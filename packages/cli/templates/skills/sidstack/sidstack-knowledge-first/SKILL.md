---
name: sidstack-knowledge-first
description: Search SidStack knowledge before implementing features or making architectural decisions.
user-invocable: false
---

# Knowledge-First Development

Before implementing features or making architectural decisions, search existing knowledge to ensure consistency with the codebase.

## When to Apply

- Implementing a new feature
- Making architectural decisions
- Modifying business logic
- Changing data models or APIs
- Working in unfamiliar parts of the codebase

## Process

### Step 1: Search for Existing Patterns

```
knowledge_search({
  projectPath: ".",
  query: "feature name or concept"
})
```

Look for:
- Similar implementations
- Design patterns used
- Business rules documented
- API conventions

### Step 2: Get Module Context

If working in a specific module:

```
knowledge_context({
  projectPath: ".",
  moduleId: "module-name"
})
```

This provides:
- Module overview and purpose
- Related documentation
- Dependencies and relationships
- Known constraints

### Step 3: Check for Related Decisions

Search for architectural decisions:

```
knowledge_search({
  projectPath: ".",
  query: "decision architecture"
})
```

Look in:
- `.sidstack/knowledge/` for documented patterns
- `openspec/` for change proposals
- `docs/` for technical documentation

## Benefits

- **Consistency**: Follow established patterns
- **Efficiency**: Don't reinvent existing solutions
- **Quality**: Build on proven approaches
- **Context**: Understand why things are the way they are
