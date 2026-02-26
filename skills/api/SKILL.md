---
name: fyso-api
description: Generar especificaciones y ejemplos de la REST API para consumo externo. Usa cuando necesites documentar endpoints, crear clientes HTTP, o integrar con aplicaciones externas.
argument-hint: [spec|ejemplos|cliente] [entidad?]
---

# REST API - Fyso

Documenta y genera código para consumir la REST API de Fyso desde aplicaciones externas.

## Cuándo Usar Este Skill

- Usuario pide "¿cómo llamo a la API?"
- Necesita ejemplos de curl
- Quiere crear un cliente HTTP (fetch, axios, etc.)
- Pregunta sobre autenticación
- Necesita endpoints y parámetros
- Quiere integrar con aplicaciones externas

## NO uses este skill para:
- Operaciones desde el MCP (usa herramientas MCP directamente)
- Ver schema de entidades (usa `/fyso-entity schema`)
- Crear/modificar datos desde Claude (usa MCP tools)

## Acciones Disponibles

### Ver Especificación Completa

```
/fyso-api spec
```

### Ejemplos para una Entidad

```
/fyso-api ejemplos products
```

### Generar Cliente TypeScript

```
/fyso-api cliente typescript products
```

### Generar Cliente Python

```
/fyso-api cliente python customers
```

## Proceso

### 1. Obtener Especificación API

Usa la MCP tool `get_rest_api_spec`:

```typescript
get_rest_api_spec({
  entities: ["products"],  // Opcional: lista específica
  includeExamples: true    // Incluir curl examples
})
```

**Respuesta incluye:**
- Base URL del API
- Autenticación (Bearer token / X-API-Key)
- Endpoints disponibles (GET, POST, PUT, DELETE)
- Query parameters
- Formato de respuestas
- Códigos de error
- Ejemplos curl por entidad

### 2. Interpretar y Explicar

Traduce la spec técnica a lenguaje simple:

**Ejemplo:**

Usuario: "¿Cómo obtengo la lista de productos?"

Respuesta:
```bash
# Listar productos (máximo 10)
curl -H "X-API-Key: your-api-key" \
  "http://localhost:3001/api/entities/products/records?limit=10"
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "data": [...],
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

### 3. Generar Clientes

Crea código idiomático para el lenguaje solicitado.

#### Cliente TypeScript (fetch)

```typescript
interface Product {
  id: string;
  name: string;
  price: number;
}

