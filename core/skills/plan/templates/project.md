# Project Template

Use this template when creating `.planning/PROJECT.md` for a new Fyso app.

---

```markdown
# {App Name}

## Tenant
- **Slug:** {tenant-slug}
- **Domain:** {business domain — e.g., healthcare, retail, services}
- **URL:** https://app.fyso.dev

## Core Value
{One sentence: what this app does and for whom}

## Stack
- **Platform:** Fyso (BaaS)
- **MCP:** Fyso MCP server
- **Auth:** OAuth 2.1
- **Runtime:** Bun

## Current State
**Shipped:** {what's been completed}
**Next:** {what's being planned}

## Phases

| # | Name | Status | Plans |
|---|------|--------|-------|
| 1 | {name} | {DONE | IN PROGRESS | PENDING} | {N} |
| 2 | {name} | {status} | {N} |

## Requirements Summary
- {N} entities
- {N} business rules ({X} compute, {Y} validate, {Z} transform)
- {N} channels with {M} tools
- {N} seed records

## Key Decisions

| Decision | Rationale | Phase |
|----------|-----------|-------|
| {what was decided} | {why} | {when} |

## Constraints
- {Project-specific constraints}
- {Business rules limitations}
- {Data requirements}

## Context
{Additional context about the domain, user needs, or technical requirements}
```
