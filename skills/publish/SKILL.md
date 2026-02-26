---
name: fyso-publish
description: Publish your Fyso app to the public catalog for others to install.
disable-model-invocation: true
---

# Publish App - Fyso

Publish your app to the Fyso catalog so other builders can install it as a prebuild.

## Flow

### Step 1: Validate the app

Check that the app has published entities:

```
list_entities()
```

If there are no published entities, stop and suggest:
"Your app doesn't have any published entities yet. Use `/fyso-add-entity` to create some first."

If there are draft (unpublished) entities, warn:
"You have draft entities that haven't been published. Want me to publish them first?"

### Step 2: Generate app description

Based on the entities and their fields, generate a description:

```
get_entity_schema({ entityName: "..." })  # For each entity
list_business_rules({ entityName: "..." })  # For each entity
```

Propose a catalog entry:

```
App: "Dental Clinic Manager"
Description: Complete management system for dental clinics with patient records,
treatment catalog, appointment scheduling, and invoice generation with automatic
tax calculation.

Entities: patients, treatments, appointments, invoices
Business Rules: 2 (invoice calculation, appointment-to-invoice)

Category: Healthcare
Tags: clinic, patients, appointments, billing
```

Ask the builder to confirm or edit the description.

### Step 3: Export metadata

```
export_metadata({ tenantId: "current-tenant-slug" })
```

This creates a JSON snapshot of the entire app schema (entities, fields, rules) that can be imported into any other tenant.

### Step 4: Show results

```
Your app "Dental Clinic Manager" is ready to share!

Metadata exported successfully.
Any builder can install this app using:

  /fyso-new-app → select your prebuild

To share manually:
  1. Save the exported metadata JSON
  2. Share it with other builders
  3. They can import it with: import_metadata({ metadata: "...", tenantId: "their-tenant" })

The app includes:
  - 4 entities with all fields and validations
  - 2 business rules
  - Ready to use immediately after import
```

## Notes

- Publishing exports the schema only, not the data (records)
- Business rules are included in the export
- Custom fields added by end users are NOT included (only system fields)
- The builder can re-publish anytime to update the catalog entry
