# API Contracts Template

Use this template when creating `.planning/UI-CONTRACTS.md`.

---

```markdown
# UI → API Contracts: {App Name}

## Base Configuration

| Key | Value |
|-----|-------|
| API Base URL | `{url}/api` |
| Tenant ID | `{tenant-slug}` |
| Auth mode | Tenant user tokens |

## Authentication

### Login

```http
POST /api/auth/tenant/login
Content-Type: application/json
X-Tenant-ID: {tenant-slug}

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "token": "uuid-session-token",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "User Name",
      "role": "member"
    }
  }
}
```

**Response 401:**
```json
{
  "success": false,
  "error": { "code": "UNAUTHORIZED", "message": "Invalid credentials" }
}
```

### Register (if self-registration enabled)

```http
POST /api/auth/tenant/users
Content-Type: application/json
X-Tenant-ID: {tenant-slug}

{
  "email": "newuser@example.com",
  "password": "password123",
  "name": "New User"
}
```

**Response 201:** Same as login response (auto-login after register)

### Current User

```http
GET /api/auth/tenant/me
X-API-Key: {token}
X-Tenant-ID: {tenant-slug}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "role": "member",
    "permissions": { ... }
  }
}
```

### Logout

```http
POST /api/auth/tenant/logout
X-API-Key: {token}
X-Tenant-ID: {tenant-slug}
```

**Response 200:** `{ "success": true }`

---

## Entity Contracts

(Repeat this section for each entity exposed in the UI)

### {Entity Name} (`{entity_slug}`)

**Schema:**

| Field | Key | Type | Required | Unique | Default | Notes |
|-------|-----|------|----------|--------|---------|-------|
| {display} | {key} | {type} | {yes/no} | {yes/no} | {value} | {notes} |

**Record shape:**
```json
{
  "id": "uuid",
  "entityId": "uuid",
  "name": "{value of name field}",
  "data": {
    "{field_key_1}": "{value}",
    "{field_key_2}": "{value}"
  },
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

**IMPORTANT:** Entity field values are in `record.data.{fieldKey}`, NOT `record.{fieldKey}`.

**List:**
```http
GET /api/entities/{entity}/records?page=1&limit=20&sort={field}&order=asc
X-API-Key: {token}
X-Tenant-ID: {tenant-slug}
```

Response: `{ data: { data: Record[], total, page, limit, totalPages } }`

**Get One:**
```http
GET /api/entities/{entity}/records/{id}
```

Response: `{ data: Record }`

**Create:**
```http
POST /api/entities/{entity}/records
Content-Type: application/json

{ "{field_key_1}": "value1", "{field_key_2}": "value2" }
```

Response 201: `{ data: Record }`

**Update:**
```http
PUT /api/entities/{entity}/records/{id}
Content-Type: application/json

{ "{field_key}": "new_value" }
```

Response: `{ data: Record }`

**Delete:**
```http
DELETE /api/entities/{entity}/records/{id}
```

Response: `{ success: true }`

**Search:**
```http
GET /api/entities/{entity}/records?search={query}
```

**Filters:**
```http
GET /api/entities/{entity}/records?filter.{field}={value}
```

**Expand relations:**
```http
GET /api/entities/{entity}/records?resolve=true
```

---

## Role → Permission Matrix

| Action | owner | admin | member | viewer | public |
|--------|-------|-------|--------|--------|--------|
(fill per entity and action)

## User Management (Admin Only)

### List Users

```http
GET /api/auth/tenant/users
X-API-Key: {admin-token}
X-Tenant-ID: {tenant-slug}
```

### Create User

```http
POST /api/auth/tenant/users
Content-Type: application/json
X-API-Key: {admin-token}
X-Tenant-ID: {tenant-slug}

{
  "email": "new@example.com",
  "password": "password",
  "name": "New User",
  "role": "member"
}
```

### Update User

```http
PUT /api/auth/tenant/users/{id}
Content-Type: application/json
X-API-Key: {admin-token}
X-Tenant-ID: {tenant-slug}

{ "name": "Updated Name", "role": "admin" }
```

### Change Password

```http
PUT /api/auth/tenant/users/{id}/password
Content-Type: application/json

{ "password": "new-password" }
```

### Delete User

```http
DELETE /api/auth/tenant/users/{id}
```

---

## API Keys & Security

| Token Type | Scope | TTL | Storage | Notes |
|-----------|-------|-----|---------|-------|
| Admin API key | All operations, all tenants | Permanent | `.env` server only | NEVER in browser |
| User session token | Single tenant, role-based | 7 days | {cookie/localStorage} | Per user |
| OAuth access token | MCP operations | 1 hour | MCP client memory | For AI agents |

## Error Codes

| Code | HTTP | UI Action |
|------|------|-----------|
| UNAUTHORIZED | 401 | Clear token, redirect to /login |
| FORBIDDEN | 403 | Show "No tiene permisos" message |
| NOT_FOUND | 404 | Show "No encontrado" page |
| VALIDATION_ERROR | 400 | Show field errors on form |
| BUSINESS_RULE_ERROR | 400 | Show rule message as toast/alert |
| INTERNAL_ERROR | 500 | Show "Error del servidor" message |

## Dashboard Queries

| KPI | Endpoint | Parse |
|-----|----------|-------|
(list each dashboard KPI with the exact API call and how to extract the value)
```
