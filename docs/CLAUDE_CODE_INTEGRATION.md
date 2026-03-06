# Claude Code Integration Guide

Integrate SidStack with Claude Code via the Model Context Protocol (MCP).

## Setup

### Option 1: CLI Init (Recommended)

```bash
cd your-project
npx @sidstack/cli init --scan
```

This automatically:
- Creates `.mcp.json` with the MCP server config
- Creates `.claude/settings.local.json` for tool auto-approval
- Sets up governance (principles, skills)
- Generates knowledge docs from your codebase

### Option 2: Manual MCP Config (Local)

Add to `.mcp.json` or Claude Code MCP settings:

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

### Option 3: Remote Server (Streamable HTTP)

Connect to a remote SidStack server using streamable-http transport:

```json
{
  "mcpServers": {
    "sidstack": {
      "type": "streamable-http",
      "url": "https://mcp.your-server.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

Set `SIDSTACK_API_URL` and `SIDSTACK_API_KEY` in `.env` if your project also calls the REST API directly. See [Quick Start - Option C](QUICK_START.md#option-c-docker-server-full-stack) for full setup.

### Verify Connection

In Claude Code, ask:
```
List my SidStack tasks
```

Claude should use the `task_list` MCP tool.

## Available MCP Tools (53)

### Knowledge (9)

| Tool | Description |
|------|-------------|
| `knowledge_context` | Build context for a task/module |
| `knowledge_search` | Search across knowledge docs |
| `knowledge_list` | List available docs |
| `knowledge_get` | Get single document with full content |
| `knowledge_modules` | List modules with stats |
| `knowledge_create` | Create knowledge document |
| `knowledge_update` | Update knowledge document |
| `knowledge_delete` | Delete knowledge document |
| `knowledge_health` | Check knowledge coverage health |

### Tasks (5)

| Tool | Description |
|------|-------------|
| `task_create` | Create task with governance |
| `task_update` | Update status/progress |
| `task_list` | List tasks with filtering |
| `task_get` | Get task details |
| `task_complete` | Complete with quality gate check |

### Impact Analysis (3)

| Tool | Description |
|------|-------------|
| `impact_analyze` | Run impact analysis on a change |
| `impact_check_gate` | Check gate status (blocked/warning/clear) |
| `impact_list` | List analyses |

### Tickets (4)

| Tool | Description |
|------|-------------|
| `ticket_create` | Create ticket |
| `ticket_list` | List/filter tickets |
| `ticket_update` | Update ticket status |
| `ticket_convert_to_task` | Convert ticket to task |

### Training (8)

| Tool | Description |
|------|-------------|
| `incident_create` | Report an incident |
| `incident_list` | List incidents |
| `lesson_create` | Create lesson from incident |
| `lesson_list` | List lessons |
| `skill_create` | Create reusable skill |
| `skill_list` | List skills |
| `rule_check` | Check rules for context |
| `training_context_get` | Get training context for session |

### OKRs (2)

| Tool | Description |
|------|-------------|
| `okr_list` | List objectives and key results |
| `okr_update` | Update key result progress |

### Test Results (3)

| Tool | Description |
|------|-------------|
| `test_result_create` | Persist test execution results |
| `test_result_list` | List test results with filtering |
| `test_result_get` | Get detailed test result |

### Agent Desk (7)

| Tool | Description |
|------|-------------|
| `desk_create` | Create agent desk (git worktree) |
| `desk_list` | List all agent desks |
| `desk_status` | Get desk status and current task |
| `desk_checkout` | Switch desk to a task |
| `desk_health` | Check desk health |
| `desk_conflicts` | Detect merge conflicts |
| `desk_remove` | Remove agent desk |

### Memory (6)

| Tool | Description |
|------|-------------|
| `memory_add` | Add a memory entry (via mem0) |
| `memory_search` | Semantic search across memories |
| `memory_list` | List memory entries |
| `memory_delete` | Delete a memory entry |
| `memory_index_knowledge` | Index knowledge docs into memory |
| `memory_cleanup` | Clean up stale memory entries |

### Traceability (1)

| Tool | Description |
|------|-------------|
| `traceability_matrix` | Generate spec-task-test coverage matrix |

### Entity References (3)

| Tool | Description |
|------|-------------|
| `entity_link` | Link entities (task↔knowledge, etc.) |
| `entity_references` | Get references for an entity |
| `entity_context` | Build context from linked entities |

### Productivity (4) — v0.7.0

| Tool | Description |
|------|-------------|
| `context_pack` | Build comprehensive context pack for a module (knowledge + memory + tasks in one call) |
| `macro_run` | Run composite macros: `start_work`, `finish_work`, `quick_context` |
| `session_save` | Save session state (decisions, blockers, files, progress) for continuity |
| `session_restore` | Restore saved session state from previous conversation |

### Claude Code Hooks (Quality Gates)

SidStack installs lifecycle hooks in `.claude/hooks/` that enforce quality automatically:

| Hook | Event | Purpose |
|------|-------|---------|
| `session-init.sh` | SessionStart | Smart bootstrap with branch→task correlation, changed modules, session restore |
| `prompt-context.sh` | UserPromptSubmit | Inject active task context with completion reminder |
| `task-complete-gate.sh` | PreToolUse (task_complete) | Block completion without test results, progress check, acceptance criteria |
| `task-create-context.sh` | PostToolUse (task_create) | Remind agent to search knowledge/memory and link entities |
| `task-start-training.sh` | PostToolUse (task_update) | Auto-inject relevant training lessons and rules |
| `pre-compact.sh` | PreCompact | Save active task state before context compaction |

## Governance for Agents

Agents automatically follow governance rules from `.sidstack/governance.md`:

### Principles
Rules agents must follow (code quality, testing, security, collaboration).

### Skills
Capability-based workflows agents use for implementation and review.

### Quality Gates
```bash
pnpm typecheck  # Must pass
pnpm lint       # Must pass
pnpm test       # Must pass
```

## Example Workflows

### Feature Implementation
```
1. "Create a task for adding user authentication"
   → task_create (auto-applies governance)

2. "What knowledge do we have about the auth module?"
   → knowledge_search + knowledge_context

3. "Analyze the impact of this change"
   → impact_analyze

4. [Implement the feature]

5. "Mark the task as complete"
   → task_complete (runs quality gates)
```

### Bug Fix with Learning
```
1. "Create a bugfix task for the login timeout"
   → task_create

2. "Start working on this task"
   → task_update (status: in_progress)

3. [Fix the bug]

4. "Create an incident report for this bug"
   → incident_create

5. "Create a lesson from this incident"
   → lesson_create

6. "Complete the task"
   → task_complete
```

### Ticket-Driven Work
```
1. "Create a ticket for the Safari login bug"
   → ticket_create

2. "Approve the ticket and convert to task"
   → ticket_update (status: approved)
   → ticket_convert_to_task

3. "Load context for this task"
   → knowledge_context

4. [Implement the fix]

5. "Complete the task"
   → task_complete
```

### OKR-Driven Work
```
1. "Show our project goals"
   → okr_list

2. "Create a task for KR-1.1"
   → task_create

3. [Implement the feature]

4. "Complete the task and update OKR progress"
   → task_complete
   → okr_update
```
