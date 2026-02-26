---
name: fyso-status
description: "Show the current status of your Fyso project. Reads STATE.md and optionally queries the live tenant to compare planned vs actual state."
argument-hint: "[--live]"
disable-model-invocation: true
---

# Fyso Status — Project State Dashboard

Quick view of where your Fyso project stands.

## Usage

```
/fyso:status           # Read from STATE.md (fast, offline)
/fyso:status --live    # Also query the real tenant to compare
```

## Output: Offline Mode

Read `.planning/STATE.md` and `.planning/ROADMAP.md` and display:

```markdown
# Project Status: {app-name}

## Position
- **Tenant:** {slug}
- **Current Phase:** {phase-name}
- **Current Plan:** {plan-id}
- **Last Activity:** {date}

## Roadmap Progress
| Phase | Name | Plans | Status |
|-------|------|-------|--------|
| 1 | Entidades base | 4 | DONE |
| 2 | Reglas de negocio | 3 | IN PROGRESS (2/3) |
| 3 | Channels | 2 | PENDING |

## Entities ({count})
| Entity | Status | Fields | Rules | Records |
|--------|--------|--------|-------|---------|
| pacientes | published | 9 | 2 | 15 |
| profesionales | published | 3 | 0 | 3 |
| sesiones | published | 7 | 1 | 42 |

## Business Rules ({count})
| Rule | Entity | Type | Tested | Status |
|------|--------|------|--------|--------|
| Validar email | pacientes | validate | yes | published |
| Calcular edad | pacientes | compute | yes | published |

## Channels ({count})
| Channel | Tools | Status |
|---------|-------|--------|
| (none yet) | — | — |

## Next Steps
- {Based on current position, suggest the next action}
```

## Output: Live Mode

Everything from offline mode, plus:

1. Select tenant and query actual state
2. Compare planned (STATE.md) vs actual (tenant):
   - Entities that exist in plan but not in tenant → MISSING
   - Entities that exist in tenant but not in plan → UNPLANNED
   - Rules that should be tested but aren't → UNTESTED
   - Published entities that are still draft → NOT PUBLISHED

```markdown
## Live Comparison

### Drift Report
| Item | Planned | Actual | Status |
|------|---------|--------|--------|
| pacientes | published | published | OK |
| facturas | published | draft | DRIFT |
| inventario | (not planned) | published | UNPLANNED |

### Issues Found
- facturas: planned as published but still in draft
- inventario: exists in tenant but not in any requirement

### Recommendation
- Publish facturas: `publish_entity({ entityName: "facturas" })`
- Add inventario to REQUIREMENTS.md or remove from tenant
```

## When to Use

- **Start of session**: Quick context recovery
- **After a build**: See what changed
- **Before planning next phase**: Know where you stand
- **Debugging**: Find drift between plan and reality
