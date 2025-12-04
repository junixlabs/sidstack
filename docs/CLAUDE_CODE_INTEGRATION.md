# Claude Code Integration Guide

Integrate SidStack with Claude Code via the Model Context Protocol (MCP).

## Setup

### 1. Configure MCP Server

Add to your Claude Code settings (`.mcp.json` or MCP settings UI):

```json
{
  "mcpServers": {
    "sidstack": {
      "command": "npx",
      "args": ["-y", "@sidstack/mcp-server"],
      "env": {
        "SIDSTACK_PROJECT_PATH": "/path/to/your/project",
        "SIDSTACK_API_URL": "http://localhost:19432"
      }
    }
  }
}
```

### 2. Start the API Server

The desktop app starts the API server automatically. For CLI-only usage:

```bash
sidstack serve
```

This starts the REST API on `localhost:19432`.

### 3. Verify Connection

In Claude Code, ask:
```
List my SidStack tasks
```

Claude should use the `task_list` MCP tool.

## Available MCP Tools

### Task Management

| Tool | Description |
|------|-------------|
| `task_create` | Create a new task with governance |
| `task_list` | List tasks with filters |
| `task_get` | Get task details |
| `task_update` | Update status/progress |
| `task_breakdown` | Split task into subtasks |
| `task_complete` | Mark task as completed |
| `task_governance_check` | Check governance compliance |

### Session Management

| Tool | Description |
|------|-------------|
| `session_launch` | Launch Claude session in terminal |
| `session_list` | List active/recent sessions |
| `session_get` | Get session details |
| `session_update_status` | Update session status |
| `session_resume` | Resume a previous session |
| `session_stats` | Get session statistics |

### Knowledge

| Tool | Description |
|------|-------------|
| `knowledge_list` | List knowledge documents |
| `knowledge_get` | Get document content |
| `knowledge_search` | Search documents by keyword |
| `knowledge_context` | Build context for Claude sessions |
| `knowledge_modules` | List modules with doc counts |

### Tickets

| Tool | Description |
|------|-------------|
| `ticket_create` | Create a ticket |
| `ticket_list` | List tickets |
| `ticket_get` | Get ticket details |
| `ticket_update` | Update ticket status |
| `ticket_start_session` | Start session for ticket |
| `ticket_convert_to_task` | Convert ticket to task |

### Impact Analysis

| Tool | Description |
|------|-------------|
| `impact_analyze` | Run impact analysis |
| `impact_check_gate` | Check gate status |
| `impact_run_validation` | Run validation check |
| `impact_approve_gate` | Approve gate |
| `impact_list` | List analyses |

### Training Room

| Tool | Description |
|------|-------------|
| `incident_create` | Create incident report |
| `lesson_create` | Create lesson from incident |
| `lesson_approve` | Approve a lesson |
| `skill_create` | Create skill from lesson |
| `rule_create` | Create enforcement rule |
| `rule_check` | Check rule compliance |

### Teams

| Tool | Description |
|------|-------------|
| `team_create` | Create agent team |
| `team_list` | List teams |
| `team_add_member` | Add agent to team |
| `team_remove_member` | Remove agent from team |

## Hook System

SidStack includes hooks that run automatically during Claude Code sessions:

### Pre-Edit Impact Check
Before editing files, SidStack checks if the affected module has open impact analysis blockers. This provides warnings but does not block edits.

Bypass with:
```bash
SIDSTACK_SKIP_IMPACT_CHECK=1
```

### Task Start Suggestion
When a task starts, SidStack suggests running impact analysis for high-impact task types (feature, refactor, breaking_change, architecture).

## Governance for Agents

Agents automatically follow governance rules from `.sidstack/governance.md`:

### Principles
Rules agents must follow (code quality, testing, security, collaboration).

### Skills
Capability-based workflows agents use for implementation, design, testing, review, and deployment.

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

4. "Launch a session to implement this"
   → session_launch

5. "Mark the task as complete"
   → task_complete (runs quality gates)
```

### Bug Fix
```
1. "Create a bugfix task for the login timeout"
   → task_create (requires acceptance criteria)

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
