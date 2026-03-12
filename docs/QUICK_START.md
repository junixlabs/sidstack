# SidStack Quick Start

Get from zero to productive in minutes.

SidStack has multiple interfaces - use any combination:
- **MCP Server** - Use from Claude Code with MCP tools
- **Desktop App** - Visual project management (macOS/Linux)
- **Web UI** - Browser-based access (remote/team)
- **Docker** - Deploy full stack on a server

---

## Option A: MCP Server (Claude Code)

### 1. Initialize Your Project

```bash
cd your-project
npx @sidstack/cli init --scan
```

This sets up everything in one command:
- `.sidstack/` - Governance, skills, and knowledge docs
- `.mcp.json` - MCP server config for Claude Code
- `.claude/settings.local.json` - Tool auto-approval

The `--scan` flag uses AI to analyze your codebase and generate knowledge docs in `.sidstack/knowledge/`.

Without scan:
```bash
npx @sidstack/cli init
```

### 2. Use MCP Tools in Claude Code

Once initialized, Claude Code has access to MCP tools:

**Knowledge (understand your project)**
```
knowledge_search         - Semantic search across knowledge and memory (SidMemo)
knowledge_list           - List available docs
knowledge_get            - Get single document
knowledge_modules        - List modules with stats
knowledge_module_overview - Get module architecture overview
knowledge_create         - Create knowledge document
knowledge_update    - Update knowledge document
knowledge_delete    - Delete knowledge document
knowledge_health    - Check coverage health
```

**Tasks (track AI work)**
```
task_create         - Create task with governance
task_update         - Update status/progress
task_list           - List tasks with filtering
task_get            - Get task details
task_complete       - Complete with quality gate check
```

**Impact Analysis (assess risk before changes)**
```
impact_analyze      - Analyze a planned change
impact_check_gate   - Check if safe to proceed
impact_list         - List analyses
```

**Tickets (external intake)**
```
ticket_create           - Create ticket
ticket_list             - List/filter tickets
ticket_update           - Update status
ticket_convert_to_task  - Convert to task
```

**Training (learn from mistakes)**
```
incident_create         - Report an incident
incident_list           - List incidents
lesson_create           - Create lesson from incident
lesson_list             - List lessons
rule_check              - Check rules for context
training_context_get    - Get training context for session
```

**Test Results (persist test execution)**
```
test_result_create  - Persist test results
test_result_list    - List test results
test_result_get     - Get detailed test result
```

**Agent Desk (workspace isolation)**
```
desk_create         - Create agent desk (git worktree)
desk_list           - List all agent desks
desk_status         - Get desk status
desk_remove         - Remove agent desk
```

**Memory (store learnings)**
```
memory_add              - Add a memory entry
memory_list             - List memory entries
memory_delete           - Delete a memory entry
memory_index_knowledge  - Index knowledge docs into memory
memory_cleanup          - Clean up stale entries
```

**Entity References**
```
entity_link         - Link entities (task↔knowledge, etc.)
entity_references   - Get references for an entity
entity_context      - Build context from linked entities (entity mode + RAG mode)
```

### 3. Example Workflow

```
1. "Create a task to add user authentication"
   → Claude calls task_create

2. "Analyze the impact of this change"
   → Claude calls impact_analyze, sees risks and blockers

3. "Build context for the api-server module"
   → Claude calls entity_context (RAG mode), gets relevant docs

4. [Implement the feature]

5. "Complete the task"
   → Claude calls task_complete, runs quality gates
```

Or configure MCP manually (without CLI init):

```json
{
  "mcpServers": {
    "sidstack": {
      "command": "npx",
      "args": ["-y", "@sidstack/mcp-server"]
    }
  }
}
```

---

## Option C: Docker Server (Full Stack)

Deploy all SidStack services on a server with Docker Compose.

### Services

