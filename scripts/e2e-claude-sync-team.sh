#!/usr/bin/env bash
set -euo pipefail

TEAM_NAME="${FYSO_E2E_TEAM_NAME:-E2E-FYSO-PLUGIN}"
AGENT_BUILDER="${FYSO_E2E_AGENT_BUILDER:-e2e_builder}"
AGENT_VERIFIER="${FYSO_E2E_AGENT_VERIFIER:-e2e_verifier}"
SKILL_NAME="${FYSO_E2E_SKILL_NAME:-e2e_sync_check}"
PROMPT_MARKER="FYSO_PLUGIN_E2E_PROMPT"
SKILL_MARKER="FYSO_PLUGIN_E2E_SKILL"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE="${FYSO_E2E_WORKSPACE:-$(mktemp -d "/tmp/fyso-plugin-e2e-XXXXXX")}"
CLAUDE_BIN="${CLAUDE_BIN:-claude}"
CONFIG_PATH="${FYSO_CONFIG_PATH:-$HOME/.fyso/config.json}"
DEBUG_LOG="$HOME/.fyso/hook-debug.log"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
CONFIG_BACKUP="$WORKSPACE/fyso-config-before-e2e.json"

export TEAM_NAME AGENT_BUILDER AGENT_VERIFIER SKILL_NAME PROMPT_MARKER SKILL_MARKER
export REPO_ROOT WORKSPACE CONFIG_PATH RUN_ID

log() {
  printf '[fyso-e2e] %s\n' "$*"
}

redact() {
  sed -E \
    -e 's/Bearer [A-Za-z0-9._-]+/Bearer ***REDACTED***/g' \
    -e 's/"token"[[:space:]]*:[[:space:]]*"[^"]+"/"token": "***REDACTED***"/g' \
    -e 's/(Authorization: )[A-Za-z0-9._-]+/\1***REDACTED***/g'
}

fail() {
  printf '\n[fyso-e2e] FAILED: %s\n' "$*" >&2
  printf '[fyso-e2e] repo: %s\n' "$REPO_ROOT" >&2
  printf '[fyso-e2e] workspace: %s\n' "$WORKSPACE" >&2
  if [ -f "$WORKSPACE/claude-sync-run-1.jsonl" ]; then
    printf '\n[fyso-e2e] last Claude sync output:\n' >&2
    tail -n 40 "$WORKSPACE/claude-sync-run-1.jsonl" | redact >&2 || true
  fi
  if [ -f "$WORKSPACE/claude-runtime-preflight.json" ]; then
    printf '\n[fyso-e2e] Claude runtime preflight output:\n' >&2
    tail -n 80 "$WORKSPACE/claude-runtime-preflight.json" | redact >&2 || true
  fi
  if [ -f "$WORKSPACE/hook-debug-new.log" ]; then
    printf '\n[fyso-e2e] hook debug tail:\n' >&2
    tail -n 80 "$WORKSPACE/hook-debug-new.log" | redact >&2 || true
  fi
  exit 1
}

backup_fyso_config() {
  [ -f "$CONFIG_PATH" ] || fail "missing Fyso config at $CONFIG_PATH"
  cp "$CONFIG_PATH" "$CONFIG_BACKUP"
}

restore_fyso_config() {
  if [ -f "$CONFIG_BACKUP" ]; then
    cp "$CONFIG_BACKUP" "$CONFIG_PATH"
  fi
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing command: $1"
}

run_preflight() {
  log "preflight"
  require_cmd "$CLAUDE_BIN"
  require_cmd python3
  require_cmd npm
  [ -f "$CONFIG_PATH" ] || fail "missing Fyso config at $CONFIG_PATH"

  validate_fyso_auth || return 1
  "$CLAUDE_BIN" --version || return 1
  validate_claude_runtime || return 1
  python3 -m py_compile "$REPO_ROOT/hooks/_tracking_lib.py" "$REPO_ROOT/hooks/check-prev-limit.py" || return 1
  python3 -m json.tool "$REPO_ROOT/hooks/hooks.json" >/dev/null || return 1
  bash -n "$REPO_ROOT/hooks/tracking.sh" || return 1
  bash -n "$REPO_ROOT/hooks/heartbeat.sh" || return 1
  bash -n "$REPO_ROOT/hooks/check-team-updates.sh" || return 1
  npm --prefix "$REPO_ROOT/opencode-plugin" test || return 1
}

