#!/usr/bin/env bash
set -euo pipefail

TEAM_ID="${FYSO_E2E_TEAM_ID:-67e05809-6332-4bc8-bf6d-9d8eae1b4aa2}"
TEAM_NAME="${FYSO_E2E_TEAM_NAME:-E2E-FYSO-PLUGIN}"
PROMPT_MARKER="FYSO_PLUGIN_E2E_PROMPT"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE="${FYSO_E2E_WORKSPACE:-$(mktemp -d "/tmp/fyso-opencode-cli-e2e-XXXXXX")}"
OPENCODE_BIN="${OPENCODE_BIN:-opencode}"
CONFIG_PATH="${FYSO_CONFIG_PATH:-$HOME/.fyso/config.json}"

export TEAM_ID TEAM_NAME PROMPT_MARKER REPO_ROOT WORKSPACE CONFIG_PATH

log() {
  printf '[fyso-opencode-e2e] %s\n' "$*"
}

fail() {
  printf '\n[fyso-opencode-e2e] FAILED: %s\n' "$*" >&2
  printf '[fyso-opencode-e2e] repo: %s\n' "$REPO_ROOT" >&2
  printf '[fyso-opencode-e2e] workspace: %s\n' "$WORKSPACE" >&2
  if [ -f "$WORKSPACE/opencode-run-1.jsonl" ]; then
    printf '\n[fyso-opencode-e2e] run-1 tail:\n' >&2
    tail -n 80 "$WORKSPACE/opencode-run-1.jsonl" >&2 || true
  fi
  if [ -f "$WORKSPACE/opencode-run-2.jsonl" ]; then
    printf '\n[fyso-opencode-e2e] run-2 tail:\n' >&2
    tail -n 80 "$WORKSPACE/opencode-run-2.jsonl" >&2 || true
  fi
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing command: $1"
}

run_preflight() {
  log "preflight"
  require_cmd "$OPENCODE_BIN"
  require_cmd python3
  require_cmd npm
  [ -f "$CONFIG_PATH" ] || fail "missing Fyso config at $CONFIG_PATH"
  "$OPENCODE_BIN" --version || return 1
  npm --prefix "$REPO_ROOT/opencode-plugin" test || return 1
}

write_opencode_config() {
  python3 <<'PYEOF'
import json
import os

workspace = os.environ["WORKSPACE"]
repo_root = os.environ["REPO_ROOT"]
config = {
    "$schema": "https://opencode.ai/config.json",
    "plugin": [f"file://{repo_root}/opencode-plugin"],
    "permission": {"edit": "allow", "bash": "allow"},
}
with open(os.path.join(workspace, "opencode.json"), "w", encoding="utf-8") as handle:
    json.dump(config, handle, indent=2)
    handle.write("\n")
PYEOF
}

run_opencode_sync() {
  local run_name="$1"
  local prompt="$2"
  local output="$WORKSPACE/opencode-${run_name}.jsonl"
  log "running OpenCode sync-team (${run_name})"
  (
    cd "$WORKSPACE"
    OPENCODE_DISABLE_AUTOUPDATE=1 "$OPENCODE_BIN" run \
      --dir "$WORKSPACE" \
      --dangerously-skip-permissions \
      --format json \
      "$prompt"
  ) | tee "$output"
}

lower_team_version() {
  python3 <<'PYEOF'
import json
import os

path = os.path.join(os.environ["WORKSPACE"], ".fyso", "team.json")
data = json.load(open(path, encoding="utf-8"))
data["version"] = 0
with open(path, "w", encoding="utf-8") as handle:
    json.dump(data, handle, indent=2)
    handle.write("\n")
PYEOF
}

snapshot_workspace() {
  local output="$1"
  python3 - "$output" <<'PYEOF'
import hashlib
import json
import os
import sys

root = os.environ["WORKSPACE"]
include_prefixes = (".fyso/", ".claude/", ".opencode/agents/")
include_exact = {"opencode.md"}
paths = []
for base, _dirs, files in os.walk(root):
    for file_name in files:
        rel = os.path.relpath(os.path.join(base, file_name), root)
        if rel in include_exact or rel.startswith(include_prefixes):
            paths.append(rel)
paths.sort()

def body(rel):
    text = open(os.path.join(root, rel), encoding="utf-8").read()
    if rel == ".fyso/team.json":
        parsed = json.loads(text)
        parsed["synced_at"] = "<ignored>"
        text = json.dumps(parsed, sort_keys=True)
    return text

payload = {
    "paths": paths,
    "hashes": {rel: hashlib.sha256(body(rel).encode()).hexdigest() for rel in paths},
}
with open(sys.argv[1], "w", encoding="utf-8") as handle:
    json.dump(payload, handle, indent=2)
PYEOF
}

