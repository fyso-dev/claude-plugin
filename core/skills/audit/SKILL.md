---
name: fyso-audit
description: "Audit a Fyso tenant for security vulnerabilities, bad practices, data integrity issues, and consistency problems. Produces a structured report with severity levels and actionable fixes."
argument-hint: "[security | practices | integrity | consistency | all]"
id: audit
title: "Audit"
hosts: ["claude", "codex"]
category: portable
---

# Fyso Audit — Tenant Health & Security Audit

You audit a Fyso tenant comprehensively. This is the backend equivalent of the UI audit workflow — instead of scanning frontend code, you scan the tenant's data model, business rules, channels, and permissions for problems.

## Usage

```
the audit workflow              # Full audit — all dimensions
the audit workflow security     # Channel exposure, permissions, API keys
the audit workflow practices    # Bad patterns, naming, missing rules
the audit workflow integrity    # Broken relations, orphan refs, draft entities
the audit workflow consistency  # Mismatches between plan and tenant state
```

---

## Step 1: Connect and Scan

```
select_tenant({ tenantSlug: "..." })
list_entities({ include_drafts: true })
```

For each entity:
```
get_entity_schema({ entityName: "..." })
list_business_rules({ entityName: "..." })
get_business_rule({ entityName: "...", ruleId: "..." })  // for each rule
query_records({ entityName: "...", limit: 1 })            // get record count
```

For channels:
```
search_channels({ query: "" })
get_channel_tools({ channelId: "..." })  // for each channel
```

Build a complete in-memory map of the tenant before running any checks.

---

## Dimension 1: SECURITY

### Channel & API Exposure

| Check | What to Look For | Severity |
|-------|-----------------|----------|
| **Public channels with sensitive data** | Channels with `public` or `anon` access exposing PII fields (email, DNI, phone, address, salary) | CRITICAL |
| **Overly permissive channel tools** | Tools that allow DELETE or bulk operations without role restriction | HIGH |
| **No auth on write operations** | Channel tools for create/update/delete with no role requirement | HIGH |
| **Admin operations exposed** | Tools that expose user management, billing, or config data publicly | CRITICAL |
| **Wildcard field access** | Channel tools returning all fields (`*`) when only specific fields are needed | MEDIUM |

**How to check:**
- For each channel, inspect `tools[].permissions` — if `roles: []` or `roles: ['public']` on mutating tools, flag it
- Cross-reference tool field lists against entity fields tagged as sensitive (email, phone, dni, password, token, salary, monto, saldo)
- Flag any tool with `method: DELETE` or `method: PUT` that has no role restriction

### Business Rule Security

| Check | What to Look For | Severity |
|-------|-----------------|----------|
| **Rules that bypass validation** | `transform` rules that overwrite validated fields without re-validating | HIGH |
| **Missing input sanitization** | No `validate` rule on text fields that accept user input (XSS via stored data) | MEDIUM |
| **Privilege escalation via rules** | `action` rules that can change `role` or `plan` fields | CRITICAL |
| **Infinite loops** | `compute` rule on field A triggers on field B, which triggers rule on field A | HIGH |
| **Rules in draft state on published entities** | Published entity with critical business logic still in draft | HIGH |

**How to check:**
- Find rules of type `action` — inspect DSL for any `updateData` touching `role`, `plan`, `status`, `permissions`
- Find `compute` rules and map trigger_field → output_field — detect cycles
- Cross-reference: for each published entity, check if any of its rules are still in `draft` status

---

## Dimension 2: BAD PRACTICES

### Data Model

| Check | What to Look For | Severity |
|-------|-----------------|----------|
| **Entities with no required fields** | Entity with 0 required fields — records can be created completely empty | HIGH |
| **No unique constraint on natural keys** | Fields like `email`, `dni`, `codigo`, `slug` without `unique: true` | HIGH |
| **Boolean fields without defaults** | Boolean field with no default — reads as null, not false | MEDIUM |
| **Text fields for structured data** | Fields named `telefono`, `email`, `fecha` typed as `text` instead of `phone`, `email`, `date` | MEDIUM |
| **Entities with no description** | Entity has no `description` — makes maintenance harder | LOW |
| **Single-field entities** | Entity with only 1 field — probably should be a `select` field on another entity | LOW |
| **Overly generic names** | Entities or fields named `data`, `info`, `value`, `item`, `thing` | LOW |
| **Relation field without display field** | `relation` field defined without specifying which field to display | MEDIUM |

