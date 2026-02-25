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
                     → cancelled
```

## Task Completion Flow

When `task_complete` is called, the following happens automatically:

### 1. Quality Gates (auto-run)

Commands are executed in the project directory and results returned as `gateResults`:

| Gate | Command | Required |
|------|---------|----------|
| typecheck | `pnpm typecheck` | Yes |
| lint | `pnpm lint` | Yes |
| test | `pnpm test` | Yes |

If required gates fail and `force` is not set, completion is blocked.

### 2. Follow-up Tasks (auto-created)

For `feature`, `bugfix`, and `security` tasks, three follow-up tasks are created:

| Task | Assigned To | Purpose |
|------|------------|---------|
| `[infra] Deploy: ...` | `human` | Deploy changes to production |
| `[test] Verify on production: ...` | `human` | Verify changes work in production |
| `[docs] Update docs: ...` | `reviewer` | Update docs affected by the change |

The `[docs]` task includes:
- List of changed files (from `git diff`)
- Stale knowledge doc warnings
- Docs to review: `CLAUDE.md`, `docs/guides/`, `src/docs/user-guide.md`

### 3. Doc Sync (stale detection)

Checks if changed files match `covers` fields in `.sidstack/knowledge/` docs. Returns `staleDocWarnings` with affected doc IDs.

### 4. Governance Validation

Validates before completion:
- Acceptance criteria defined (for feature/bugfix/security)
- Progress history meets minimum updates
- Title format is valid (`[TYPE] description`)

Use `force: true` to bypass validation (logs a governance violation).

## Task Breakdown

Split complex tasks into subtasks:
```
Break down this task into smaller subtasks
```
Claude uses `task_breakdown` to create child tasks.