validate_workspace() {
  python3 <<'PYEOF'
import json
import os
import re

root = os.environ["WORKSPACE"]
team_name = os.environ["TEAM_NAME"]
prompt_marker = os.environ["PROMPT_MARKER"]
required = [
    ".fyso/team.json",
    ".claude/agents/e2e_builder.md",
    ".claude/agents/e2e_verifier.md",
    ".opencode/agents/e2e_builder.md",
    ".opencode/agents/e2e_verifier.md",
    ".claude/CLAUDE.md",
    "opencode.md",
]
for rel in required:
    if not os.path.exists(os.path.join(root, rel)):
        raise SystemExit(f"missing {rel}")

team = json.load(open(os.path.join(root, ".fyso/team.json"), encoding="utf-8"))
if team.get("team_name") != team_name:
    raise SystemExit(f"unexpected team_name: {team}")

for rel in [".claude/CLAUDE.md", "opencode.md"]:
    text = open(os.path.join(root, rel), encoding="utf-8").read()
    if prompt_marker not in text:
        raise SystemExit(f"missing prompt marker in {rel}")

for rel in required:
    text = open(os.path.join(root, rel), encoding="utf-8").read()
    if re.search("etendo", text, re.I):
        raise SystemExit(f"Etendo reference found in {rel}")
    if rel.startswith(".opencode/agents/") and not re.search(
        r'color: "(success|warning|accent|info|error|secondary|primary)"', text
    ):
        raise SystemExit(f"invalid OpenCode color in {rel}")
PYEOF
}

validate_idempotency() {
  python3 <<'PYEOF'
import json
import os

before = json.load(open(os.path.join(os.environ["WORKSPACE"], "snapshot-before.json"), encoding="utf-8"))
after = json.load(open(os.path.join(os.environ["WORKSPACE"], "snapshot-after.json"), encoding="utf-8"))
if before["paths"] != after["paths"]:
    raise SystemExit(json.dumps({"paths_changed": {"before": before["paths"], "after": after["paths"]}}, indent=2))
if before["hashes"] != after["hashes"]:
    changed = [path for path in after["paths"] if before["hashes"].get(path) != after["hashes"].get(path)]
    raise SystemExit(json.dumps({"hashes_changed": changed}, indent=2))
PYEOF
}

