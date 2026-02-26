---
name: fyso-expose
description: "Create channels and channel tools to expose your Fyso app as an API. Other agents and apps can discover and use your tools via MCP."
argument-hint: "[entity-name | all]"
---

# Fyso Expose — Channel & API Creation

You create **channels** that expose your Fyso app's data as discoverable tools. Other agents (Claude, bots, apps) can find your channel and execute operations against your entities — without writing code.

This is a Fyso-specific command with no GSD equivalent.

## Usage

```
/fyso:expose                  # Interactive: ask what to expose
/fyso:expose pacientes        # Expose CRUD tools for pacientes entity
/fyso:expose all              # Expose tools for all published entities
```

## Flow

### Step 1: Assess What's Available

```
select_tenant({ tenantSlug: "..." })
list_entities()
```

Only published entities can be exposed via channels. If entities are in draft, warn the user and suggest publishing first.

### Step 2: Design the Channel

Ask the user (or infer from context):

1. **Channel name**: "Consultorio API", "Mi Tienda", etc.
2. **Description**: What this channel does
3. **Tags**: For discovery (e.g., "health", "clinic", "appointments")
4. **Scope**: Which entities to expose
5. **Operations per entity**: Which CRUD operations to allow

Default operations per entity:
- `buscar-{entity}` — semantic search / query
- `crear-{entity}` — create record
- `listar-{entity}` — list records with filters
- `obtener-{entity}` — get single record by ID
- `actualizar-{entity}` — update record
- `eliminar-{entity}` — delete record

For read-only entities, only expose search/list/get.

### Step 3: Create the Channel

```
publish_channel({
  name: "Consultorio API",
  description: "API del consultorio de fonoaudiología. Gestiona pacientes, sesiones y facturación.",
  tags: ["health", "clinic", "fonoaudiologia"]
})
```

### Step 4: Define Tools

For each entity being exposed:

```
define_channel_tool({
  channelId: "<channel-id>",
  toolName: "buscar-pacientes",
  description: "Buscar pacientes por nombre, DNI o cualquier campo",
  parameters: {
    query: { type: "string", description: "Texto de búsqueda", required: true }
  },
  entityMapping: {
    entity: "pacientes",
    operation: "semantic_search"
  }
})

define_channel_tool({
  channelId: "<channel-id>",
  toolName: "agendar-sesion",
  description: "Crear una nueva sesión de atención",
  parameters: {
    paciente_id: { type: "string", description: "ID del paciente", required: true },
    profesional_id: { type: "string", description: "ID del profesional", required: true },
    fecha: { type: "string", description: "Fecha de la sesión (YYYY-MM-DD)", required: true },
    duracion_min: { type: "number", description: "Duración en minutos", required: false },
    notas: { type: "string", description: "Notas para la sesión", required: false }
  },
  entityMapping: {
    entity: "sesiones",
    operation: "create",
    fieldMapping: {
      paciente_id: "paciente_id",
      profesional_id: "profesional_id",
      fecha: "fecha",
      duracion_min: "duracion_min",
      notas_clinicas: "notas"
    }
  }
})
```

### Step 5: Set Permissions

```
set_channel_permissions({
  channelId: "<channel-id>",
  config: {
    public: true,
    allowedOperations: ["query", "create", "read", "update"],
    // or more restrictive:
    // allowedOperations: ["query", "read"]
  }
})
```

### Step 6: Verify

Test each tool:

```
execute_channel_tool({
  channelId: "<channel-id>",
  toolName: "buscar-pacientes",
  params: { query: "test" }
})
```

### Step 7: Report

```markdown
Channel created: "Consultorio API"

Tools exposed:
  - buscar-pacientes (semantic search)
  - crear-paciente (create)
  - listar-pacientes (query with filters)
  - agendar-sesion (create session)
  - listar-sesiones (query sessions)

Access:
  - Public: yes
  - Discovery: search_channels({ query: "consultorio" })
  - Usage: execute_channel_tool({ channelId: "...", toolName: "...", params: {...} })

Other agents can now find and use your API via MCP!
```

## Best Practices

1. **Tool names are verbs**: "buscar-pacientes", not "pacientes-search"
2. **Descriptions are for agents**: Write them as if explaining to an AI what the tool does
3. **Parameter descriptions matter**: They help agents understand what to pass
4. **Don't expose everything**: Only expose what external consumers need
5. **Test before publishing**: Always verify at least one tool works
6. **Slugs are global**: Once a channel slug is deleted, it can't be reused. Choose carefully.
