---
name: architecture-understanding
description: Skill for understanding and respecting existing architectural patterns in a codebase before making changes.
category: core
priority: high
---

# Architecture Understanding Skill

Before implementing any feature, understand and respect the existing architecture.

## Architecture Discovery Process

### 1. Identify the Architectural Pattern

Look for these common patterns:

**Layered Architecture**
```
src/
├── controllers/   # HTTP handlers
├── services/      # Business logic
├── repositories/  # Data access
└── models/        # Data structures
```

**Clean Architecture / Hexagonal**
```
src/
├── domain/        # Core business logic (no external deps)
├── application/   # Use cases
├── infrastructure/# External implementations
└── presentation/  # API/UI
```

**Feature-Based / Vertical Slices**
```
src/
├── users/
│   ├── user.controller.ts
│   ├── user.service.ts
│   └── user.repository.ts
├── orders/
│   ├── order.controller.ts
│   └── ...
```

**Modular Monolith**
```
src/
├── modules/
│   ├── user/      # Self-contained module
│   ├── order/     # Self-contained module
│   └── shared/    # Shared utilities
```

### 2. Understand Dependency Direction

Key principle: **Dependencies flow inward**

```
Controllers → Services → Repositories
    ↓           ↓            ↓
  (HTTP)    (Business)    (Database)
```

- Higher layers depend on lower layers
- Domain/core should have NO external dependencies
- Infrastructure adapts to domain interfaces

### 3. Identify Boundaries

Look for:
- Module boundaries (separate directories/packages)
- API boundaries (public exports)
- Service boundaries (separate processes)
- Data boundaries (separate databases/schemas)

### 4. Recognize Cross-Cutting Concerns

Common patterns for:
- **Logging**: Middleware, decorators, or AOP
- **Authentication**: Middleware, guards
- **Validation**: DTOs, decorators, middleware
- **Error handling**: Global handlers, Result types
- **Caching**: Decorators, service wrappers

## Implementation Guidelines

### DO:
- Follow existing patterns exactly
- Put new code in the appropriate layer
- Use existing abstractions and utilities
- Maintain dependency direction
- Respect module boundaries

### DON'T:
- Bypass layers (controller calling repository directly)
- Create circular dependencies
- Mix concerns in a single file
- Introduce new patterns without discussion
- Break existing conventions

## Architecture Checklist

Before implementing, verify:

- [ ] I've identified the architectural pattern
- [ ] I know which layer my code belongs in
- [ ] I understand the dependency direction
- [ ] I've found similar implementations to follow
- [ ] My changes respect existing boundaries
- [ ] I'm using existing abstractions where available

## Common Violations to Avoid

1. **Layer Skipping**: Controller directly accessing database
2. **Circular Dependencies**: A imports B imports A
3. **God Objects**: One class doing everything
4. **Leaky Abstractions**: Infrastructure details in domain
5. **Anemic Domain**: All logic in services, empty models

## When to Escalate

Escalate to orchestrator/architect when:
- Existing architecture doesn't support the requirement
- You need to introduce a new pattern
- There's a conflict between requirements and architecture
- You find architectural debt that blocks implementation
