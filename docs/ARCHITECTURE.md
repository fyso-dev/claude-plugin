# Fyso AI Plugin Architecture

Fyso AI Plugin is organized in three layers:

- `core/`: portable source of truth for skills, reference docs, MCP config, and templates.
- `adapters/<host>/`: host-specific overlays such as manifests, hooks, agents, and install docs.
- `dist/<host>/`: generated distribution artifacts ready for each host runtime.

## Source Rules

- `core/` must stay host-neutral.
- `adapters/` may contain host-specific naming, runtime hooks, and manifests.
- Generated output must always be recreated from `core/` plus the selected adapter.

## Build Contract

Use one of:

```bash
bun bin/build.ts --host claude
bun bin/build.ts --host codex
bun bin/build.ts --host all
```

The build copies portable content from `core/`, overlays host artifacts from `adapters/<host>/`, and writes the result to `dist/<host>/`.
