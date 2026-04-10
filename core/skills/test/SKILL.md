---
name: fyso-test
description: Ejecutar tests del sistema ERP. Valida entidades, reglas de negocio y funcionamiento general.
argument-hint: [all|entidades|reglas] [nombre-entidad]
disable-model-invocation: true
allowed-tools: Bash(bun test *), Bash(curl *)
id: test
title: "Test"
hosts: ["claude", "codex"]
category: portable
---

# Testing - Fyso

Ejecuta tests para validar el funcionamiento del ERP.

## Comandos

### Ejecutar todos los tests

```
the test workflow
```

### Tests de entidades

```
the test workflow entidades
```

### Tests de reglas de negocio

```
the test workflow reglas
```

### Tests de una entidad específica

```
the test workflow entidades Productos
```

### Tests de reglas de una entidad

```
the test workflow reglas Facturas
```

## Proceso de Testing

### 1. Tests Unitarios (API)

```bash
cd packages/api && bun test
```

Esto ejecuta:
- Tests del expression parser
- Tests del rules engine
- Tests de business rules service
- Tests exhaustivos de seguridad

### 2. Tests de Entidades

Para cada entidad, verifica:

```typescript
// 1. La entidad existe
list_entities()

// 2. Se puede crear un registro
create_record({
  entityName: "productos",
  data: { nombre: "Test", precio: 10 }
})

// 3. Se puede consultar
query_records({ entityName: "productos" })

// 4. Se puede actualizar
update_record({
  entityName: "productos",
  id: "<id>",
  data: { precio: 15 }
})

// 5. Se puede eliminar
delete_record({
  entityName: "productos",
  id: "<id>"
})
```

### 3. Tests de Reglas de Negocio

Para cada regla, verifica:

```typescript
// 1. La regla existe
list_business_rules({ entityName: "facturas" })

// 2. Test con datos de prueba
test_business_rule({
  entityName: "facturas",
  ruleId: "<rule-id>",
  testContext: {
    cantidad: 10,
    precio_unitario: 100
  }
})

// Verificar resultado esperado:
// - subtotal = 1000
// - iva = 210
// - total = 1210
```

### 4. Tests de Integración

```bash
# API responde
curl http://localhost:3001/api/health

# MCP responde
curl http://localhost:3002/mcp/health

# Frontend carga
curl http://localhost:5173
```

## Reportes

### Formato de Salida

```
📊 Test Results - Fyso ERP
═══════════════════════════════════════

✅ API Health Check         PASS
✅ Database Connection       PASS
✅ MCP Server               PASS

📦 Entidades (4)
  ✅ Productos              PASS (CRUD OK)
  ✅ Clientes               PASS (CRUD OK)
  ✅ Facturas               PASS (CRUD OK)
  ✅ DetalleFactura         PASS (CRUD OK)

📋 Reglas de Negocio (6)
  ✅ Cálculo IVA            PASS
  ✅ Descuento Escalonado   PASS
  ✅ Validación Cantidad    PASS
  ✅ Control Stock          PASS
  ✅ Email Lowercase        PASS
  ✅ Código Uppercase       PASS

═══════════════════════════════════════
Total: 13/13 tests passing (100%)
```

## Tests de Seguridad

Verifica que el sistema rechace:

```typescript
// Injection attempts
evaluateExpression("x = 5")           // ❌ Assignment
evaluateExpression("constructor")     // ❌ Prototype
evaluateExpression("__proto__")       // ❌ Prototype
evaluateExpression("process.exit()")  // ❌ Node access
```

## Tests de Performance

```typescript
// Timeout de expresiones largas
const longExpr = Array(1000).fill("x + 1").join(" + ");
// Debe completar en < 100ms o timeout
```

## Después de Tests

Si todos pasan:
```
✅ Todos los tests pasaron. El sistema está listo.
¿Quieres desplegarlo? Usa the deploy workflow
```

Si alguno falla:
```
❌ 2 tests fallaron:
  - Validación Cantidad: condition "cantdad > 0" tiene typo
  - Control Stock: campo "stok" no existe

¿Quieres que corrija estos errores?
```
