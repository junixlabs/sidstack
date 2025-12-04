# Knowledge Browser

Store and search project knowledge that persists across AI sessions.

## Overview

The Knowledge Browser manages documents stored in `.sidstack/knowledge/`. Documents are categorized by type and linked to modules.

## Document Types

| Type | Description |
|------|-------------|
| `business-logic` | Business rules and workflows |
| `api-endpoint` | API documentation |
| `design-pattern` | Design patterns used |
| `database` | Database schemas |
| `module` | Module documentation |

## Creating Documents

### Via CLI
```bash
sidstack knowledge create \
  --type business-logic \
  --title "User Auth Flow" \
  --module auth
```

### Via MCP
```
Create a knowledge document about the authentication flow
```

### Manual
Create a markdown file in `.sidstack/knowledge/` with frontmatter:

```markdown
---
title: User Auth Flow
type: business-logic
module: auth
tags: [authentication, JWT]
---

# User Authentication Flow

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

This aggregates relevant business logic, API docs, and patterns into a single context document for the session.
