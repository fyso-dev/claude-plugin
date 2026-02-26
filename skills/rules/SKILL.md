---
name: fyso-rules
description: Crear reglas de negocio usando lenguaje natural. Cálculos automáticos, validaciones, transformaciones y lógica condicional.
argument-hint: [entidad] [descripción de la regla]
---

# Reglas de Negocio - Fyso

Crea reglas de negocio que se ejecutan automáticamente cuando cambian datos.

## Tu Rol

Eres un experto en traducir descripciones en lenguaje natural a DSL de reglas de negocio.

## Tipos de Reglas

### 1. Cálculos (compute)
Calcular campos automáticamente.

**Usuario dice:** "Calcular subtotal multiplicando cantidad por precio"

**DSL:**
```json
{
  "compute": {
    "subtotal": {
      "type": "formula",
      "expression": "cantidad * precio"
    }
  }
}
```

### 2. Validaciones (validate)
Validar datos antes de guardar.

**Usuario dice:** "La cantidad debe ser mayor a cero"

**DSL:**
```json
{
  "validate": [{
    "id": "cantidad_positiva",
    "condition": "cantidad > 0",
    "message": "La cantidad debe ser mayor a cero",
    "severity": "error"
  }]
}
```

### 3. Transformaciones (transform)
Transformar valores automáticamente.

**Usuario dice:** "El código siempre en mayúsculas"

**DSL:**
```json
{
  "transform": {
    "codigo": { "type": "uppercase" }
  }
}
```

### 4. Condicionales
Lógica if/then/else.

**Usuario dice:** "Si subtotal > 1000, aplicar 10% descuento, sino 0"

**DSL:**
```json
{
  "compute": {
    "descuento": {
      "type": "conditional",
      "conditions": [
        { "when": "subtotal > 1000", "then": "subtotal * 0.10" }
      ],
      "default": "0"
    }
  }
}
```

## Proceso de Creación

### 1. Analizar el Prompt

Identifica:
- **Entidad**: ¿A qué tabla aplica?
- **Tipo**: ¿Cálculo, validación, transformación?
- **Campos involucrados**: ¿Qué campos se usan/modifican?
- **Trigger**: ¿Cuándo se dispara? (field_change, before_save, etc.)

### 2. Generar DSL

Construye el objeto DSL con:
```json
{
  "compute": { },    // Campos calculados
  "validate": [ ],   // Validaciones
  "transform": { }   // Transformaciones
}
```

### 3. Llamar MCP Tool

```typescript
create_business_rule({
  entityName: "facturas",
  name: "Cálculo de IVA y Total",
  description: "Calcula IVA 21% y total automáticamente",
  triggerType: "field_change",
  triggerFields: ["subtotal"],
  ruleDsl: {
    compute: {
      iva: { type: "formula", expression: "subtotal * 0.21" },
      total: { type: "formula", expression: "subtotal + iva" }
    }
  },
  auto_publish: false
})
```

### 4. Probar la Regla

```typescript
test_business_rule({
  entityName: "facturas",
  ruleId: "<rule-id>",
  testContext: {
    subtotal: 1000
  }
})
```

**Cómo interpretar la respuesta — CRÍTICO:**

`success: true` significa que la regla **se ejecutó sin errores de sintaxis**. No significa que haya o no validaciones fallidas. Interpretá así:

| Tipo de regla | Respuesta | Significado |
|--------------|-----------|-------------|
| `compute` | `success: true` + `computedValues: { campo: valor }` | ✅ Correcto — la regla calculó los valores |
| `validate` con datos válidos | `success: true` + `errors: []` o sin `errors` | ✅ Correcto — los datos son válidos, la regla funcionó bien |
| `validate` con datos inválidos | `success: true` + `errors: [{ message: "..." }]` | ✅ Correcto — la regla detectó el problema esperado |
| Cualquier tipo | `success: false` + `error: "..."` | ❌ Bug en el DSL — hay un error de sintaxis o expresión |

**Ejemplo validate — datos VÁLIDOS (sin errores = comportamiento correcto):**
```json
{
  "success": true,
  "errors": []
}
```
→ La regla evaluó correctamente. Los datos pasaron la validación. ✅ Publicar.

**Ejemplo validate — datos INVÁLIDOS (con errores = validación funcionando):**
```json
{
  "success": true,
  "errors": [{ "id": "email_requerido", "message": "El email es requerido", "severity": "error" }]
}
```
→ La regla detectó el error esperado. ✅ Correcto. Ahora testear con datos válidos para confirmar que pasan.

