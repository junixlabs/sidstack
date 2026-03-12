---
name: SidStack Training
description: View and manage project training data (incidents, lessons, rules)
category: core
version: 1.0.0
tags: [sidstack, training, lessons, rules, learning]
---

# SidStack Training - Learning Management

Manage project-specific training: incidents, lessons, and rules.

## /sidstack:training (no args) — Overview

Show training system overview:

1. Fetch stats:
   ```
   incident_list({ projectPath: "." })
   lesson_list({ projectPath: "." })
   ```

2. Display:
   ```
   ## Training Overview

   ### Incidents
   - [N] open incidents
   - [N] with lessons created

   ### Lessons
   - [N] draft lessons
   - [N] approved lessons

   ### Recent Activity
   - [date] [type]: [title]

   Subcommands: incident, lesson, rules, context
   ```

## /sidstack:training incident — Incident Management

### /sidstack:training incident list

List all incidents:

```
incident_list({ projectPath: ".", status: "open" })
```

Display:
```
## Open Incidents

| ID | Module | Type | Severity | Title |
|----|--------|------|----------|-------|
| inc-xxx | auth | mistake | medium | Wrong password comparison |
```

### /sidstack:training incident create

Interactive incident creation:

1. Ask for details:
   - Module ID
   - Type: mistake, failure, confusion, slow
   - Severity: low, medium, high, critical
   - Title and description

2. Create:
   ```
   incident_create({
     projectPath: ".",
     moduleId: "[input]",
     type: "[input]",
     severity: "[input]",
     title: "[input]",
     description: "[input]"
   })
   ```

3. Ask: "Create a lesson from this incident?"

## /sidstack:training lesson — Lesson Management

### /sidstack:training lesson list

List all lessons:

```
lesson_list({ projectPath: "." })
```

Display:
```
## Lessons

| ID | Module | Status | Title |
|----|--------|--------|-------|
| lesson-xxx | auth | approved | Always hash passwords with bcrypt |
| lesson-yyy | api | draft | Rate limit all public endpoints |
```

### /sidstack:training lesson create

Interactive lesson creation:

1. Optionally link to incidents:
   - Show recent open incidents
   - Let user select which to link

2. Collect details:
   - Module ID
   - Title
   - Problem (what went wrong)
   - Root cause (why it happened)
   - Solution (how to prevent/fix)
   - Applicability (modules, roles, task types)

3. Create:
   ```
   lesson_create({
     projectPath: ".",
     moduleId: "[input]",
     incidentIds: ["[selected]"],
     title: "[input]",
     problem: "[input]",
     rootCause: "[input]",
     solution: "[input]",
     applicability: {
       modules: ["[input]"],
       roles: ["worker"],
       taskTypes: ["feature", "bugfix"]
     }
   })
   ```

### /sidstack:training lesson approve <id>

Approve a draft lesson:

```
lesson_approve({ lessonId: "$1" })
```

Display: "Lesson [id] approved. It will now be included in training context."

## /sidstack:training rules [module] — Check Rules

Show applicable rules for a module:

```
rule_check({
  projectPath: ".",
  moduleId: "[module or current]",
  role: "worker",
  taskType: "feature"
})
```

Display:
```
## Rules for [module]

### MUST (Mandatory)
- [rule-name]: [content]

### SHOULD (Recommended)
- [rule-name]: [content]

### MAY (Optional)
- [rule-name]: [content]
```

## /sidstack:training context [module] — View Training Context

Show what training context would be injected for a module:

```
training_context_get({
  projectPath: ".",
  moduleId: "[module or current]",
  role: "worker",
  taskType: "feature"
})
```

Display the full training context that would be injected.

## Arguments

`$ARGUMENTS` — Subcommand and arguments. If empty, show overview.

## Examples

```bash
# Show training overview
/sidstack:training

# List all incidents
/sidstack:training incident list

# Create a lesson interactively
/sidstack:training lesson create

# Check rules for auth module
/sidstack:training rules auth

# View training context for api module
/sidstack:training context api
```
