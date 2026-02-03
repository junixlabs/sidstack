---
name: sidstack-training-context
description: >
  Load training context when starting tasks. Trigger when: starting a new task,
  working in a specific module, or before significant changes. Use
  training_context_get to load skills, rules, and lessons for the context.
---

# Training Context

## When to Load Context

- Starting a new task
- Working in a module for first time
- Before significant changes

## Process

### Get Training Context

```
training_context_get({
  projectPath: ".",
  moduleId: "module-name",
  role: "worker",
  taskType: "feature" | "bugfix" | "refactor"
})
```

### Apply Returned Context

| Type | How to Apply |
|------|--------------|
| Skills | Follow procedures/checklists |
| Rules (`must`) | Mandatory compliance |
| Rules (`should`) | Recommended |
| Lessons | Avoid known pitfalls |

## Example

```
# Starting work on auth module
training_context_get({
  projectPath: ".",
  moduleId: "auth",
  role: "worker",
  taskType: "feature"
})

# Returns:
# - Skills: secure-password-handling checklist
# - Rules: MUST use bcrypt, SHOULD add rate limiting
# - Lessons: Session tokens must rotate on privilege change
```
