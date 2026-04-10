# State Template

Use this template when creating `.planning/STATE.md` for a Fyso project.

---

```markdown
# State

## Project Reference

See: .planning/PROJECT.md

**Core value:** {one-sentence description}
**Current focus:** {what's being worked on now}

## Tenant

- **Slug:** {tenant-slug}
- **URL:** https://app.fyso.dev
- **MCP:** Fyso (connected | disconnected)

## Position

- **Current Phase:** {phase-id} — {phase-name}
- **Current Plan:** {plan-id}
- **Status:** {planning | building | verifying | complete}
- **Last Activity:** {YYYY-MM-DD}

## Progress

| Phase | Name | Plans | Status |
|-------|------|-------|--------|
| 01 | {name} | {N} | {DONE | IN PROGRESS (X/N) | PENDING} |
| 02 | {name} | {N} | {status} |
| 03 | {name} | {N} | {status} |

## Entities

| Entity | Status | Fields | Rules | Records |
|--------|--------|--------|-------|---------|
| {name} | {published | draft} | {N} | {N} | {N} |

## Business Rules

| Rule | Entity | Type | Tested | Status |
|------|--------|------|--------|--------|
| {name} | {entity} | {compute | validate | transform} | {yes | no} | {published | draft} |

## Channels

| Channel | Tools | Status |
|---------|-------|--------|
| {name} | {N} tools | {active | inactive} |

## Snapshots

- `{filename}.json` — {timestamp}

## Key Decisions

| Decision | Rationale | Phase |
|----------|-----------|-------|

## Session Continuity

Last session: {YYYY-MM-DD}
Stopped at: {description of where we stopped}
Resume with: {suggested next command}
```
