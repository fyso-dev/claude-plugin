---
name: fyso-mcp
description: Configurar Claude Desktop o Claude Code para conectar con el servidor MCP de Fyso.
argument-hint: [setup|status|test]
disable-model-invocation: true
allowed-tools: Bash(cat *), Bash(echo *), Bash(mkdir *)
---

# Configuración MCP - Fyso

Configura tu cliente Claude para usar las herramientas MCP de Fyso.

## ¿Qué es MCP?

Model Context Protocol (MCP) permite que Claude acceda a herramientas externas. Con Fyso MCP puedes:

- Crear y gestionar entidades
- Crear reglas de negocio
- Consultar y modificar datos
- Ejecutar tests

## Configuración

### Para Claude Desktop

1. **Ubicar archivo de configuración:**

   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Agregar configuración de Fyso:**

```json
{
  "mcpServers": {
    "fyso": {
      "command": "bun",
      "args": ["run", "/path/to/fyso/packages/mcp-server/src/index.ts"],
      "env": {
        "API_URL": "http://localhost:3001"
      }
    }
  }
}
```

3. **Reiniciar Claude Desktop**

### Para Claude Code

1. **Crear/editar configuración MCP:**

```bash
mkdir -p ~/.claude
```

2. **Agregar a `~/.claude/settings.json`:**

```json
{
  "mcpServers": {
    "fyso": {
      "command": "bun",
      "args": ["run", "/path/to/fyso/packages/mcp-server/src/index.ts"],
      "env": {
        "API_URL": "http://localhost:3001"
      }
    }
  }
}
```

### Opción HTTP (Alternativa)

Si prefieres conectar via HTTP:

1. **Iniciar servidor MCP:**

```bash
cd /path/to/fyso/packages/mcp-server
bun run start:http
```

2. **Configurar cliente:**

```json
{
  "mcpServers": {
    "fyso": {
      "url": "http://localhost:3002/mcp",
      "transport": "sse"
    }
  }
}
```

## Verificar Conexión

### 1. Ver herramientas disponibles

Pregunta a Claude:
```
¿Qué herramientas de Fyso tienes disponibles?
```

Debería listar 16 herramientas:
- `generate_entity`
- `list_entities`
- `get_entity_schema`
- `query_records`
- `create_record`
- `update_record`
- `delete_record`
- `publish_entity`
- `list_entity_changes`
- `generate_business_rule`
- `create_business_rule`
- `list_business_rules`
- `get_business_rule`
- `test_business_rule`
- `publish_business_rule`
- `delete_business_rule`

### 2. Probar una herramienta

Pregunta a Claude:
```
Lista las entidades disponibles en Fyso
```

Debería ejecutar `list_entities` y mostrar las entidades existentes.

### 3. Test completo

```
Crea una entidad de prueba llamada "Test" con un campo "nombre"
```

## Troubleshooting

### Error: "MCP server not found"

1. Verificar que el servidor esté corriendo:
```bash
curl http://localhost:3002/mcp/health
```

2. Verificar la ruta en la configuración

3. Verificar que Bun esté instalado:
```bash
bun --version
```

### Error: "Connection refused"

1. Iniciar el servidor:
```bash
cd /path/to/fyso
bun run dev:mcp
```

2. Verificar puerto no ocupado:
```bash
lsof -i :3002
```

### Error: "Authentication failed"

1. Verificar API_URL en variables de entorno
2. Verificar que la API esté corriendo en ese puerto

## Configuración Avanzada

### Con autenticación

```json
{
  "mcpServers": {
    "fyso": {
      "url": "http://localhost:3002/mcp",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer <token>"
      }
    }
  }
}
```

### Múltiples proyectos

```json
{
  "mcpServers": {
    "fyso-tienda": {
      "command": "bun",
      "args": ["run", "~/tienda/packages/mcp-server/src/index.ts"]
    },
    "fyso-restaurante": {
      "command": "bun",
      "args": ["run", "~/restaurante/packages/mcp-server/src/index.ts"]
    }
  }
}
```

## Resultado Esperado

```
✅ MCP Configurado
═══════════════════════════════════════

Servidor: http://localhost:3002/mcp
Estado: Conectado
Herramientas: 16 disponibles

Puedes empezar a usar comandos como:
- "Crea una entidad Productos"
- "Lista las reglas de Facturas"
- "Consulta todos los clientes"

¡Tu ERP está listo para usar con Claude!
```
