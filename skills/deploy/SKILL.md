---
name: fyso-deploy
description: Deploy your Fyso app to sites.fyso.dev
disable-model-invocation: true
---

# Deploy - Fyso

One-command deploy to `sites.fyso.dev`.

## Flow

### Step 1: Check for existing site

```
list_static_sites()
```

If a site already exists, show it and ask if the builder wants to update it or deploy to a new subdomain.

### Step 2: Determine what to deploy

Check if the builder has a frontend project to deploy:

1. Look for common build output directories:
   - `dist/` (Vite, Astro)
   - `out/` (Next.js static export)
   - `build/` (Create React App)
   - `.next/` (Next.js — needs `next export` first)

2. If no build output exists, ask the builder:
   - "Do you have a frontend to deploy? If so, what framework?"
   - If no frontend, suggest: "I can deploy a simple landing page for your app"

### Step 3: Build (if needed)

If the project has a frontend but no build output:

```bash
# Vite / Astro
bun run build

# Next.js static export
bun run build && bun run export

# Or whatever the project's build command is
```

### Step 4: Choose subdomain

Ask the builder for a subdomain name, or suggest one based on the tenant/project name:

```
Your app will be available at: https://{subdomain}-sites.fyso.dev

Suggested subdomain: "mi-taller"
```

Rules for subdomains:
- Lowercase letters, numbers, and hyphens only
- No spaces or special characters
- Must be unique across all Fyso sites

### Step 5: Deploy

Call the MCP tool:

```
deploy_static_site({
  subdomain: "mi-taller",
  path: "/absolute/path/to/dist"
})
```

**Two possible responses — handle both:**

**A) Success response** (MCP uploaded directly):
```json
{ "success": true, "url": "https://mi-taller-sites.fyso.dev" }
```
→ Done. **CRITICAL: Ignore the `url` field in the response.** The API sometimes returns `mi-taller.fyso.dev` (without `-sites`), which is wrong and will 404. Always construct the real URL yourself:
```
Real URL = https://{subdomain}-sites.fyso.dev
```
Show that URL to the user, not whatever the API returns.

**B) Shell command response** (MCP can't access local files — remote mode):
```json
{ "success": false, "command": "curl -X POST https://..." }
```
→ The MCP returned a `curl` command that the user must run locally. Show it clearly:

```
El MCP no puede acceder a tus archivos locales directamente.
Ejecutá este comando en tu terminal:

{command}

Cuando termine, tu sitio estará en: https://mi-taller-sites.fyso.dev
```

Do NOT try to run the curl command yourself — it requires local file access. Just show it to the user.

### Step 6: Confirm

```
Deployed!

Your app is live at: https://{subdomain}-sites.fyso.dev

(Note: the API response URL may show {subdomain}.fyso.dev without "-sites" — that's a bug in the API. The correct URL always has "-sites".)

To update: just run /fyso-deploy again
```

## Quick Deploy (No Frontend)

If the builder just wants their Fyso data accessible but doesn't have a frontend:

1. Generate a minimal static page using the Fyso API client
2. Build it
3. Deploy it

This is a future enhancement — for now, the skill requires an existing build output directory.
