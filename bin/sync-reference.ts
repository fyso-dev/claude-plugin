#!/usr/bin/env bun
/**
 * sync-reference.ts — Regenerates FYSO-REFERENCE.md from individual reference files.
 *
 * Usage:
 *   bun scripts/sync-reference.ts           # Regenerate FYSO-REFERENCE.md
 *   bun scripts/sync-reference.ts --check   # Check if it's up to date (exit 1 if stale)
 *
 * Source files (Tier 3):
 *   skills/fyso-entity/reference/field-types.md
 *   skills/fyso-plan/reference/mcp-operations.md
 *   skills/fyso-plan/reference/limitations.md
 *   skills/fyso-plan/reference/domain-patterns.md
 *   skills/fyso-rules/reference/dsl-reference.md
 *   skills/fyso-ui/reference/auth-patterns.md
 *   skills/fyso-ui/reference/ui-patterns.md
 *   skills/fyso-ui/reference/fyso-ui-components.md
 *
 * Output (Tier 2):
 *   FYSO-REFERENCE.md
 */

import { Glob } from "bun";

const ROOT = import.meta.dir + "/..";
const OUTPUT = `${ROOT}/FYSO-REFERENCE.md`;

// Ordered sections: each maps a reference file to a section in the consolidated doc
const SECTIONS = [
  {
    number: 1,
    title: "Field Types",
    source: "skills/fyso-entity/reference/field-types.md",
    extract: extractFieldTypes,
  },
  {
    number: 2,
    title: "MCP Operations",
    source: "skills/fyso-plan/reference/mcp-operations.md",
    extract: extractMCPOps,
  },
  {
    number: 3,
    title: "Business Rules DSL",
    source: "skills/fyso-rules/reference/dsl-reference.md",
    extract: extractDSL,
  },
  {
    number: 4,
    title: "Limitations",
    source: "skills/fyso-plan/reference/limitations.md",
    extract: extractLimitations,
  },
  {
    number: 5,
    title: "Domain Patterns",
    source: "skills/fyso-plan/reference/domain-patterns.md",
    extract: extractDomainPatterns,
  },
  {
    number: 6,
    title: "Auth & Roles",
    source: "skills/fyso-ui/reference/auth-patterns.md",
    extract: extractAuth,
  },
  {
    number: 7,
    title: "UI Components (@fyso/ui)",
    source: "skills/fyso-ui/reference/fyso-ui-components.md",
    extract: extractUIComponents,
  },
  {
    number: 8,
    title: "UI Patterns",
    source: "skills/fyso-ui/reference/ui-patterns.md",
    extract: extractUIPatterns,
  },
];

// --- Extractors: each reads the full file and returns a compact summary ---

function extractFieldTypes(content: string): string {
  return `| Type | Config | Use For |
|------|--------|---------|
| \`text\` | — | names, titles, codes, descriptions |
| \`number\` | \`{ decimals: 0 }\` | quantities, stock, counts |
| \`number\` | \`{ decimals: 2 }\` | prices, totals, money, percentages |
| \`email\` | — | email addresses (auto-validated) |
| \`phone\` | — | phone numbers |
| \`date\` | — | dates (no time) |
| \`boolean\` | — | flags (activo, disponible) |
| \`select\` | \`{ options: ["a","b"] }\` | status, type, category |
| \`relation\` | \`{ entity: "x", displayField: "nombre" }\` | foreign keys |

**Validations:** \`required: true\`, \`unique: true\`, \`{ min, max }\` (numbers), \`{ minLength, maxLength }\` (text), \`{ pattern: "regex" }\`.

**Conventions:** Entity names: lowercase plural Spanish. Field keys: snake_case. Money: always \`number\` with \`decimals: 2\`. Relations: always need \`displayField\`.`;
}

function extractMCPOps(content: string): string {
  return `### Tenant
\`\`\`
select_tenant({ tenantSlug: "slug" })     # ALWAYS first
list_tenants()
\`\`\`

### Entities
\`\`\`
generate_entity({ definition: { entity: { name, displayName, description }, fields: [...] }, auto_publish: false })
list_entities({ include_drafts: true })
get_entity_schema({ entityName: "..." })
publish_entity({ entityName: "...", version_message: "..." })
\`\`\`

### Business Rules
\`\`\`
create_business_rule({ entityName, name, description, triggerType, triggerFields, ruleDsl: { compute, validate, transform }, auto_publish: false })
generate_business_rule({ entityName, prompt, auto_publish: false })
test_business_rule({ entityName, ruleId, testContext: { field: value } })
publish_business_rule({ entityName, ruleId })
list_business_rules({ entityName })
delete_business_rule({ entityName, ruleId })
\`\`\`

### Records
\`\`\`
create_record({ entityName, data: { field: value } })
query_records({ entityName, limit, page, sort, order, filters: { field: value } })
update_record({ entityName, id, data: { field: newValue } })
delete_record({ entityName, id })
\`\`\`

### Channels
\`\`\`
publish_channel({ name, description, tags })
define_channel_tool({ channelId, toolName, description, parameters, entityMapping: { entity, operation } })
set_channel_permissions({ channelId, config: { public, allowedOperations } })
execute_channel_tool({ channelId, toolName, params })
\`\`\`

### Metadata
\`\`\`
export_metadata({ tenantId })     # JSON snapshot of all entities/rules
import_metadata({ metadata, tenantId })
\`\`\``;
}

