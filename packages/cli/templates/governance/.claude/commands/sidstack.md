---
name: SidStack
description: Project dashboard and quick actions
category: core
version: 2.0.0
tags: [sidstack, project, tasks, tickets]
---

# SidStack - Project Dashboard

Quick access to project status and common actions.

## /sidstack (no args) — Dashboard

Show project overview:

1. Fetch data:
   - `task_list({ projectId, preset: "actionable" })`
   - `ticket_list({ projectId, status: ["new", "approved"] })`

2. Display:
   ```
   ## Dashboard

   ### Active Tasks
   - [task-id] [title] (progress%)

   ### Pipeline
   - [N] pending tasks
   - [N] open tickets

   What would you like to do?
   ```

## /sidstack ticket <id> — Process Ticket

End-to-end ticket processing:

1. `ticket_get({ ticketId: "$1" })`
2. `ticket_convert_to_task({ ticketId: "$1" })`
3. `task_update({ taskId, status: "in_progress" })`
4. Implement the task
5. Update progress at milestones: `task_update({ progress: 30/60/90 })`
6. `task_complete({ taskId })`

## /sidstack task — Current Task

Show active task status:

```
task_list({ projectId, status: ["in_progress"] })
```

## /sidstack complete — Finish Task

1. Run quality gates:
   ```bash
   pnpm typecheck && pnpm build && pnpm test
   ```
2. If pass: `task_complete({ taskId })`
3. If fail: Show errors, ask to fix

## /sidstack impact <description> — Analyze Impact

1. `impact_analyze({ description: "$ARGUMENTS" })`
2. `impact_check_gate({ analysisId })`
3. Show: risk level, affected modules, recommendations

## Arguments

`$ARGUMENTS` — Subcommand and arguments. If empty, show dashboard.
