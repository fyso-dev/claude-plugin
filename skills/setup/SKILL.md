---
name: fyso-setup
description: "Initialize a new Fyso project and configure MCP connection. Project setup, dependencies, database, and Claude MCP configuration."
argument-hint: "[init [project-name] | mcp [setup|status|test]]"
disable-model-invocation: true
allowed-tools: Bash(git *), Bash(bun *), Bash(mkdir *), Bash(cp *), Bash(cd *), Bash(cat *), Bash(echo *)
---

# Fyso Setup — Project Init & MCP Configuration

One command for all setup tasks: initialize a new Fyso project and configure MCP connection.

## Subcommands

```
/fyso:setup init my-project     # Clone, install, configure DB, generate CLAUDE.md
/fyso:setup mcp                 # Configure Claude to use Fyso MCP server
/fyso:setup mcp status          # Check MCP connection status
/fyso:setup mcp test            # Test MCP tools are working
```

---

## Mode: INIT — Initialize Project

### 1. Create project directory

```bash
mkdir -p ~/$ARGUMENTS
cd ~/$ARGUMENTS
```

### 2. Clone Fyso

```bash
git clone https://github.com/fyso/fyso.git .
```

### 3. Install dependencies

```bash
bun install
```

### 4. Configure database

Create `.env`:
```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/$ARGUMENTS
API_PORT=3001
MCP_PORT=3002
WEB_PORT=5173
```

### 5. Create database and run migrations

```bash
createdb $ARGUMENTS 2>/dev/null || echo "DB already exists"
cd packages/db && bun run migrate
```

### 6. Generate CLAUDE.md

```markdown
# $ARGUMENTS - ERP Project

## Stack
- Runtime: Bun
- Database: PostgreSQL
- API: Hono
- Frontend: React + Vite

## Commands
bun run dev          # Start everything
bun run dev:api      # API only
bun run dev:web      # Frontend only
bun run dev:mcp      # MCP server only

## Database
cd packages/db && bun run migrate    # Run migrations
cd packages/db && bun run seed       # Load test data

## Tests
cd packages/api && bun test          # API tests

## MCP Server
Available at http://localhost:3002/mcp
```

### 7. Verify installation

```bash
bun run dev &
sleep 3
curl http://localhost:3001/api/health
```

### Next step after init

Suggest creating first entities:
```
Project ready. Now create your entities.
What kind of business is this? I'll suggest common entities.
```

---

## Mode: MCP — Configure MCP Connection

### For Claude Desktop

Location:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "fyso": {
      "command": "bun",
      "args": ["run", "/path/to/fyso/packages/mcp-server/src/index.ts"],
      "env": { "API_URL": "http://localhost:3001" }
    }
  }
}
```

### For Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "fyso": {
      "command": "bun",
      "args": ["run", "/path/to/fyso/packages/mcp-server/src/index.ts"],
      "env": { "API_URL": "http://localhost:3001" }
    }
  }
}
```

### HTTP Alternative

Start server: `cd packages/mcp-server && bun run start:http`

```json
{
  "mcpServers": {
    "fyso": {
      "url": "http://localhost:3002/mcp",
      "transport": "sse"
    }
  }
}
```

### Verify Connection

1. Ask Claude: "What Fyso tools do you have?"
2. Should list 16 tools (generate_entity, list_entities, etc.)
3. Test: "List available Fyso entities"

### Troubleshooting

| Error | Fix |
|-------|-----|
| MCP server not found | Check server running: `curl http://localhost:3002/mcp/health` |
| Connection refused | Start server: `bun run dev:mcp` |
| Auth failed | Verify API_URL in env |

### Multiple Projects

```json
{
  "mcpServers": {
    "fyso-tienda": {
      "command": "bun",
      "args": ["run", "~/tienda/packages/mcp-server/src/index.ts"]
    },
    "fyso-restaurante": {
      "command": "bun",
      "args": ["run", "~/restaurante/packages/mcp-server/src/index.ts"]
    }
  }
}
```
