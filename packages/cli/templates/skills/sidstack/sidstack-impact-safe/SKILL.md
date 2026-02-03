---
name: sidstack-impact-safe
description: Run impact analysis before modifying core modules, APIs, or database schemas.
user-invocable: false
---

# Impact-Safe Changes

Before modifying critical code, run impact analysis to understand risks and dependencies.

## When to Apply

Run `impact_analyze` before touching:

- **Core modules**: packages/shared, src-tauri, database
- **APIs**: Route handlers, request/response schemas
- **Database**: Schema changes, migrations
- **Security**: Authentication, authorization, encryption
- **Integrations**: External services, MCP tools

## Process

### Step 1: Analyze Impact

```
impact_analyze({
  description: "What you're changing and why",
  targetModules: ["affected-module-1", "affected-module-2"],
  changeType: "feature" | "refactor" | "bugfix" | "migration" | "deletion"
})
```

### Step 2: Check Gate Status

```
impact_check_gate({
  analysisId: "from-step-1"
})
```

### Step 3: Interpret Results

| Status | Meaning | Action |
|--------|---------|--------|
| `clear` | Safe to proceed | Continue with implementation |
| `warning` | Caution needed | Review risks, proceed carefully |
| `blocked` | High risk | Address blockers before proceeding |

## Risk Indicators

**High Risk:**
- Breaking API changes
- Database schema modifications
- Security-sensitive code changes
- Multiple modules affected

**Medium Risk:**
- Internal API changes
- Adding new dependencies
- Modifying shared utilities

**Low Risk:**
- Isolated bug fixes
- Documentation updates
- Test additions

## Best Practices

1. **Always analyze before implementing** risky changes
2. **Document the analysis** in your commit message
3. **If blocked**, create tasks to address blockers first
4. **If warning**, add extra tests for affected areas
