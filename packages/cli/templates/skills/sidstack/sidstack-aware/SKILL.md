---
name: sidstack-aware
user-invocable: false
allowed-tools: mcp__sidstack__task_update, mcp__sidstack__task_list, mcp__sidstack__task_complete, mcp__sidstack__task_get, mcp__sidstack__incident_create, mcp__sidstack__lesson_create, mcp__sidstack__memory_add, mcp__sidstack__memory_search, mcp__sidstack__entity_link, mcp__sidstack__entity_references, mcp__sidstack__knowledge_search, mcp__sidstack__entity_context, mcp__sidstack__training_context_get
description: "Tracks task progress milestones and guides completion flow with quality gates. Auto-triggers when code changes are made, work nears completion, user queries task status, or a task needs the plan-first gate check before implementation."
---

# SidStack Task Progress & Completion

## When This Activates

This skill provides workflow guidance during active implementation:

- **New request arrives**: classify intent → route to correct workflow
- After code changes: update progress milestones
- Work nearing completion: guide through quality gates
- Task status queries: "check task", "list tasks", "what's the status"

> **Note:** Task lifecycle is guided by the `/sidstack-dev` skill. This skill tracks progress and completion flow.

---

## Session Start Behavior

When activated at the beginning of a session or after context compaction:

1. `task_list({ projectId: "FOLDER_NAME", preset: "actionable" })` — show active and pending tasks
2. If an in_progress task exists, display it and offer to resume
3. If no active task, show top pending tasks as options
4. `training_context_get({ projectId: "FOLDER_NAME" })` — load applicable rules and lessons

---

## Workflow Classification

When the user sends a natural-language request (not a `/sidstack-*` command), classify before acting.

### Step 1: Classify Intent

| Intent | Workflow | TaskType | Needs Task? |
|--------|----------|----------|-------------|
| Question, explanation, discussion | discuss | — | No |
| Task CRUD, status check, OKR | track | — | No |
| Critical/urgent production fix | hotfix | bugfix (critical) | Yes |
| Fix bug, error, regression, broken | bugfix | bugfix | Yes |
| New feature, endpoint, UI component | implement | feature | Yes |
| Refactor, optimize, perf, cleanup | improve | refactor/perf/debt | Yes |
| Review code, audit, verify | review | — | Existing |
| Ticket ID referenced | ticket | (from ticket) | Via convert |
| Documentation, knowledge build/update | knowledge | docs | No |
| Incident, lesson, recurring bug pattern | learn | — | No |

### Step 2: Context Check (for task-creating workflows only)

Before creating a new task:

1. `task_list({ projectId: "FOLDER_NAME", preset: "actionable" })` — is there an existing task for this?
   - YES, matching topic → Resume it. Do not create duplicate.
   - NO → Continue to Step 3.
2. `memory_search({ query: "[request summary]" })` — any past learnings?
3. `training_context_get({ projectId: "FOLDER_NAME" })` — applicable rules?

### Step 3: Disambiguate

If classification is uncertain:

- **In-progress task on same topic?** → Resume that task.
- **Request mentions task-ID (task-xxx)?** → Load and continue that task.
- **Request mentions ticket-ID (JIRA-xxx, GH-xxx)?** → Route to ticket workflow.
- **Still ambiguous?** → Ask user: "This could be a [bugfix] or [feature]. Which workflow fits better?"

### Step 4: Route

| Workflow | Route |
|----------|-------|
| discuss | Answer directly. No skill invoked. |
| track | Handle with MCP task tools. |
| hotfix | Create task → tell user: "Created hotfix task [id]. Starting `/sidstack-dev hotfix [id]`" |
| bugfix | Create task → tell user: "Created bugfix task [id]. Use `/sidstack-dev fix [id]` for structured flow, or say 'proceed' for lightweight." |
| implement | Create task → tell user: "Created feature task [id]. Use `/sidstack-dev feature [id]` for full 4-step, or say 'proceed' for lightweight." |
| improve | Create task (refactor/perf/debt) → same as implement |
| review | Tell user: "Use `/sidstack-dev review [task-ids]`" |
| ticket | Tell user: "Use `/sidstack ticket <id>` to process" |
| knowledge | Tell user: "Use `/sidstack-knowledge [mode]`" |
| learn | Use `incident_create` → `lesson_create` directly |

**Lightweight flow** (when user says "proceed" instead of `/sidstack-dev`):
```
task_start_with_context({ taskId })
→ implement
→ task_update({ progress })
→ test
→ task_governance_check({ taskId })
→ test_result_create(...)
→ task_complete_with_context({ taskId })
→ memory_add(...)
```

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
1. `entity_context({ entityType: "task", entityId: taskId })` — loads all linked knowledge, memory, references in one call
2. If entity_context returns no linked docs, fall back to `knowledge_search` + `memory_search`
3. `entity_link` — link any newly discovered relevant docs to the task

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

| Workflow Moment | Tool | Purpose |
|----------------|------|---------|
| **Session Start** | `mcp__sidstack__task_list` | Check active/pending tasks |
| | `mcp__sidstack__training_context_get` | Load rules and lessons |
| **Starting Work** | `mcp__sidstack__entity_context` | Load ALL linked context in one call |
| | `mcp__sidstack__task_create` | Before implementing (with acceptance criteria) |
| **During Work** | `mcp__sidstack__task_update` | Progress updates (progress: 0-100) |
| | `mcp__sidstack__knowledge_search` | Find project patterns, docs |
| | `mcp__sidstack__impact_analyze` | Before touching core/risky code |
| **Finishing Work** | `mcp__sidstack__task_complete` | After quality checks pass |
| | `mcp__sidstack__memory_add` | Store learnings for future |
| | `mcp__sidstack__entity_link` | Link task to knowledge docs, specs |
| **Fallback** | `mcp__sidstack__memory_search` | When entity_context has no linked docs |
| | `mcp__sidstack__entity_references` | Query what's linked to a task |
