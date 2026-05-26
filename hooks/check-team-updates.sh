#!/usr/bin/env bash
# Checks once per Claude session whether the synced Fyso team has a newer version.

CONFIG="$HOME/.fyso/config.json"
[ ! -f "$CONFIG" ] && exit 0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export FYSO_HOOKS_DIR="$SCRIPT_DIR"

TMPFILE=$(mktemp)
cat > "$TMPFILE" 2>/dev/null || true

SESSION_ID=$(python3 - "$TMPFILE" <<'PYEOF' 2>/dev/null
import json, sys
try:
    with open(sys.argv[1]) as handle:
        print(json.load(handle).get("session_id", ""))
except Exception:
    print("")
PYEOF
)
rm -f "$TMPFILE"

FLAG_FILE="/tmp/fyso-version-check-${SESSION_ID:-$PPID}"
[ -f "$FLAG_FILE" ] && exit 0
touch "$FLAG_FILE" 2>/dev/null || true

find_team_json() {
  local dir="${CLAUDE_PROJECT_DIR:-$PWD}"
  while [ "$dir" != "/" ] && [ -n "$dir" ]; do
    if [ -f "$dir/.fyso/team.json" ]; then
      printf '%s\n' "$dir/.fyso/team.json"
      return 0
    fi
    dir=$(dirname "$dir")
  done
  return 1
}

TEAM_FILE=$(find_team_json) || exit 0
export TEAM_FILE

python3 <<'PYEOF'
import json
import os
import sys
import urllib.request

try:
    cfg = json.load(open(os.path.expanduser("~/.fyso/config.json")))
    team = json.load(open(os.environ.get("TEAM_FILE", "")))
except Exception:
    sys.exit(0)

token = cfg.get("token", "")
tenant = cfg.get("tenant_id", "")
api_url = cfg.get("api_url", "https://api.fyso.dev")
team_id = team.get("team_id", "")
team_name = team.get("team_name", "")
try:
    local_version = int(team.get("version", 0) or 0)
except Exception:
    local_version = 0

if not token or not tenant or not team_id:
    sys.exit(0)

try:
    req = urllib.request.Request(
        f"{api_url}/api/entities/teams/records/{team_id}",
        headers={"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant},
        method="GET",
    )
    resp = urllib.request.urlopen(req, timeout=4)
    data = json.loads(resp.read().decode())
    record = data.get("data") or data
    remote_version = int(record.get("version", local_version) or 0)
except Exception:
    sys.exit(0)

if remote_version > local_version:
    print(
        f"[fyso] Hay una nueva version del equipo \"{team_name or team_id}\" "
        f"(local: v{local_version}, remota: v{remote_version}). "
        "Antes de responder, avisale al usuario en una linea que puede correr /sync-team para actualizar agentes y skills locales."
    )
PYEOF
