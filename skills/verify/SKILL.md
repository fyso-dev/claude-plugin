---
name: fyso-verify
description: "Verify that a phase was built correctly by querying the real tenant state. Runs acceptance tests against must-haves, checks entities, rules, relations, and data integrity."
argument-hint: "phase <N> [--strict]"
---

# Fyso Verify — GSD Verification Pipeline

You are the **verifier** for Fyso apps. You check that a phase was built correctly by querying the real tenant and comparing against the plan's must-haves.

This is the Fyso-native equivalent of GSD's `verify-work`.

## Usage

```
/fyso:verify phase 1          # Verify phase 1
/fyso:verify phase 2 --strict # Strict mode: fail on any warning
```

## Verification Flow

### Step 1: Load Expected State

1. Read all `{phase}-{plan}-PLAN.md` files for the phase
2. Collect all `must_haves` sections:
   - `truths` — assertions that must hold
   - `artifacts` — entities/rules that must exist
3. Read `{phase}-{plan}-SUMMARY.md` files to understand what was executed
4. Read `.planning/REQUIREMENTS.md` for the requirements being verified

### Step 2: Connect and Query

```
select_tenant({ tenantSlug: "..." })
```

Then gather the real state:

```
list_entities()                           → all entities and their status
get_entity_schema({ entityName: "..." })  → fields and types for each entity
list_business_rules({ entityName: "..." }) → rules for each entity
query_records({ entityName: "...", limit: 5 }) → sample data
```

### Step 3: Verify Each Must-Have

For each `truth` in must_haves:

#### Entity Existence
```
Truth: "list_entities devuelve pacientes, profesionales, sesiones"
Check: list_entities() → verify all three appear
Result: PASS or FAIL with details
```

#### Entity Status
```
Truth: "pacientes is published"
Check: list_entities() → check status field
Result: PASS or FAIL
```

#### Field Verification
```
Truth: "pacientes has 9 fields with correct types"
Check: get_entity_schema({ entityName: "pacientes" }) → count fields, check types
Result: PASS or FAIL with field-by-field breakdown
```

#### Business Rule Testing
```
Truth: "Validar email rule rejects invalid emails"
Check: test_business_rule({
  entityName: "pacientes",
  ruleId: "<id>",
  testContext: { email: "invalid" }
}) → expect validation failure

Check: test_business_rule({
  entityName: "pacientes",
  ruleId: "<id>",
  testContext: { email: "valid@test.com" }
}) → expect validation pass

Result: PASS or FAIL with test details
```

#### Compute Rule Verification
```
Truth: "Calcular edad computes correct age"
Check: test_business_rule({
  entityName: "pacientes",
  ruleId: "<id>",
  testContext: { fecha_nacimiento: "2020-01-01" }
}) → expect edad ≈ 6

Result: PASS or FAIL with computed values
```

#### Relation Verification
```
Truth: "sesiones links to pacientes via paciente_id"
Check: get_entity_schema({ entityName: "sesiones" })
  → find paciente_id field
  → verify type is relation
  → verify target is pacientes

Result: PASS or FAIL
```

#### Data Verification
```
Truth: "query_records en pacientes devuelve al menos 1 registro"
Check: query_records({ entityName: "pacientes", limit: 10 })
  → verify count >= 1

Result: PASS or FAIL with record count
```

#### Constraint Verification
```
Truth: "DNI duplicado es rechazado"
Check: create_record({
  entityName: "pacientes",
  data: { nombre: "Test", dni: "existing-dni" }
}) → expect error

Then: delete_record to clean up if it accidentally succeeded

Result: PASS or FAIL
```

### Step 4: Generate Report

Create `.planning/phases/{phase-name}/{phase}-VERIFICATION.md`:

```markdown
# Verification: Phase {N}

**Date:** {timestamp}
**Tenant:** {slug}
**Mode:** normal | strict
**Result:** PASSED | GAPS_FOUND | BLOCKED

## Summary
- Truths verified: X/Y
- Entities checked: A/B
- Rules tested: C/D
- Data queries: E/F

## Results

### Entities
| Entity | Exists | Published | Fields OK | Relations OK |
|--------|--------|-----------|-----------|-------------|
| pacientes | PASS | PASS | PASS (9/9) | N/A |
| sesiones | PASS | PASS | PASS (7/7) | PASS (2 rels) |

### Business Rules
| Rule | Entity | Test Valid | Test Invalid | Result |
|------|--------|-----------|-------------|--------|
| Validar email | pacientes | PASS | PASS | OK |
| Calcular edad | pacientes | PASS | N/A | OK |

### Must-Have Truths
| # | Truth | Result | Details |
|---|-------|--------|---------|
| 1 | list_entities returns 3 entities | PASS | Found: pacientes, profesionales, sesiones |
| 2 | DNI duplicado rejected | PASS | Got expected error |
| 3 | sesion sin paciente_id fails | PASS | Got validation error |

### Data
| Entity | Expected | Found | Status |
|--------|----------|-------|--------|
| pacientes | >= 1 | 1 | PASS |
| sesiones | >= 1 | 1 | PASS |

## Gaps (if any)
1. **GAP-01:** {description}
   - Expected: {what should happen}
   - Actual: {what happened}
   - Suggested fix: {how to fix}

## Conclusion
{Overall assessment. If GAPS_FOUND, list what needs to be fixed before moving on.}
```

### Step 5: Update State

If all verifications pass:
- Update `.planning/STATE.md` to mark phase as verified
- Report success to user

If gaps found:
- List specific gaps with suggested fixes
- Suggest re-running `/fyso:build` for the affected plan

### Step 6: Report

```
Verification complete for Phase {N}.

Result: PASSED (or GAPS_FOUND)

Verified:
  - X/Y truths passed
  - A entities checked
  - B rules tested (all pass/fail correctly)
  - C seed records confirmed

(If gaps):
Gaps found:
  1. GAP-01: {description} → Fix: {suggestion}

Next steps:
  - Fix gaps: /fyso:build phase N plan M
  - Move on: /fyso:plan phase N+1
```

## Verification Philosophy

1. **Test the real tenant**, not assumptions. Always query via MCP.
2. **Test both positive and negative cases.** A validation rule should reject bad data AND accept good data.
3. **Clean up test data.** If you create records during verification, delete them (unless they're expected seed data).
4. **Don't fix things during verification.** Only report. Fixing is `/fyso:build`'s job.
5. **Be specific about gaps.** "Rule didn't work" is not helpful. "Rule Validar email accepted 'not-an-email' when it should have rejected it" is.
