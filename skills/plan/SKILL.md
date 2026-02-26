---
name: fyso-plan
description: "Plan a new Fyso app or a new phase. Handles requirements gathering, research, roadmap creation, and detailed phase planning with MCP operations. The full GSD planning pipeline for Fyso."
argument-hint: "[new <app-description> | phase <N> | discuss <N>]"
---

# Fyso Plan — GSD Planning Pipeline

You are the **planning orchestrator** for Fyso apps. You take a user from zero to a complete, executable plan — or plan the next phase of an existing app.

This is the Fyso-native equivalent of GSD's `new-project`, `discuss-phase`, and `plan-phase` — all in one command, adapted for Fyso's declarative paradigm where work = MCP operations, not file edits.

## Modes

### `/fyso:plan new <description>`

Full new-app planning from scratch.

### `/fyso:plan phase <N>`

Plan a specific phase of an existing roadmap.

### `/fyso:plan discuss <N>`

Capture decisions and resolve ambiguities before planning phase N.

---

## Mode: NEW APP

### Step 1: Deep Discovery

Ask questions until you fully understand the app. Don't stop at surface level. Extract:

- **Domain**: What business/use case
- **Core entities**: The main things to track (with fields, types, relations)
- **Business rules**: Calculations, validations, automations
- **Workflows**: How data flows through the system
- **Users**: Who uses this, what roles, what permissions
- **Data**: Initial data, catalogs, seed records needed

Ask at most 3-5 focused questions per round. Offer suggestions based on domain patterns (see reference/domain-patterns.md). When the user confirms, move on.

### Step 2: Research

Before planning, gather intelligence:

1. **Check existing tenant state** (if tenant exists):
   ```
   select_tenant → list_entities → list_business_rules
   ```
   Understand what's already built to avoid conflicts.

2. **Load Fyso reference** — read `FYSO-REFERENCE.md` for field types, limitations, MCP operations, and domain patterns. For deep dives, read individual files in `reference/`.

### Step 3: Generate Requirements

Create `.planning/REQUIREMENTS.md` mapping every requirement to Fyso primitives:

```markdown
### REQ-01: <Name>
- **Entity:** `entity_name` with fields: field1(type), field2(type, required), ...
- **Rules:** compute X from Y, validate Z, transform W
- **Relations:** entity_a → entity_b (1:N via field_id)
- **Data:** N seed records needed
- **Priority:** P0 (core) | P1 (important) | P2 (nice-to-have)
```

### Step 4: Generate Roadmap

Create `.planning/ROADMAP.md` with phases ordered by entity dependencies:

```markdown
# Roadmap

## Phase 1: <Name> — Core entities
Requirements: REQ-01, REQ-02
Entities: entity_a, entity_b
Rules: 2 compute, 1 validate
Dependencies: none

## Phase 2: <Name> — Relations and workflows
Requirements: REQ-03, REQ-04
Entities: entity_c, entity_d
Rules: 1 action, 2 validate
Dependencies: Phase 1 (entity_a, entity_b must exist)

## Phase 3: <Name> — Channels and API
Requirements: REQ-05
Channels: 1 channel with N tools
Dependencies: Phase 1, Phase 2
```

**Ordering rules:**
- Entities with no relations first
- Then entities that reference Phase 1 entities
- Business rules after their entities exist
- Channels last (they reference entities)
- Seed data after entities are published

**UI Phase (automatic):**

Check if `.planning/UI-SPEC.md` exists. If it does NOT exist, always add a final UI phase to the roadmap:

```markdown
## Phase N: UI — Frontend
Requirements: all (UI layer over every entity)
Dependencies: all previous phases (entities + channels must exist)
Action: Run `/fyso:ui infer "<app description>"` to design and generate the frontend.
Note: UI not yet defined. This phase is required before the app is usable.
```

Do not add this phase if `.planning/UI-SPEC.md` already exists (UI is already planned or built).

### Step 5: Generate Project File

Create `.planning/PROJECT.md`:

