---
name: fyso-scan
description: "Scan a Fyso tenant and generate a complete state report. Shows all entities, fields, rules, channels, and records. The equivalent of map-codebase for Fyso."
argument-hint: "[tenant-slug]"
---

# Fyso Scan — Tenant State Discovery

You scan a Fyso tenant and produce a complete state report. This is the Fyso equivalent of GSD's `map-codebase` — instead of mapping files and directories, you map entities, fields, rules, and channels.

## Usage

```
/fyso:scan                    # Scan current tenant (from STATE.md)
/fyso:scan mi-consultorio     # Scan specific tenant
```

## Scan Flow

### Step 1: Connect

```
select_tenant({ tenantSlug: "..." })
```

If the tenant doesn't exist or can't connect, report the error and stop.

### Step 2: Discover Entities

```
list_entities({ include_drafts: true })
```

For each entity found:

```
get_entity_schema({ entityName: "..." })
```

Collect:
- Entity name, display name, description
- Published vs draft status
- Field count, field names, field types
- Which fields are required, unique, have defaults
- Relation fields and their targets

### Step 3: Discover Business Rules

For each entity:

```
list_business_rules({ entityName: "..." })
```

For each rule found:

```
get_business_rule({ entityName: "...", ruleId: "..." })
```

Collect:
- Rule name, type (compute/validate/transform)
- Trigger type and trigger fields
- Published vs draft status
- DSL content

### Step 4: Count Records

For each published entity:

```
query_records({ entityName: "...", limit: 1 })
```

Get total record count from pagination metadata.

### Step 5: Discover Channels (if any)

```
search_channels({ query: "" })
```

For each channel found:

```
get_channel_tools({ channelId: "..." })
```

### Step 6: Generate Report

Output a complete state report:

```markdown
# Tenant Scan: {slug}

**Scanned:** {timestamp}
**MCP:** connected

## Entities ({count})

| Entity | Status | Fields | Rules | Records |
|--------|--------|--------|-------|---------|
| pacientes | published | 9 | 2 | 15 |
| profesionales | published | 3 | 0 | 3 |
| sesiones | published | 7 | 1 | 42 |
| facturas | draft | 6 | 0 | 0 |

### pacientes (published, 9 fields, 2 rules, 15 records)

| Field | Type | Required | Unique | Default |
|-------|------|----------|--------|---------|
| nombre | text | yes | no | — |
| apellido | text | yes | no | — |
| dni | text | yes | yes | — |
| fecha_nacimiento | date | no | no | — |
| obra_social | text | no | no | — |
| telefono | text | no | no | — |
| email | text | no | no | — |
| activo | boolean | no | no | true |
| notas | text | no | no | — |

Rules:
  - **Validar email** (validate, before_save) — Published
  - **Calcular edad** (compute, field_change) — Published

### (repeat for each entity...)

## Business Rules Summary ({total count})

| Rule | Entity | Type | Trigger | Status |
|------|--------|------|---------|--------|
| Validar email | pacientes | validate | before_save | published |
| Calcular edad | pacientes | compute | field_change | published |
| Calcular total | facturas | compute | field_change | draft |

## Channels ({count})

| Channel | Tools | Status |
|---------|-------|--------|
| Consultorio API | 3 tools | active |

## Health Check

- Entities: {X} published, {Y} draft
- Rules: {A} published, {B} draft, {C} untested
- Data: {D} total records across all entities
- Channels: {E} active
```

### Step 7: Update STATE.md (Optional)

If `.planning/STATE.md` exists, offer to update it with the scan results.

If it doesn't exist, offer to create it.

## When to Use

- **Before starting a new project** — see what's already in the tenant
- **After a build** — quick check that everything was created
- **Debugging** — find missing entities, draft rules, broken relations
- **Onboarding** — understand an existing tenant you didn't build
