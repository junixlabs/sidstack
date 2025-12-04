# SidStack Quick Start

Get from zero to productive in under 5 minutes.

SidStack has two interfaces - use either or both:
- **MCP Server** - Use from Claude Code with MCP tools
- **Desktop App** - Visual project management (macOS)

---

## Option A: MCP Server (Claude Code)

### 1. Add to Claude Code

Add to your Claude Code MCP settings (`~/.claude/settings.json` or project `.mcp.json`):

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

### 2. Initialize Your Project

```bash
cd your-project
npx @sidstack/cli init
```

This creates:
- `.sidstack/` - Config, governance rules, skills
- `.mcp.json` - MCP server config for Claude Code
- `.claude/` - Claude Code hooks and settings

### 3. Scan Your Codebase (Optional)

Auto-generate knowledge docs from your code:

```bash
npx @sidstack/cli init --scan
```

Claude Code will analyze your codebase and create structured docs in `.sidstack/knowledge/`.

### 4. Use MCP Tools in Claude Code

Once configured, Claude Code has access to these tools:

**Knowledge (understand your project)**
```
knowledge_search  - Search project knowledge
knowledge_context - Build context for a task/module
knowledge_list    - List all knowledge docs
```

**Tasks (track AI work)**
```
task_create   - Create a task with governance
task_update   - Update progress
task_list     - List tasks
task_complete - Complete with quality gate check
```

**Impact Analysis (assess risk before changes)**
```
impact_analyze    - Analyze a planned change
impact_check_gate - Check if safe to proceed
```

**Example workflow in Claude Code:**
```
1. "Create a task to add user authentication"
   → Claude calls task_create

2. "Analyze the impact of this change"
   → Claude calls impact_analyze, sees risks and blockers

3. "Build context for the api-server module"
   → Claude calls knowledge_context, gets relevant docs

4. [Implement the feature]

5. "Complete the task"
   → Claude calls task_complete, runs quality gates
```

---

## Option B: Desktop App (macOS)

### 1. Install

Build from source:
```bash
git clone https://github.com/junixlabs/sidstack.git
cd sidstack
pnpm install
pnpm tauri:build
```

Or download the `.dmg` from releases.

### 2. Open Your Project

Launch SidStack and select your project folder. If not initialized, the app will guide you through setup.

### 3. Explore the 7 Views

| View | What It Does |
|------|-------------|
| **Project Hub** | Capability tree, entity connections, project overview |
| **Task Manager** | Create/track tasks, 4 view modes (list, kanban, timeline, detail) |
| **Knowledge Browser** | Browse `.sidstack/knowledge/` docs with tree view and search |
| **Ticket Queue** | External ticket intake, review workflow, convert to tasks |
| **Training Room** | Capture lessons from incidents, build rules over time |
| **Settings** | Project configuration |
| **Worktree Status** | Git branch and file status |

### 4. Create Your First Task

1. Open **Task Manager** (sidebar)
2. Click **+ New Task**
3. Set title, type, and priority
4. Click **Launch Session** to start a Claude Code session with task context

---

## Key Concepts

### Knowledge System
SidStack stores structured project knowledge in `.sidstack/knowledge/` as markdown with YAML frontmatter. Categories: business-logic, api, database, patterns, modules.

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
