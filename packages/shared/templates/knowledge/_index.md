---
id: knowledge-index
type: index
title: Project Knowledge Base
created: {{date}}
---

# Project Knowledge Base

Structured documentation for humans and AI agents.

## Categories

| Category | Description | Type |
|----------|-------------|------|
| [00-context](./00-context/) | Vision, glossary, onboarding | Living |
| [01-architecture](./01-architecture/) | System design, modules, patterns | Living |
| [02-decisions](./02-decisions/) | ADRs, technical decisions | Event |
| [03-standards](./03-standards/) | Coding conventions, naming, testing | Living |
| [04-data](./04-data/) | Database schema, ownership, retention | Living |
| [05-api](./05-api/) | API contracts, schemas, versioning | Living |
| [06-operations](./06-operations/) | Deployment, monitoring, rollback | Living |
| [07-projects](./07-projects/) | Project-specific documentation | Event |
| [08-incidents](./08-incidents/) | Incident reports, root cause analysis | Event |

## Document Format

```yaml
---
id: unique-identifier
type: guide | spec | decision | reference | pattern | rule
module: module-name
status: draft | active | review | archived
tags: [tag1, tag2]
---

# Document Title

Content here...
```

## Naming Conventions

- **Living docs (00-06)**: descriptive filenames (`auth-flow.md`, `naming-conventions.md`)
- **Event docs (02, 07, 08)**: date-prefixed (`2026-01-15-adopt-rest.md`, `2026-02-crash-fix.md`)
