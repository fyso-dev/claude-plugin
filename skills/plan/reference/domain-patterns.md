# Domain Patterns — Common Entity & Rule Patterns

Use this reference when designing Fyso apps. These patterns cover the most common business domains.

## Healthcare / Clinic

### Entities
- **pacientes** — nombre, apellido, dni(unique), fecha_nacimiento, obra_social, telefono, email, activo(boolean, default:true), notas
- **profesionales** — nombre, matricula(unique), especialidad, telefono, email, activo(boolean)
- **sesiones** — paciente(rel→pacientes), profesional(rel→profesionales), fecha(date, required), hora(text), duracion_min(number, default:30), estado(select: programada/confirmada/completada/cancelada), notas_clinicas, monto(number, decimals:2)
- **facturas** — paciente(rel→pacientes), sesion(rel→sesiones), fecha(date), subtotal(number), iva(number), total(number), estado(select: borrador/emitida/pagada/anulada)

### Common Rules
- Compute: edad from fecha_nacimiento
- Compute: total = subtotal + iva, iva = subtotal * 0.21
- Validate: email format
- Validate: fecha sesion not in past

---

## Retail / Store

### Entities
- **productos** — nombre, sku(unique), categoria(select), precio(number, decimals:2), costo(number, decimals:2), stock(number, decimals:0), stock_minimo(number, default:10), activo(boolean)
- **clientes** — nombre, email(email), telefono(phone), direccion, notas
- **ventas** — cliente(rel→clientes), fecha(date), subtotal(number), descuento(number), iva(number), total(number), estado(select: pendiente/completada/anulada), metodo_pago(select: efectivo/tarjeta/transferencia)
- **detalle_venta** — venta(rel→ventas), producto(rel→productos), cantidad(number), precio_unitario(number), subtotal(number)

### Common Rules
- Compute: detalle subtotal = cantidad * precio_unitario
- Compute: venta total = subtotal - descuento + iva
- Compute: bajo_stock = stock < stock_minimo
- Validate: cantidad > 0
- Validate: stock >= 0

---

## Services / Consulting

### Entities
- **clientes** — nombre, empresa, email, telefono, direccion
- **proyectos** — cliente(rel→clientes), nombre, descripcion, fecha_inicio(date), fecha_fin(date), presupuesto(number), estado(select: propuesta/activo/completado/cancelado)
- **tareas** — proyecto(rel→proyectos), descripcion, horas_estimadas(number), horas_reales(number), estado(select: pendiente/en_progreso/completada), prioridad(select: baja/media/alta/urgente)
- **facturas** — cliente(rel→clientes), proyecto(rel→proyectos), fecha(date), subtotal(number), iva(number), total(number), estado(select: borrador/emitida/pagada)

### Common Rules
- Compute: factura total = subtotal + iva
- Compute: proyecto horas_total = sum of tareas horas_reales (requires after_save action)
- Validate: fecha_fin >= fecha_inicio
- Validate: horas_estimadas > 0

---

## Restaurant

### Entities
- **platos** — nombre, categoria(select: entrada/principal/postre/bebida), precio(number), disponible(boolean, default:true), tiempo_preparacion(number)
- **mesas** — numero(number, unique), capacidad(number), estado(select: libre/ocupada/reservada)
- **pedidos** — mesa(rel→mesas), fecha(date), hora(text), total(number), estado(select: abierto/en_preparacion/servido/cerrado), mesero(text)
- **detalle_pedido** — pedido(rel→pedidos), plato(rel→platos), cantidad(number), precio_unitario(number), subtotal(number), notas(text)

### Common Rules
- Compute: detalle subtotal = cantidad * precio_unitario
- Validate: cantidad > 0
- Validate: plato disponible == true

---

## Repair Shop / Workshop

### Entities
- **clientes** — nombre, telefono, email, direccion
- **trabajos** — cliente(rel→clientes), descripcion, equipo(text), fecha_ingreso(date), fecha_entrega(date), estado(select: recibido/diagnostico/reparando/listo/entregado), costo_estimado(number), costo_final(number), notas
- **repuestos** — nombre, codigo(unique), precio(number), stock(number)
- **detalle_trabajo** — trabajo(rel→trabajos), repuesto(rel→repuestos), cantidad(number), precio_unitario(number), subtotal(number)

### Common Rules
- Compute: detalle subtotal = cantidad * precio_unitario
- Validate: stock >= 0
- Transform: codigo → uppercase

---

## Inventory / Warehouse

### Entities
- **productos** — nombre, sku(unique), categoria(select), precio_costo(number), precio_venta(number), stock(number), stock_minimo(number), ubicacion(text)
- **proveedores** — nombre, contacto, email, telefono, direccion
- **compras** — proveedor(rel→proveedores), fecha(date), total(number), estado(select: pendiente/recibida/parcial)
- **movimientos** — producto(rel→productos), tipo(select: entrada/salida/ajuste), cantidad(number), fecha(date), motivo(text), referencia(text)

### Common Rules
- Compute: margen = precio_venta - precio_costo
- Compute: bajo_stock = stock < stock_minimo
- Validate: cantidad > 0 (movimientos)
- Validate: stock >= 0

---

## Freelancer / Solo

### Entities
- **clientes** — nombre, empresa, email, telefono
- **proyectos** — cliente(rel→clientes), nombre, presupuesto(number), estado(select: propuesta/activo/completado), fecha_inicio(date), fecha_fin(date)
- **facturas** — cliente(rel→clientes), proyecto(rel→proyectos), numero(text, unique), fecha(date), subtotal(number), iva(number), total(number), estado(select: borrador/enviada/pagada/vencida)
- **pagos** — factura(rel→facturas), fecha(date), monto(number), metodo(select: transferencia/efectivo/cheque)

### Common Rules
- Compute: factura total = subtotal + iva, iva = subtotal * 0.21
- Validate: monto pago > 0

---

## Universal Patterns

### Naming Conventions
- Entity names: lowercase, plural, Spanish (pacientes, facturas, productos)
- Field keys: lowercase, snake_case (fecha_nacimiento, precio_unitario)
- Display names: Title Case Spanish (Fecha de Nacimiento, Precio Unitario)

### Status Fields
Always use `select` type with explicit options. Always include a default value (the initial state).

### Money Fields
Always `number` with `{ decimals: 2 }`. Never text.

### Required Fields
Mark as required: names, dates, amounts, foreign keys for core relations.
Leave optional: notes, descriptions, secondary contact info.

### Relations
Always specify `displayField` — usually "nombre" or "name".
Relations are always optional unless explicitly required.
