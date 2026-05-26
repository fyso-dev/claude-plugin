#!/usr/bin/env python3
"""Detect recent unreported usage-limit hits from previous Claude sessions."""

import datetime
import getpass
import glob
import json
import os
import sys
import time

try:
    import urllib.request
except Exception:
    sys.exit(0)

sys.path.insert(0, os.environ.get("FYSO_HOOKS_DIR", os.path.dirname(os.path.abspath(__file__))))
try:
    from _tracking_lib import (
        cleanup_limit_flags,
        find_usage_limit_text,
        get_claude_account,
        mark_limit_hit,
        should_skip_limit_hit,
        utc_iso,
    )
except Exception:
    sys.exit(0)


def _debug(message):
    if not os.path.exists(os.path.expanduser("~/.fyso/debug")):
        return
    try:
        with open(os.path.expanduser("~/.fyso/hook-debug.log"), "a") as log:
            log.write(message + "\n")
    except Exception:
        pass


def _read_tail(path, max_bytes=20000):
    try:
        size = os.path.getsize(path)
        with open(path, encoding="utf-8", errors="replace") as handle:
            if size > max_bytes:
                handle.seek(size - max_bytes)
                handle.readline()
            return handle.readlines()
    except Exception:
        return []


params_path = os.environ.get("FYSO_PREV_LIMIT_PARAMS", "")
try:
    with open(params_path) as handle:
        params = json.load(handle)
except Exception:
    sys.exit(0)

transcript_dir = params.get("transcript_dir", "")
session_id = params.get("session_id", "")
api_url = params.get("api_url", "https://api.fyso.dev")
token = params.get("token", "")
tenant = params.get("tenant", "")
user_email = params.get("user_email", "")
cwd = params.get("cwd", "")

if not transcript_dir or not token or not tenant:
    sys.exit(0)

cleanup_limit_flags()

try:
    transcripts = sorted(
        glob.glob(os.path.join(transcript_dir, "*.jsonl")),
        key=os.path.getmtime,
        reverse=True,
    )
except Exception:
    transcripts = []

max_age_seconds = 6 * 3600
for transcript in transcripts[:5]:
    previous_session = os.path.basename(transcript).replace(".jsonl", "")
    if not previous_session or previous_session == session_id:
        continue
    try:
        if time.time() - os.path.getmtime(transcript) > max_age_seconds:
            continue
    except OSError:
        continue
    if should_skip_limit_hit(previous_session):
        continue

    text, reset_at = find_usage_limit_text(_read_tail(transcript), tail=30)
    if not text:
        continue

    payload = {
        "event": "usage_limit_hit",
        "detail": f"detected on next session_start: {text[:100]}",
        "limit_reset_at": reset_at,
        "user": user_email or getpass.getuser(),
        "session_id": previous_session,
        "claude_account": get_claude_account() or None,
        "model": "claude-opus-4-6",
        "model_family": "opus",
        "tokens": 0,
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_creation_tokens": 0,
        "cache_read_tokens": 0,
        "session_tokens": 0,
        "session_input_tokens": 0,
        "session_output_tokens": 0,
        "session_cache_creation_tokens": 0,
        "session_cache_read_tokens": 0,
        "cwd": cwd or None,
        "timestamp": utc_iso(),
    }
    payload = {key: value for key, value in payload.items() if value is not None}
    try:
        request = urllib.request.Request(
            f"{api_url}/api/entities/tracking/records",
            data=json.dumps(payload).encode(),
            headers={
                "Authorization": f"Bearer {token}",
                "X-Tenant-ID": tenant,
                "Content-Type": "application/json",
            },
            method="POST",
        )
        urllib.request.urlopen(request, timeout=5)
        mark_limit_hit(previous_session)
        _debug(f"PREV_LIMIT: sent usage_limit_hit for {previous_session[:8]}")
    except Exception as exc:
        _debug(f"PREV_LIMIT: send error {exc}")
    break
