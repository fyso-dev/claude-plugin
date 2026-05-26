#!/bin/bash
# Fyso Team Sync — Usage tracking hook v2.0
# Reads hook data from stdin (JSON) and sends to Fyso API
# Supports: session_start, session_end, agent_dispatch, subagent_start, subagent_stop

CONFIG="$HOME/.fyso/config.json"
[ ! -f "$CONFIG" ] && exit 0

# Resolve shared pricing source of truth (sibling opencode-plugin/src/pricing.json)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRICING_FILE="$SCRIPT_DIR/../opencode-plugin/src/pricing.json"

# Read stdin to temp file (avoids quoting issues)
TMPFILE=$(mktemp)
cat > "$TMPFILE" 2>/dev/null || true

EVENT_TYPE="${1:-session}"

# Debug: save raw stdin for inspection (mirrors _tracking_lib.is_debug/debug_log
# but kept in bash so the cp + size measurement stay outside Python).
if [ -f "$HOME/.fyso/debug" ]; then
  echo "=== $(date -u) === EVENT=$EVENT_TYPE ===" >> "$HOME/.fyso/hook-debug.log"
  cp "$TMPFILE" "$HOME/.fyso/last-hook-stdin-${EVENT_TYPE}.json" 2>/dev/null
  echo "TMPFILE=$TMPFILE size=$(wc -c < "$TMPFILE")" >> "$HOME/.fyso/hook-debug.log"
  echo "STDIN_CONTENT=$(cat "$TMPFILE")" >> "$HOME/.fyso/hook-debug.log"
fi

# Single python call: read config + parse stdin + build payload + send
export TMPFILE EVENT_TYPE PRICING_FILE FYSO_HOOKS_DIR="$SCRIPT_DIR"
python3 << 'PYEOF'
import json, datetime, os, sys, getpass, hashlib, subprocess

# Import shared tracking library (single source of truth for config/team/
# transcript parsing/model family/HTTP send/debug logging).
sys.path.insert(0, os.environ.get("FYSO_HOOKS_DIR", os.path.dirname(os.path.abspath(__file__))))
try:
    from _tracking_lib import (
        load_pricing,
        infer_model_family,
        calculate_cost,
        parse_transcript_usage,
        summarize_transcript_lines,
        load_config,
        load_team_name,
        find_usage_limit_text,
        get_claude_account,
        should_skip_limit_hit,
        mark_limit_hit,
        extract_limit_reset_at,
        USAGE_LIMIT_KEYWORDS,
        utc_iso,
        debug_log,
        send_tracking_payload,
    )
except Exception:
    sys.exit(0)

cfg = load_config()
if not cfg:
    sys.exit(0)

token = cfg.get("token", "")
tenant = cfg.get("tenant_id", "")
api_url = cfg.get("api_url", "https://api.fyso.dev")
user_email = cfg.get("user_email", "")

if not token or not tenant:
    sys.exit(0)

# Load shared pricing source of truth (PRICING table + default_family)
_PRICING, DEFAULT_FAMILY = load_pricing()

# Read stdin JSON from temp file (once)
tmpfile = os.environ.get("TMPFILE", "")
hook = {}
if tmpfile and os.path.exists(tmpfile):
    try:
        with open(tmpfile) as f:
            content = f.read().strip()
        if content:
            hook = json.loads(content)
    except:
        pass
    finally:
        try:
            os.unlink(tmpfile)
        except:
            pass

# Team info from local .fyso/team.json (per project directory)
hook_cwd = hook.get("cwd", os.getcwd())
team_name = load_team_name(hook_cwd)

event_type = os.environ.get("EVENT_TYPE", "session")
limit_reset_at = None
mark_limit_after_send = False

# Session ID
session_id = hook.get("session_id", "")
if not session_id:
    key = f"{os.getppid()}-{datetime.date.today().isoformat()}"
    session_id = hashlib.md5(key.encode()).hexdigest()[:12]

# Tool info
tool_name = hook.get("tool_name", "")
tool_input = hook.get("tool_input", {}) or {}
tool_response = hook.get("tool_response", {}) or {}

# Agent name from input
agent = ""
if isinstance(tool_input, dict):
    agent = tool_input.get("subagent_type", "") or tool_input.get("name", "") or ""

# Action detail from input description
detail = ""
if isinstance(tool_input, dict):
    detail = tool_input.get("description", "") or tool_input.get("prompt", "")
    if isinstance(detail, str) and len(detail) > 200:
        detail = detail[:200] + "..."
if event_type == "session_start":
    detail = "session start"

# Token breakdown: extract individual token types from tool_response
input_tokens = 0
output_tokens = 0
cache_creation_tokens = 0
cache_read_tokens = 0
model = ""
message_id = ""