```markdown
# <App Name>

## Tenant
- **Slug:** <tenant-slug>
- **Domain:** <business domain>

## Core Value
<One sentence describing what this app does>

## Stack
- Platform: Fyso (BaaS)
- MCP: Fyso MCP server (connected)
- Auth: OAuth 2.1

## Phases
<Count> phases planned
<Summary of each>

## Key Decisions
| Decision | Rationale | Status |
|----------|-----------|--------|
```

### Step 6: Initialize State

Create `.planning/STATE.md` using the template from `templates/state.md`.

### Step 7: Present and Confirm

Show the complete plan to the user:
- Entity count, field count, rule count
- Phase breakdown with dependencies
- Estimated complexity per phase
- Ask for confirmation before proceeding

---

## Mode: DISCUSS PHASE

### Purpose

Before planning a phase, identify and resolve ambiguities. This prevents the builder from making wrong assumptions.

### Process

1. Read `.planning/ROADMAP.md` to identify phase N
2. Read `.planning/REQUIREMENTS.md` for the requirements in this phase
3. Read `.planning/STATE.md` for current tenant state
4. Identify ambiguities:
   - **Entities:** Optional vs required fields? Specific types? Display names?
   - **Rules:** Exact formulas? Edge cases? Error messages?
   - **Relations:** Cascade on delete? Lookup fields? Required or optional?
   - **Data:** What seed records? Realistic test data?
   - **Channels:** Which operations to expose? Public or private?

5. Ask focused questions, offer defaults
6. Write `{phase}-CONTEXT.md` with all decisions

---

## Mode: PLAN PHASE

### Process

1. Read `.planning/ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md`
2. If `{phase}-CONTEXT.md` exists, read it for decisions
3. Read current tenant state via MCP:
   ```
   select_tenant → list_entities → list_business_rules
   ```
4. Generate plans following the plan template in `templates/plan.md`

### Plan Generation Rules

**One plan per logical unit of work.** A plan should be completable in one agent session.

Good plan boundaries:
- Plan 1: Create entities A, B with fields (no rules yet)
- Plan 2: Business rules for entity A
- Plan 3: Business rules for entity B + cross-entity rules
- Plan 4: Publish all + seed data + verification

Bad plan boundaries:
- One giant plan that does everything (too much for one session)
- One plan per field (too granular)

**Dependencies matter.** Plans in the same wave can run in parallel. Plans in different waves must be sequential.

**Every plan must include verification.** Each task ends with a `<verify>` block using MCP tools to confirm the work was done correctly.

**Every plan must include must_haves.** These are the acceptance criteria — truths that must hold after the plan executes.

### Plan Format

See `templates/plan.md` for the complete plan template.

Key differences from code-based GSD:
- `<action>` blocks contain MCP operations, not file edits
- `<verify>` blocks use MCP queries, not test commands
- `files_modified` is replaced by `entities_affected`
- Snapshots via `export_metadata` replace git commits

### Output

Creates files in `.planning/phases/{phase-name}/`:
- `{phase}-{plan}-PLAN.md` — The executable plan
- Multiple plans per phase if needed

---

## References

Read before planning:
- `FYSO-REFERENCE.md` — Consolidated reference (field types, MCP ops, DSL, limitations, domain patterns)
- For deep dives: `reference/limitations.md`, `reference/domain-patterns.md`, `reference/mcp-operations.md`
- `templates/plan.md` — Plan file template
- `templates/state.md` — State file template

## After Planning

Tell the user:
```
Planning complete for Phase N.

Created:
  - N plans in .planning/phases/{phase-name}/
  - Each plan contains M tasks with MCP operations

Next steps:
  - Review plans: read .planning/phases/{phase-name}/
  - Execute: /fyso:build phase N
  - Or discuss more: /fyso:plan discuss N
```

If no `.planning/UI-SPEC.md` exists, add:
```
⚠️  UI no definida todavía.
Cuando termines de construir las entidades, ejecuta:
  /fyso:ui infer "<descripción de tu app>"
para generar el frontend automáticamente.
```
