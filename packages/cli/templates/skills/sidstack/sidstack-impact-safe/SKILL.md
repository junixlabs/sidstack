---
name: sidstack-impact-safe
description: >
  Run impact analysis before risky changes. Trigger when: modifying core modules
  (shared, database, auth), changing APIs or schemas, touching security code,
  or affecting multiple modules. Use impact_analyze then impact_check_gate.
---

# Impact-Safe Changes

## When to Run Impact Analysis

- Modifying core modules (database, auth, shared)
- Changing API routes or response schemas
- Database schema changes or migrations
- Security-related code (auth, encryption)
- Changes affecting 3+ files across modules

## Process

### 1. Analyze

```
impact_analyze({
  description: "What you're changing and why",
  targetModules: ["module1", "module2"],
  changeType: "feature" | "refactor" | "bugfix" | "migration"
})
```

### 2. Check Gate

```
impact_check_gate({ analysisId: "from-step-1" })
```

### 3. Interpret

| Status | Action |
|--------|--------|
| `clear` | Safe to proceed |
| `warning` | Proceed with extra care |
| `blocked` | Fix blockers first |
