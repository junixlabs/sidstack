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

## Available MCP Tools

### Knowledge (9)

| Tool | Description |
|------|-------------|
| `knowledge_search` | Semantic search across knowledge and memory (SidMemo) |
| `knowledge_list` | List available docs |
| `knowledge_get` | Get single document with full content |
| `knowledge_modules` | List modules with stats |
| `knowledge_module_overview` | Get module architecture overview |
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

### Training (6)

| Tool | Description |
|------|-------------|
| `incident_create` | Report an incident |
| `incident_list` | List incidents |
| `lesson_create` | Create lesson from incident |
| `lesson_list` | List lessons |
| `rule_check` | Check rules for context |
| `training_context_get` | Get training context for session |

### Test Results (3)

| Tool | Description |
|------|-------------|
| `test_result_create` | Persist test execution results |
| `test_result_list` | List test results with filtering |
| `test_result_get` | Get detailed test result |

### Agent Desk (4)

| Tool | Description |
|------|-------------|
| `desk_create` | Create agent desk (git worktree) |
| `desk_list` | List all agent desks |
| `desk_status` | Get desk status and current task |
| `desk_remove` | Remove agent desk |

### Memory (5)

| Tool | Description |
|------|-------------|
| `memory_add` | Add a memory entry |
| `memory_list` | List memory entries |
| `memory_delete` | Delete a memory entry |
| `memory_index_knowledge` | Index knowledge docs into memory |
| `memory_cleanup` | Clean up stale memory entries |

### Entity References (3)

| Tool | Description |
|------|-------------|
| `entity_link` | Link entities (task↔knowledge, etc.) |
| `entity_references` | Get references for an entity |
| `entity_context` | Build context from linked entities (entity mode + RAG mode) |

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
   → knowledge_search + entity_context (RAG mode)

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
   → entity_context

4. [Implement the fix]

5. "Complete the task"
   → task_complete
```

