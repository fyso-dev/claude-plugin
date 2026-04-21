# Fyso Plugin — OpenCode Context

This project uses the **Fyso Plugin**, a universal plugin for AI coding agents that connects to the Fyso BaaS platform via MCP.

## MCP Server

The Fyso MCP server is configured in `.opencode.json`. It provides 80+ operations across 10 tool groups:
`fyso_schema`, `fyso_data`, `fyso_rules`, `fyso_auth`, `fyso_views`, `fyso_knowledge`, `fyso_deploy`, `fyso_meta`, `fyso_agents`, `fyso_ai`.

Authentication is handled via OAuth — on first use, the MCP server opens a browser flow.

## Available Commands

Custom commands are available via `Ctrl+K` under the `project:` namespace:

| Command | Description |
|---------|-------------|
| `project:fyso` | Main orchestrator — routes your request to the right workflow |
| `project:plan` | Design complete apps: requirements, roadmap, phases |
| `project:build` | Execute plans: create entities, rules, data via MCP |
| `project:verify` | Verify tenant matches plan requirements |
| `project:ui` | UI generation pipeline: discovery, mockups, contracts, code |
| `project:new-app` | Wizard for new apps with pre-built templates |
| `project:entity` | Create and manage entities (tables) |
| `project:rules` | Create business rules with natural language |
| `project:deploy` | Deploy to sites.fyso.dev |
| `project:scan` | Scan tenant and generate status report |
| `project:status` | View project status |
| `project:sync-team` | Sync a Fyso agent team to local directories |

## GSD Pipeline

The standard workflow for building apps:

1. `/plan new "description"` — gather requirements, generate roadmap
2. `/plan phase N` — detailed plan for phase N
3. `/build phase N` — execute via MCP operations
4. `/verify phase N` — validate against must-haves
5. `/ui` — generate frontend

## Planning Files

All project state is tracked in `.planning/`:
- `PROJECT.md` — project overview
- `REQUIREMENTS.md` — mapped to Fyso entities
- `ROADMAP.md` — phases with dependencies
- `STATE.md` — current tenant state

## Reference

For detailed Fyso platform reference (field types, MCP operations, DSL syntax, REST API), read `FYSO-REFERENCE.md`.
