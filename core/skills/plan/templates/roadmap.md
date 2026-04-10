# Roadmap Template

Use this template when creating `.planning/ROADMAP.md` for a Fyso app.

---

```markdown
# Roadmap

## Overview
{N} phases, {M} total plans estimated
Ordered by entity dependencies: independent → dependent → rules → channels

## Phase 1: {Name} — {Description}

**Requirements:** REQ-01, REQ-02
**Entities:** {entity_a}, {entity_b}
**Rules:** {N} compute, {N} validate
**Dependencies:** none
**Estimated Plans:** {N}

### What gets built:
- Entity `{entity_a}` with {N} fields
- Entity `{entity_b}` with {N} fields
- {N} business rules
- Publish all entities
- Seed data: {N} records

---

## Phase 2: {Name} — {Description}

**Requirements:** REQ-03, REQ-04
**Entities:** {entity_c}, {entity_d}
**Rules:** {N} compute, {N} validate, {N} action
**Dependencies:** Phase 1 ({entity_a}, {entity_b} must exist and be published)
**Estimated Plans:** {N}

### What gets built:
- Entity `{entity_c}` with relations to Phase 1 entities
- Entity `{entity_d}` with relations
- {N} business rules including cross-entity rules
- Publish + seed data

---

## Phase 3: {Name} — Channels & API

**Requirements:** REQ-05
**Channels:** {N} channel with {M} tools
**Dependencies:** Phase 1, Phase 2 (all entities published)
**Estimated Plans:** {N}

### What gets built:
- Channel "{channel_name}" with {M} tools
- Tool definitions for CRUD operations
- Permissions configuration

---

## Dependency Graph

Phase 1 (independent)
  ↓
Phase 2 (depends on Phase 1 entities)
  ↓
Phase 3 (depends on all entities published)

## Ordering Rules Applied
1. Entities with no relations → first phases
2. Entities with relations → after their targets exist
3. Business rules → after their entities exist
4. Channels → after entities are published
5. Seed data → after entities are published and rules are active
```