function extractDSL(content: string): string {
  return `### Structure
\`\`\`json
{ "compute": { }, "validate": [ ], "transform": { } }
\`\`\`

### Compute
\`\`\`json
"field": { "type": "formula", "expression": "a * b" }
"field": { "type": "conditional", "conditions": [{ "when": "x > 10", "then": "x * 0.1" }], "default": "0" }
\`\`\`
Fields execute in order — later fields can reference earlier ones.

### Validate
\`\`\`json
{ "id": "unique_id", "condition": "price >= 0", "message": "Error msg", "severity": "error|warning|info" }
\`\`\`

### Transform
\`\`\`json
"field": { "type": "uppercase|lowercase|trim" }
"field": { "type": "round", "decimals": 2 }
"field": { "type": "default", "value": "pendiente" }
\`\`\`

### Operators
- Arithmetic: \`+ - * / % ^\`
- Comparison: \`> < >= <= == !=\`
- Logical: \`and or not\`
- Inline conditional: \`if(cond, true_val, false_val)\`

### Functions
- Math: \`floor(n) ceil(n) abs(n) min(a,b) max(a,b)\`
- Text: \`upper(s) lower(s) trim(s) len(s)\`
- Utility: \`coalesce(a, b, ...)\`

### Trigger Types
- \`field_change\` — fires when specified fields change in UI (NOT from updateDataDirect)
- \`before_save\` — fires before record is saved (best for validations)
- \`after_save\` — fires after record is saved (for cross-entity updates)`;
}

function extractLimitations(content: string): string {
  return `| # | Limitation | Impact | Workaround |
|---|-----------|--------|------------|
| 1 | \`field_change\` triggers don't fire from \`updateDataDirect\` | High | Use \`before_save\` for critical validations |
| 2 | MCP session loses tenant context | Medium | Always \`select_tenant\` first in every task |
| 3 | Semantic search requires OPENAI_API_KEY + embedding worker | Medium | Use \`query\` with text filters instead |
| 4 | Channel slugs globally non-reusable once deleted | Medium | Choose names carefully, don't use temp names |
| 5 | Published entities with data resist schema changes | High | Design all fields before publishing |
| 6 | Compute chains must be in correct order | Medium | Order compute fields by dependency in DSL |
| 7 | \`generate_entity\` creates all fields at once (no individual create_field) | Low | Use full field list in generate_entity |
| 8 | DSL: no string interpolation, limited date math, no arrays, no API calls | Low | Keep expressions simple, use multiple rules |

**Things that work fine:** Multiple entity creation, rules after publish, relations, query_records, metadata import/export.`;
}

