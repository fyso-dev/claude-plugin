# Tipos de Campo - Referencia Completa

## Tipos Básicos

### string
Texto corto, máximo 255 caracteres.

```json
{
  "fieldKey": "nombre",
  "fieldType": "string",
  "label": "Nombre",
  "required": true,
  "validation": {
    "minLength": 2,
    "maxLength": 100
  }
}
```

### text
Texto largo, sin límite práctico.

```json
{
  "fieldKey": "descripcion",
  "fieldType": "text",
  "label": "Descripción"
}
```

### integer
Número entero.

```json
{
  "fieldKey": "cantidad",
  "fieldType": "integer",
  "label": "Cantidad",
  "defaultValue": 0,
  "validation": {
    "min": 0,
    "max": 99999
  }
}
```

### decimal
Número con decimales (precisión: 10,2).

```json
{
  "fieldKey": "precio",
  "fieldType": "decimal",
  "label": "Precio",
  "required": true,
  "validation": {
    "min": 0
  }
}
```

### boolean
Verdadero o Falso.

```json
{
  "fieldKey": "activo",
  "fieldType": "boolean",
  "label": "Activo",
  "defaultValue": true
}
```

### date
Solo fecha (sin hora).

```json
{
  "fieldKey": "fecha_nacimiento",
  "fieldType": "date",
  "label": "Fecha de Nacimiento"
}
```

### datetime
Fecha con hora.

```json
{
  "fieldKey": "ultima_compra",
  "fieldType": "datetime",
  "label": "Última Compra"
}
```

## Tipos Especiales

### enum
Lista de opciones predefinidas.

```json
{
  "fieldKey": "estado",
  "fieldType": "enum",
  "label": "Estado",
  "options": ["pendiente", "en_proceso", "completado", "cancelado"],
  "defaultValue": "pendiente"
}
```

### relation
Referencia a otra entidad (foreign key).

```json
{
  "fieldKey": "cliente_id",
  "fieldType": "relation",
  "label": "Cliente",
  "relation": {
    "entity": "clientes",
    "displayField": "nombre"
  }
}
```

### json
Objeto JSON flexible.

```json
{
  "fieldKey": "metadata",
  "fieldType": "json",
  "label": "Metadatos"
}
```

## Validaciones Comunes

### Requerido
```json
{ "required": true }
```

### Rango numérico
```json
{ "validation": { "min": 0, "max": 100 } }
```

### Longitud de texto
```json
{ "validation": { "minLength": 3, "maxLength": 50 } }
```

### Patrón regex
```json
{ "validation": { "pattern": "^[A-Z]{3}[0-9]{4}$" } }
```

### Único
```json
{ "unique": true }
```

## Campos con Comportamiento Especial

### Email
```json
{
  "fieldKey": "email",
  "fieldType": "string",
  "label": "Email",
  "validation": {
    "pattern": "^[^@]+@[^@]+\\.[^@]+$"
  }
}
```

### Teléfono
```json
{
  "fieldKey": "telefono",
  "fieldType": "string",
  "label": "Teléfono",
  "validation": {
    "pattern": "^[+]?[0-9]{8,15}$"
  }
}
```

### Precio (moneda)
```json
{
  "fieldKey": "precio",
  "fieldType": "decimal",
  "label": "Precio",
  "display": {
    "format": "currency",
    "currency": "USD"
  }
}
```

### Porcentaje
```json
{
  "fieldKey": "descuento",
  "fieldType": "decimal",
  "label": "Descuento",
  "display": {
    "format": "percentage"
  },
  "validation": {
    "min": 0,
    "max": 100
  }
}
```
