# Install on Codex

Fyso AI Plugin ships a Codex adapter with a Codex plugin manifest and a repo-local marketplace entry.

## Repo-Local Plugin

- Plugin root: `dist/codex/`
- Marketplace entry: `dist/codex/.agents/plugins/marketplace.json`

## Notes

- Codex uses the shared Fyso skills, references, and MCP tooling from `core/`.
- Claude-only runtime artifacts are not included in the Codex build.
- The Codex plugin id is `fyso-ai`.
