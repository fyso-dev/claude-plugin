---
name: fyso-add-entity
description: Add a new entity to your Fyso app with proper field types, relations, and business rules.
disable-model-invocation: true
---

# Add Entity - Fyso

Guided entity creation following Fyso best practices for field types, relations, and business rules.

## Flow

### Step 1: Understand what data the builder needs

Ask what they want to manage. Examples:

- "I need to track customers with name, email, phone"
- "I want an invoices table linked to customers"
- "Add a products entity with price, stock, and category"

### Step 2: Check existing entities

Before creating, see what already exists:

```
list_entities()
```

This helps suggest relations to existing entities.

### Step 3: Propose the entity schema

Map the builder's description to proper Fyso field types:

| Builder says | Field type | Config |
|-------------|------------|--------|
| name, title, code | `text` | — |
| description, notes, comments | `text` | — |
| price, cost, total, amount | `number` | `{ decimals: 2 }` |
| quantity, stock, count | `number` | `{ decimals: 0 }` |
| email | `email` | — |
| phone | `phone` | — |
| date, start_date, due_date | `date` | — |
| active, published, paid | `boolean` | — |
| status, type, category | `select` | `{ options: [...] }` |
| customer, project, invoice | `relation` | `{ entity: "..." }` |

Present the proposed schema clearly:

```
Here's what I'll create:

Entity: invoices
Fields:
  - customer (relation → customers)
  - date (date, required)
  - items (text, for line item descriptions)
  - subtotal (number, 2 decimals)
  - tax_rate (number, 2 decimals, default: 21)
  - tax (number, 2 decimals)
  - total (number, 2 decimals)
  - status (select: draft / sent / paid / overdue, default: draft)
  - notes (text)

Shall I create this?
```

### Step 4: Create the entity

Use `generate_entity` with the proper definition:

```
generate_entity({
  definition: {
    entity: {
      name: "invoices",
      displayName: "Invoices",
      description: "Customer invoices with tax calculation"
    },
    fields: [
      { name: "Customer", fieldKey: "customer", fieldType: "relation", isRequired: true, config: { entity: "customers", displayField: "name" } },
      { name: "Date", fieldKey: "date", fieldType: "date", isRequired: true },
      { name: "Subtotal", fieldKey: "subtotal", fieldType: "number", isRequired: true, config: { decimals: 2 } },
      { name: "Tax Rate", fieldKey: "tax_rate", fieldType: "number", config: { decimals: 2 } },
      { name: "Tax", fieldKey: "tax", fieldType: "number", config: { decimals: 2 } },
      { name: "Total", fieldKey: "total", fieldType: "number", config: { decimals: 2 } },
      { name: "Status", fieldKey: "status", fieldType: "select", config: { options: ["draft", "sent", "paid", "overdue"] } },
      { name: "Notes", fieldKey: "notes", fieldType: "text" }
    ]
  },
  auto_publish: true,
  version_message: "Create invoices entity"
})
```

### Step 5: Suggest business rules

After creating the entity, propose useful rules based on the fields:

**For entities with calculated fields:**
```
generate_business_rule({
  entityName: "invoices",
  prompt: "When subtotal or tax_rate changes, calculate tax = subtotal * tax_rate / 100 and total = subtotal + tax",
  auto_publish: true
})
```

**For entities with stock/inventory:**
```
generate_business_rule({
  entityName: "products",
  prompt: "When stock drops below 10, set low_stock to true",
  auto_publish: true
})
```

**For entities with status workflows:**
```
generate_business_rule({
  entityName: "invoices",
  prompt: "When status changes to paid, set paid_date to today",
  auto_publish: true
})
```

Only suggest rules that make sense for the entity. Don't force rules on simple entities.

### Step 6: Confirm creation

```
Entity "invoices" created and published!

Fields: 8 (1 relation, 3 numbers, 1 date, 1 select, 1 text)
Relations: customers → invoices
Business rules: 1 (auto-calculate tax and total)

You can now:
  - Create records: create_record({ entityName: "invoices", data: { ... } })
  - Query records: query_records({ entityName: "invoices" })
  - Add another entity: /fyso-add-entity
```

## Field Type Reference

See [reference/field-types.md](reference/field-types.md) for complete field type documentation.

## Examples

See [examples/freelancer-entities.md](examples/freelancer-entities.md) for a complete freelancer app entity set.

## Best Practices

1. **Naming**: Entity names are lowercase, plural (customers, invoices, products)
2. **Relations**: Always specify `displayField` so the UI shows meaningful text
3. **Required fields**: Mark key identifiers as required (name, email, date)
4. **Select fields**: Provide sensible default options, builder can change later
5. **Numbers**: Use `decimals: 2` for money, `decimals: 0` for quantities
6. **Business rules**: Suggest after creation, not before — keep the flow fast
