# Step 4: Review (Feature Mode)

Self-review + UAT report generation for human review.

## Phase 1: Self-Review Checklist

### Code Quality
- [ ] Follows project conventions (from Step 0 detection)
- [ ] No `any` types, proper TypeScript
- [ ] Functions focused, reasonable length
- [ ] Error handling present
- [ ] No hardcoded secrets/credentials
- [ ] No security vulnerabilities (XSS, SQL injection, command injection)

### Feature Completeness
- [ ] All acceptance criteria met (re-read from task)
- [ ] **Plan compliance**: implementation follows the approved `solutionPlan` approach
- [ ] **Scope compliance**: only files listed in the plan were changed (or deviations documented)
- [ ] Test plan scenarios passed
- [ ] No debug code left (console.log, TODO)

### Quality Gates
```bash
pnpm typecheck   # Must pass
pnpm test        # Must pass
pnpm lint        # Should pass (warn on minor)
```

## Phase 2: Generate UAT Report

Create a structured report for human review:

```markdown
## UAT Report: [Feature Name]

**Task:** [task-id] - [title]
**Branch:** feature/[name]
**Date:** [YYYY-MM-DD]

### Changes Summary
| File | Change Type | Description |
|------|-------------|-------------|
| [path] | New/Modified/Deleted | [what and why] |

### Test Results
| # | Scenario | Priority | Result | Notes |
|---|----------|----------|--------|-------|
| 1 | [scenario] | P0 | PASS | - |

### Quality Gates
| Gate | Status |
|------|--------|
| TypeCheck | PASS/FAIL |
| Tests | PASS/FAIL ([X] passed, [Y] failed) |
| Lint | PASS/WARN |

### Human Review Needed
[List specific areas that need human attention:]
- [ ] [Area 1]: [why human should check this]
- [ ] [Area 2]: [why human should check this]

### How to Test Manually
1. [Step-by-step instructions for human to verify]
2. [Include exact commands, URLs, or UI paths]

### Sensitive Changes (if any)
[Flag if changes touch auth, database schema, payment, config]
```

## Phase 3: Human Checkpoint

Present UAT report to user:

```
AskUserQuestion: "UAT report generated. Please review. Approve to complete task?"
```

## Feedback Loop

If user requests changes:

| Feedback Type | Action | Loop back to |
|---------------|--------|--------------|
| Requirement gap | Missing feature aspect | Step 1 (Research) |
| Code issue | Bug or architecture flaw | Step 2 (Implement) → Step 3 (Test) |
| Test gap | Missing verification | Step 3 (Test) |
| Minor fix | Style, naming | Fix in-place, no loop |

**Max 3 loops.** After 3, report remaining issues and ask user for decision.

## Phase 4: Complete

After user approval, submit implementSummary then complete:

```
mcp__sidstack__task_update({
  taskId,
  progress: 95,
  notes: "UAT approved by user.",
  implementSummary: "[what was done, key decisions, files changed]"
})
mcp__sidstack__task_complete({ taskId, projectPath: "." })
```

Optional (ask user):
- Commit changes: `git add [files] && git commit -m "feat: [description]"`
- Update knowledge docs if needed

### Store Completion Learnings

After task completes, store key learnings in semantic memory:

```
mcp__sidstack__memory_add({
  content: "[Task title]: [implementSummary]. Key learnings: [patterns, gotchas, decisions]",
  projectId: "[project]",
  metadata: { sourceType: "task_completion", taskId: "[taskId]" }
})
```

This enables future agents to find these learnings via `memory_search` (auto-expires in 90 days).

### Lesson Synthesis

Review any `[NOTE:*]` tags from progress history. If actionable observations exist and user approves:
1. `mcp__sidstack__lesson_create(...)` (permanent record)
2. `mcp__sidstack__memory_add({ content: "...", metadata: { sourceType: "lesson" } })` (semantic search index)

Let user decide which to act on. Do NOT auto-create lessons.
