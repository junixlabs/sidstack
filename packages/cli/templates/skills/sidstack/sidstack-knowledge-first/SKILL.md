---
name: sidstack-knowledge-first
description: >
  Search project knowledge before implementing. Trigger when: starting a new
  feature, making architectural decisions, working in unfamiliar code, or
  modifying business logic. Use knowledge_search and knowledge_context.
---

# Knowledge-First Development

## When to Search Knowledge

- Starting a new feature implementation
- Making architectural decisions
- Working in unfamiliar modules
- Changing business logic or data models

## Process

### 1. Search for Patterns

```
knowledge_search({
  projectPath: ".",
  query: "feature name or concept"
})
```

### 2. Get Module Context

```
knowledge_context({
  projectPath: ".",
  moduleId: "module-name"
})
```

## What to Look For

- Similar implementations
- Design patterns used
- Business rules
- API conventions
- Known constraints
