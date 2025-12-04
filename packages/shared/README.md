# @sidstack/shared

Shared TypeScript types, database layer, and utilities for SidStack packages.

## Usage

```typescript
import { TaskStatus, AgentRole, KnowledgeDocument } from '@sidstack/shared';
```

## Exports

- `TaskStatus` - Task lifecycle states
- `AgentRole` - Agent roles (Worker, Reviewer)
- `KnowledgeDocument` - Knowledge document types
- `Database` - SQLite database layer (better-sqlite3)
- `KnowledgeService` - Knowledge document operations
- `ImpactEngine` - Impact analysis engine

## Development

```bash
pnpm build
```