validate_claude_runtime() {
  local output="$WORKSPACE/claude-runtime-preflight.json"
  local exit_code=0
  (
    cd "$WORKSPACE"
    "$CLAUDE_BIN" \
      --output-format json \
      --verbose \
      -p "Responde exactamente OK-FYSO-CLAUDE-RUNTIME."
  ) >"$output" 2>&1 || exit_code=$?

  python3 - "$output" <<'PYEOF'
import json
import sys

path = sys.argv[1]
raw = open(path, errors="replace").read()
if "oauth_org_not_allowed" in raw or "Not logged in" in raw or "authentication_failed" in raw:
    raise SystemExit(
        "Claude runtime preflight failed. Use a working Claude Code CLI session "
        "or set ANTHROPIC_API_KEY/CLAUDE_BIN for this shell."
    )

try:
    data = json.loads(raw)
except Exception:
    data = None

if isinstance(data, dict):
    if data.get("is_error"):
        raise SystemExit(f"Claude runtime preflight returned error: {data.get('result')}")
    if "OK-FYSO-CLAUDE-RUNTIME" not in str(data.get("result", "")):
        raise SystemExit(f"Claude runtime preflight returned unexpected result: {data}")
elif "OK-FYSO-CLAUDE-RUNTIME" not in raw:
    raise SystemExit("Claude runtime preflight did not return the expected marker")
PYEOF
  [ "$exit_code" -eq 0 ]
}

