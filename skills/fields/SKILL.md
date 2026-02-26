---
name: fyso-fields
description: Gestionar campos personalizados (custom fields) en entidades. Agregar, listar, modificar y eliminar campos que no son afectados por import/export de metadata.
argument-hint: [listar|agregar|modificar|eliminar] [entidad] [campo...]
---

# Custom Fields - Fyso

Gestiona campos personalizados que los usuarios de un tenant agregan a las entidades. Estos campos son independientes de la metadata del sistema y NO se ven afectados por import/export.

## Conceptos Clave

### System vs Custom Fields

| Tipo | isSystem | Creado por | Import/Export | Borrable |
|------|----------|------------|---------------|----------|
| **System** | `true` | Import metadata / MCP generate | Se actualiza con import | No |
| **Custom** | `false` | Usuario del tenant | NO se toca | Si |

Cuando se importa metadata:
- Campos **system** se crean/actualizan normalmente
- Campos **custom** se preservan intactos (nunca se sobreescriben ni eliminan)

## Acciones Disponibles

### Listar Campos

```
/fyso-fields listar productos
/fyso-fields listar clientes custom
/fyso-fields listar facturas all
```

### Agregar Campo

```
/fyso-fields agregar campo notas_internas a productos
/fyso-fields agregar campo descuento_especial (decimal, requerido) a facturas
```

### Modificar Campo

```
/fyso-fields modificar campo notas_internas en productos como requerido
```

### Eliminar Campo

```
/fyso-fields eliminar campo notas_internas de productos
```

## Proceso

### 1. Listar campos de una entidad

Usa la MCP tool `manage_custom_fields`:

```typescript
manage_custom_fields({
  action: "list",
  entityName: "productos",
  type: "custom"  // "custom" | "system" | "all"
})
```

### 2. Agregar un campo personalizado

```typescript
manage_custom_fields({
  action: "add",
  entityName: "productos",
  fieldData: {
    name: "Notas Internas",
    fieldKey: "notas_internas",
    fieldType: "textarea",
    description: "Notas visibles solo para el equipo",
    isRequired: false
  }
})
```

El campo se crea automaticamente como `isSystem: false`.

### 3. Actualizar un campo

```typescript
manage_custom_fields({
  action: "update",
  entityName: "productos",
  fieldId: "uuid-del-campo",
  fieldData: {
    isRequired: true,
    description: "Ahora es obligatorio"
  }
})
```

Solo se pueden actualizar campos custom. Los campos system estan protegidos.

### 4. Eliminar un campo

```typescript
manage_custom_fields({
  action: "delete",
  entityName: "productos",
  fieldId: "uuid-del-campo"
})
```

Solo se pueden eliminar campos custom.

## REST API para Clientes

Estos endpoints permiten a una aplicacion frontend gestionar custom fields.

### Base URL

```
https://{host}/api/entities/{entityName}/fields
```

### Autenticacion

Usa tenant user token:

```bash
X-API-Key: {session-token}
X-Tenant-ID: {tenant-slug}
```

### Endpoints

#### Listar campos

```bash
GET /api/entities/{entityName}/fields
GET /api/entities/{entityName}/fields?type=custom
GET /api/entities/{entityName}/fields?type=system
GET /api/entities/{entityName}/fields?type=all
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Notas Internas",
      "fieldKey": "notas_internas",
      "fieldType": "textarea",
      "isSystem": false,
      "isRequired": false,
      "description": "Notas del equipo",
      "config": {},
      "displayOrder": 10
    }
  ]
}
```

#### Agregar campo

```bash
POST /api/entities/{entityName}/fields
Content-Type: application/json

{
  "name": "Descuento Especial",
  "fieldKey": "descuento_especial",
  "fieldType": "number",
  "description": "Descuento aplicable por el vendedor",
  "isRequired": false,
  "config": { "min": 0, "max": 100 }
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Descuento Especial",
    "fieldKey": "descuento_especial",
    "fieldType": "number",
    "isSystem": false,
    ...
  }
}
```

Los campos creados via este endpoint son siempre `isSystem: false`.

#### Actualizar campo

```bash
PUT /api/entities/{entityName}/fields/{fieldId}
Content-Type: application/json

{
  "name": "Descuento VIP",
  "isRequired": true
}
```

Solo funciona para campos custom. Retorna 403 para campos system.

#### Eliminar campo

```bash
DELETE /api/entities/{entityName}/fields/{fieldId}
```

Solo funciona para campos custom. Retorna 403 para campos system.

## Tipos de Campo Disponibles

| Tipo | Descripcion | Config |
|------|-------------|--------|
| `text` | Texto corto | `maxLength` |
| `textarea` | Texto largo | `maxLength` |
| `number` | Numero | `min`, `max`, `decimals` |
| `email` | Email con validacion | - |
| `phone` | Telefono | - |
| `date` | Fecha | - |
| `boolean` | Si/No | - |
| `select` | Lista de opciones | `options: string[]` |
| `relation` | Referencia a otra entidad | `entity`, `displayField` |

## Ejemplo Completo: Cliente Next.js

```typescript
const API_URL = process.env.NEXT_PUBLIC_FYSO_API_URL;

// Listar custom fields de productos
async function getCustomFields(entityName: string) {
  const res = await fetch(
    `${API_URL}/entities/${entityName}/fields?type=custom`,
    {
      headers: {
        'X-API-Key': userToken,
        'X-Tenant-ID': tenantSlug,
      },
    }
  );
  const { data } = await res.json();
  return data;
}

// Agregar custom field
async function addCustomField(entityName: string, field: {
  name: string;
  fieldKey: string;
  fieldType: string;
  description?: string;
  isRequired?: boolean;
  config?: Record<string, any>;
}) {
  const res = await fetch(
    `${API_URL}/entities/${entityName}/fields`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': userToken,
        'X-Tenant-ID': tenantSlug,
      },
      body: JSON.stringify(field),
    }
  );
  const { data } = await res.json();
  return data;
}

// Eliminar custom field
async function deleteCustomField(entityName: string, fieldId: string) {
  await fetch(
    `${API_URL}/entities/${entityName}/fields/${fieldId}`,
    {
      method: 'DELETE',
      headers: {
        'X-API-Key': userToken,
        'X-Tenant-ID': tenantSlug,
      },
    }
  );
}
```

## Comportamiento con Import/Export

### Escenario: Import de metadata

1. Tenant tiene entidad `productos` con campos system: `nombre`, `precio`, `stock`
2. Usuario agrega custom field: `notas_internas`
3. Admin importa nueva version de metadata que agrega campo `categoria`

**Resultado:**
- `nombre`, `precio`, `stock` -> actualizados (system)
- `categoria` -> creado como system
- `notas_internas` -> **intacto** (custom, no se toca)

### Escenario: Discard draft

1. Entity publicada tiene campos system + custom
2. Admin edita un campo system y crea draft
3. Admin descarta el draft

**Resultado:**
- Campos system -> restaurados al snapshot publicado
- Campos custom -> **preservados** (no se eliminan)

## Errores Comunes

| Error | Causa | Solucion |
|-------|-------|----------|
| 403 SYSTEM_FIELD | Intentar modificar/eliminar campo system | Solo campos custom son editables |
| 404 NOT_FOUND | Entidad o campo no existe | Verificar nombre/ID |
| 400 CREATE_FIELD_ERROR | fieldKey duplicado | Usar fieldKey unico por entidad |