**Ejemplo compute:**
```json
{
  "success": true,
  "computedValues": { "iva": 210, "total": 1210 }
}
```
→ Los campos fueron calculados correctamente. ✅ Publicar.

**Protocolo de testing para reglas validate:**
1. Testar con datos **inválidos** → debe aparecer el error en `errors[]`
2. Testar con datos **válidos** → `errors[]` debe estar vacío
3. Ambos pasan → publicar

### 5. Publicar si está correcto

```typescript
publish_business_rule({
  entityName: "facturas",
  ruleId: "<rule-id>"
})
```

## Referencia DSL

Ver [reference/dsl-reference.md](reference/dsl-reference.md) para documentación completa.

### Operadores

| Operador | Descripción | Ejemplo |
|----------|-------------|---------|
| `+` | Suma | `cantidad + 1` |
| `-` | Resta | `total - descuento` |
| `*` | Multiplicación | `cantidad * precio` |
| `/` | División | `total / cantidad` |
| `>` | Mayor que | `stock > 0` |
| `<` | Menor que | `precio < 100` |
| `>=` | Mayor o igual | `cantidad >= 1` |
| `<=` | Menor o igual | `descuento <= 50` |
| `==` | Igual | `estado == "activo"` |
| `!=` | Distinto | `tipo != "interno"` |
| `and` | Y lógico | `stock > 0 and activo == true` |
| `or` | O lógico | `tipo == "A" or tipo == "B"` |

### Funciones

| Función | Descripción | Ejemplo |
|---------|-------------|---------|
| `floor(n)` | Redondear abajo | `floor(3.7)` → 3 |
| `ceil(n)` | Redondear arriba | `ceil(3.2)` → 4 |
| `abs(n)` | Valor absoluto | `abs(-5)` → 5 |
| `min(a,b)` | Mínimo | `min(stock, 100)` |
| `max(a,b)` | Máximo | `max(precio, 0)` |
| `upper(s)` | Mayúsculas | `upper(codigo)` |
| `lower(s)` | Minúsculas | `lower(email)` |
| `trim(s)` | Quitar espacios | `trim(nombre)` |
| `len(s)` | Longitud | `len(codigo) > 3` |

## Ejemplos Comunes

### Factura con IVA

```
/fyso-rules facturas Calcular subtotal, aplicar IVA 21%, calcular total
```

**DSL:**
```json
{
  "compute": {
    "subtotal": { "type": "formula", "expression": "cantidad * precio_unitario" },
    "iva": { "type": "formula", "expression": "subtotal * 0.21" },
    "total": { "type": "formula", "expression": "subtotal + iva" }
  },
  "validate": [
    { "id": "cantidad_positiva", "condition": "cantidad > 0", "message": "Cantidad inválida", "severity": "error" }
  ]
}
```

### Descuento Escalonado

```
/fyso-rules pedidos Descuento: >2000=15%, >1000=10%, >500=5%
```

**DSL:**
```json
{
  "compute": {
    "descuento": {
      "type": "conditional",
      "conditions": [
        { "when": "subtotal > 2000", "then": "subtotal * 0.15" },
        { "when": "subtotal > 1000", "then": "subtotal * 0.10" },
        { "when": "subtotal > 500", "then": "subtotal * 0.05" }
      ],
      "default": "0"
    },
    "total": { "type": "formula", "expression": "subtotal - descuento" }
  }
}
```

### Control de Stock

```
/fyso-rules productos Si stock < 10, marcar como bajo_stock
```

**DSL:**
```json
{
  "compute": {
    "bajo_stock": {
      "type": "conditional",
      "conditions": [
        { "when": "stock < 10", "then": "true" }
      ],
      "default": "false"
    }
  }
}
```

## Trigger Types

| Tipo | Cuándo se ejecuta |
|------|-------------------|
| `field_change` | Cuando cambia un campo específico (default) |
| `before_save` | Antes de guardar el registro |
| `after_save` | Después de guardar |
| `on_load` | Al cargar el registro |

## Después de Crear

1. Confirma al usuario que la regla fue creada
2. Muestra el resultado del test
3. Pregunta si quiere publicar o hacer ajustes
4. Sugiere reglas adicionales relacionadas
