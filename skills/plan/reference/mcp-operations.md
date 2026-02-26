# Fyso MCP Operations — Quick Reference

Complete reference of MCP tools available for planning and execution.

## Tenant Management

### select_tenant
Select a tenant to operate on.
```
select_tenant({ tenantSlug: "mi-consultorio" })
```
**Must be called before any other operation.**

### list_tenants
List available tenants.
```
list_tenants()
```

## Entity Operations

### generate_entity
Create an entity with all its fields in one call.
```
generate_entity({
  definition: {
    entity: {
      name: "invoices",           // lowercase, plural
      displayName: "Invoices",    // human-readable
      description: "Client invoices with tax calculation"
    },
    fields: [
      {
        name: "Customer",           // display name
        fieldKey: "customer",       // programmatic key
        fieldType: "relation",      // see field types below
        isRequired: true,
        config: {
          entity: "customers",      // relation target
          displayField: "name"      // what to show in UI
        }
      },
      {
        name: "Date",
        fieldKey: "date",
        fieldType: "date",
        isRequired: true
      },
      {
        name: "Subtotal",
        fieldKey: "subtotal",
        fieldType: "number",
        isRequired: true,
        config: { decimals: 2 }
      },
      {
        name: "Status",
        fieldKey: "status",
        fieldType: "select",
        config: {
          options: ["draft", "sent", "paid", "overdue"]
        }
      }
    ]
  },
  auto_publish: false,              // create as draft
  version_message: "Create invoices entity"
})
```

### list_entities
List all entities in the tenant.
```
list_entities({ include_drafts: true })
```

### get_entity_schema
Get field details for an entity.
```
get_entity_schema({ entityName: "invoices" })
```

### publish_entity
Publish a draft entity.
```
publish_entity({
  entityName: "invoices",
  version_message: "Initial publish with all fields"
})
```

### list_entity_changes
See pending changes on a draft entity.
```
list_entity_changes({ entityName: "invoices" })
```

## Field Types

| Type | Config | Example |
|------|--------|---------|
| `text` | — | names, titles, codes |
| `number` | `{ decimals: 0 }` | quantities, stock |
| `number` | `{ decimals: 2 }` | prices, totals, money |
| `email` | — | email addresses |
| `phone` | — | phone numbers |
| `date` | — | dates |
| `boolean` | — | yes/no flags |
| `select` | `{ options: ["a", "b"] }` | status, type, category |
| `relation` | `{ entity: "...", displayField: "..." }` | foreign keys |

## Business Rule Operations

### create_business_rule
Create a rule with explicit DSL.
```
create_business_rule({
  entityName: "invoices",
  name: "Calculate tax and total",
  description: "Compute tax from subtotal * rate, then total",
  triggerType: "field_change",        // or "before_save", "after_save"
  triggerFields: ["subtotal", "tax_rate"],
  ruleDsl: {
    compute: {
      tax: { type: "formula", expression: "subtotal * tax_rate / 100" },
      total: { type: "formula", expression: "subtotal + tax" }
    },
    validate: [
      {
        id: "positive_subtotal",
        condition: "subtotal >= 0",
        message: "Subtotal must be non-negative",
        severity: "error"
      }
    ],
    transform: {
      email: { type: "lowercase" }
    }
  },
  auto_publish: false
})
```

### generate_business_rule
Generate a rule from natural language.
```
generate_business_rule({
  entityName: "invoices",
  prompt: "When subtotal or tax_rate changes, calculate tax = subtotal * tax_rate / 100 and total = subtotal + tax",
  auto_publish: false
})
```

### list_business_rules
List rules for an entity.
```
list_business_rules({ entityName: "invoices" })
```

### get_business_rule
Get rule details.
```
get_business_rule({ entityName: "invoices", ruleId: "uuid" })
```

### test_business_rule
Test a rule with sample data.
```
test_business_rule({
  entityName: "invoices",
  ruleId: "uuid",
  testContext: {
    subtotal: 1000,
    tax_rate: 21
  }
})
// Expected: { tax: 210, total: 1210 }
```

### publish_business_rule
Publish a draft rule.
```
publish_business_rule({ entityName: "invoices", ruleId: "uuid" })
```

### delete_business_rule
Delete a rule.
```
delete_business_rule({ entityName: "invoices", ruleId: "uuid" })
```

## Record Operations

### create_record
Create a new record.
```
create_record({
  entityName: "invoices",
  data: {
    customer: "customer-uuid",
    date: "2026-02-25",
    subtotal: 1000,
    tax_rate: 21,
    status: "draft"
  }
})
```

### query_records
Query records with pagination and filters.
```
query_records({
  entityName: "invoices",
  limit: 10,
  page: 1,
  sort: "date",
  order: "desc",
  filters: { status: "paid" }
})
```

### update_record
Update a record.
```
update_record({
  entityName: "invoices",
  id: "record-uuid",
  data: { status: "paid" }
})
```

### delete_record
Delete a record.
```
delete_record({
  entityName: "invoices",
  id: "record-uuid"
})
```

## Metadata Operations

### export_metadata
Export the entire tenant schema as JSON.
```
export_metadata({ tenantId: "mi-consultorio" })
```
Returns a JSON snapshot of all entities, fields, and rules.

### import_metadata
Import a metadata snapshot into a tenant.
```
import_metadata({
  metadata: "<JSON string>",
  tenantId: "mi-consultorio"
})
```

## Channel Operations

### publish_channel
Create/publish a channel.
```
publish_channel({
  name: "Consultorio API",
  description: "API for the clinic",
  tags: ["health", "clinic"]
})
```

### define_channel_tool
Define a tool on a channel.
```
define_channel_tool({
  channelId: "uuid",
  toolName: "buscar-pacientes",
  description: "Search patients by name or DNI",
  parameters: {
    query: { type: "string", description: "Search text", required: true }
  },
  entityMapping: {
    entity: "pacientes",
    operation: "semantic_search"
  }
})
```

### set_channel_permissions
Configure channel access.
```
set_channel_permissions({
  channelId: "uuid",
  config: {
    public: true,
    allowedOperations: ["query", "read", "create", "update"]
  }
})
```

### search_channels
Discover channels.
```
search_channels({ query: "clinic", tags: ["health"] })
```

### get_channel_tools
List tools on a channel.
```
get_channel_tools({ channelId: "uuid" })
```

### execute_channel_tool
Execute a tool on a channel.
```
execute_channel_tool({
  channelId: "uuid",
  toolName: "buscar-pacientes",
  params: { query: "García" }
})
```

## Custom Fields

### manage_custom_fields
CRUD for custom (non-system) fields.
```
manage_custom_fields({
  action: "list" | "add" | "update" | "delete",
  entityName: "products",
  type: "custom" | "system" | "all",       // for list
  fieldData: { ... },                       // for add/update
  fieldId: "uuid"                           // for update/delete
})
```
