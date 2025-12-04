# Skill: Architecture Understanding

**ID:** architecture-understanding
**Created:** 2025-12-06
**Type:** core
**Applies To:** All agents (DEV, BA, QA, DA)

## When to Apply

Apply this skill when:
- Adding new code to a project
- Creating new files
- Modifying project structure
- Implementing new features

## Rule

**Before adding code, understand project structure:**

1. **Read package.json** - Understand dependencies & scripts
2. **List directories** - Understand folder structure
3. **Find entry points** - main.ts, index.ts, App.tsx
4. **Follow existing patterns** - Match how existing code is organized

## Workflow

```bash
# 1. Understand project structure
LS({ path: "packages/api-server/src" })
# → routes/, lib/, index.ts

# 2. Read entry point
Read({ file_path: "packages/api-server/src/index.ts" })
# → Found: app.use('/api/graph', graphRouter)

# 3. Understand how components connect
# graphRouter is mounted at /api/graph
# Routes in graph.ts are relative: '/overview' → /api/graph/overview
```

## Example

**Task:** Add a new API endpoint

### WRONG:

```bash
# Creating file in wrong location
Write({ file_path: "src/api/newEndpoint.js" })  // Wrong location!
```

### CORRECT:

```bash
# 1. Check existing routes structure
LS({ path: "packages/api-server/src/routes" })
# → graph.ts, agents.ts, projects.ts, ...

# 2. Read a route file to understand pattern
Read({ file_path: "packages/api-server/src/routes/graph.ts" })
# → Pattern: Router(), router.get(), export { router }

# 3. See how routes are registered
Read({ file_path: "packages/api-server/src/index.ts" })
# → Pattern: import { graphRouter }, app.use('/api/graph', graphRouter)

# 4. Create route following correct pattern
Write({
  file_path: "packages/api-server/src/routes/myNew.ts",
  content: "// Following existing pattern..."
})
```

## Common Patterns to Understand

### Monorepo Structure
```
packages/
├── cli/           # Command-line interface
├── api-server/    # REST API
├── web-ui/        # Frontend
└── shared/        # Shared types/utils
```

### Route Registration Pattern
```typescript
// In routes/xxx.ts
const router = Router();
router.get('/endpoint', handler);
export { router as xxxRouter };

// In index.ts
import { xxxRouter } from './routes/xxx';
app.use('/api/xxx', xxxRouter);
```

### Component Organization
```
src/
├── components/    # Reusable UI components
├── views/         # Page-level components
├── hooks/         # Custom React hooks
├── stores/        # State management
└── api/           # API client functions
```

## Anti-patterns

- Creating files in random locations
- Not following existing naming conventions
- Ignoring established patterns
- Breaking architectural boundaries

## Benefits

- Consistent codebase
- Easier code reviews
- Better maintainability
- Faster onboarding for new agents
