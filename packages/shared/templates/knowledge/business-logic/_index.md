---
id: business-logic-index
type: index
title: Business Logic Documentation
created: {{date}}
---

# Business Logic Documentation

Document your project's business rules, workflows, and state machines here.

## What to Document

- **Business Rules**: Validation rules, constraints, permissions
- **Workflows**: Multi-step processes, approval flows
- **State Machines**: Entity states and transitions
- **Domain Logic**: Core business calculations, transformations

## Template

Create new documents with this structure:

```markdown
---
id: feature-name
type: business-logic
module: module-name
status: draft | implemented | deprecated
related: [other-doc-ids]
---

# Feature Name

## Overview
Brief description of the business logic.

## Rules
1. Rule one
2. Rule two

## States (if applicable)
- state_a → state_b (trigger: action)
- state_b → state_c (trigger: action)

## Code References
- `src/services/feature.ts:45` - Main handler
```

## Documents

<!-- Add your business logic documents here -->
