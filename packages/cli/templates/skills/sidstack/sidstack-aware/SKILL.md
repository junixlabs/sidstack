---
name: sidstack-aware
user-invocable: false
allowed-tools: mcp__sidstack__task_update, mcp__sidstack__task_list, mcp__sidstack__task_complete, mcp__sidstack__task_get, mcp__sidstack__incident_create, mcp__sidstack__lesson_create, mcp__sidstack__memory_add, mcp__sidstack__memory_search, mcp__sidstack__entity_link, mcp__sidstack__entity_references, mcp__sidstack__knowledge_search, mcp__sidstack__entity_context
description: "Tracks task progress milestones and guides completion flow with quality gates. Auto-triggers when code changes are made, work nears completion, user queries task status, or a task needs the plan-first gate check before implementation."
---

# SidStack Task Progress & Completion

## When This Activates

This skill provides workflow guidance during active implementation:

- After code changes: update progress milestones
- Work nearing completion: guide through quality gates
- Task status queries: "check task", "list tasks", "what's the status"

> **Note:** Task lifecycle is guided by the `/sidstack-dev` skill. This skill tracks progress and completion flow.

---

## Plan-First Gate (MANDATORY)

**Before any implementation begins**, verify the task has an approved plan:

```
mcp__sidstack__task_get({ taskId: "[id]" })
→ check: planStatus === "approved"
```

| planStatus | Action |
|------------|--------|
| `undefined` / no plan | **STOP.** Run `/sidstack-plan [task-id]` to create a plan first. |
| `draft` | **STOP.** Plan is pending user review. Do not implement. |
| `revision_requested` | **STOP.** Read `planReviewNotes`, revise plan, resubmit. |
| `approved` | **PROCEED.** Move to `in_progress` and implement following the plan. |

**Exception:** hotfix mode only (critical production issues can skip plan review).

### Implementation Must Follow the Plan

When `planStatus === "approved"`:
1. Read the `solutionPlan` field — this is the contract
2. Change only files listed in the plan
3. Follow the approach described in the plan
4. If you discover the plan is wrong or incomplete: **STOP**, update notes, move back to `review`
5. If you need to touch files NOT in the plan: ask user before proceeding

## Progress Tracking

Update progress at milestones during implementation:

| Progress | Milestone | Also Consider |
|----------|-----------|---------------|
| 10% | Requirements understood | |
| 25-30% | solutionPlan submitted → status `review` | Submit plan via `task_update({ status: "review", solutionPlan: "..." })`. Wait for `planStatus=approved` before coding. |
| 60% | Core logic done | Note any patterns/workarounds as `[NOTE:pattern]` |
| 80% | Testing/verifying | Note any issues found as `[NOTE:issue]` |
| 95% | Submit `implementSummary` before completion | `task_update({ implementSummary: "[what was done, key decisions, files changed]" })` |
| 100% | All checks pass | |

```
mcp__sidstack__task_update({ taskId: "[id]", progress: X, notes: "milestone" })
```

## Task Queries

| User Says | Action |
|-----------|--------|
| "check task", "list tasks" | `mcp__sidstack__task_list({ projectId: "FOLDER_NAME" })` |
| "what's the status", "where are we" | `mcp__sidstack__task_list` + show active task details |
| "review tasks", "pending plans" | `mcp__sidstack__task_list({ status: ["review"] })` — show tasks with `planStatus` |

## Completion Flow

Before calling `mcp__sidstack__task_complete`:

1. Code changes implemented
2. Tests pass (if applicable)
3. Build succeeds (if applicable)
4. Manually verified the change works
5. **Submit implementSummary**: what was done, key decisions, files changed
   ```
   mcp__sidstack__task_update({ taskId: "[id]", implementSummary: "[summary]" })
   ```
6. **Lesson check**: Any patterns, issues, or decisions worth noting?
   - If yes: use `incident_create` -> `lesson_create` flow
   - If no: proceed to completion

```
mcp__sidstack__task_complete({ taskId: "[id]" })
```

## Integrated Workflow (applies to ALL implementation work)

These steps apply whether you're in `/sidstack-dev` mode or handling a regular prompt:

### On Task Start (after create or resume)
1. `knowledge_search` — find relevant docs for the work area
2. `memory_search` — find past learnings, patterns, gotchas
3. `entity_link` — link each relevant knowledge doc to the task (`relationship: "requires_context"`)

### During Implementation
4. `entity_context` — if you need full context for a task with linked entities
5. `entity_link` — link any new knowledge docs you create to the task

### On Task Complete
6. `memory_add` — store key learnings: `{ content: "[summary + learnings]", projectId: "...", metadata: { sourceType: "task_completion", taskId: "..." } }`
7. `test_result_create` — if tests were run, persist results with `taskId`

> **Rule:** Always search before you build. Always store after you complete.

## Task Creation Template

When a task needs to be created (e.g., no active task found):

```
mcp__sidstack__task_create({
  projectId: "FOLDER_NAME",
  title: "[TYPE] Clear description",
  description: "Problem: X. Solution: Y.",
  taskType: "feature|bugfix|refactor|test|docs",
  priority: "medium",
  acceptanceCriteria: [
    { description: "Specific verifiable outcome" }
  ]
})
```

## Output Templates

**Progress Update:**
```markdown
Progress: [X]% - [milestone description]
```

**Task Complete:**
```markdown
Task [task-id] completed.
Summary: [what was done]
Quality gates: All passed
```

## Error Handling

| Situation | Action |
|-----------|--------|
| MCP tools unavailable | Warn user, proceed without task tracking |
| Task create fails | Report error, ask user to check config |
| No project config found | Suggest running `sidstack init` |
| Task already exists | Use existing task, don't create duplicate |

## Task Systems: SidStack vs Built-in

| System | Use For |
|--------|---------|
| **SidStack MCP** (`mcp__sidstack__task_*`) | Governance, quality gates, cross-session persistence |
| **Built-in** (`TaskCreate/TaskUpdate`) | Session-local sub-step coordination |

Rule: Always create the SidStack MCP task first (governance requires it). Optionally use built-in tasks for sub-steps within the session.

## Quick Reference

| Tool | When |
|------|------|
| `mcp__sidstack__task_list` | Session start, before new work |
| `mcp__sidstack__task_create` | Before implementing (with acceptance criteria) |
| `mcp__sidstack__task_update` | Progress updates during work |
| `mcp__sidstack__task_complete` | After quality checks pass |
| `mcp__sidstack__knowledge_search` | Before implementing unfamiliar area |
| `mcp__sidstack__impact_analyze` | Before touching core/risky code |
| `mcp__sidstack__memory_search` | Before starting unfamiliar task |
| `mcp__sidstack__memory_add` | After task completion (store learnings) |
| `mcp__sidstack__entity_link` | Link task to knowledge docs, specs |
| `mcp__sidstack__entity_references` | Query what's linked to a task |
| `mcp__sidstack__entity_context` | Get full context for any entity |
