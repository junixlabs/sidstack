---
name: sidstack-lesson-detector
description: >
  Suggest creating lessons after debugging or fixing issues. Trigger when:
  bug took long to debug, found reusable pattern, error was preventable,
  or issue recurred. Ask user before creating incident_create then lesson_create.
---

# Lesson Detection

## Trigger Conditions

| Condition | Ask User |
|-----------|----------|
| Bug took >30min to debug | "Create a lesson for future debugging?" |
| Found reusable pattern | "Document this pattern as a skill?" |
| Error was preventable | "Create a rule to prevent this?" |
| Same issue occurred before | "This is recurring. Create a lesson?" |

## Process

### 1. Ask User First

> "I noticed this was tricky. Would you like me to document it as a lesson?"

### 2. Create Incident (if yes)

```
incident_create({
  projectPath: ".",
  moduleId: "module-name",
  type: "mistake" | "confusion" | "slow",
  severity: "medium",
  title: "Short summary",
  description: "What happened"
})
```

### 3. Create Lesson (if user agrees)

```
lesson_create({
  projectPath: ".",
  moduleId: "module-name",
  incidentIds: ["incident-id"],
  title: "Descriptive title",
  problem: "What went wrong",
  rootCause: "Why it happened",
  solution: "How to prevent it"
})
```

## Good Lesson Criteria

- Clear problem statement
- Root cause (not just symptoms)
- Actionable solution
- Defined scope (modules, task types)
