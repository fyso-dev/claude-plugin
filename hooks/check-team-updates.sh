#!/usr/bin/env bash
# Backward-compatible wrapper: auto-syncs the saved Fyso team when a newer
# remote version exists.

CONFIG="$HOME/.fyso/config.json"
[ ! -f "$CONFIG" ] && exit 0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$SCRIPT_DIR/auto-sync-team.py"
