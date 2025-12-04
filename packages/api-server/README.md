# @sidstack/api-server

REST API server for SidStack desktop app.

## Endpoints

```
# Tasks
GET    /api/tasks                  - List tasks
POST   /api/tasks                  - Create task
GET    /api/tasks/:id              - Get task
PUT    /api/tasks/:id              - Update task
POST   /api/tasks/:id/complete     - Complete with governance check

# Tickets
GET    /api/tickets                - List tickets
POST   /api/tickets                - Create ticket
PUT    /api/tickets/:id            - Update ticket
POST   /api/tickets/:id/convert    - Convert to task

# Knowledge
GET    /api/knowledge              - List documents
GET    /api/knowledge/search       - Search documents
GET    /api/knowledge/context      - Build context

# Sessions
POST   /api/sessions/launch        - Launch Claude session
GET    /api/sessions               - List sessions

# Impact Analysis
POST   /api/impact/analyze         - Run impact analysis
GET    /api/impact/:id/gate        - Check gate status

# Training
POST   /api/training/incidents     - Create incident
POST   /api/training/lessons       - Create lesson
```

## Development

```bash
# Start server (port 19432)
pnpm dev

# Build
pnpm build
```

## Configuration

Uses SQLite database at `.sidstack/db/`. Port defaults to 19432.