| Service | Port | Description |
|---------|------|-------------|
| **api-server** | 19432 | REST API — central data gateway (SQLite) |
| **mcp-server** | 19433 | MCP tools — Streamable HTTP for Claude Code |
| **bot-server** | 3222 | SidBot — Gemini intent router + chat |
| **web-ui** | 5174 | React SPA — browser-based project management |
| **caddy** | 80/443 | Reverse proxy — auto TLS (Let's Encrypt) |
| **mem0** | 4321 | Semantic memory (optional) |
| **litellm** | 4000 | LLM gateway for mem0 (optional) |

### 1. Configure Environment

```bash
cd docker
cp .env.example .env
```

Edit `.env` with your values:

```env
# Required
SIDSTACK_API_KEY=sk-your-secure-key

# Domain names (must point to your server IP)
API_DOMAIN=api.yourdomain.com
MCP_DOMAIN=mcp.yourdomain.com
APP_DOMAIN=app.yourdomain.com

# Optional: CORS for Web UI
SIDSTACK_CORS_ORIGINS=https://app.yourdomain.com
```

### 2. Start All Services

```bash
# Full stack (all services)
docker compose up -d

# Core only (no semantic memory)
docker compose up -d api-server mcp-server bot-server web-ui caddy

# Minimal (API + MCP only, no proxy)
docker compose up -d api-server mcp-server
```

### 3. Verify

```bash
# Check all services are running
docker compose ps

# Health checks
curl https://api.yourdomain.com/health
curl https://mcp.yourdomain.com/health

# Open Web UI
open https://app.yourdomain.com
```

### 4. Connect Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "sidstack": {
      "type": "streamable-http",
      "url": "https://mcp.yourdomain.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

### 5. Sync Knowledge to Server

Push local `.sidstack/knowledge/` files to the remote API:

```bash
npx @sidstack/cli knowledge sync \
  --api-url https://api.yourdomain.com \
  --api-key sk-your-key

# Preview without changes
npx @sidstack/cli knowledge sync --dry-run
```

### Architecture

```
Internet
  │
  ├── app.yourdomain.com  → Caddy → web-ui (:5174)
  ├── api.yourdomain.com  → Caddy → api-server (:19432) → SQLite
  ├── mcp.yourdomain.com  → Caddy → mcp-server (:19433) → api-server
  └── bot.yourdomain.com  → Caddy → bot-server (:3222)  → api-server + Gemini

  Web UI: /api/* proxied internally to api-server
  MCP Server: calls API Server via HTTP (no direct DB access)
  Bot Server: Gemini intent routing, calls API Server for tasks/tickets
```

---

## Option D: Connect to Remote Server

Connect Claude Code to an existing SidStack server (deployed by your team).

### 1. Get Your Credentials

Your admin provides:
- API URL (e.g. `https://api.yourdomain.com`)
- MCP URL (e.g. `https://mcp.yourdomain.com`)
- API Key (e.g. `sk-...`)

### 2. Configure `.mcp.json`

```json
{
  "mcpServers": {
    "sidstack": {
      "type": "streamable-http",
      "url": "https://mcp.yourdomain.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

### 3. Set Environment (Optional)

For CLI commands that call the REST API directly:

```bash
export SIDSTACK_API_URL=https://api.yourdomain.com
export SIDSTACK_API_KEY=sk-your-key
```

### 4. Verify Connection

In Claude Code, ask:
```
List my SidStack tasks
```

Claude should use the `task_list` MCP tool and connect to the remote server.

---

## Option B: Desktop App (macOS/Linux)

### 1. Install

Download the `.dmg` (macOS) or `.deb`/`.AppImage` (Linux) from [Releases](https://github.com/junixlabs/sidstack/releases).

Or build from source:

```bash
git clone https://github.com/junixlabs/sidstack.git
cd sidstack
pnpm install && pnpm packages:build && pnpm tauri:build
```

### 2. Connect to Server

On first launch, the app shows a **Connection Setup** screen. Enter your Server URL and API Key, then test the connection.

### 3. Explore the Views

| View | Shortcut | Description |
|------|----------|-------------|
| **Project Hub** | `Cmd+1` | Dashboard with capabilities, goals, and quick actions |
| **Task Manager** | `Cmd+2` | Create/track tasks, list/kanban/timeline views |
| **Knowledge Browser** | `Cmd+3` | Browse `.sidstack/knowledge/` docs with tree view and search |
| **Ticket Queue** | `Cmd+4` | External ticket intake, review workflow, convert to tasks |
| **Training Room** | `Cmd+5` | Capture lessons from incidents, build rules over time |
| **Agent Desk** | - | Manage isolated agent workspaces (git worktrees) |
| **Docs** | - | Built-in documentation viewer |
| **Settings** | `Cmd+,` | Project configuration |

---

## Key Concepts

### Knowledge System
SidStack stores structured project knowledge in `.sidstack/knowledge/` as markdown with YAML frontmatter. 9 categories:

| Category | Purpose |
|----------|---------|
| `00-context` | Vision, glossary, onboarding |
| `01-architecture` | System design, module boundaries |
| `02-decisions` | ADRs, technical decisions |
| `03-standards` | Coding conventions, naming rules |
| `04-data` | Database schema, data models |
| `05-api` | API contracts, schemas |
| `06-operations` | Deployment, monitoring |
| `07-projects` | Project-specific docs |
| `08-incidents` | Incident reports, root cause analysis |

Use `init --scan` to auto-generate these docs, or create them manually.

### Impact Analysis
Before making changes, run `impact_analyze` to assess:
- **Scope** - Which modules and files are affected
- **Risks** - Security, database, API breaking changes
- **Gate** - BLOCKED (must resolve), WARNING (proceed with caution), CLEAR (safe)

### Governance
Quality gates enforced before task completion:
```bash
pnpm typecheck  # Must pass
pnpm lint       # Must pass
pnpm test       # Must pass
```

### Agent Roles
- **Worker** - Implementation (features, bugs, refactoring)
- **Reviewer** - Independent verification (code review, security audit)

---

## What's Next

- [Claude Code Integration](CLAUDE_CODE_INTEGRATION.md) - Full MCP setup details
- [API Reference](API_REFERENCE.md) - REST API documentation
- [Impact Analysis](IMPACT_ANALYSIS.md) - Change impact guide
