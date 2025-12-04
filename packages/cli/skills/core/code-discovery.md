# Skill: Code Discovery

**ID:** code-discovery
**Created:** 2025-12-06
**Type:** core
**Applies To:** All agents (DEV, BA, QA, DA)

## When to Apply

Apply this skill when:
- You need to know if an API/function/class exists
- You need to find the correct path/endpoint
- You need to understand how something is implemented
- You want to follow existing patterns

## Rule

**NEVER guess API paths, function names, or class names.**

Instead:
1. **Grep source code** to find exact definitions
2. **Read route definitions** to understand URL structure
3. **Find exports** to understand public interfaces

## Patterns to Search

```bash
# Find API routes
Grep({ pattern: "router\\.get|router\\.post", path: "src/routes" })

# Find specific endpoint
Grep({ pattern: "/api/graph", path: "packages/api-server" })

# Find where routes are mounted
Grep({ pattern: "app\\.use", path: "packages/api-server/src/index.ts" })

# Find function definition
Grep({ pattern: "function fetchNodes|const fetchNodes", path: "src" })

# Find class/interface
Grep({ pattern: "class GraphClient|interface GraphClient" })

# Find exports
Grep({ pattern: "export.*function|export.*class|export.*const" })
```

## Example

**Task:** "Call the correct API to get graph data"

### WRONG (guessing endpoints):

```javascript
fetch('/api/graph')        // 404
fetch('/api/nodes')        // 404
fetch('/api/graph/nodes')  // 404
```

### CORRECT (grep first):

```bash
# 1. Grep for route definitions
Grep({
  pattern: "router\\.get.*graph",
  path: "packages/api-server/src/routes"
})
# → Found: graph.ts:7: router.get('/overview', ...)

# 2. Find where route is mounted
Read({ file_path: "packages/api-server/src/index.ts" })
# → Found: app.use('/api/graph', graphRouter)

# 3. Combine: /api/graph + /overview = /api/graph/overview
fetch('/api/graph/overview')  // Success!
```

## Key Insight

Route paths are constructed from:
- **Base path** (from `app.use('/api/xxx', router)` in index.ts)
- **Route path** (from `router.get('/yyy', ...)` in route file)
- **Full path** = Base + Route = `/api/xxx/yyy`

## Anti-patterns

- Guessing API endpoints based on intuition
- Assuming function names exist
- Not checking imports before using modules
- Calling methods without verifying they exist

## Benefits

- Zero 404 errors (endpoints verified before calling)
- Correct function signatures (read from source)
- Fewer bugs from incorrect assumptions
- Less wasted tokens on trial-and-error
