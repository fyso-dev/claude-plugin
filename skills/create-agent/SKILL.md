---
name: create-agent
description: Guided wizard for non-technical users to create a Fyso agent. Collects purpose, role, responsibilities, constraints, and output expectations; drafts the agent identity and system prompt; confirms with the user; then persists the agent through the Fyso API.
user-invocable: true
---

# Create a Fyso Agent

Use this wizard when the user wants to create a new agent but does not already have a polished role and prompt.

## Config

Reuses the same credentials as `sync-team`, with automatic precedence:

- `./.fyso/config.json` -- local, directory-scoped credentials (highest priority; created by `/fyso:login`)
- `~/.fyso/config.json` -- global credentials (`token`, `tenant_id`, `api_url`)

If the local file exists, use it (resolving a `{ "profile": "<name>" }` reference against the global `profiles` map). Otherwise fall back to the global file. **Never ask the user which credentials to use.** If neither file yields a token, tell the user:

> No encontre tus credenciales de Fyso en `~/.fyso/config.json`. Corre primero `/fyso:sync-team` para guardar tu token, despues volve a este wizard.

Stop. Do not proceed without a token.

## Step 1 -- Understand the job

Ask one question at a time, in Spanish:

1. **Trabajo principal:** Que queres que haga este agente?
2. **Contexto:** En que tipo de proyectos o tareas va a trabajar?
3. **Entregable:** Que deberia devolver cuando termina?
4. **Limites:** Que no deberia hacer sin pedir permiso?
5. **Tono:** Como deberia comunicarse?

If the user already provided enough detail, infer missing answers conservatively and show them in the confirmation step.

## Step 2 -- Draft the agent

Produce these fields:

- `display_name`: short human name, title case.
- `name`: safe lowercase identifier, using letters, numbers, `_` or `-`.
- `role`: one short role label such as `developer`, `qa`, `reviewer`, `designer`, `analyst`, `support`, `security`, or `assistant`.
- `soul`: one or two sentences describing identity, specialty, and judgment.
- `system_prompt`: operational instructions with:
  - mission and responsibilities;
  - expected inputs;
  - expected output shape;
  - quality bar;
  - when to ask for clarification;
  - limits and escalation rules.

Keep prompts practical and specific. Avoid marketing copy.

## Step 3 -- Confirm

Show a compact summary:

```text
Voy a crear este agente:
Nombre visible: ...
Identificador: ...
Rol: ...
Soul: ...
System prompt:
...
```

Ask for explicit confirmation before writing anything.

## Step 4 -- Create the agent

POST to the agents endpoint:

```bash
curl -s -X POST "{API_URL}/api/entities/agents/records" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "X-Tenant-ID: {TENANT_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "{NAME}",
    "display_name": "{DISPLAY_NAME}",
    "role": "{ROLE}",
    "soul": "{SOUL}",
    "system_prompt": "{SYSTEM_PROMPT}",
    "status": "active"
  }'
```

If a field is empty, omit it except for `name`, `display_name`, `role`, and `status`.

If the API returns a non-2xx response, surface the status code and body snippet to the user, then stop.

## Step 5 -- Next action

After creation, report:

- agent name and ID;
- role;
- whether `soul` and `system_prompt` were saved;
- dashboard URL: `https://agent-ui-sites.fyso.dev/`;
- next step: add the agent to a team, then run `/fyso:sync-team`.

## OpenCode shortcut

In OpenCode the same flow is available via the `fyso-create-agent` tool.

- Called without `name`: returns the guided prompt-writing checklist.
- Called with `name`, optional `display_name`, `role`, `soul`, `system_prompt`, and `status`: creates the agent.
