# Review Mode

Batch analysis: create solutionPlans for multiple tasks. No implementation.

## Input

- Task IDs: `review task-1 task-2 task-3`
- Filter: `review pending` (all pending tasks for this project)

## Process

1. **Load tasks**: Fetch by IDs or by `task_list({ preset: 'actionable', status: ['pending'] })`
2. **For each task:**
   a. Read task details: `task_get({ taskId })`
   b. Research context:
      - `mcp__sidstack__knowledge_search({ projectPath: ".", query: "[task topic]" })`
      - Grep codebase for affected patterns
   c. Link knowledge to task:
      - For each relevant knowledge doc: `mcp__sidstack__entity_link({ sourceType: "task", sourceId: "[taskId]", targetType: "knowledge", targetId: "[docId]", relationship: "requires_context" })`
   d. Create solutionPlan:
      - Root cause / requirement summary
      - Proposed approach (logic changes, affected modules)
      - Referenced knowledge docs (IDs linked via entity_link)
      - Risk assessment (what could go wrong)
   e. Submit: `task_update({ taskId, status: "review", solutionPlan: "...", progress: 25 })`
3. **Present summary**: table of all tasks with plan status

## solutionPlan Format

Focus on root cause + logic approach, NOT detailed implementation:

```
## [Task Title]

**Root Cause / Requirement:** [what needs to change and why]

**Approach:** [logic changes, affected modules, key decisions]

**Risk:** [breaking changes, side effects, dependencies]
```

## Output

| Task | Title | Plan Status |
|------|-------|-------------|
| task-1 | [title] | review (draft) |
| task-2 | [title] | review (draft) |

"N tasks analyzed and submitted for review. Review plans in UI or use task_get to read each plan."

## After Review

User reviews → approves/requests revision via:
- UI TaskDetailPanel (approve/reject buttons)
- MCP: `task_update({ taskId, planStatus: "approved" })`

Then implement approved tasks:
- Single: `/sidstack-dev feature task-1`
- Parallel: spawn teammates for multiple tasks
