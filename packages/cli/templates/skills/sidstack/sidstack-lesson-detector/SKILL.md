---
name: sidstack-lesson-detector
description: Proactively suggest creating lessons after debugging, finding patterns, or encountering preventable errors.
user-invocable: false
---

# Lesson Detection

After completing work, PROACTIVELY check if a lesson should be created. This helps the project learn from mistakes and capture reusable knowledge.

## Trigger Conditions

| Condition | Suggestion |
|-----------|------------|
| Bug took >30min to debug | "This was tricky. Create a lesson to help future debugging?" |
| Found reusable pattern | "This pattern could be documented as a skill. Create one?" |
| Error could have been prevented | "This could be avoided. Create a rule to prevent it?" |
| Same issue occurred before | "This is a recurring issue. Let's create a lesson." |
| Workaround for framework limitation | "Document this workaround as a lesson?" |
| Non-obvious solution | "This solution isn't intuitive. Document it for future reference?" |

## When Triggered

### Step 1: Create Incident

```
incident_create({
  projectPath: ".",
  moduleId: "[current-module]",
  type: "mistake" | "confusion" | "slow" | "failure",
  severity: "low" | "medium" | "high",
  title: "[short summary]",
  description: "[what happened, what was tried, what worked]",
  context: {
    taskId: "[if working on a task]",
    files: ["list of affected files"],
    errorMessage: "[if applicable]"
  }
})
```

### Step 2: Ask User

After creating the incident, ask:

> "I noticed this was [tricky to debug / a recurring pattern / easily preventable]. Would you like me to create a lesson to help future work?"

Options:
1. **Yes, create lesson** → Proceed to Step 3
2. **No, skip** → End
3. **Just the incident** → Already done in Step 1

### Step 3: Create Lesson (if user agrees)

```
lesson_create({
  projectPath: ".",
  moduleId: "[current-module]",
  incidentIds: ["[incident-id from step 1]"],
  title: "[descriptive title]",
  problem: "[what went wrong]",
  rootCause: "[why it happened]",
  solution: "[how to prevent or fix it]",
  applicability: {
    modules: ["affected-modules"],
    roles: ["worker"],
    taskTypes: ["feature", "bugfix", "refactor"]
  }
})
```

## Detection Patterns

### Debugging Time
If you spent significant effort debugging:
- Multiple failed attempts
- Had to read source code / docs
- Solution was non-obvious

### Repeated Issues
If you've seen similar problems:
- Same error in different contexts
- Common misconceptions
- Framework quirks

### Preventable Errors
If the issue could be caught earlier:
- Type errors that slipped through
- Missing validation
- Race conditions
- Edge cases

### Reusable Patterns
If the solution is generalizable:
- Utility functions
- Design patterns
- Workarounds
- Best practices

## Lesson Quality Guidelines

A good lesson includes:

1. **Clear Problem Statement**: What exactly went wrong?
2. **Root Cause Analysis**: Why did it happen? (not just what)
3. **Actionable Solution**: Steps to prevent or fix
4. **Scope**: When does this apply? (modules, task types, roles)

## Example Lessons

### Example 1: Debugging Lesson

```yaml
title: "Always check async/await in useEffect cleanup"
problem: "Memory leak warning when component unmounts during async operation"
rootCause: "useEffect cleanup runs but async operation continues, trying to setState on unmounted component"
solution: |
  1. Use AbortController for fetch requests
  2. Use isMounted flag for other async operations
  3. Cancel or ignore results in cleanup function
applicability:
  modules: [frontend, ui]
  taskTypes: [feature, bugfix]
```

### Example 2: Pattern Lesson

```yaml
title: "Use optimistic updates for better UX"
problem: "UI feels sluggish when waiting for API responses"
rootCause: "Waiting for server confirmation before updating UI"
solution: |
  1. Update local state immediately
  2. Send request to server
  3. Revert if server returns error
  4. Use toast to show error state
applicability:
  modules: [frontend]
  taskTypes: [feature]
```

## Skill Promotion

When a lesson proves valuable (used multiple times, prevents recurring issues), suggest promoting it to a skill:

```
skill_create({
  projectPath: ".",
  name: "skill-name-from-lesson",
  type: "checklist" | "procedure" | "rule",
  description: "[what the skill does]",
  lessonIds: ["[lesson-id]"],
  content: "[markdown content with steps/rules]",
  applicability: {
    modules: ["modules"],
    roles: ["worker"],
    taskTypes: ["feature", "bugfix"]
  },
  trigger: {
    when: "task_start" | "before_commit" | "on_error",
    conditions: ["module:auth", "taskType:feature"]
  }
})
```