### Business Rules

| Check | What to Look For | Severity |
|-------|-----------------|----------|
| **Entities with no rules** | Published entity with numeric or derived fields but zero business rules | MEDIUM |
| **Unused draft rules** | Rules in draft that have never been published — dead code | LOW |
| **Hardcoded values in rules** | DSL with magic numbers or hardcoded strings that should be configurable | MEDIUM |
| **Rules with no error message** | `validate` rule that returns `false` with no message — user gets no feedback | HIGH |
| **Duplicate rule logic** | Two rules on different entities with identical or near-identical DSL | LOW |

### Naming Conventions

| Check | What to Look For | Severity |
|-------|-----------------|----------|
| **Mixed languages** | Entity names in Spanish + English mixed (`clientes` + `orders`) | LOW |
| **Inconsistent casing** | Some entities `snake_case`, others `camelCase` or `PascalCase` | LOW |
| **Plural entity names** | Entities should be plural (`pacientes`, not `paciente`) | LOW |

---

## Dimension 3: DATA INTEGRITY

### Relations

| Check | What to Look For | Severity |
|-------|-----------------|----------|
| **Broken relation targets** | `relation` field pointing to an entity that doesn't exist | CRITICAL |
| **Draft entity referenced by published entity** | Published entity has a relation to an entity still in draft | HIGH |
| **No orphan protection** | Parent entity exists but no rule or validation prevents deleting it while children exist | MEDIUM |
| **Circular relations** | Entity A relates to B, B relates to A (not always wrong, but flag for review) | LOW |

### Data Quality

| Check | What to Look For | Severity |
|-------|-----------------|----------|
| **Published entity with 0 records** | Likely a setup entity (categories, config) that was never seeded | LOW |
| **Draft entity with records** | Records exist on an entity that was never published (data in limbo) | HIGH |
| **Rules not applied to existing records** | Published compute rule but records predate it and have null in the computed field | MEDIUM |

**How to check:**
- For each `relation` field, verify the target entity exists in `list_entities`
- For each published entity, `query_records(limit:1)` — if total=0 and entity has >3 fields, flag as possibly unseeded
- For each draft entity, `query_records(limit:1)` — if total>0, flag as data in limbo

---

## Dimension 4: CONSISTENCY

### Plan vs Tenant

If `.planning/REQUIREMENTS.md` or `.planning/ROADMAP.md` exist, cross-reference:

| Check | What to Look For | Severity |
|-------|-----------------|----------|
| **Entity in plan but not in tenant** | REQUIREMENTS.md defines `facturas` but entity doesn't exist | HIGH |
| **Entity in tenant but not in plan** | Tenant has `temp_test` entity not in any planning doc | MEDIUM |
| **Field count mismatch** | Plan says entity has 8 fields, tenant has 5 | MEDIUM |
| **Rule in plan but not built** | REQUIREMENTS.md mentions "calcular total" rule, no matching rule in tenant | HIGH |
| **Phase marked done but entities still draft** | STATE.md says Phase 2 complete but `facturas` entity is still in draft | HIGH |

### STATE.md Accuracy

If `.planning/STATE.md` exists:

| Check | What to Look For | Severity |
|-------|-----------------|----------|
| **STATE.md out of sync** | STATE.md lists entities/rules that don't match actual tenant state | MEDIUM |
| **Completed phases with missing artifacts** | Phase marked `done` but its entities are missing or in draft | HIGH |

---

## Step 2: Generate Audit Report

Write `.planning/AUDIT.md`:

