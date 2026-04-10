# DSL de Reglas de Negocio - Referencia Completa

## Estructura General

```json
{
  "compute": { },     // Campos calculados
  "validate": [ ],    // Validaciones
  "transform": { }    // Transformaciones
}
```

## Compute (Cálculos)

### Formula Simple

```json
{
  "compute": {
    "total": {
      "type": "formula",
      "expression": "cantidad * precio"
    }
  }
}
```

### Fórmula con Múltiples Operaciones

```json
{
  "compute": {
    "subtotal": { "type": "formula", "expression": "cantidad * precio_unitario" },
    "iva": { "type": "formula", "expression": "subtotal * 0.21" },
    "total": { "type": "formula", "expression": "subtotal + iva" }
  }
}
```

**Nota:** Las fórmulas se ejecutan en orden. `iva` puede usar `subtotal` porque se calcula primero.

### Condicional Simple

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

### Condicional Escalonado

```json
{
  "compute": {
    "categoria_precio": {
      "type": "conditional",
      "conditions": [
        { "when": "precio > 1000", "then": "'premium'" },
        { "when": "precio > 500", "then": "'standard'" },
        { "when": "precio > 100", "then": "'economico'" }
      ],
      "default": "'basico'"
    }
  }
}
```

### Condicional con Operadores Lógicos

```json
{
  "compute": {
    "envio_gratis": {
      "type": "conditional",
      "conditions": [
        { "when": "subtotal > 500 and cliente_premium == true", "then": "true" }
      ],
      "default": "false"
    }
  }
}
```

## Validate (Validaciones)

### Validación Simple

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

### Severidades

| Severity | Comportamiento |
|----------|----------------|
| `error` | Bloquea el guardado |
| `warning` | Muestra advertencia, permite guardar |
| `info` | Solo informativo |

### Múltiples Validaciones

```json
{
  "validate": [
    {
      "id": "precio_positivo",
      "condition": "precio >= 0",
      "message": "El precio no puede ser negativo",
      "severity": "error"
    },
    {
      "id": "stock_bajo",
      "condition": "stock >= 10",
      "message": "Stock bajo, considere reabastecer",
      "severity": "warning"
    },
    {
      "id": "descuento_maximo",
      "condition": "descuento <= 50",
      "message": "Descuento máximo permitido: 50%",
      "severity": "error"
    }
  ]
}
```

### Validación con Campo Específico

```json
{
  "validate": [{
    "id": "email_requerido",
    "condition": "len(email) > 0",
    "message": "El email es requerido",
    "severity": "error",
    "field": "email"
  }]
}
```

## Transform (Transformaciones)

### Uppercase

```json
{
  "transform": {
    "codigo": { "type": "uppercase" }
  }
}
```

### Lowercase

```json
{
  "transform": {
    "email": { "type": "lowercase" }
  }
}
```

### Trim

```json
{
  "transform": {
    "nombre": { "type": "trim" }
  }
}
```

### Round

```json
{
  "transform": {
    "total": { "type": "round", "decimals": 2 }
  }
}
```

### Default Value

```json
{
  "transform": {
    "estado": { "type": "default", "value": "pendiente" }
  }
}
```

### Múltiples Transformaciones

```json
{
  "transform": {
    "codigo": { "type": "uppercase" },
    "email": { "type": "lowercase" },
    "nombre": { "type": "trim" },
    "total": { "type": "round", "decimals": 2 }
  }
}
```

## Operadores

### Aritméticos

| Operador | Descripción | Ejemplo |
|----------|-------------|---------|
| `+` | Suma | `a + b` |
| `-` | Resta | `a - b` |
| `*` | Multiplicación | `a * b` |
| `/` | División | `a / b` |
| `%` | Módulo | `a % b` |
| `^` | Potencia | `a ^ 2` |

### Comparación

