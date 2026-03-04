# Knowledge Browser

Store and search project knowledge that persists across AI sessions.

## Overview

The Knowledge Browser manages documents stored in `.sidstack/knowledge/`. Documents are organized into 9 categories.

## Knowledge Categories

| Category | Purpose |
|----------|---------|
| `00-context` | Vision, glossary, onboarding, team structure |
| `01-architecture` | System design, module boundaries, patterns |
| `02-decisions` | ADRs, technical decisions (date-prefixed) |
| `03-standards` | Coding conventions, naming, testing rules |
| `04-data` | Database schema, ownership, retention |
| `05-api` | API contracts, schemas, versioning |
| `06-operations` | Deployment, monitoring, rollback strategy |
| `07-projects` | Project-specific docs (date-prefixed) |
| `08-incidents` | Incident reports, root cause analysis (date-prefixed) |

## Creating Documents

### Via CLI
```bash
npx @sidstack/cli knowledge create \
  --category 01-architecture \
  --title "Auth Design"
```

### Via MCP
```
Create a knowledge document about the authentication flow
```

### Manual
Create a markdown file in `.sidstack/knowledge/<category>/` with frontmatter:

```markdown
---
title: Auth Design
category: 01-architecture
tags: [authentication, JWT]
---

# Authentication Design

Login uses JWT tokens with refresh...
```

## Searching

### Desktop App
Use the search bar at the top of the Knowledge Browser. Filter by category tabs.

### MCP
```
Search knowledge for "authentication"
```
Uses `knowledge_search` tool.

### API
```
GET /api/knowledge?projectPath=/path&search=authentication
```

## Context Building

SidStack builds context from knowledge documents for Claude sessions:

```
Build context for the auth module
```

This aggregates relevant architecture docs, API specs, and patterns into a single context document for the session.

## Knowledge Sync (Remote)

Push local knowledge files to a remote SidStack server:

```bash
npx @sidstack/cli knowledge sync \
  --api-url https://api.yourdomain.com \
  --api-key sk-your-key
```

## Knowledge Health

Check coverage gaps across your categories:

```
Check knowledge health
```
Uses `knowledge_health` tool. Returns coverage percentages and suggestions.
