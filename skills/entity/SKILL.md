---
name: fyso-entity
description: Crear y gestionar entidades del ERP. Usa cuando el usuario quiera crear tablas, agregar campos, o modificar la estructura de datos.
argument-hint: [crear|listar|modificar] [nombre-entidad] [campos...]
---

# Gestión de Entidades - Fyso

Crea y gestiona entidades (tablas) del sistema ERP.

## Acciones Disponibles

### Crear Entidad

```
/fyso-entity crear Productos con nombre, precio, stock
```

### Listar Entidades

```
/fyso-entity listar
```

### Agregar Campo

```
/fyso-entity agregar campo descuento a Productos
```

## Cómo Crear una Entidad

### 1. Analizar la solicitud del usuario

Extrae:
- Nombre de la entidad (singular, PascalCase)
- Campos con sus tipos inferidos

### 2. Mapear tipos de campo

| Descripción del usuario | Tipo Fyso |
|------------------------|-------------|
| nombre, titulo, descripcion | string |
| precio, monto, total, costo | decimal |
| cantidad, stock, unidades | integer |
| fecha, fecha_creacion | date |
| activo, disponible, publicado | boolean |
| email | string + validación |
| telefono | string |
| notas, comentarios | text |
| *_id (ej: cliente_id) | relation |

### 3. Generar DSL de entidad

```json
{
  "name": "productos",
  "displayName": "Productos",
  "fields": [
    {
      "fieldKey": "nombre",
      "fieldType": "string",
      "label": "Nombre",
      "required": true
    },
    {
      "fieldKey": "precio",
      "fieldType": "decimal",
      "label": "Precio",
      "required": true,
      "validation": { "min": 0 }
    },
    {
      "fieldKey": "stock",
      "fieldType": "integer",
      "label": "Stock",
      "defaultValue": 0
    }
  ]
}
```

### 4. Llamar MCP Tool

Usa la tool `generate_entity` del servidor MCP:

```typescript
generate_entity({
  name: "productos",
  description: "Catálogo de productos",
  fields: [...],
  auto_publish: false  // Crear como draft primero
})
```

### 5. Probar la entidad

Después de crear, ejecuta un test básico:

```typescript
// Crear registro de prueba
create_record({
  entityName: "productos",
  data: { nombre: "Test", precio: 10, stock: 5 }
})

// Consultar
query_records({
  entityName: "productos"
})
```

### 6. Publicar si todo está bien

```typescript
publish_entity({
  entityName: "productos"
})
```

## Tipos de Campo Disponibles

Ver [reference/field-types.md](reference/field-types.md) para lista completa.

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| string | Texto corto (255 chars) | nombre, codigo |
| text | Texto largo | descripcion, notas |
| integer | Número entero | cantidad, stock |
| decimal | Número con decimales | precio, total |
| boolean | Verdadero/Falso | activo, publicado |
| date | Solo fecha | fecha_nacimiento |
| datetime | Fecha y hora | created_at |
| enum | Lista de opciones | estado: [pendiente, completado] |
| relation | Referencia a otra entidad | cliente_id → Clientes |

## Campos Automáticos

Cada entidad incluye automáticamente:
- `id` (UUID, primary key)
- `created_at` (datetime)
- `updated_at` (datetime)

## Ejemplo Completo

**Usuario dice:**
> Crear entidad Facturas con cliente, fecha, subtotal, iva, total, estado

**Análisis:**
- Entidad: `Facturas`
- Campos:
  - cliente → relation a Clientes
  - fecha → date
  - subtotal → decimal
  - iva → decimal
  - total → decimal
  - estado → enum [pendiente, pagada, anulada]

**DSL generado:**
```json
{
  "name": "facturas",
  "displayName": "Facturas",
  "fields": [
    { "fieldKey": "cliente_id", "fieldType": "relation", "relation": { "entity": "clientes" } },
    { "fieldKey": "fecha", "fieldType": "date", "required": true },
    { "fieldKey": "subtotal", "fieldType": "decimal", "required": true },
    { "fieldKey": "iva", "fieldType": "decimal", "required": true },
    { "fieldKey": "total", "fieldType": "decimal", "required": true },
    { "fieldKey": "estado", "fieldType": "enum", "options": ["pendiente", "pagada", "anulada"], "defaultValue": "pendiente" }
  ]
}
```

## Después de Crear

Sugiere al usuario:
1. Crear reglas de negocio para calcular totales
2. Agregar validaciones
3. Relacionar con otras entidades
