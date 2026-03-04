# SidStack API Reference

REST API running on `localhost:19432` (local) or your configured server URL (remote).

## Authentication

When `SIDSTACK_API_KEY` is set, all endpoints (except `/health` and `/api/events/stream`) require a Bearer token:

```
Authorization: Bearer YOUR_API_KEY
```

## Rate Limiting

- **Writes** (POST/PUT/PATCH/DELETE): 100 requests per 15 minutes
- **Reads** (GET): 600 requests per 15 minutes

Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Health Check

```
GET /health

Response: 200
{ "status": "ok", "timestamp": "2026-02-25T..." }
```

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

### Delete Ticket
```
DELETE /api/tickets/:id

Response: 204
```

## Knowledge

### List Documents
```
GET /api/knowledge?projectPath=/path&category=01-architecture

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

### Create Document
```
POST /api/knowledge
{
  "projectPath": "/path",
  "category": "01-architecture",
  "title": "Auth Design",
  "content": "# Auth Design\n..."
}

Response: 201
```

### Update Document
```
PUT /api/knowledge/doc/:id
{
  "projectPath": "/path",
  "content": "# Updated content..."
}

Response: 200
```

### Delete Document
```
DELETE /api/knowledge/doc/:id?projectPath=/path

Response: 204
```

### Build Context
```
GET /api/knowledge/context?projectPath=/path&moduleId=auth&format=claude

Response: 200
(raw markdown)
```

### List Modules
```
GET /api/knowledge/modules?projectPath=/path

Response: 200
```

### Knowledge Health
```
GET /api/knowledge/health?projectPath=/path

Response: 200
```

### Cache Management
```
GET /api/knowledge/cache/stats
POST /api/knowledge/cache/invalidate
{ "projectPath": "/path/to/project" }
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

## Entity References

### Link Entities
```
POST /api/references/link
{
  "sourceType": "task",
  "sourceId": "task-123",
  "targetType": "knowledge",
  "targetId": "doc-456"
}

Response: 201
```

### Get References
```
GET /api/references?entityType=task&entityId=task-123

Response: 200
```

## Traceability

### Get Matrix
```
GET /api/traceability/matrix?projectId=my-project

Response: 200
```

## Events (SSE)

### Stream Events
```
GET /api/events/stream

Response: text/event-stream
(Server-Sent Events — no auth required)
```

Events include task updates, ticket changes, and knowledge modifications. Used by the desktop app for real-time sync.

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

## Error Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | Deleted |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (missing/invalid auth) |
| 403 | Forbidden (invalid API key) |
| 404 | Not found |
| 409 | Conflict (duplicate) |
| 429 | Too many requests (rate limited) |
| 500 | Internal server error |