| Operador | Descripción | Ejemplo |
|----------|-------------|---------|
| `>` | Mayor que | `x > 10` |
| `<` | Menor que | `x < 10` |
| `>=` | Mayor o igual | `x >= 10` |
| `<=` | Menor o igual | `x <= 10` |
| `==` | Igual | `x == 10` |
| `!=` | Distinto | `x != 10` |

### Lógicos

| Operador | Descripción | Ejemplo |
|----------|-------------|---------|
| `and` | Y lógico | `a > 0 and b > 0` |
| `or` | O lógico | `a > 0 or b > 0` |
| `not` | Negación | `not activo` |

### Condicional Inline

```
if(condicion, valor_si_true, valor_si_false)
```

Ejemplo:
```
if(stock > 0, "Disponible", "Agotado")
```

## Funciones

### Matemáticas

| Función | Descripción | Ejemplo |
|---------|-------------|---------|
| `floor(n)` | Redondear abajo | `floor(3.7)` → 3 |
| `ceil(n)` | Redondear arriba | `ceil(3.2)` → 4 |
| `abs(n)` | Valor absoluto | `abs(-5)` → 5 |
| `min(a,b)` | Mínimo | `min(10, 20)` → 10 |
| `max(a,b)` | Máximo | `max(10, 20)` → 20 |

### Texto

| Función | Descripción | Ejemplo |
|---------|-------------|---------|
| `upper(s)` | Mayúsculas | `upper("abc")` → "ABC" |
| `lower(s)` | Minúsculas | `lower("ABC")` → "abc" |
| `trim(s)` | Quitar espacios | `trim(" a ")` → "a" |
| `len(s)` | Longitud | `len("hello")` → 5 |

### Utilidades

| Función | Descripción | Ejemplo |
|---------|-------------|---------|
| `coalesce(a,b,...)` | Primer valor no-null | `coalesce(null, 5)` → 5 |

## Constantes

| Constante | Valor |
|-----------|-------|
| `PI` | 3.14159... |
| `E` | 2.71828... |
| `true` | Verdadero |
| `false` | Falso |

## Ejemplos Completos

### Sistema de Facturación

```json
{
  "compute": {
    "subtotal": { "type": "formula", "expression": "cantidad * precio_unitario" },
    "descuento_monto": {
      "type": "conditional",
      "conditions": [
        { "when": "subtotal > 2000", "then": "subtotal * 0.15" },
        { "when": "subtotal > 1000", "then": "subtotal * 0.10" }
      ],
      "default": "0"
    },
    "subtotal_con_descuento": { "type": "formula", "expression": "subtotal - descuento_monto" },
    "iva": { "type": "formula", "expression": "subtotal_con_descuento * 0.21" },
    "total": { "type": "formula", "expression": "subtotal_con_descuento + iva" }
  },
  "validate": [
    { "id": "cantidad_positiva", "condition": "cantidad > 0", "message": "Cantidad inválida", "severity": "error" },
    { "id": "precio_positivo", "condition": "precio_unitario >= 0", "message": "Precio inválido", "severity": "error" }
  ],
  "transform": {
    "total": { "type": "round", "decimals": 2 }
  }
}
```

### Control de Inventario

```json
{
  "compute": {
    "valor_inventario": { "type": "formula", "expression": "stock * precio_costo" },
    "bajo_stock": {
      "type": "conditional",
      "conditions": [{ "when": "stock < stock_minimo", "then": "true" }],
      "default": "false"
    },
    "estado_stock": {
      "type": "conditional",
      "conditions": [
        { "when": "stock == 0", "then": "'agotado'" },
        { "when": "stock < stock_minimo", "then": "'bajo'" },
        { "when": "stock < stock_minimo * 2", "then": "'normal'" }
      ],
      "default": "'alto'"
    }
  },
  "validate": [
    { "id": "stock_no_negativo", "condition": "stock >= 0", "message": "Stock no puede ser negativo", "severity": "error" }
  ]
}
```
