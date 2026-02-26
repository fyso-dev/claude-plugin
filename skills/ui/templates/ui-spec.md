# UI Spec Template

Use this template when creating `.planning/UI-SPEC.md`.

---

```markdown
# UI Specification: {App Name}

## Objective
{What the UI does, for whom, and the primary use case}

## App Type
- [ ] Internal admin panel
- [ ] Client-facing portal
- [ ] Public website
- [ ] Mixed (public + authenticated)

## Users & Roles

| Role | Access Level | Description | Can Self-Register |
|------|-------------|-------------|-------------------|
| owner | Full control | App owner, all permissions | no |
| admin | Management | Manage users + all CRUD | no |
| member | Standard | Create and edit records | {yes/no} |
| viewer | Read-only | View data, no modifications | {yes/no} |
| public | No auth | Public pages, no login | n/a |

## Role-Based UI Differences

| Feature | owner | admin | member | viewer | public |
|---------|-------|-------|--------|--------|--------|
| Dashboard | yes | yes | yes | yes | no |
| {Entity} list | yes | yes | yes | yes | {yes/no} |
| {Entity} create | yes | yes | yes | no | no |
| {Entity} edit | yes | yes | yes | no | no |
| {Entity} delete | yes | yes | no | no | no |
| User management | yes | yes | no | no | no |
| Own profile | yes | yes | yes | yes | no |

## Pages

### Public Pages (no auth required)

| Page | Route | Purpose |
|------|-------|---------|
| {Landing/Home} | `/` | {description} |
| Login | `/login` | Email + password login |
| Register | `/register` | Self-registration form |

### Authenticated Pages

| Page | Route | Roles | Type | Entity |
|------|-------|-------|------|--------|
| Dashboard | `/app` | all | dashboard | — |
| {Entity} List | `/app/{entity}` | {roles} | list (DataGrid) | {entity} |
| {Entity} Detail | `/app/{entity}/:id` | {roles} | detail (RecordDetail) | {entity} |
| {Entity} New | `/app/{entity}/new` | {roles} | form (DynamicForm) | {entity} |
| {Entity} Edit | `/app/{entity}/:id/edit` | {roles} | form (DynamicForm) | {entity} |
| Users | `/app/users` | owner, admin | user-management | — |
| Profile | `/app/profile` | all | profile | — |

## Entity → UI Mapping

| Entity | List | Create | Edit | Delete | Detail | Public View |
|--------|------|--------|------|--------|--------|-------------|
| {entity} | DataGrid | DynamicForm | DynamicForm | confirm dialog | RecordDetail | {yes/no} |

## Authentication

| Setting | Value |
|---------|-------|
| Method | Tenant user tokens |
| Login endpoint | `POST /api/auth/tenant/login` |
| Register endpoint | `POST /api/auth/tenant/register` (if self-reg) |
| Token storage | {localStorage / httpOnly cookie} |
| Token refresh | {on 401 redirect to login / automatic refresh} |
| Session TTL | 7 days |

## API Configuration

| Setting | Value |
|---------|-------|
| API URL | `{url}` |
| Tenant ID | `{slug}` |
| Auth header | `X-API-Key: {token}` + `X-Tenant-ID: {slug}` |
| Public data proxy | {yes: server-side with admin key / no} |

## Dashboard

### KPIs

| KPI | Label | Source Entity | Query | Format |
|-----|-------|---------------|-------|--------|
| {kpi_name} | {display label} | {entity} | count / sum({field}) / filter | {number / currency / percent} |

### Quick Actions

| Action | Label | Route |
|--------|-------|-------|
| {action} | {label} | {route} |

### Recent Activity

| Section | Entity | Sort | Limit | Filter |
|---------|--------|------|-------|--------|
| {name} | {entity} | {field} desc | 5 | {optional filter} |

## Style

| Setting | Value |
|---------|-------|
| Theme | {minimal / professional / modern / dark} |
| Primary color | {hex or CSS variable} |
| Layout | {sidebar / topnav / landing+app} |
| Responsive | {yes / no / mobile-first} |
| Language | {es / en / both} |
| Icons | Lucide React |
| Font | {system / Inter / custom} |

## Navigation

### Sidebar Items (or Top Nav)

```
{icon} Dashboard        → /app
{icon} {Entity 1}       → /app/{entity1}
{icon} {Entity 2}       → /app/{entity2}
{icon} {Entity 3}       → /app/{entity3}
───────
{icon} Usuarios         → /app/users       (admin+)
{icon} Mi Perfil        → /app/profile
```

## Search & Filters

| Feature | Scope | Details |
|---------|-------|---------|
| Global search | {across entities / single entity} | {description} |
| Entity filters | {per entity} | {status, date range, category} |
| Saved filters | {yes / no} | {description} |

## Special Views (if any)

| View | Type | Entity | Description |
|------|------|--------|-------------|
| {Calendar} | calendar | {entity} | {date field for scheduling} |
| {Kanban} | kanban | {entity} | {status field for columns} |
| {Chart} | chart | {entity} | {aggregation for chart} |

## Technical Notes

- {Any constraints or special requirements}
- {Performance considerations}
- {Third-party integrations}
```