```markdown
# Fyso Tenant Audit: {slug}

**Date:** {date}
**Scope:** {full / security / practices / integrity / consistency}
**Tenant:** {slug}

## Summary

| Dimension | Critical | High | Medium | Low |
|-----------|----------|------|--------|-----|
| Security | {n} | {n} | {n} | {n} |
| Bad Practices | {n} | {n} | {n} | {n} |
| Data Integrity | {n} | {n} | {n} | {n} |
| Consistency | {n} | {n} | {n} | {n} |
| **TOTAL** | **{n}** | **{n}** | **{n}** | **{n}** |

{If 0 critical + 0 high: "✅ Tenant is healthy."}
{If critical > 0: "🚨 {n} critical issues require immediate attention."}

---

## 🚨 Critical Issues

### [SECURITY] Canal público expone DNI y email de pacientes
- **Where:** Channel `consultorio-api` → tool `list_pacientes`
- **Problem:** Tool has `roles: ['public']` and returns fields: `nombre, dni, email, telefono`
- **Risk:** Anyone with the channel URL can read all patient PII without authentication
- **Fix:** Restrict to `roles: ['member', 'admin', 'owner']` or remove sensitive fields from tool response
- **Effort:** 5 min

### [INTEGRITY] Relación rota: `sesiones.paciente_id` → entidad `paciente` no existe
- **Where:** Entity `sesiones`, field `paciente_id` (relation)
- **Problem:** Target entity is `paciente` (singular) but tenant has `pacientes` (plural)
- **Risk:** All relation lookups will fail. Records can't be linked to patients.
- **Fix:** Update field to point to `pacientes`
- **Effort:** 10 min

---

## 🔴 High Issues

### [PRACTICES] Entidad `sesiones` sin campos requeridos
- **Where:** Entity `sesiones`
- **Problem:** 0 of 7 fields are marked required. Records can be created completely empty.
- **Risk:** Data quality degradation. Reports and rules may fail on null fields.
- **Fix:** Mark at minimum `fecha`, `paciente_id`, `profesional_id` as required.
- **Effort:** 5 min

### [SECURITY] Regla `calcular_descuento` en draft en entidad publicada
- **Where:** Entity `facturas`, rule `calcular_descuento` (draft)
- **Problem:** Entity is published and has records, but this rule was never published.
- **Risk:** Discount calculation is silently not running on any invoice.
- **Fix:** Review rule logic and publish it: `publish_business_rule`
- **Effort:** 15 min

---

## 🟡 Medium Issues

...

## 🔵 Low Issues

...

## ✅ Passed Checks

- ✅ [SECURITY] No tools with DELETE access on public channels
- ✅ [INTEGRITY] All relation fields point to existing entities
- ✅ [PRACTICES] Consistent naming convention (Spanish, snake_case, plural)
- ✅ [CONSISTENCY] All Phase 1 entities exist and are published
...

## Recommended Actions

1. **Immediate:** Fix {n} critical issues — data exposure risks
2. **This week:** Address {n} high issues — data quality and security gaps
3. **Backlog:** Review {n} medium/low issues — polish and maintainability
```

---

## Step 3: Present Results Inline

After writing the file, show a concise summary:

```
## Audit: {tenant-slug}

| Dim. | CRIT | HIGH | MED | LOW |
|------|------|------|-----|-----|
| Security | 1 | 2 | 0 | 1 |
| Practices | 0 | 2 | 3 | 2 |
| Integrity | 1 | 1 | 1 | 0 |
| Consistency | 0 | 1 | 1 | 0 |

🚨 2 critical issues — acción inmediata requerida.

**Críticos:**
1. [SECURITY] Canal público expone DNI y email → channel `consultorio-api`
2. [INTEGRITY] Relación rota `sesiones.paciente_id` → entidad `paciente` no existe

Reporte completo: `.planning/AUDIT.md`

¿Quieres que arregle los issues críticos y altos ahora?
```

If the user says yes, fix each issue using MCP operations, verify each fix, and re-run the specific checks to confirm resolution.

---

## Scope by Subcommand

| Subcommand | Dimensions | Focus |
|------------|------------|-------|
| `audit` (full) | All 4 | Everything |
| `audit security` | Security | Channels, rules, permissions |
| `audit practices` | Bad Practices | Data model, rules, naming |
| `audit integrity` | Data Integrity | Relations, orphans, draft/published mismatches |
| `audit consistency` | Consistency | Plan vs tenant, STATE.md accuracy |

---

## Reference

- `FYSO-REFERENCE.md` — Field types, MCP operations, DSL syntax, limitations
- Run the scan workflow first if you want a full tenant map before auditing
