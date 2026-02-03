---
name: sidstack-training-context
description: Load project-specific training (skills, rules, lessons) when starting implementation tasks.
user-invocable: false
---

# Training Context Injection

When starting implementation in a module, automatically load and apply relevant training context. This ensures Claude applies learned lessons, follows established rules, and uses proven skills.

## When to Apply

- Starting a new task or feature implementation
- Working in a specific module for the first time
- Before making significant changes
- After task assignment with `task_update({ status: "in_progress" })`

## Process

### Step 1: Get Training Context

When beginning work on a module:

```
training_context_get({
  projectPath: ".",
  moduleId: "[current-module]",
  role: "worker",
  taskType: "[feature|bugfix|refactor|test|docs]"
})
```

### Step 2: Apply Returned Context

The training context includes three types of knowledge:

#### Skills (How to do things)

Skills are procedures, checklists, or templates. Apply them as you work:

| Skill Type | How to Apply |
|------------|--------------|
| `procedure` | Follow the steps in order |
| `checklist` | Verify each item before completing task |
| `template` | Use as starting point for new code |
| `rule` | Check compliance throughout implementation |

#### Rules (What you must/should do)

Rules are constraints that must be followed:

| Priority | Meaning |
|----------|---------|
| `must` | Mandatory - cannot proceed without compliance |
| `should` | Recommended - document if you deviate |
| `may` | Optional - use judgment |

#### Lessons (What we learned)

Lessons are past experiences that inform current work:

- **Problem**: What went wrong before
- **Root Cause**: Why it happened
- **Solution**: How to prevent it

### Step 3: Acknowledge Context

After loading training context, mentally note:

1. **Active Skills**: What procedures/checklists apply?
2. **Mandatory Rules**: What constraints must I follow?
3. **Relevant Lessons**: What pitfalls should I avoid?

## Training Context Format

The `training_context_get` tool returns structured markdown:

```markdown
## Module-Specific Knowledge for [module-name]

### Active Skills
- **[skill-name]** (procedure): [description]
  - Step 1: ...
  - Step 2: ...

### Mandatory Rules
- **MUST**: [rule-name] - [content]
- **SHOULD**: [rule-name] - [content]

### Recent Lessons Learned
- **[lesson-title]**: [solution summary]
  - Problem: [what went wrong]
  - Avoid: [what not to do]
```

## Context Filtering

Training context is filtered by:

| Filter | Description |
|--------|-------------|
| `moduleId` | Only skills/rules/lessons for this module |
| `role` | Skills for your role (worker, reviewer, etc.) |
| `taskType` | Skills for this task type (feature, bugfix, etc.) |

## Example Workflow

### Starting a Feature Task

1. **Get context before coding**:
   ```
   training_context_get({
     projectPath: ".",
     moduleId: "auth",
     role: "worker",
     taskType: "feature"
   })
   ```

2. **Review returned skills**:
   - "implement-feature" checklist
   - "secure-password-handling" procedure

3. **Note mandatory rules**:
   - MUST: Use bcrypt for password hashing
   - SHOULD: Add rate limiting to auth endpoints

4. **Remember lessons**:
   - "Session tokens must be rotated on privilege change"
   - "Don't store passwords in logs"

5. **Proceed with implementation**, applying the context

### Working on a Bugfix

1. **Get context**:
   ```
   training_context_get({
     projectPath: ".",
     moduleId: "api",
     role: "worker",
     taskType: "bugfix"
   })
   ```

2. **Apply debugging lessons**:
   - Check recent similar bugs
   - Follow established debugging procedures

3. **Verify against rules**:
   - Ensure fix doesn't violate any rules
   - Check if related rules need updating

## Integration with Other Skills

### With sidstack-lesson-detector

After completing work, the lesson detector may suggest creating new lessons. These lessons then become part of training context for future work.

### With sidstack-knowledge-first

Training context complements knowledge search:
- **Knowledge**: Patterns, decisions, business logic (static)
- **Training**: Skills, rules, lessons (dynamic, learned)

Use both for comprehensive context.

## Periodic Refresh

For long-running tasks, periodically refresh training context:
- When switching modules
- After receiving new instructions
- Before critical operations (commits, deployments)
