---
name: fyso-listen
description: "Activate a real-time event channel that bridges Fyso SSE events into this Claude Code session. Events from your tenant arrive as channel messages and Claude can react to them automatically."
argument-hint: "[--tenant <slug>] [--entities <e1,e2>] [--stop]"
disable-model-invocation: true
---

# /fyso:listen — Fyso SSE Channel Bridge

Connect this Claude Code session to the Fyso real-time event stream. Events from your tenant (record created, updated, deleted, rule triggered) arrive as channel messages that Claude can act on immediately.

## Requirements

- Claude Code v2.1.80 or later
- `bun` installed (`bun --version` to check, https://bun.sh if not)
- A valid Fyso API key or JWT for the target tenant
- The Fyso plugin installed (`/plugin install fyso@fyso-marketplace`)

## Usage

```
/fyso:listen                              # interactive setup + show launch command
/fyso:listen --tenant acme               # pre-fill tenant slug
/fyso:listen --entities invoices,clients # filter to specific entities
/fyso:listen --stop                      # show how to stop the channel
```

## What This Skill Does

This skill does NOT directly activate the channel (channels require a subprocess spawned by Claude Code at startup). Instead it:

1. Reads existing configuration (tenant slug from current session, API key from env)
2. Validates the configuration is complete
3. Writes a `.env` file for the channel server if needed
4. Outputs the exact `claude --dangerously-load-development-channels` command to run
5. Optionally writes a helper script `fyso-listen.sh` for convenience

## Instructions

Parse the user's arguments:
- `--tenant <slug>` — target tenant slug (overrides active session tenant)
- `--entities <list>` — comma-separated entity slugs to filter (optional)
- `--stop` — show stop instructions instead of start

### Step 1: Determine configuration

Collect the following values. Use what's already available before asking the user:

| Value | Source (in priority order) |
|-------|---------------------------|
| `FYSO_TENANT_SLUG` | `--tenant` arg → active session tenant (from `select_tenant`) → ask user |
| `FYSO_API_KEY` | env var `FYSO_API_KEY` → ask user |
| `FYSO_API_URL` | env var `FYSO_API_URL` → default `https://app.fyso.dev` |
| `FYSO_ENTITIES` | `--entities` arg → env var `FYSO_ENTITIES` → empty (all events) |

### Step 2: Validate

- `FYSO_TENANT_SLUG` must not be empty
- `FYSO_API_KEY` must not be empty
- If either is missing, tell the user what's needed and stop

### Step 3: Find the channel server path

The channel server is `channel-server.ts` inside the Fyso plugin. Locate it with:

```bash
# Try common locations in order
CHANNEL_SERVER=$(
  ls ~/.claude/plugins/cache/fyso-plugins/fyso/*/bin/channel-server.ts 2>/dev/null | head -1 || \
  ls ~/.claude/plugins/*/fyso/packages/mcp-server/src/channel-server.ts 2>/dev/null | head -1 || \
  echo "NOT_FOUND"
)
```

If not found, tell the user: "Could not locate channel-server.ts. Run `/plugin update fyso` to get the latest version."

### Step 4: Write `.mcp.json` in current directory

Create or merge `fyso-channel` into the project's `.mcp.json` (current working directory). If `.mcp.json` already exists, merge the new server entry into `mcpServers` — do NOT overwrite existing servers.

The entry should be:

```json
{
  "mcpServers": {
    "fyso-channel": {
      "command": "bun",
      "args": ["<CHANNEL_SERVER_PATH>"],
      "env": {
        "FYSO_API_URL": "<api_url>",
        "FYSO_TENANT_SLUG": "<tenant_slug>",
        "FYSO_API_KEY": "<api_key>",
        "FYSO_ENTITIES": "<entities or empty>"
      }
    }
  }
}
```

This ensures Claude Code finds the MCP server when launched from this directory with `--dangerously-load-development-channels server:fyso-channel`.

### Step 5: Output summary

Show the user:

```
Fyso Channel configured

Tenant:   <slug>
Entities: <list or "all">
API URL:  <url>
Config:   .mcp.json (this directory)

To start listening:
  Exit this session, then run from this directory:

  claude --dangerously-load-development-channels server:fyso-channel

Once running, Fyso events will arrive as <channel source="fyso-channel"> messages in your session.
Claude will react to them automatically.

To stop: Ctrl+C in the terminal where the channel is running.
```

### --stop mode

If the user ran `/fyso:listen --stop`, show:

```
To stop the Fyso channel:
  Press Ctrl+C in the terminal where "claude --dangerously-load-development-channels" is running.
  The channel server shuts down gracefully and stops receiving events.

Config file remains at ~/.claude/channels/fyso/.env for next time.
To delete it: rm -rf ~/.claude/channels/fyso/
```

## Channel Event Format

Once active, events arrive in the session as:

```xml
<channel source="fyso-channel" event_type="record.created" entity="invoices" record_id="123" tenant="acme">
{
  "id": "123",
  "entity": "invoices",
  "action": "created",
  "data": { ... }
}
</channel>
```

Meta attributes:
- `event_type` — event name from the SSE stream (e.g. `record.created`, `rule.triggered`)
- `entity` — entity slug the event belongs to
- `record_id` — affected record ID when applicable
- `action` — operation type (`created`, `updated`, `deleted`)
- `tenant` — tenant slug

Connection lifecycle events also arrive:
- `event_type="connected"` — stream established
- `event_type="disconnected"` — stream dropped, auto-reconnect in progress
- `event_type="error"` — auth or fatal error

## Error Handling

| Problem | Solution |
|---------|----------|
| Auth failed (401) | Check `FYSO_API_KEY` in `~/.claude/channels/fyso/.env` |
| Tenant not found (404) | Check `FYSO_TENANT_SLUG` |
| Channel not registering | Make sure `bun` is installed and you used `--dangerously-load-development-channels` |
| No events arriving | Verify entity filter isn't too narrow; try without `--entities` |
| "blocked by org policy" | Your Team/Enterprise admin must enable channels at claude.ai/admin-settings |
