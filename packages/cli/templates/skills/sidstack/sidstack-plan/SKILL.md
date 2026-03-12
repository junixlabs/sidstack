---
name: sidstack-plan
description: "Analyzes pending tasks, writes solution plans, and submits them for human approval before implementation begins. Triggers on: /sidstack-plan, 'review tasks', 'plan tasks', 'what needs planning'. Does NOT implement — only plans."
argument-hint: "[task-id(s) | pending | review]"
allowed-tools: mcp__sidstack__task_list, mcp__sidstack__task_get, mcp__sidstack__task_update, mcp__sidstack__knowledge_search, mcp__sidstack__entity_link, mcp__sidstack__entity_context, mcp__sidstack__entity_references, mcp__sidstack__impact_analyze
---

# SidStack Plan Review

Analyze tasks, write solution plans, submit for human approval. **No implementation.**

```
pending → analyze → solutionPlan → submit (status: review) → STOP → user approves → /sidstack-dev feature
```

## Input Handling

Parse `$ARGUMENTS`:

| Input | Action |
|-------|--------|
| (empty) or `pending` | `task_list({ projectId, status: ["pending"] })` |
| `review` | `task_list({ projectId, status: ["review"] })` — show plan statuses |
| task IDs | `task_get({ taskId })` for each ID in `$ARGUMENTS` |

---

## Step 1: Load & Display Tasks

Fetch tasks based on input. Display summary:

```
| # | Task | Title | Status | Plan |
|---|------|-------|--------|------|
| 1 | task-abc | Fix auth timeout | pending | — |
```

If `review`: show `planStatus` and `planReviewNotes` for revision-requested tasks.

---

## Step 2: Analyze Each Task

For each task:

1. **Read details**: `task_get({ taskId })` — extract title, description, taskType, acceptanceCriteria
2. **Search context**: `knowledge_search` for task topic
3. **Research codebase**: Grep/Glob affected code, read key files
4. **Link knowledge**: `entity_link` each relevant doc to the task
5. **Impact analysis** (if core modules): `impact_analyze`

---

## Step 3: Write Solution Plan

The solutionPlan is the **contract** that implementation must follow. Use this format:

```markdown
## Root Cause / Requirement
[Why this change is needed.]

## Approach
[Logic changes, affected modules, key decisions. Reference existing patterns.]

### Files to Change
- `path/to/file.ts` — [what and why]

### Files to Create (if any)
- `path/to/new.ts` — [purpose]

## Acceptance Verification
- AC1: [criterion] → [how to verify]

## Risks
- [Risk]: [mitigation]

## Out of Scope
[What this task does NOT cover.]

## Knowledge References
- [doc-id]: [title] — [why relevant]
```

**Plan writing rules:**
- Be specific — name files, functions, modules
- Root cause first — explain WHY before HOW
- Reference existing patterns found in Step 2
- Map every acceptance criterion to a verification path
- Describe logic approach, not line-by-line code

---

## Step 4: Submit & Stop

```
mcp__sidstack__task_update({
  taskId: "[id]",
  status: "review",
  solutionPlan: "[plan]",
  progress: 25
})
```

Present summary table of all analyzed tasks. Then **STOP**. Do not implement.

User approves via UI or MCP: `task_update({ taskId, planStatus: "approved" })`

---

## Step 5: Handle Revisions

If task has `planStatus: "revision_requested"`:
1. Read `planReviewNotes`
2. Re-analyze addressing each feedback point
3. Resubmit updated `solutionPlan`
4. Note what changed: "Revised: [point] addressed by [change]"

---

## Plan Enforcement (applies to all implementation skills)

### No Implementation Without Approved Plan
Before any `status: "in_progress"`, check `planStatus === "approved"`.
Exception: hotfix mode only.

### Implementation Follows the Plan
- Change only files listed in the plan
- Follow the described approach
- If plan proves wrong: **STOP**, move back to `review`, update plan, wait for re-approval

### Scope Guard
If touching files NOT in the plan: ask user before proceeding.

### Traceability
- Commit messages reference task ID
- `implementSummary` notes which plan sections were executed and any deviations

---

## Error Handling

| Situation | Action |
|-----------|--------|
| No pending tasks | Report "No tasks need planning" |
| Task already approved | Skip, show status |
| MCP unavailable | Warn user, suggest manual plan |
| Knowledge search empty | Plan from codebase research only |
| Impact shows blockers | Include in plan risks, flag to user |