validate_fyso_auth() {
  python3 <<'PYEOF'
import json
import os
import urllib.request
import urllib.error

cfg = json.load(open(os.environ["CONFIG_PATH"]))
api_url = cfg.get("api_url", "https://api.fyso.dev").rstrip("/")
token = cfg.get("token", "")
tenant = cfg.get("tenant_id", "")
if not token or not tenant:
    raise SystemExit("Fyso config must include token and tenant_id")

req = urllib.request.Request(
    f"{api_url}/api/entities/teams/records",
    headers={"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant},
    method="GET",
)
try:
    with urllib.request.urlopen(req, timeout=20) as resp:
        resp.read()
except urllib.error.HTTPError as exc:
    raw = exc.read().decode(errors="replace")
    raise SystemExit(
        f"Fyso auth preflight failed with HTTP {exc.code}: {raw[:500]}\n"
        "Refresh ~/.fyso/config.json by logging in or re-running the Fyso setup/sync flow."
    )
PYEOF
}

upsert_fixture() {
  log "upserting Fyso fixture in real tenant"
  python3 <<'PYEOF'
import json
import os
import sys
import urllib.parse
import urllib.request

cfg = json.load(open(os.environ["CONFIG_PATH"]))
api_url = cfg.get("api_url", "https://api.fyso.dev").rstrip("/")
token = cfg.get("token", "")
tenant = cfg.get("tenant_id", "")
if not token or not tenant:
    raise SystemExit("Fyso config must include token and tenant_id")

team_name = os.environ["TEAM_NAME"]
builder_name = os.environ["AGENT_BUILDER"]
verifier_name = os.environ["AGENT_VERIFIER"]
skill_name = os.environ["SKILL_NAME"]
prompt_marker = os.environ["PROMPT_MARKER"]
skill_marker = os.environ["SKILL_MARKER"]


def request(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{api_url}{path}",
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "X-Tenant-ID": tenant,
            "Content-Type": "application/json",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode(errors="replace")
        raise RuntimeError(f"{method} {path} failed with HTTP {exc.code}: {raw[:500]}")


def slugify(value):
    out = []
    for ch in value.lower():
        if ch.isalnum():
            out.append(ch)
        elif ch in {"-", "_", " "}:
            out.append("-")
    slug = "".join(out).strip("-")
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug or "fyso-e2e"


def list_records(entity):
    resp = request("GET", f"/api/entities/{entity}/records")
    return ((resp.get("data") or {}).get("items") or [])


def find_by_name(entity, name):
    for record in list_records(entity):
        if record.get("name") == name:
            return record
    return None


def update_record(entity, record_id, body):
    try:
        return request("PUT", f"/api/entities/{entity}/records/{record_id}", body)
    except RuntimeError:
        return request("PATCH", f"/api/entities/{entity}/records/{record_id}", body)


def upsert_by_name(entity, name, body):
    existing = find_by_name(entity, name)
    if existing:
        update_record(entity, existing["id"], body)
        refreshed = find_by_name(entity, name)
        return refreshed or {**existing, **body}
    resp = request("POST", f"/api/entities/{entity}/records", body)
    created = resp.get("data") or resp
    if not created.get("id"):
        refreshed = find_by_name(entity, name)
        if refreshed:
            return refreshed
        raise RuntimeError(f"create {entity}/{name} returned no id: {resp}")
    return created


def normalize_related(value):
    if isinstance(value, dict):
        return value.get("id") or value.get("_id") or value.get("value")
    return value


def relation_exists(entity, team_id, related_key, related_id):
    for record in list_records(entity):
        if normalize_related(record.get("team")) != team_id:
            continue
        if normalize_related(record.get(related_key)) == related_id:
            return True
    return False


def entity_exists(entity):
    try:
        list_records(entity)
        return True
    except RuntimeError as exc:
        if f"Entity '{entity}' not found" in str(exc):
            return False
        raise


def ensure_relation(entity, team_id, related_key, related_id):
    if not relation_exists(entity, team_id, related_key, related_id):
        request("POST", f"/api/entities/{entity}/records", {"team": team_id, related_key: related_id})


team = upsert_by_name(
    "teams",
    team_name,
    {
        "name": team_name,
        "slug": slugify(team_name),
        "description": "Idempotent e2e fixture for fyso-plugin sync-team.",
        "prompt": f"{prompt_marker}\nUse this team only for sync-team e2e validation.",
        "version": 1,
    },
)

builder = upsert_by_name(
    "agents",
    builder_name,
    {
        "name": builder_name,
        "slug": slugify(builder_name),
        "display_name": "E2E Builder",
        "role": "developer",
        "status": "active",
        "soul": "Builds the deterministic sync-team e2e fixture.",
        "system_prompt": "You are the builder agent for the fyso-plugin sync-team e2e fixture.",
    },
)
verifier = upsert_by_name(
    "agents",
    verifier_name,
    {
        "name": verifier_name,
        "slug": slugify(verifier_name),
        "display_name": "E2E Verifier",
        "role": "qa",
        "status": "active",
        "soul": "Verifies deterministic sync-team e2e output.",
        "system_prompt": "You are the verifier agent for the fyso-plugin sync-team e2e fixture.",
    },
)
supports_skills = entity_exists("skills") and entity_exists("team_skills")
skill = None
if supports_skills:
    skill = upsert_by_name(
        "skills",
        skill_name,
        {
            "name": skill_name,
            "slug": slugify(skill_name),
            "description": "Idempotent sync-team e2e skill.",
            "content": f"# E2E Sync Check\n\n{skill_marker}\n\nThis skill validates fyso-plugin sync-team output.",
        },
    )

ensure_relation("team_agents", team["id"], "agent", builder["id"])
ensure_relation("team_agents", team["id"], "agent", verifier["id"])
if supports_skills and skill:
    ensure_relation("team_skills", team["id"], "skill", skill["id"])

fixture = {
    "team": {"id": team["id"], "name": team.get("name", team_name), "version": team.get("version", 1)},
    "agents": [builder["id"], verifier["id"]],
    "supports_skills": supports_skills,
    "skill": skill["id"] if skill else None,
}
with open(os.path.join(os.environ["WORKSPACE"], "fixture.json"), "w") as handle:
    json.dump(fixture, handle, indent=2)
print(json.dumps(fixture, indent=2))
PYEOF
}

run_claude_sync() {
  local run_name="$1"
  local output="$WORKSPACE/claude-sync-${run_name}.jsonl"
  log "running Claude Code sync-team ($run_name)"
  restore_fyso_config
  (
    cd "$WORKSPACE"
    "$CLAUDE_BIN" \
      --plugin-dir "$REPO_ROOT" \
      --permission-mode bypassPermissions \
      --include-hook-events \
      --output-format stream-json \
      --verbose \
      --debug hooks \
      -p "Usa /fyso:sync-team. Reutiliza las credenciales guardadas en ~/.fyso/config.json, pero no modifiques, no escribas y no recrees ~/.fyso/config.json. Selecciona exactamente el team ${TEAM_NAME}. Sincroniza el equipo y no hagas otros cambios. Si necesitas elegir de una lista, elige ${TEAM_NAME}."
  ) >"$output" 2>&1 || {
    restore_fyso_config
    fail "Claude sync-team run failed: $run_name"
  }
  restore_fyso_config
}

snapshot_workspace() {
  local output="$1"
  python3 - "$WORKSPACE" >"$output" <<'PYEOF'
import hashlib
import json
import os
import sys

root = sys.argv[1]
items = {}
for dirpath, _, filenames in os.walk(root):
    for filename in filenames:
        path = os.path.join(dirpath, filename)
        rel = os.path.relpath(path, root)
        if rel.startswith("claude-sync-") or rel in {
            "fixture.json",
            "snapshot-1.json",
            "snapshot-2.json",
            "hook-debug-new.log",
            "claude-runtime-preflight.json",
            "claude-version-check.jsonl",
            "fyso-config-before-e2e.json",
        }:
            continue
        with open(path, "rb") as handle:
            data = handle.read()
        if rel == ".fyso/team.json":
            parsed = json.loads(data.decode())
            parsed["synced_at"] = "<ignored>"
            data = json.dumps(parsed, sort_keys=True).encode()
        items[rel] = hashlib.sha256(data).hexdigest()
print(json.dumps(items, sort_keys=True, indent=2))
PYEOF
}

validate_workspace() {
  log "validating synced workspace"
  python3 - "$WORKSPACE" <<'PYEOF'
import json
import os
import sys

root = sys.argv[1]
team_name = os.environ["TEAM_NAME"]
builder_name = os.environ["AGENT_BUILDER"]
verifier_name = os.environ["AGENT_VERIFIER"]
skill_name = os.environ["SKILL_NAME"]
prompt_marker = os.environ["PROMPT_MARKER"]
skill_marker = os.environ["SKILL_MARKER"]
fixture = json.load(open(os.path.join(root, "fixture.json")))
supports_skills = bool(fixture.get("supports_skills"))
paths = [
    ".fyso/team.json",
    f".claude/agents/{builder_name}.md",
    f".claude/agents/{verifier_name}.md",
    f".opencode/agents/{builder_name}.md",
    f".opencode/agents/{verifier_name}.md",
    ".claude/CLAUDE.md",
    "opencode.md",
]
if supports_skills:
    paths.extend([
        f".claude/skills/{skill_name}.md",
        f".opencode/skills/{skill_name}.md",
    ])
missing = [path for path in paths if not os.path.exists(os.path.join(root, path))]
if missing:
    raise SystemExit(f"missing expected files: {missing}")

team = json.load(open(os.path.join(root, ".fyso/team.json")))
if team.get("team_name") != team_name or not team.get("team_id") or "version" not in team or not team.get("synced_at"):
    raise SystemExit(f"invalid .fyso/team.json: {team}")
if isinstance(team.get("version"), str):
    raise SystemExit(f".fyso/team.json version must be numeric, got string: {team}")

for rel in [".claude/CLAUDE.md", "opencode.md"]:
    text = open(os.path.join(root, rel)).read()
    if prompt_marker not in text:
        raise SystemExit(f"{rel} does not contain {prompt_marker}")

if supports_skills:
    for rel in [f".claude/skills/{skill_name}.md", f".opencode/skills/{skill_name}.md"]:
        text = open(os.path.join(root, rel)).read()
        if skill_marker not in text:
            raise SystemExit(f"{rel} does not contain {skill_marker}")

for rel in paths:
    text = open(os.path.join(root, rel), errors="ignore").read()
    if "Etendo" in text or "etendo" in text:
        raise SystemExit(f"unexpected Etendo reference in {rel}")
PYEOF
}

validate_idempotency() {
  log "validating idempotency"
  python3 - "$WORKSPACE/snapshot-1.json" "$WORKSPACE/snapshot-2.json" <<'PYEOF'
import json
import sys

first = json.load(open(sys.argv[1]))
second = json.load(open(sys.argv[2]))
if first != second:
    first_keys = set(first)
    second_keys = set(second)
    raise SystemExit(
        "workspace changed after second sync: "
        f"added={sorted(second_keys-first_keys)} removed={sorted(first_keys-second_keys)} "
        f"changed={sorted(k for k in first_keys & second_keys if first[k] != second[k])}"
    )
PYEOF
}

validate_hook_debug() {
  log "validating hook debug output"
  local initial_size="$1"
  if [ ! -f "$DEBUG_LOG" ]; then
    fail "hook debug log was not created"
  fi
  tail -c +"$((initial_size + 1))" "$DEBUG_LOG" >"$WORKSPACE/hook-debug-new.log" || true
  python3 - "$WORKSPACE/hook-debug-new.log" "$WORKSPACE" <<'PYEOF'
import re
import sys

log_path, workspace = sys.argv[1], sys.argv[2]
text = open(log_path, errors="replace").read()
required = [
    '"event": "session_start"',
    '"event": "session_update"',
    '"claude_account"',
    f'"cwd": "{workspace}"',
]
missing = [item for item in required if item not in text]
if missing:
    raise SystemExit(f"hook debug missing expected markers: {missing}")
if not re.search(r'"timestamp": "[^"]+Z"', text):
    raise SystemExit("hook debug missing Z timestamp")
PYEOF
}

validate_tracking_api() {
  log "validating tracking records through Fyso API"
  python3 - "$WORKSPACE" <<'PYEOF'
import json
import os
import sys
import urllib.parse
import urllib.request

root = sys.argv[1]
cfg = json.load(open(os.environ["CONFIG_PATH"]))
api_url = cfg.get("api_url", "https://api.fyso.dev").rstrip("/")
token = cfg["token"]
tenant = cfg["tenant_id"]

def request(path):
    req = urllib.request.Request(
        f"{api_url}{path}",
        headers={"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode())

params = urllib.parse.urlencode({"filter.cwd": root})
resp = request(f"/api/entities/tracking/records?{params}")
items = ((resp.get("data") or {}).get("items") or [])
events = {item.get("event") for item in items}
if not {"session_start", "session_update"}.issubset(events):
    raise SystemExit(f"tracking records not found for cwd={root}: events={sorted(events)}")
PYEOF
}

validate_version_check() {
  log "validating team auto-sync on session start"
  python3 - "$WORKSPACE/.fyso/team.json" <<'PYEOF'
import json
import sys

path = sys.argv[1]
data = json.load(open(path))
data["version"] = 0
with open(path, "w") as handle:
    json.dump(data, handle, indent=2)
PYEOF

  local output="$WORKSPACE/claude-version-check.jsonl"
  (
    cd "$WORKSPACE"
    restore_fyso_config
    "$CLAUDE_BIN" \
      --plugin-dir "$REPO_ROOT" \
      --permission-mode bypassPermissions \
      --include-hook-events \
      --output-format stream-json \
      --verbose \
      --debug hooks \
      -p "Responde exactamente OK-FYSO-VERSION-CHECK."
  ) >"$output" 2>&1 || {
    restore_fyso_config
    fail "Claude version check run failed"
  }
  restore_fyso_config

  python3 - "$WORKSPACE/.fyso/team.json" "$output" <<'PYEOF'
import json
import sys

team_path, output_path = sys.argv[1:3]
team = json.load(open(team_path, encoding="utf-8"))
if int(team.get("version") or 0) <= 0:
    raise SystemExit(f"team auto-sync did not update local version: {team}")

output = open(output_path, encoding="utf-8", errors="replace").read()
if "actualizado automaticamente" not in output and "actualizado automáticamente" not in output:
    raise SystemExit("team auto-sync message was not observed in Claude output")
PYEOF
}

main() {
  mkdir -p "$WORKSPACE"
  WORKSPACE="$(cd "$WORKSPACE" && pwd -P)"
  CONFIG_BACKUP="$WORKSPACE/fyso-config-before-e2e.json"
  export WORKSPACE CONFIG_BACKUP
  mkdir -p "$HOME/.fyso"
  touch "$HOME/.fyso/debug"
  backup_fyso_config
  trap restore_fyso_config EXIT
  local initial_size=0
  [ -f "$DEBUG_LOG" ] && initial_size="$(wc -c <"$DEBUG_LOG" | tr -d ' ')"

  log "repo: $REPO_ROOT"
  log "workspace: $WORKSPACE"
  run_preflight || fail "preflight failed"
  upsert_fixture || fail "fixture upsert failed"
  run_claude_sync "run-1"
  validate_workspace || fail "workspace validation failed after first sync"
  snapshot_workspace "$WORKSPACE/snapshot-1.json"
  run_claude_sync "run-2"
  validate_workspace || fail "workspace validation failed after second sync"
  snapshot_workspace "$WORKSPACE/snapshot-2.json"
  validate_idempotency || fail "idempotency validation failed"
  validate_hook_debug "$initial_size" || fail "hook debug validation failed"
  validate_tracking_api || fail "tracking API validation failed"
  validate_version_check || fail "version check validation failed"
  log "PASS"
}

main "$@"
