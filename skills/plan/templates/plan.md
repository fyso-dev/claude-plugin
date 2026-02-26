# Plan Template

Use this template when creating plan files in `.planning/phases/{phase-name}/`.

---

```markdown
---
phase: {phase-id}-{phase-name}
plan: {plan-number}
type: execute
wave: {wave-number}
depends_on: [{list of plan IDs this depends on}]
tenant: {tenant-slug}
autonomous: true
requirements: [{REQ-01, REQ-02, ...}]
entities_affected:
  - {entity-name-1}
  - {entity-name-2}

must_haves:
  truths:
    - "{assertion about tenant state that must be true after execution}"
    - "{another assertion}"
  artifacts:
    - entity: "{entity-name}"
      status: "published"
      fields: {count}
      rules: {count}
    - entity: "{entity-name}"
      status: "published"
      fields: {count}
      rules: {count}
---

<objective>
{What this plan achieves in 1-3 sentences.}

Purpose: {Why this matters for the overall project.}
Output: {Concrete deliverables — entities created, rules configured, data seeded, etc.}
</objective>

<context>
Tenant: {slug}
MCP: Fyso (connected)
Dependencies: {what must exist before this plan runs}

@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
{@.planning/phases/{phase}/{context-file} if exists}
</context>

<tasks>

<task type="auto">
  <name>Task 1: {descriptive name}</name>
  <action>
  1. select_tenant({ tenantSlug: "{slug}" })
  2. {MCP operation with full parameters}
  3. {MCP operation with full parameters}
  ...
  </action>
  <verify>
  - {MCP query to verify} → expected result
  - {MCP query to verify} → expected result
  </verify>
  <done>{What's true when this task is complete}</done>
</task>

<task type="auto">
  <name>Task 2: {descriptive name}</name>
  <action>
  1. select_tenant({ tenantSlug: "{slug}" })
  2. {MCP operation}
  ...
  </action>
  <verify>
  - {verification}
  </verify>
  <done>{completion statement}</done>
</task>

</tasks>

<verification>
{Overall verification steps after all tasks complete}
1. {Check 1}
2. {Check 2}
...
</verification>

<success_criteria>
- {Criterion 1}
- {Criterion 2}
...
</success_criteria>

<output>
After completion, create `.planning/phases/{phase-name}/{phase}-{plan}-SUMMARY.md`
Export metadata to `.planning/snapshots/{phase}-{plan}.json`
</output>
```

## Notes for Plan Authors

### Task Types
- `type="auto"` — Builder executes without user interaction
- `type="confirm"` — Builder pauses and asks user before proceeding (for destructive operations)

### MCP Operation Format
Always write the full operation with all parameters:
```
generate_entity({
  definition: {
    entity: { name: "invoices", displayName: "Invoices", description: "..." },
    fields: [
      { name: "Name", fieldKey: "name", fieldType: "text", isRequired: true },
      ...
    ]
  },
  auto_publish: false,
  version_message: "Create invoices entity"
})
```

NOT shorthand like:
```
create entity invoices
```

### Verification Format
Always specify the expected result:
```
list_entities() → must include "invoices" with status "draft"
test_business_rule(ruleId, { subtotal: 1000 }) → expect tax = 210, total = 1210
create_record(pacientes, { dni: "existing" }) → must fail with unique constraint error
```

### Must-Haves
These are the acceptance criteria for `/fyso:verify`. Be specific:

Good: `"test_business_rule with {subtotal: 1000, tax_rate: 21} returns {tax: 210, total: 1210}"`
Bad: `"invoice calculation works"`

Good: `"create_record with duplicate DNI is rejected"`
Bad: `"unique constraints work"`
