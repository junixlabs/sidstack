# Ticket Queue

Receive and process external tickets before converting them to tasks.

## Overview

The Ticket Queue accepts tickets from external sources (Jira, GitHub, Linear) and provides a review workflow before converting to actionable tasks.

## Ticket Sources

| Source | Method |
|--------|--------|
| API | `POST /api/tickets` |
| MCP | `ticket_create` tool |
| Manual | Desktop app UI |
| Jira | Webhook integration |
| GitHub | Webhook integration |

## Ticket Workflow

```
new → reviewing → approved → in_progress → completed
              ↘ rejected
```

### 1. Create
```bash
curl -X POST http://localhost:19432/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "my-project",
    "title": "Users cannot reset password",
    "type": "bug",
    "priority": "high",
    "source": "manual"
  }'
```

### 2. Review
In the desktop app, open **Ticket Queue** to see incoming tickets. Review the description, priority, and labels.

### 3. Approve or Reject
Update the ticket status:
- **Approve** - Ready for conversion to task
- **Reject** - Not actionable or duplicate

### 4. Convert to Task
```bash
curl -X POST http://localhost:19432/api/tickets/:id/convert-to-task
```

This creates a task with the ticket's details and links them together.

### 5. Start Session
Launch a Claude session directly from a ticket:
```bash
curl -X POST http://localhost:19432/api/tickets/:id/start-session \
  -H "Content-Type: application/json" \
  -d '{"workspacePath": "/path/to/project"}'
```

## Ticket Fields

| Field | Type | Required |
|-------|------|----------|
| title | string | Yes |
| projectId | string | Yes |
| type | bug/feature/improvement/task/epic | Yes |
| priority | low/medium/high/critical | Yes |
| description | string | No |
| source | manual/api/jira/github/linear | No |
| labels | string[] | No |
| externalId | string | No |
| externalUrls | string[] | No |