if isinstance(tool_response, dict):
    usage = tool_response.get("usage", {})
    if isinstance(usage, dict):
        input_tokens = usage.get("input_tokens", 0) or 0
        output_tokens = usage.get("output_tokens", 0) or 0
        cache_creation_tokens = usage.get("cache_creation_input_tokens", 0) or 0
        cache_read_tokens = usage.get("cache_read_input_tokens", 0) or 0
    # Fallback to totalTokens if no breakdown
    if not (input_tokens or output_tokens):
        total = tool_response.get("totalTokens", 0) or 0
        if total:
            output_tokens = total  # conservative: attribute to output

tokens = input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens

# Message ID for deduplication
if isinstance(tool_response, dict):
    message_id = tool_response.get("id", "") or tool_response.get("requestId", "") or ""
if not message_id and isinstance(hook, dict):
    message_id = hook.get("requestId", "") or ""

# Single-pass transcript read: shared lib accumulates session usage and last-seen model.
# Only retain raw lines when the caller will run a second pass.
transcript_path = hook.get("transcript_path", "")
_needs_summary = event_type in ("session_end", "session_update", "usage_limit_check", "stop_failure")
_t = parse_transcript_usage(transcript_path, retain_lines=_needs_summary)
session_input = _t["input"]
session_output = _t["output"]
session_cache_creation = _t["cache_creation"]
session_cache_read = _t["cache_read"]
session_tokens = session_input + session_output + session_cache_creation + session_cache_read
if _t["model"]:
    model = _t["model"]
_summary = ""
_tools_used = []
_last_text = ""

# Per-script summary pass (only for session_end/session_update) — wider dedup
# window (5) and stricter text threshold (10) than heartbeat.sh.
if _needs_summary:
    _tools_used, _last_text = summarize_transcript_lines(
        _t["lines"],
        tools_dedup_window=5,
        text_threshold=10,
    )

if transcript_path:
    debug_log(
        f"TRANSCRIPT: path={transcript_path} lines={_t['line_count']} "
        f"usage_entries={_t['usage_count']} model_entries={_t['model_count']} "
        f"model={model} session_tokens={session_tokens}\n"
    )

# When Claude reports a usage limit after the user closes the terminal, the
# next session is the first chance to notice the synthetic transcript entry.
if event_type == "session_start":
    transcript_dir = os.path.dirname(transcript_path) if transcript_path else ""
    script_path = os.path.join(os.environ.get("FYSO_HOOKS_DIR", SCRIPT_DIR if "SCRIPT_DIR" in globals() else ""), "check-prev-limit.py")
    if transcript_dir and os.path.exists(script_path):
        params_path = f"/tmp/fyso-prev-limit-{session_id}.json"
        try:
            with open(params_path, "w") as params_file:
                json.dump(
                    {
                        "transcript_dir": transcript_dir,
                        "session_id": session_id,
                        "api_url": api_url,
                        "token": token,
                        "tenant": tenant,
                        "user_email": user_email,
                        "cwd": hook.get("cwd", os.getcwd()),
                    },
                    params_file,
                )
            env = dict(os.environ)
            env["FYSO_PREV_LIMIT_PARAMS"] = params_path
            subprocess.Popen(
                [sys.executable, script_path],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                env=env,
            )
            debug_log("PREV_LIMIT: background check launched\n")
        except Exception as exc:
            debug_log(f"PREV_LIMIT: launch error {exc}\n")

# Fallback: default to opus (Claude Code default model)
if not model:
    model = "claude-opus-4-6"

# User and active Claude account
user = user_email or getpass.getuser()
claude_account = get_claude_account()

def send_limit_hit(detail, reset_at=None):
    if should_skip_limit_hit(session_id):
        debug_log(f"LIMIT_HIT: skip duplicate session={session_id[:8]}\n")
        return
    payload_data = {
        "event": "usage_limit_hit",
        "detail": detail,
        "limit_reset_at": reset_at,
        "team_name": team_name or None,
        "user": user or None,
        "claude_account": claude_account or None,
        "session_id": session_id or None,
        "model": model if model != "<synthetic>" else "claude-opus-4-6",
        "model_family": infer_model_family(model if model != "<synthetic>" else "claude-opus-4-6", DEFAULT_FAMILY),
        "tokens": 0,
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_creation_tokens": 0,
        "cache_read_tokens": 0,
        "session_tokens": session_tokens,
        "session_input_tokens": session_input,
        "session_output_tokens": session_output,
        "session_cache_creation_tokens": session_cache_creation,
        "session_cache_read_tokens": session_cache_read,
        "cwd": hook.get("cwd", os.getcwd()) or None,
        "timestamp": utc_iso(),
    }
    payload_data = {k: v for k, v in payload_data.items() if v is not None}
    try:
        status, body = send_tracking_payload(api_url, token, tenant, json.dumps(payload_data).encode())
        mark_limit_hit(session_id)
        debug_log(f"LIMIT_HIT: sent {status} {body[:200]}\n")
    except Exception as exc:
        debug_log(f"LIMIT_HIT: error {exc}\n")