validate_tracking() {
  log "validating OpenCode tracking source"
  python3 <<'PYEOF'
import json
import os
import time
import urllib.request

time.sleep(1)
cfg = json.load(open(os.environ["CONFIG_PATH"], encoding="utf-8"))
api_url = cfg.get("api_url", "https://api.fyso.dev/api").rstrip("/")
token = cfg.get("token", "")
tenant = cfg.get("tenant_id", "")
workspace = os.environ["WORKSPACE"]
roots = {workspace, workspace.replace("/tmp/", "/private/tmp/")}

req = urllib.request.Request(
    f"{api_url}/api/entities/tracking/records?limit=100&page=1&resolve=true&sort=timestamp&order=desc",
    headers={"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant, "Accept": "application/json"},
)
with urllib.request.urlopen(req, timeout=30) as resp:
    rows = ((json.load(resp).get("data") or {}).get("items") or [])

items = []
for record in rows:
    row = record.get("data") if isinstance(record.get("data"), dict) else record
    if row.get("cwd") in roots:
        items.append(row)

if not items:
    raise SystemExit("no tracking records found for OpenCode smoke workspace")

bad_source = [
    {"event": item.get("event"), "source": item.get("source"), "tool": item.get("tool"), "session_id": item.get("session_id")}
    for item in items
    if item.get("source") != "opencode"
]
if bad_source:
    raise SystemExit("tracking records without source=opencode: " + json.dumps(bad_source, indent=2))

if not any(item.get("event") == "session_start" and item.get("session_id") for item in items):
    raise SystemExit("missing OpenCode session_start tracking record")

if not any(
    item.get("event") == "agent_dispatch"
    and item.get("tool") == "fyso-sync-team"
    and item.get("session_id")
    and item.get("team_name") == os.environ["TEAM_NAME"]
    for item in items
):
    raise SystemExit("missing OpenCode fyso-sync-team agent_dispatch tracking record")

if not any(
    item.get("event") == "agent_dispatch"
    and item.get("tool") == "fyso-auto-sync-team"
    and item.get("session_id")
    and item.get("team_name") == os.environ["TEAM_NAME"]
    for item in items
):
    raise SystemExit("missing OpenCode fyso-auto-sync-team agent_dispatch tracking record")

bad_model = [
    {"event": item.get("event"), "model": item.get("model"), "session_id": item.get("session_id")}
    for item in items
    if str(item.get("model") or "").startswith("claude-opus")
    or str(item.get("model") or "").startswith(("msg_", "prt_", "call_"))
]
if bad_model:
    raise SystemExit("OpenCode tracking used invalid/fallback model: " + json.dumps(bad_model, indent=2))

usage_records = [
    item
    for item in items
    if item.get("event") in {"session_update", "heartbeat"} and int(item.get("session_tokens") or 0) > 0
]
if not usage_records:
    raise SystemExit("missing OpenCode usage tracking with nonzero session_tokens")

usage_without_model = [
    {"event": item.get("event"), "session_tokens": item.get("session_tokens"), "session_id": item.get("session_id")}
    for item in usage_records
    if not item.get("model")
]
if usage_without_model:
    raise SystemExit("OpenCode usage tracking missing real model: " + json.dumps(usage_without_model, indent=2))

usage_without_model_family = [
    {"event": item.get("event"), "model": item.get("model"), "session_tokens": item.get("session_tokens"), "session_id": item.get("session_id")}
    for item in usage_records
    if not item.get("model_family")
]
if usage_without_model_family:
    raise SystemExit("OpenCode usage tracking missing model_family: " + json.dumps(usage_without_model_family, indent=2))

usage_without_cost = [
    {"event": item.get("event"), "model": item.get("model"), "model_family": item.get("model_family"), "session_tokens": item.get("session_tokens"), "cost_usd": item.get("cost_usd"), "session_cost_usd": item.get("session_cost_usd"), "session_id": item.get("session_id")}
    for item in usage_records
    if float(item.get("cost_usd") or 0) <= 0 or float(item.get("session_cost_usd") or 0) <= 0
]
if usage_without_cost:
    raise SystemExit("OpenCode usage tracking missing positive cost: " + json.dumps(usage_without_cost, indent=2))

print(json.dumps({
    "tracking_records": len(items),
    "events": [
        {
            "event": item.get("event"),
            "source": item.get("source"),
            "tool": item.get("tool"),
            "session_id": item.get("session_id"),
            "team_name": item.get("team_name"),
            "model": item.get("model"),
            "model_family": item.get("model_family"),
            "session_tokens": item.get("session_tokens"),
            "cost_usd": item.get("cost_usd"),
            "session_cost_usd": item.get("session_cost_usd"),
            "timestamp": item.get("timestamp"),
        }
        for item in items[:10]
    ],
}, indent=2))
PYEOF
}

main() {
  log "repo: $REPO_ROOT"
  log "workspace: $WORKSPACE"
  mkdir -p "$WORKSPACE"
  run_preflight || fail "preflight failed"
  write_opencode_config
  run_opencode_sync "run-1" "Usa la herramienta fyso-sync-team con team_id exactamente ${TEAM_ID}. Ese ID corresponde al team ${TEAM_NAME}. Sincronizalo y no hagas otros cambios." || fail "OpenCode sync-team run-1 failed"
  validate_workspace || fail "workspace validation failed after run-1"
  snapshot_workspace "$WORKSPACE/snapshot-before.json"
  run_opencode_sync "run-2" "Usa la herramienta fyso-sync-team con team_id exactamente ${TEAM_ID}. Sincroniza ${TEAM_NAME} otra vez y no hagas otros cambios." || fail "OpenCode sync-team run-2 failed"
  validate_workspace || fail "workspace validation failed after run-2"
  snapshot_workspace "$WORKSPACE/snapshot-after.json"
  validate_idempotency || fail "idempotency validation failed"
  lower_team_version || fail "failed to lower local team version for auto-sync validation"
  run_opencode_sync "auto-sync" "No ejecutes fyso-sync-team. Responde exactamente OK-FYSO-OPENCODE-AUTO-SYNC." || fail "OpenCode auto-sync session failed"
  validate_workspace || fail "workspace validation failed after auto-sync session"
  python3 - "$WORKSPACE/.fyso/team.json" <<'PYEOF' || fail "OpenCode auto-sync did not update local team version"
import json
import time
import sys

path = sys.argv[1]
team = {}
for _ in range(20):
    team = json.load(open(path, encoding="utf-8"))
    if int(team.get("version") or 0) > 0:
        break
    time.sleep(0.5)
else:
    raise SystemExit(f"team auto-sync did not update local version: {team}")
PYEOF
  validate_tracking || fail "tracking validation failed"
  log "PASS"
}

main "$@"