class FysoClient {
  constructor(
    private apiKey: string,
    private tenantId: string,
    private baseUrl = 'http://localhost:3001/api'
  ) {}

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'X-API-Key': this.apiKey,
        'X-Tenant-ID': this.tenantId,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API Error');
    }

    return response.json();
  }

  async listProducts(page = 1, limit = 20) {
    return this.request<{
      success: boolean;
      data: {
        data: Product[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>(`/entities/products/records?page=${page}&limit=${limit}`);
  }

  async getProduct(id: string) {
    return this.request<{ success: boolean; data: Product }>(
      `/entities/products/records/${id}`
    );
  }

  async createProduct(data: Omit<Product, 'id'>) {
    return this.request<{ success: boolean; data: Product }>(
      `/entities/products/records`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async updateProduct(id: string, data: Partial<Product>) {
    return this.request<{ success: boolean; data: Product }>(
      `/entities/products/records/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  }

  async deleteProduct(id: string) {
    return this.request<{ success: boolean }>(
      `/entities/products/records/${id}`,
      {
        method: 'DELETE',
      }
    );
  }
}

// Uso para admin
const adminClient = new FysoClient('admin-api-key', '');
const entities = await adminClient.listEntities();

// Uso para tenant user
const userClient = new FysoClient('user-session-token', 'mi-empresa');
const products = await userClient.listProducts(1, 10);
```

#### Cliente Python (requests)

```python
import requests
from typing import Optional, Dict, Any, List

class FysoClient:
    def __init__(self, api_key: str, tenant_id: str = "", base_url: str = "http://localhost:3001/api"):
        self.api_key = api_key
        self.tenant_id = tenant_id
        self.base_url = base_url
        self.session = requests.Session()
        headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json"
        }
        if tenant_id:
            headers["X-Tenant-ID"] = tenant_id
        self.session.headers.update(headers)

    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        response = self.session.request(method, url, **kwargs)
        response.raise_for_status()
        return response.json()

    def list_products(self, page: int = 1, limit: int = 20) -> Dict[str, Any]:
        return self._request(
            "GET",
            f"/entities/products/records?page={page}&limit={limit}"
        )

    def get_product(self, product_id: str) -> Dict[str, Any]:
        return self._request("GET", f"/entities/products/records/{product_id}")

    def create_product(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self._request("POST", "/entities/products/records", json=data)

    def update_product(self, product_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        return self._request(
            "PUT",
            f"/entities/products/records/{product_id}",
            json=data
        )

    def delete_product(self, product_id: str) -> Dict[str, Any]:
        return self._request("DELETE", f"/entities/products/records/{product_id}")

# Uso para admin
admin_client = FysoClient("admin-api-key")
entities = admin_client.list_entities()

# Uso para tenant user
user_client = FysoClient("user-session-token", "mi-empresa")
products = user_client.list_products(page=1, limit=10)
```

## Query Parameters Comunes

### Paginación
- `page`: Número de página (1-indexed)
- `limit`: Items por página (max 100, default 20)

### Ordenamiento
- `sort`: Campo por el que ordenar
- `order`: `asc` o `desc`

### Búsqueda y Filtros
- `search`: Búsqueda de texto completo
- `resolve`: Expandir relaciones (`true`/`false`)
- `filter.{fieldKey}`: Filtrar por valor exacto
  - Ejemplo: `filter.status=active`

### Ejemplos de URLs

```bash
# Listar con paginación
GET /api/entities/products/records?page=2&limit=50

# Búsqueda
GET /api/entities/products/records?search=laptop

# Filtros
GET /api/entities/products/records?filter.status=active&filter.category=electronics

# Ordenar
GET /api/entities/products/records?sort=price&order=desc

# Expandir relaciones
GET /api/entities/orders/records?resolve=true
```

## Arquitectura de la API

### Base URL
```
http://localhost:3001/api
```

En producción:
```
https://tu-dominio.com/api
```

### Endpoints Principales

#### 1. Gestión de Entidades
```
GET    /entities                          # Listar entidades
GET    /entities/{entity}                 # Schema de entidad
GET    /entities/{entity}/records         # Listar records
POST   /entities/{entity}/records         # Crear record
GET    /entities/{entity}/records/{id}    # Obtener record
PUT    /entities/{entity}/records/{id}    # Actualizar record
DELETE /entities/{entity}/records/{id}    # Eliminar record
```

#### 2. Autenticación de Tenant Users
```
POST   /auth/tenant/login                 # Login usuario (público)
POST   /auth/tenant/logout                # Logout (requiere token)
GET    /auth/tenant/me                    # Info usuario actual (requiere token)
GET    /auth/tenant/users                 # Listar usuarios (requiere admin)
POST   /auth/tenant/users                 # Crear usuario (requiere admin)
GET    /auth/tenant/users/{id}            # Obtener usuario (requiere admin)
PUT    /auth/tenant/users/{id}            # Actualizar usuario (requiere admin)
PUT    /auth/tenant/users/{id}/password   # Cambiar contraseña (requiere admin)
DELETE /auth/tenant/users/{id}            # Eliminar usuario (requiere admin)
```

#### 3. Generación de Metadatos
```
POST   /generation/entity                 # Generar entidad desde prompt
```

## Autenticación

La API soporta **dos modos de autenticación**:

### Modo 1: Admin Token (Administración)

Para operaciones administrativas y MCP tools.

**Bearer Token:**
```bash
curl -H "Authorization: Bearer {admin-api-key}" \
  http://localhost:3001/api/entities
```

**X-API-Key Header:**
```bash
curl -H "X-API-Key: {admin-api-key}" \
  http://localhost:3001/api/entities
```

### Modo 2: Tenant User Token (Usuarios de Aplicación)

Para usuarios finales de la aplicación. Requiere **dos headers**:

```bash
curl -H "X-API-Key: {user-session-token}" \
     -H "X-Tenant-ID: {tenant-slug}" \
  http://localhost:3001/api/entities/products/records
```

O con Authorization:

```bash
curl -H "Authorization: Bearer {user-session-token}" \
     -H "X-Tenant-ID: {tenant-slug}" \
  http://localhost:3001/api/entities/products/records
```

### Flujo de Autenticación de Usuario

#### 1. Crear Usuario (Admin)

```bash
POST /api/auth/tenant/users
Authorization: Bearer {admin-api-key}
Content-Type: application/json

{
  "email": "usuario@empresa.com",
  "password": "secure123",
  "name": "Juan Pérez",
  "role": "member"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "usuario@empresa.com",
    "name": "Juan Pérez",
    "role": "member"
  }
}
```

#### 2. Login de Usuario

**IMPORTANTE:** El endpoint de login es público y **NO requiere** token admin. Solo necesita el header `X-Tenant-ID`.

```bash
POST /api/auth/tenant/login
X-Tenant-ID: {tenant-slug}
Content-Type: application/json

{
  "email": "usuario@empresa.com",
  "password": "secure123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "uuid-session-token",
    "user": {
      "id": "user-uuid",
      "email": "usuario@empresa.com",
      "name": "Juan Pérez",
      "role": "member"
    }
  }
}
```

#### 3. Usar el Token

```bash
GET /api/entities/products/records
X-API-Key: {uuid-session-token}
X-Tenant-ID: mi-empresa
```

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [...],
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

#### 4. Verificar Info del Usuario

```bash
GET /api/auth/tenant/me
X-API-Key: {uuid-session-token}
X-Tenant-ID: mi-empresa
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "usuario@empresa.com",
    "name": "Juan Pérez",
    "role": "member",
    "permissions": {...}
  }
}
```

#### 5. Logout

```bash
POST /api/auth/tenant/logout
X-API-Key: {uuid-session-token}
X-Tenant-ID: mi-empresa
```

**Response:**
```json
{
  "success": true
}
```

### Roles y Permisos

| Role | Permisos |
|------|----------|
| `owner` | Control total del tenant |
| `admin` | Gestionar usuarios y configuración |
| `member` | Crear y editar records |
| `viewer` | Solo lectura |

Los permisos granulares se definen en el campo `permissions`:

```json
{
  "entities": {
    "products": ["create", "read", "update", "delete"],
    "invoices": ["read", "update"],
    "customers": ["read"]
  },
  "canManageUsers": false
}
```

## Códigos de Error

| Código | HTTP | Descripción |
|--------|------|-------------|
| NOT_FOUND | 404 | Entidad o registro no encontrado |
| VALIDATION_ERROR | 400 | Datos inválidos, verificar campos requeridos |
| BUSINESS_RULE_ERROR | 400 | Regla de negocio impidió la operación |
| UNAUTHORIZED | 401 | API key faltante o inválida |
| FORBIDDEN | 403 | Sin permisos para esta operación |
| INTERNAL_ERROR | 500 | Error del servidor |

## Respuestas Estándar

### Estructura de un Record

**IMPORTANTE:** Los campos de la entidad están anidados dentro de `data`, no en el nivel superior del record.

```json
{
  "id": "6bd2d1db-d104-4a15-977a-a759c38608a9",
  "entityId": "79d376b6-b00d-4d07-83b6-62276bc57fee",
  "name": "Test Company S.L.",
  "data": {
    "name": "Test Company S.L.",
    "email": "test@testcompany.es",
    "phone": "+34 912345678",
    "taxId": "B12345678"
  },
  "createdAt": "2026-02-03T12:51:15.352Z",
  "updatedAt": "2026-02-03T12:51:15.352Z"
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único del record |
| `entityId` | UUID | ID de la entidad a la que pertenece |
| `name` | string | Copia del campo `name` de `data` (para búsquedas rápidas) |
| `data` | object | **Campos de la entidad anidados aquí** |
| `createdAt` | datetime | Fecha de creación |
| `updatedAt` | datetime | Fecha de última actualización |

### Acceso a Campos

Para acceder a los campos de la entidad en tu código:

```typescript
// ❌ Incorrecto
const email = record.email;

// ✅ Correcto
const email = record.data.email;
```

### Éxito - Un registro

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "entityId": "uuid",
    "name": "Record Name",
    "data": {
      "name": "Record Name",
      "email": "email@example.com",
      "...otros campos de la entidad"
    },
    "createdAt": "2026-02-03T12:51:15.352Z",
    "updatedAt": "2026-02-03T12:51:15.352Z"
  }
}
```

### Éxito - Lista paginada

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "uuid",
        "entityId": "uuid",
        "name": "Record 1",
        "data": { "...campos de entidad" },
        "createdAt": "...",
        "updatedAt": "..."
      },
      {
        "id": "uuid",
        "entityId": "uuid",
        "name": "Record 2",
        "data": { "...campos de entidad" },
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El campo 'name' es requerido"
  }
}
```

## Flujo de Trabajo Típico

1. Usuario pide información sobre API
2. Ejecutar `get_rest_api_spec()`
3. Explicar endpoints relevantes en lenguaje simple
4. Proveer ejemplos curl
5. Si pide código, generar cliente en su lenguaje
6. Incluir manejo de errores y mejores prácticas

## Mejores Prácticas

### 1. Siempre Incluir Manejo de Errores

```typescript
try {
  const product = await client.getProduct(id);
} catch (error) {
  if (error.code === 'NOT_FOUND') {
    console.log('Producto no encontrado');
  } else {
    console.error('Error:', error.message);
  }
}
```

### 2. Usar Variables de Entorno

```typescript
const API_KEY = process.env.FYSO_API_KEY;
const BASE_URL = process.env.FYSO_API_URL || 'http://localhost:3001/api';
```

### 3. Implementar Retry Logic

Para errores de red temporales:

```typescript
async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}
```

### 4. Cache de Respuestas

Para datos que no cambian frecuentemente:

```typescript
const cache = new Map();

async function getCached<T>(key: string, fetcher: () => Promise<T>, ttl = 60000): Promise<T> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  const data = await fetcher();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}
```

## Relación con Otras Tools

- **get_entity_schema**: Obtener tipos y validaciones de campos
- **list_business_rules**: Ver reglas que afectan operaciones
- **list_entities**: Descubrir entidades disponibles

## Ejemplos Completos

### Next.js API Route

```typescript
// app/api/products/route.ts
import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.FYSO_API_KEY!;
const BASE_URL = process.env.FYSO_API_URL!;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') || '1';
  const limit = searchParams.get('limit') || '20';

  try {
    const response = await fetch(
      `${BASE_URL}/entities/products/records?page=${page}&limit=${limit}`,
      {
        headers: {
          'X-API-Key': API_KEY,
        },
      }
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
```

### Express.js Middleware

```javascript
const express = require('express');
const axios = require('axios');

const app = express();
const apiClient = axios.create({
  baseURL: process.env.FYSO_API_URL,
  headers: {
    'X-API-Key': process.env.FYSO_API_KEY,
  },
});

app.get('/api/products', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { data } = await apiClient.get(
      `/entities/products/records?page=${page}&limit=${limit}`
    );
    res.json(data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || error.message,
    });
  }
});
```

## Debugging Tips

### Inspeccionar Headers

```bash
curl -v -H "X-API-Key: your-key" http://localhost:3001/api/entities/products/records
```

### Ver Response Completo

```bash
curl -i -H "X-API-Key: your-key" http://localhost:3001/api/entities/products/records
```

### Validar JSON

```bash
curl -H "X-API-Key: your-key" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test"}' \
     http://localhost:3001/api/entities/products/records | jq
```

## Flujo Completo de Ejemplo

### Aplicación Web con Usuarios

```javascript
// 1. Login del usuario (desde el frontend)
async function loginUser(email, password) {
  const response = await fetch('http://localhost:3001/api/auth/tenant/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': 'mi-empresa'
    },
    body: JSON.stringify({ email, password })
  });
  
  const { data } = await response.json();
  // Guardar token en localStorage o cookie
  localStorage.setItem('userToken', data.token);
  localStorage.setItem('tenantId', 'mi-empresa');
  return data.user;
}

