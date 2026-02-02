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

### Option 2: Manual MCP Config

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

### Verify Connection

In Claude Code, ask:
```
List my SidStack tasks
```

Claude should use the `task_list` MCP tool.

## Available MCP Tools (32)

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

### Sessions (1)

| Tool | Description |
|------|-------------|
| `session_launch` | Launch Claude session with context |

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
