# SidStack API Reference

REST API running on `localhost:19432`.

## Tasks

### Create Task
```
POST /api/tasks
Content-Type: application/json

{
  "title": "[feature] Add user authentication",
  "description": "Implement login/logout flow",
  "projectId": "my-project",
  "taskType": "feature",
  "priority": "high",
  "acceptanceCriteria": [
    { "description": "Login form renders correctly" }
  ]
}

Response: 201
{ "id": "task-...", "status": "pending", ... }
```

### List Tasks
```
GET /api/tasks?projectId=my-project&status=pending,in_progress

Response: 200
{ "tasks": [...], "total": 5 }
```

### Get Task
```
GET /api/tasks/:id

Response: 200
{ "id": "task-...", "title": "...", ... }
```

### Update Task
```
PATCH /api/tasks/:id
{ "status": "in_progress", "progress": 50 }

Response: 200
```

## Tickets

### Create Ticket
```
POST /api/tickets
{
  "projectId": "my-project",
  "title": "Fix login bug",
  "type": "bug",
  "priority": "high",
  "source": "manual"
}

Response: 201
```

### List Tickets
```
GET /api/tickets?projectId=my-project&status=new,reviewing

Response: 200
{ "tickets": [...] }
```

### Update Ticket
```
PATCH /api/tickets/:id
{ "status": "approved" }

Response: 200
```

### Convert Ticket to Task
```
POST /api/tickets/:id/convert-to-task

Response: 200
{ "ticket": {...}, "task": {...} }
```

### Start Session for Ticket
```
POST /api/tickets/:id/start-session
{ "workspacePath": "/path/to/project" }

Response: 200
```

### Delete Ticket
```
DELETE /api/tickets/:id

Response: 204
```

## Sessions

### Create Session
```
POST /api/sessions
{
  "workspacePath": "/path/to/project",
  "taskId": "task-123",
  "prompt": "Fix the authentication bug"
}

Response: 201
```

### List Sessions
```
GET /api/sessions?workspacePath=/path&status=active

Response: 200
{ "sessions": [...] }
```

### Get Session
```
GET /api/sessions/:id

Response: 200
```

### Update Session Status
```
POST /api/sessions/:id/status
{ "status": "completed" }

Response: 200
```

### Resume Session
```
POST /api/sessions/:id/resume
{ "additionalPrompt": "Continue where we left off" }

Response: 200
```

### Get Active Sessions
```
GET /api/sessions/query/active

Response: 200
```

### Get Session Stats
```
GET /api/sessions/stats/overview

Response: 200
```

### Delete Session
```
DELETE /api/sessions/:id

Response: 204
```

## Knowledge

### List Documents
```
GET /api/knowledge?projectPath=/path&type=business-logic&module=auth

Response: 200
{ "documents": [...] }
```

### Get Document
```
GET /api/knowledge/doc/:id?projectPath=/path

Response: 200
{ "id": "...", "title": "...", "content": "..." }
```

### Search Documents
```
GET /api/knowledge?projectPath=/path&search=authentication

Response: 200
```

### Build Context
```
GET /api/knowledge/context?projectPath=/path&moduleId=auth&format=claude

Response: 200
(raw markdown)
```

### List Types
```
GET /api/knowledge/types?projectPath=/path

Response: 200
{ "types": [{ "type": "business-logic", "count": 8 }, ...] }
```

### List Modules
```
GET /api/knowledge/modules?projectPath=/path

Response: 200
```

## Impact Analysis

### Run Analysis
```
POST /api/impact/analyze
{
  "taskId": "task-123",
  "projectPath": "/path/to/project"
}

Response: 201
```

### Get Analysis
```
GET /api/impact/:id

Response: 200
```

### Check Gate
```
GET /api/impact/:id/gate

Response: 200
{ "status": "blocked" | "warning" | "clear" }
```

### Approve Gate
```
POST /api/impact/:id/gate/approve
{ "approver": "user", "reason": "Reviewed and accepted" }

Response: 200
```

### Run Validation
```
POST /api/impact/:id/validations/:vid/run

Response: 200
```

## Progress Tracking

### List Work Sessions
```
GET /api/progress/sessions?workspacePath=/path

Response: 200
```

### Get Active Session
```
GET /api/progress/sessions/active?workspacePath=/path

Response: 200
```

### Log Work Entry
```
POST /api/progress/entries
{
  "sessionId": "session-...",
  "action": "edit",
  "filePath": "src/auth.ts"
}

Response: 201
```

### Get Work History
```
GET /api/progress/history?workspacePath=/path&hours=24

Response: 200
```

## Training Room

### Create Incident
```
POST /api/training/incidents
{
  "projectPath": "/path",
  "title": "Login timeout on slow connections",
  "severity": "medium",
  "moduleId": "auth"
}

Response: 201
```

### Create Lesson
```
POST /api/training/lessons
{
  "projectPath": "/path",
  "incidentId": "inc-...",
  "title": "Add timeout configuration",
  "category": "auth"
}

Response: 201
```

### Approve Lesson
```
POST /api/training/lessons/:id/approve

Response: 200
```

### Create Skill
```
POST /api/training/skills
{
  "projectPath": "/path",
  "name": "timeout-configuration",
  "description": "Configure timeouts for external calls"
}

Response: 201
```

### Create Rule
```
POST /api/training/rules
{
  "projectPath": "/path",
  "name": "require-timeout-config",
  "scope": "api-server",
  "enforcement": "strict"
}

Response: 201
```

## Error Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | Deleted |
| 400 | Bad request (validation error) |
| 404 | Not found |
| 409 | Conflict (duplicate) |
| 500 | Internal server error |

## Cache Management

### Get Cache Stats
```
GET /api/knowledge/cache/stats

Response: 200
```

### Invalidate Cache
```
POST /api/knowledge/cache/invalidate
{ "projectPath": "/path/to/project" }

Response: 200
```
