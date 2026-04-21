# @fyso/plugin

Universal Fyso plugin for AI coding agents. Build complete business apps from conversation using the Fyso BaaS platform.

**Works with:** Claude Code, OpenCode

## What You Get

| Component | Count | Description |
|-----------|-------|-------------|
| **Skills/Commands** | 23 | Slash commands for Claude Code, custom commands for OpenCode |
| **Agents** | 5 | Specialized AI agents (architect, designer, builder, verifier, ui-architect) |
| **Team Sync** | 1 | Sync Fyso agent teams to local directories |
| **Tracking** | 3 | Session tracking, agent dispatch, heartbeat hooks |
| **Reference** | 3-tier | Auto-synced docs: always-loaded summary, consolidated reference, deep dives |
| **MCP** | 10 | Fyso MCP server: 10 grouped tools with 80+ actions |

## Installation

### Claude Code

#### From Marketplace (Recommended)

```bash
# 1. Add the Fyso marketplace
/plugin marketplace add fyso-dev/fyso-plugin

# 2. Install the plugin
/plugin install fyso@fyso-plugins
```

#### Team Auto-Install

Add to your project's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "fyso-plugins": {
      "source": {
        "source": "github",
        "repo": "fyso-dev/fyso-plugin"
      }
    }
  },
  "enabledPlugins": {
    "fyso@fyso-plugins": true
  }
}
```

Team members will be prompted to install automatically.

### OpenCode

Copy the configuration files to your project:

```bash
# 1. Clone or download the plugin
git clone https://github.com/fyso-dev/fyso-plugin.git /tmp/fyso-plugin

# 2. Copy MCP config
cp /tmp/fyso-plugin/.opencode.json ./.opencode.json

# 3. Copy commands
cp -r /tmp/fyso-plugin/.opencode/commands/ ./.opencode/commands/

# 4. Copy context file
cp /tmp/fyso-plugin/opencode.md ./opencode.md

# 5. Copy reference docs
cp /tmp/fyso-plugin/FYSO-REFERENCE.md ./FYSO-REFERENCE.md
```

Commands are available via `Ctrl+K` in the OpenCode TUI.

## Setup

### 1. Restart your coding agent

After installing, restart Claude Code or OpenCode. Skills/commands become available immediately.

### 2. Connect your Fyso account

On first use, the MCP server opens an OAuth flow to connect your Fyso account. No API key needed -- authentication is handled automatically.

### 3. Sync your team (optional)

If you work with Fyso agent teams:

- **Claude Code:** `/fyso:sync-team`
- **OpenCode:** `Ctrl+K` then select `project:sync-team`

This downloads your team's agents and makes them available as subagents.

## Available Skills / Commands

### GSD Pipeline (Plan, Build, Verify)

```
# Claude Code                          # OpenCode (Ctrl+K)
/fyso:plan new "Dental clinic ERP"      project:plan
/fyso:plan phase 1                      project:plan
/fyso:build phase 1                     project:build
/fyso:verify phase 1                    project:verify
```

### UI Generation Pipeline

```
/fyso:ui all                            project:ui
/fyso:ui infer "Admin panel"            project:ui
/fyso:ui audit                          project:ui
```

### Full List

| Skill (Claude Code) | Command (OpenCode) | Description |
|---------------------|-------------------|-------------|
| `/fyso:fyso` | `project:fyso` | Main orchestrator -- routes your request |
| `/fyso:plan` | `project:plan` | Design complete apps: requirements, roadmap, phases |
| `/fyso:build` | `project:build` | Execute plans: create entities, rules, data via MCP |
| `/fyso:verify` | `project:verify` | Verify tenant matches plan requirements |
| `/fyso:scan` | `project:scan` | Scan tenant and generate status report |
| `/fyso:status` | `project:status` | View project status |
| `/fyso:ui` | `project:ui` | UI generation: discovery, mockups, contracts, code |
| `/fyso:new-app` | `project:new-app` | Wizard for new apps with pre-built templates |
| `/fyso:entity` | `project:entity` | Create and manage entities |
| `/fyso:rules` | `project:rules` | Create business rules |
| `/fyso:deploy` | `project:deploy` | Deploy to sites.fyso.dev |
| `/fyso:sync-team` | `project:sync-team` | Sync Fyso agent teams to local directories |
| `/fyso:add-entity` | -- | Guided entity creation |
| `/fyso:api` | -- | REST API docs and clients |
| `/fyso:expose` | -- | Create channels and API tools |
| `/fyso:fields` | -- | Field management |
| `/fyso:init` | -- | Initialize new project |
| `/fyso:listen` | -- | Real-time data monitoring |
| `/fyso:mcp` | -- | MCP configuration |
| `/fyso:publish` | -- | Publish apps/entities |
| `/fyso:test` | -- | Test runner for rules |
| `/fyso:audit` | -- | Security/UX auditing |
| `/fyso:welcome` | -- | Guided onboarding |

## Agents (Claude Code only)

Five specialized agents with restricted MCP access:

| Agent | Role |
|-------|------|
| **architect** | Analyzes requirements, proposes entity schemas |
| **designer** | Plans roadmaps and phases |
| **builder** | Executes MCP operations |
| **verifier** | Validates tenant state against plans |
| **ui-architect** | Generates React + @fyso/ui frontends |

## Team Sync

Sync agent teams defined in Fyso to your local environment:

1. Run the sync command (see above)
2. Enter your API token from https://agent-ui-sites.fyso.dev/
3. Pick a team
4. Agent files are created for both platforms:
   - Claude Code: `.claude/agents/{name}.md`
   - OpenCode: `.opencode/commands/agents/{name}.md`

## Tracking (Claude Code only)

Session lifecycle hooks track usage and send events to the Fyso API:
- **Session start/stop** with token consumption summary
- **Agent dispatch** tracking with token breakdown
- **Heartbeat** every 5 minutes with activity summary and cost estimate
- **Subagent lifecycle** start/stop events

Tracking is passive and requires `~/.fyso/config.json` credentials. Without them, hooks exit silently.

## Documentation Tiers

| Tier | File | When Loaded | Content |
|------|------|-------------|---------|
| 1 | `CLAUDE.md` / `opencode.md` | Always (auto) | Fyso mental model |
| 2 | `FYSO-REFERENCE.md` | 1 read per skill | Everything consolidated: types, MCP, DSL, patterns |
| 3 | `skills/*/reference/*.md` | On-demand | Full docs with examples |

## MCP Tools (v2.0)

The plugin connects to Fyso's MCP server via OAuth. Ten grouped tools:

| Tool | Actions | Purpose |
|------|---------|---------|
| `fyso_data` | 6 | Records CRUD, bookings, scheduling |
| `fyso_schema` | 11 | Entities, fields, presets |
| `fyso_rules` | 7 | Business rules with DSL, testing, logs |
| `fyso_auth` | 13 | Users, roles, tenants, invitations |
| `fyso_views` | 4 | Filtered entity views |
| `fyso_knowledge` | 3 | Knowledge base search, docs search |
| `fyso_deploy` | 5 | Static sites, custom domains, CI/CD tokens |
| `fyso_meta` | 8 | API docs, metadata, secrets, usage, feedback |
| `fyso_agents` | 11 | AI agents: create, run, version, templates |
| `fyso_ai` | 10 | Multi-provider AI, prompt templates, call logs |

## Requirements

- [Claude Code](https://claude.ai/code) v1.0.33+ **or** [OpenCode](https://github.com/opencode-ai/opencode)
- Fyso account at [fyso.dev](https://fyso.dev)

## License

MIT -- Fyso Software