if event_type == "stop_failure":
    error_type = hook.get("error_type", "")
    error_message = hook.get("error_message", "") or hook.get("error", "")
    last_message = hook.get("last_assistant_message", "")
    _limit_text, _reset_at = find_usage_limit_text(_t["lines"], tail=50)
    combined = f"{error_type} {error_message} {last_message}".lower()
    if not _limit_text and not any(keyword in combined for keyword in USAGE_LIMIT_KEYWORDS):
        sys.exit(0)
    if not _reset_at:
        _reset_at = extract_limit_reset_at(last_message)
    send_limit_hit(
        f"stop_failure: {error_type}" + (f" - {str(error_message)[:100]}" if error_message else ""),
        _reset_at,
    )
    sys.exit(0)

if event_type == "usage_limit_check":
    _limit_text, _reset_at = find_usage_limit_text(_t["lines"], tail=50)
    if _limit_text:
        send_limit_hit("usage limit detected", _reset_at)
    sys.exit(0)

if event_type == "session_update":
    _limit_text, _reset_at = find_usage_limit_text(_t["lines"], tail=50)
    if _limit_text and not should_skip_limit_hit(session_id):
        event_type = "usage_limit_hit"
        detail = "usage limit detected"
        limit_reset_at = _reset_at
        mark_limit_after_send = True

if event_type == "agent_dispatch":
    if isinstance(tool_response, dict) and tool_response.get("type") == "error":
        err_type = (tool_response.get("error") or {}).get("type", "")
        if err_type == "rate_limit_error":
            event_type = "rate_limit_hit"
        elif err_type == "overloaded_error":
            event_type = "overloaded_hit"

# Build detail for session_end/session_update
if event_type in ("session_end", "session_update", "usage_limit_hit"):
    if not (event_type == "usage_limit_hit" and detail):
        if _last_text:
            _summary = _last_text.split("\n")[0][:120]
        elif _tools_used:
            _summary = "Used: " + ", ".join(_tools_used[-5:])
        detail = _summary if _summary else "session update"
    # For session events, clear per-event tokens (session-level is what matters)
    tokens = 0
    input_tokens = 0
    output_tokens = 0
    cache_creation_tokens = 0
    cache_read_tokens = 0

# Model family (for business rule cost calculation server-side) — shared logic
model_family = infer_model_family(model, DEFAULT_FAMILY)
cost_usd = calculate_cost(
    model_family,
    input_tokens,
    output_tokens,
    cache_creation_tokens,
    cache_read_tokens,
    _PRICING,
)
session_cost_usd = calculate_cost(
    model_family,
    session_input,
    session_output,
    session_cache_creation,
    session_cache_read,
    _PRICING,
)

# Build payload
data = {
    "event": event_type,
    "tool": tool_name or None,
    "agent": agent or None,
    "detail": detail or None,
    "limit_reset_at": limit_reset_at,
    "team_name": team_name or None,
    "user": user or None,
    "claude_account": claude_account or None,
    "session_id": session_id or None,
    "model": model or None,
    "model_family": model_family or None,
    "message_id": message_id or None,
    "tokens": tokens,
    "input_tokens": input_tokens,
    "output_tokens": output_tokens,
    "cache_creation_tokens": cache_creation_tokens,
    "cache_read_tokens": cache_read_tokens,
    "session_tokens": session_tokens,
    "session_input_tokens": session_input,
    "session_output_tokens": session_output,
    "session_cache_creation_tokens": session_cache_creation,
    "session_cache_read_tokens": session_cache_read,
    "cost_usd": round(session_cost_usd if event_type in ("session_end", "session_update", "usage_limit_hit") else cost_usd, 6),
    "session_cost_usd": round(session_cost_usd, 6) if event_type in ("session_end", "session_update", "usage_limit_hit") and session_cost_usd > 0 else None,
    "cwd": hook.get("cwd", os.getcwd()) or None,
    "timestamp": utc_iso(),
}
data = {k: v for k, v in data.items() if v is not None}
payload = json.dumps(data).encode()

debug_log(f"PAYLOAD: {payload.decode()}\n")

try:
    status, body = send_tracking_payload(api_url, token, tenant, payload)
    if mark_limit_after_send:
        mark_limit_hit(session_id)
    debug_log(f"RESPONSE: {status} {body[:200]}\n\n")
except Exception as e:
    debug_log(f"ERROR: {e}\n\n")
PYEOF

# Cleanup
rm -f "$TMPFILE" 2>/dev/null
exit 0
