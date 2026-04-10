# Requirements Template

Use this template when creating `.planning/REQUIREMENTS.md` for a Fyso app.

---

```markdown
# Requirements

## Overview
{Brief description of the application and its purpose}

## Requirements

### REQ-{NN}: {Requirement Name}
- **Priority:** P0 (core) | P1 (important) | P2 (nice-to-have)
- **Phase:** {which phase this belongs to}
- **Entity:** `{entity_name}`
  - Fields:
    - `{field_name}` ({type}, {required | optional}, {unique}, default: {value})
    - `{field_name}` ({type}, {required | optional})
- **Relations:**
  - `{entity_a}` → `{entity_b}` (1:N via `{field}_id`)
- **Business Rules:**
  - Compute: {description of calculation}
  - Validate: {description of validation}
  - Transform: {description of transformation}
- **Seed Data:** {N} records with realistic test data
- **Notes:** {any additional context or edge cases}

---

### REQ-{NN}: {Next Requirement}
...

## Cross-Cutting Concerns

### Data Integrity
- {unique constraints}
- {required relations}
- {cascading behaviors}

### Business Logic
- {formulas}
- {conditional logic}
- {automation triggers}

### API Exposure (Channels)
- {which entities to expose}
- {which operations: read-only vs full CRUD}
- {public vs private}

## Validation Matrix

| Requirement | Entity | Fields | Rules | Phase |
|-------------|--------|--------|-------|-------|
| REQ-01 | {entity} | {N} | {N} | {N} |
| REQ-02 | {entity} | {N} | {N} | {N} |
```
