# Fyso AI Plugin

Fyso AI Plugin packages Fyso skills, reference docs, and MCP tooling for host agents. The repository is host-agnostic at its core and ships explicit adapters for Claude and Codex.

## Structure

| Path | Purpose |
|------|---------|
| `core/` | Neutral source of truth for skills, references, templates, and MCP config |
| `adapters/claude/` | Claude-specific manifests, hooks, agents, and install docs |
| `adapters/codex/` | Codex-specific manifests, marketplace metadata, and install docs |
| `dist/` | Generated host artifacts |

## Product Naming

- Product: `Fyso AI Plugin`
- Canonical package: `@fyso/ai-plugin`
- Canonical repo/docs naming: `fyso-ai-plugin`
- Canonical Codex plugin id: `fyso-ai`

Compatibility shim:

- `@fyso/claude-plugin` remains as a temporary shim in `packages/claude-plugin-shim/`

## Host Guides

- General architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Claude install: [docs/INSTALL-CLAUDE.md](docs/INSTALL-CLAUDE.md)
- Codex install: [docs/INSTALL-CODEX.md](docs/INSTALL-CODEX.md)

## Build

```bash
bun run neutralize-core
bun run validate:core
bun run sync-reference
bun run build
```

Or build one host at a time:

```bash
bun run build:claude
bun run build:codex
```

## What Gets Generated

- `dist/claude/` includes the neutral Fyso core plus Claude manifests, hooks, and agent profiles.
- `dist/codex/` includes the neutral Fyso core plus Codex plugin manifests and marketplace metadata.

## Development Notes

- Keep `core/` free of host names, slash commands, and host runtime paths.
- Put host runtime behavior in `adapters/<host>/`.
- Regenerate `core/FYSO-REFERENCE.md` from `core/skills/*/reference/` only.
