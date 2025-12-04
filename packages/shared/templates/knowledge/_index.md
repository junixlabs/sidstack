---
id: knowledge-index
type: index
title: Project Knowledge Base
created: {{date}}
---

# Project Knowledge Base

Welcome to your project's knowledge documentation. This knowledge base helps both humans and AI agents understand your project's architecture, business rules, and technical decisions.

## Categories

| Category | Description |
|----------|-------------|
| [Business Logic](./business-logic/_index.md) | Business rules, workflows, state machines |
| [API](./api/_index.md) | API endpoints, request/response schemas |
| [Patterns](./patterns/_index.md) | Design patterns used in the project |
| [Database](./database/_index.md) | Schema, tables, relationships |
| [Modules](./modules/_index.md) | Module documentation |

## Quick Start

1. Navigate to a category above
2. Create new documents using the provided templates
3. Link related documents using the `related` field in frontmatter

## Document Format

All documents use YAML frontmatter:

```yaml
---
id: unique-identifier
type: business-logic | api-endpoint | design-pattern | database-table
module: module-name
status: draft | implemented | deprecated
related: [other-doc-ids]
tags: [tag1, tag2]
---

# Document Title

Content here...
```

## For AI Agents

When working on this project:
1. Read relevant knowledge docs before making changes
2. Follow documented patterns
3. Update docs after significant changes
