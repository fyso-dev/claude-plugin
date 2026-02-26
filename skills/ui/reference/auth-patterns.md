# Authentication Patterns for Fyso UIs

## Pattern 1: Internal Admin Panel (Most Common)

**When:** Team uses the app internally. No public access, no self-registration.

```
Flow:
  1. User navigates to /app → redirected to /login
  2. Login with email/password → POST /api/auth/tenant/login
  3. Get token → store in httpOnly cookie or localStorage
  4. All API calls include X-API-Key: {token} + X-Tenant-ID: {slug}
  5. On 401 → redirect to /login

User creation: Admin creates users via /app/users
Roles: owner, admin, member
```

**Auth Provider:**
```tsx
interface AuthState {
  user: { id: string; email: string; name: string; role: string } | null
  token: string | null
  loading: boolean
}

// Login
const login = async (email: string, password: string) => {
  const res = await fetch(`${API_URL}/auth/tenant/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_SLUG },
    body: JSON.stringify({ email, password }),
  })
  const { data } = await res.json()
  setToken(data.token)
  setUser(data.user)
}

// Check session on mount
const checkSession = async () => {
  const token = getStoredToken()
  if (!token) return setLoading(false)
  try {
    const res = await fetch(`${API_URL}/auth/tenant/me`, {
      headers: { 'X-API-Key': token, 'X-Tenant-ID': TENANT_SLUG },
    })
    const { data } = await res.json()
    setUser(data)
  } catch {
    clearToken()
  }
  setLoading(false)
}
```

---

## Pattern 2: Client Portal (Self-Registration)

**When:** Clients sign up to view their own data.

```
Flow:
  1. Landing page at / (public)
  2. Login at /login or Register at /register
  3. Register: POST /api/auth/tenant/users (with special public endpoint)
     OR admin pre-creates accounts
  4. After login, client sees only their own data (filtered by user)
  5. Role: viewer (read-only) or member (can create requests/tickets)

User creation: Self-registration + admin approval (optional)
Roles: owner, admin, member (staff), viewer (client)
```

**Registration Form:**
```tsx
const register = async (email: string, password: string, name: string) => {
  const res = await fetch(`${API_URL}/auth/tenant/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_SLUG },
    body: JSON.stringify({ email, password, name }),
  })
  const { data } = await res.json()
  // Auto-login after registration
  setToken(data.token)
  setUser(data.user)
}
```

---

## Pattern 3: Public + Authenticated Areas

**When:** Part of the app is public (catalog, landing), part requires login.

```
Routes:
  /              → Public landing page
  /catalog       → Public product/service listing (read-only)
  /catalog/:id   → Public detail page
  /login         → Login form
  /register      → Registration (optional)
  /app/*         → Authenticated area (requires login)

Auth check: Only /app/* routes require authentication
Public pages: Fetch data with admin API key on server side, or public endpoints
```

**Route Structure:**
```tsx
<Routes>
  {/* Public routes - no auth needed */}
  <Route path="/" element={<PublicLayout />}>
    <Route index element={<LandingPage />} />
    <Route path="catalog" element={<PublicCatalog />} />
    <Route path="catalog/:id" element={<PublicDetail />} />
    <Route path="login" element={<LoginPage />} />
    <Route path="register" element={<RegisterPage />} />
  </Route>

  {/* Authenticated routes */}
  <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
    <Route index element={<Dashboard />} />
    <Route path="pacientes" element={<PacientesList />} />
    <Route path="pacientes/:id" element={<PacienteDetail />} />
    {/* ... */}
  </Route>
</Routes>
```

---

## Pattern 4: No Auth (Fully Public)

**When:** Read-only data display. No login, no user management.

```
Flow:
  1. All pages are public
  2. Data fetched with admin API key (server-side proxy)
  3. No user context, no role-based access

Server proxy (Bun.serve):
  /api/* → forward to Fyso API with admin key
  This avoids exposing the API key to the browser
```

**Server-side proxy:**
```ts
Bun.serve({
  routes: {
    "/api/entities/:entity/records": async (req) => {
      const res = await fetch(`${FYSO_API_URL}/entities/${req.params.entity}/records`, {
        headers: { 'X-API-Key': ADMIN_API_KEY },
      })
      return new Response(res.body, { headers: { 'Content-Type': 'application/json' } })
    },
  },
})
```

---

## Token Storage Strategies

### Strategy 1: localStorage (Simple)
```ts
const setToken = (token: string) => localStorage.setItem('fyso_token', token)
const getToken = () => localStorage.getItem('fyso_token')
const clearToken = () => localStorage.removeItem('fyso_token')
```
- Pros: Simple, persists across tabs
- Cons: Vulnerable to XSS

### Strategy 2: httpOnly Cookie (Secure)
```ts
// Server sets the cookie on login response
// Browser automatically sends it with every request
// No JS access to the token
```
- Pros: XSS-safe
- Cons: Requires server-side cookie handling, CSRF protection needed

### Strategy 3: Memory + Refresh (Most Secure)
```ts
let token: string | null = null
const setToken = (t: string) => { token = t }
const getToken = () => token
// Token lost on page refresh → use refresh token endpoint to get new one
```
- Pros: Not persisted, not accessible to XSS
- Cons: Lost on refresh, needs refresh token flow

**Recommendation:** localStorage for internal admin panels. httpOnly cookies for client-facing apps. Memory + refresh for high-security apps.

---

## Role-Based Access Helpers

```tsx
type Role = 'owner' | 'admin' | 'member' | 'viewer'

const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
}

function hasRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

function canPerform(userRole: Role, action: 'create' | 'edit' | 'delete' | 'manage_users'): boolean {
  switch (action) {
    case 'create': return hasRole(userRole, 'member')
    case 'edit': return hasRole(userRole, 'member')
    case 'delete': return hasRole(userRole, 'admin')
    case 'manage_users': return hasRole(userRole, 'admin')
  }
}

// In components:
function EntityActions({ record }) {
  const { user } = useAuth()
  return (
    <>
      {canPerform(user.role, 'edit') && <EditButton record={record} />}
      {canPerform(user.role, 'delete') && <DeleteButton record={record} />}
    </>
  )
}
```

---

## API Key Handling

| Scenario | Key Type | Where Stored | Who Has It |
|----------|----------|-------------|------------|
| Admin backend | Admin API key | `.env` / server only | Developer |
| Server-side proxy | Admin API key | `.env` / server only | Server process |
| User browser | User session token | Cookie/localStorage | Each user |
| MCP client | OAuth access token | MCP client memory | AI agent |

**NEVER expose admin API keys in browser code.** Use a server-side proxy or tenant user tokens.
