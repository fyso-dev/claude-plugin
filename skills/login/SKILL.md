---
name: fyso-login
description: "Initialize directory-scoped Fyso and Fyso Teams credentials in the current directory. Creates ./.fyso/config.json (fyso_backend#1637 scheme), guides token/tenant or profile setup, and keeps credentials out of git. Run this when Fyso reports missing credentials for a directory."
argument-hint: "[--profile <name>] [--teams]"
---

# Fyso Login — Directory-scoped Fyso credentials setup

Set up local Fyso (and optionally Fyso Teams) credentials for the **current working directory**, following the directory-scoped credential scheme from [fyso_backend#1637](https://github.com/fyso-dev/fyso_backend/issues/1637):

1. `./.fyso/config.json` — project-local (git-ignored), highest priority.
2. `~/.fyso/config.json` — global fallback; may declare named `profiles`.

A local file usually just selects a profile: `{ "profile": "<name>" }`. Tokens live in the global file so they can be rotated in one place. Inline `token`/`tenant_id` in the local file are also supported and override the referenced profile.

Resolution is automatic: when both files exist, the local one is used; otherwise the global one. Fyso skills and tools apply this precedence silently and must never ask the user which credentials to use.

## Usage

```
/fyso:login                     # interactive setup
/fyso:login --profile etendo    # pre-select a global profile for this directory
/fyso:login --teams             # also configure a Fyso Teams profile
```

## Instructions

Parse the arguments:
- `--profile <name>` — profile to select for this directory (skips the profile question).
- `--teams` — also configure Fyso Teams credentials (skips the Teams question).

**Never print a token back to the user.** When showing existing or new configuration, mask tokens as `fyso_ak_…abcd` (prefix + last 4 characters).

### Step 1: Inspect existing configuration

Check both files:

```bash
cat ./.fyso/config.json 2>/dev/null
cat ~/.fyso/config.json 2>/dev/null
```

- If `./.fyso/config.json` **already exists**: do NOT overwrite it silently. Show the user a masked summary of what it contains (selected profile and/or tenant, token masked) and ask for explicit confirmation before rewriting it. If the user declines, stop — leave everything untouched.
- Note which named profiles (if any) exist in the global `~/.fyso/config.json`.

### Step 2: Choose how to log in

Ask the user (skip what the arguments already answered):

1. **Use an existing profile** — if the global file has `profiles`, list their names (and tenant ids) and let the user pick one.
2. **Enter new credentials** — ask for:
   - API token (`fyso_ak_...` API key, or an admin JWT)
   - Tenant slug/id (e.g. `acme`)
   - A profile name to store them under in the global file (default: the tenant id).
3. **Inline local-only credentials** — if the user prefers not to touch the global file, store `token`/`tenant_id` directly in the local file.

Then ask about **Fyso Teams** (unless `--teams` was passed or the user already covered it): "Do you also use Fyso Teams from this directory?" If yes, collect its token and tenant (the Fyso Teams workspace tenant) and store them as a separate `fyso-teams` profile in the global file, so it can be selected from any directory with `{ "profile": "fyso-teams" }`.

### Step 3: Write the config files

Create the directory and files (use the Write tool or a heredoc — never echo tokens into shell history when avoidable):

```bash
mkdir -p ./.fyso
```

- **Global** `~/.fyso/config.json`: when new credentials or a Teams profile were entered, **merge** them into the existing `profiles` map — never delete or replace other profiles or the top-level `token`/`tenant_id` that may already be there. Create the file (and `~/.fyso/`) if missing.
- **Local** `./.fyso/config.json`:
  - Profile mode: `{ "profile": "<name>" }`
  - Inline mode: `{ "token": "...", "tenant_id": "..." }`

Restrict permissions on every file that contains a token:

```bash
chmod 700 ./.fyso ~/.fyso 2>/dev/null
chmod 600 ./.fyso/config.json ~/.fyso/config.json 2>/dev/null
```

### Step 4: Keep credentials out of git

If the current directory is inside a git repository (`git rev-parse --is-inside-work-tree`), make sure `.fyso/` is ignored:

```bash
grep -qxF '.fyso/' .gitignore 2>/dev/null || printf '\n# Local Fyso credentials — never commit\n.fyso/\n' >> .gitignore
```

If `.gitignore` did not exist, this creates it. Tell the user the entry was added (or already present). If `./.fyso/config.json` was somehow already tracked by git, warn the user to remove it from the index (`git rm --cached .fyso/config.json`) and rotate the token.

### Step 5: Verify and summarize

Verify the credentials work by calling a cheap Fyso MCP tool (e.g. `fyso_auth` → `list_tenants`). If the MCP server was already running before the files existed, it caches credentials per process — tell the user to restart the session/MCP server for the new files to take effect.

If verification fails, show a clear, plain-language error (wrong/expired token, unreachable backend) — never dump raw stack traces at the user.

Then show a summary like:

```
Fyso credentials configured for this directory

Local:   ./.fyso/config.json        → profile "etendo"
Global:  ~/.fyso/config.json        → profiles: etendo, fyso-teams
Token:   fyso_ak_…abcd (masked)
Git:     .fyso/ ignored via .gitignore

Restart the session if Fyso tools still report missing credentials.
```

## Error handling

| Problem | Solution |
|---------|----------|
| User declines overwrite | Stop without touching any file; suggest `--profile` to just switch profiles later |
| Selected profile missing from global file | Offer to create it (ask for token + tenant) instead of writing a dangling reference |
| Verification call fails with 401 | Token is wrong/expired — re-ask for the token, don't leave broken files behind |
| Backend unreachable | Say so plainly (network/server down), keep the files, suggest retrying verification later |
| Not a git repository | Skip the gitignore step and mention the files are local-only |