// 2. Hacer requests autenticados
async function fetchProducts() {
  const token = localStorage.getItem('userToken');
  const tenantId = localStorage.getItem('tenantId');
  
  const response = await fetch('http://localhost:3001/api/entities/products/records', {
    headers: {
      'X-API-Key': token,
      'X-Tenant-ID': tenantId
    }
  });
  
  return await response.json();
}

// 3. Logout
async function logoutUser() {
  const token = localStorage.getItem('userToken');
  const tenantId = localStorage.getItem('tenantId');
  
  await fetch('http://localhost:3001/api/auth/tenant/logout', {
    method: 'POST',
    headers: {
      'X-API-Key': token,
      'X-Tenant-ID': tenantId
    }
  });
  
  localStorage.removeItem('userToken');
  localStorage.removeItem('tenantId');
}
```

## Diferencias Clave: Admin vs Tenant User

| Aspecto | Admin | Tenant User |
|---------|-------|-------------|
| **Token** | API Key permanente | Session token (7 días) |
| **Login** | `/api/auth/login` | `/api/auth/tenant/login` |
| **Headers** | Solo `X-API-Key` | `X-API-Key` + `X-Tenant-ID` |
| **Permisos** | Todos los tenants | Un solo tenant |
| **Operaciones** | CRUD usuarios, settings | CRUD records según role |
| **Uso** | MCP tools, admin panel | Aplicaciones frontend |

## Notas Importantes

1. **API Key Security**: Nunca expongas API keys en código frontend
2. **Tenant Users**: Para apps web usa tenant users, no admin tokens
3. **CORS**: El servidor acepta `*`, configura apropiadamente en producción
4. **HTTPS**: Usa HTTPS en producción
5. **Rate Limiting**: Implementa throttling en producción
6. **Validación**: Valida datos antes de enviar
7. **Sesiones**: Los tokens de usuario expiran a los 7 días
