# Task Management

Create, track, and complete tasks with built-in governance.

## Creating Tasks

### From the Desktop App
1. Open **Task Manager** from the sidebar
2. Click **+ New Task**
3. Fill in title, description, and type
4. For `feature` and `bugfix` types, add acceptance criteria (required by governance)

### From Claude Code (MCP)
```
Create a task for adding user authentication
```
Claude uses `task_create` with auto-governance.

### From the API
```bash
curl -X POST http://localhost:19432/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "[feature] Add user auth",
    "description": "Implement login flow",
    "projectId": "my-project",
    "taskType": "feature",
    "priority": "high",
    "acceptanceCriteria": [{"description": "Login form works"}]
  }'
```

## Task Types

| Type | Governance | Description |
|------|-----------|-------------|
| `feature` | Requires acceptance criteria | New functionality |
| `bugfix` | Requires acceptance criteria | Bug fixes |
| `refactor` | Standard | Code restructuring |
| `test` | Standard | Test additions |
| `docs` | Minimal | Documentation |
| `infra` | Standard | Infrastructure |
| `security` | Requires acceptance criteria | Security changes |
| `perf` | Standard | Performance |
| `debt` | Standard | Technical debt |
| `spike` | Minimal | Research/exploration |

## Task Lifecycle

```
pending → in_progress → completed
                     → blocked
                     → failed
```

## Task Breakdown

Split complex tasks into subtasks:
```
Break down this task into smaller subtasks
```
Claude uses `task_breakdown` to create child tasks.

## Quality Gates

Before completing a task, quality gates must pass:
- `pnpm typecheck` - Zero type errors
- `pnpm lint` - Zero lint errors
- `pnpm test` - All tests pass
