---
name: fyso-init
description: Inicializar un nuevo proyecto ERP con Fyso. Crea la estructura de directorios, instala dependencias, y configura la base de datos.
argument-hint: [nombre-proyecto]
disable-model-invocation: true
allowed-tools: Bash(git *), Bash(bun *), Bash(mkdir *), Bash(cp *), Bash(cd *)
---

# Inicializar Proyecto Fyso

Crea un nuevo proyecto ERP en el directorio `$ARGUMENTS`.

## Pasos a Ejecutar

### 1. Crear directorio del proyecto

```bash
mkdir -p ~/$ARGUMENTS
cd ~/$ARGUMENTS
```

### 2. Clonar Fyso

```bash
git clone https://github.com/fyso/fyso.git .
# O si ya existe localmente:
# cp -r /path/to/fyso/* .
```

### 3. Instalar dependencias

```bash
bun install
```

### 4. Configurar base de datos

Crear archivo `.env` con:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/$ARGUMENTS
API_PORT=3001
MCP_PORT=3002
WEB_PORT=5173
```

### 5. Crear base de datos

```bash
createdb $ARGUMENTS 2>/dev/null || echo "DB ya existe"
```

### 6. Ejecutar migraciones

```bash
cd packages/db && bun run migrate
```

### 7. Generar CLAUDE.md del proyecto

Crear archivo `CLAUDE.md` en la raíz del proyecto con:

```markdown
# $ARGUMENTS - ERP Project

## Stack
- Runtime: Bun
- Database: PostgreSQL
- API: Hono
- Frontend: React + Vite

## Comandos

### Desarrollo
bun run dev          # Iniciar todo
bun run dev:api      # Solo API
bun run dev:web      # Solo frontend
bun run dev:mcp      # Solo MCP server

### Base de datos
cd packages/db && bun run migrate    # Ejecutar migraciones
cd packages/db && bun run seed       # Cargar datos de prueba

### Tests
cd packages/api && bun test          # Tests de API

## Entidades
(Se actualizará automáticamente)

## Reglas de Negocio
(Se actualizará automáticamente)

## MCP Server
El servidor MCP está disponible en puerto 3002.
Configura tu cliente MCP apuntando a: http://localhost:3002/mcp
```

### 8. Verificar instalación

```bash
bun run dev &
sleep 3
curl http://localhost:3001/api/health
```

## Resultado Esperado

Al finalizar, el usuario tendrá:

1. ✅ Proyecto clonado en `~/$ARGUMENTS`
2. ✅ Dependencias instaladas
3. ✅ Base de datos configurada
4. ✅ Migraciones ejecutadas
5. ✅ CLAUDE.md generado
6. ✅ Servidor funcionando

## Siguiente Paso

Después de inicializar, sugiere al usuario crear sus primeras entidades:

```
Tu proyecto está listo. Ahora podemos crear las entidades.
¿Qué tipo de negocio es? Te sugeriré las entidades más comunes.
```
