# SidStack Quick Start

Get from zero to productive in minutes.

SidStack has two interfaces - use either or both:
- **MCP Server** - Use from Claude Code with 32 MCP tools
- **Desktop App** - Visual project management (macOS)

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

Once initialized, Claude Code has access to 32 tools:

**Knowledge (understand your project)**
```
knowledge_context   - Build context for a task/module
knowledge_search    - Search across knowledge docs
knowledge_list      - List available docs
knowledge_get       - Get single document
knowledge_modules   - List modules with stats
knowledge_create    - Create knowledge document
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
skill_create            - Create reusable skill
skill_list              - List skills
rule_check              - Check rules for context
training_context_get    - Get training context for session
```

**OKRs (project goals)**
```
okr_list            - List objectives and key results
okr_update          - Update key result progress
```

**Sessions**
```
session_launch      - Launch Claude session with context
```

### 3. Example Workflow

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

## Option B: Desktop App (macOS)

### 1. Install

Download the `.dmg` from [Releases](https://github.com/junixlabs/sidstack/releases).

Or build from source:

```bash
git clone https://github.com/junixlabs/sidstack.git
cd sidstack
pnpm install && pnpm packages:build && pnpm tauri:build
```

### 2. Open Your Project

Launch SidStack and select your project folder. If not initialized, the app will guide you through setup.

### 3. Explore the 7 Views

| View | Shortcut | Description |
|------|----------|-------------|
| **Project Hub** | `Cmd+1` | Capability tree, entity connections, OKR progress |
| **Task Manager** | `Cmd+2` | Create/track tasks, 4 view modes (list, kanban, timeline, detail) |
| **Knowledge Browser** | `Cmd+3` | Browse `.sidstack/knowledge/` docs with tree view and search |
| **Ticket Queue** | `Cmd+4` | External ticket intake, review workflow, convert to tasks |
| **Training Room** | `Cmd+5` | Capture lessons from incidents, build rules over time |
| **Settings** | `Cmd+,` | Project configuration |
| **Worktree Status** | - | Git branch and file status |

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
- [Impact Analysis](IMPACT_ANALYSIS.md) - Change impact guide