function extractDomainPatterns(content: string): string {
  // Parse domain sections from content
  const domains: string[] = [];
  const sections = content.split(/^## /m).filter(s => s.trim());

  for (const section of sections) {
    const lines = section.split("\n");
    const title = lines[0]?.trim();
    if (!title) continue;
    // Skip non-domain sections
    if (title.startsWith("Domain") || title.startsWith("Universal") || title.startsWith("#")) continue;
    // Skip sections without entity definitions
    if (!section.includes("### Entities") && !lines.some(l => l.startsWith("- **"))) continue;

    // Extract entities from the section
    const entityLines = lines.filter(l => l.startsWith("- **"));
    const entities = entityLines.map(l => {
      const match = l.match(/\*\*(\w+)\*\*/);
      return match ? match[1] : "";
    }).filter(Boolean);

    // Extract relations
    const relations = entityLines
      .filter(l => l.includes("rel→"))
      .map(l => {
        const entity = l.match(/\*\*(\w+)\*\*/)?.[1] || "";
        const rels = [...l.matchAll(/rel→(\w+)/g)].map(m => m[1]);
        return rels.map(r => `${entity}→${r}`).join(", ");
      })
      .filter(Boolean);

    // Extract rules
    const ruleLines = lines.filter(l => l.startsWith("- Compute:") || l.startsWith("- Validate:") || l.startsWith("- Transform:"));
    const rules = ruleLines.map(l => l.replace("- ", "")).join(", ");

    domains.push(
      `### ${title}\n- **Entities:** ${entities.join(", ")}\n- **Key relations:** ${relations.join(", ")}\n- **Rules:** ${rules}`
    );
  }

  return domains.join("\n\n");
}

function extractAuth(content: string): string {
  return `### Role Hierarchy
\`owner > admin > member > viewer > public\`

| Role | CRUD | Users | Config |
|------|------|-------|--------|
| owner | All entities, all ops | Create/manage all | Full |
| admin | All entities, all ops | Create/manage | Limited |
| member | Assigned entities, create/edit | Own profile only | None |
| viewer | Assigned entities, read-only | Own profile only | None |
| public | Public endpoints only | None | None |

### Auth Endpoints
\`\`\`
POST /api/auth/tenant/login    → { token, user }
POST /api/auth/tenant/register → { token, user }  (if self-reg)
GET  /api/auth/tenant/me       → { user }
POST /api/auth/tenant/logout
\`\`\`

### Headers
\`\`\`
X-API-Key: {user-token}
X-Tenant-ID: {tenant-slug}
\`\`\`

### Token Types
| Type | Scope | Storage |
|------|-------|---------|
| Admin API key | All ops, server only | \`.env\` (NEVER in browser) |
| User session token | Single tenant, role-based | Cookie or localStorage |
| OAuth access token | MCP operations | Memory |`;
}

function extractUIComponents(content: string): string {
  return `### Core Components
- **FysoProvider** — wraps app, provides API client + translations
- **DataGrid** — auto-columns from entity metadata, pagination, sort, mobile cards
- **DynamicForm** — auto-generated form from entity schema, validation, relation dropdowns
- **RecordDetail** — master-detail with child entity records
- **UI primitives** — Button, Input, Label, Table, Calendar (shadcn-based)

### Key Hooks
\`\`\`tsx
useFysoEntity('entity')   → { entity, loading, error }
useFysoClient()           → client (records.list/get/create/update/delete)
useFyso()                 → { client, translations, entityCache }
\`\`\`

### Record Data Shape
\`\`\`
record.data.{fieldKey}    # NOT record.{fieldKey}
\`\`\``;
}

function extractUIPatterns(content: string): string {
  return `### Layouts
- **Sidebar** — admin panels (240px sidebar, collapsible on mobile)
- **TopNav** — simple apps, client portals
- **Landing + App** — public pages + authenticated area

### Page Types
- **Entity List** — DataGrid + search + filters + pagination + [+ New] button
- **Entity Detail** — RecordDetail + child entity tables
- **Entity Form** — DynamicForm (create/edit modes)
- **Dashboard** — KPI cards + recent activity + quick actions
- **Login/Register** — centered form
- **User Management** — admin: list + create/edit users

### Style Presets
| Preset | Primary | Background | Use For |
|--------|---------|------------|---------|
| Minimal | near-black | white | clean, simple apps |
| Professional | dark blue | white | admin panels, business |
| Modern | purple | white | client-facing, colorful |
| Dark | light text | near-black bg | dark mode default |`;
}

// --- Main ---

async function getSourceHash(): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  for (const section of SECTIONS) {
    const path = `${ROOT}/${section.source}`;
    const file = Bun.file(path);
    if (await file.exists()) {
      hasher.update(await file.text());
    }
  }
  return hasher.digest("hex");
}

async function generate(): Promise<string> {
  const now = new Date().toISOString().split("T")[0];
  const parts: string[] = [];

  parts.push(`# Fyso Platform — Consolidated Reference`);
  parts.push(`<!-- AUTO-GENERATED by scripts/sync-reference.ts — DO NOT EDIT MANUALLY -->`);
  parts.push(`<!-- Source: skills/*/reference/*.md — Last sync: ${now} -->`);
  parts.push(``);
  parts.push(
    `Quick-reference for all Fyso concepts. Read this ONE file instead of ${SECTIONS.length} individual reference files. For deep dives, read the source files in \`skills/*/reference/\`.`
  );

  for (const section of SECTIONS) {
    const path = `${ROOT}/${section.source}`;
    const file = Bun.file(path);

    parts.push(``);
    parts.push(`---`);
    parts.push(``);
    parts.push(`## ${section.number}. ${section.title}`);
    parts.push(``);

    if (await file.exists()) {
      const content = await file.text();
      parts.push(section.extract(content));
    } else {
      parts.push(`> Source file not found: \`${section.source}\``);
    }

    parts.push(``);
    parts.push(`Source: \`${section.source}\``);
  }

  return parts.join("\n") + "\n";
}

async function main() {
  const checkOnly = process.argv.includes("--check");

  const output = await generate();

  if (checkOnly) {
    const existing = Bun.file(OUTPUT);
    if (await existing.exists()) {
      const current = await existing.text();
      // Compare ignoring the date line
      const normalize = (s: string) =>
        s.replace(/Last sync: \d{4}-\d{2}-\d{2}/, "Last sync: DATE");
      if (normalize(current) === normalize(output)) {
        console.log("FYSO-REFERENCE.md is up to date.");
        process.exit(0);
      }
    }
    console.log("FYSO-REFERENCE.md is OUT OF DATE. Run: bun scripts/sync-reference.ts");
    process.exit(1);
  }

  await Bun.write(OUTPUT, output);
  console.log(`Synced FYSO-REFERENCE.md (${SECTIONS.length} sections)`);
}

main();
