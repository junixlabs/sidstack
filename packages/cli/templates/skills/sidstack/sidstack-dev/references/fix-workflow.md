# Fix Mode (3 Steps)

Targeted bug fix. Branch: `fix/<name>`

---

## Step 1: Diagnose

Root cause analysis before any code changes.

### Process
1. **Reproduce** — Confirm the bug, get exact error/behavior
2. **Scope** — Identify affected module, handler, component
3. **Root Cause** — Trace execution path to the actual problem
4. **Impact** — List all components affected by both the bug AND the fix

### Tools
- Use Grep/Glob to search for related code
- Check recent git commits that may have introduced the bug
- If relevant knowledge exists: `mcp__sidstack__knowledge_search({ projectPath: ".", query: "[bug topic]" })`

### Output
Brief diagnosis report: bug description, root cause, affected files, proposed fix.

### Gate
Root cause confirmed. Submit diagnosis as solutionPlan and move task to `review`:

```
mcp__sidstack__task_update({
  taskId,
  status: "review",
  solutionPlan: "Root cause: [cause]. Fix: [approach]. Affected files: [list].",
  progress: 30
})
```

Wait for `planStatus=approved` before Step 2. Use `AskUserQuestion` if diagnosis is ambiguous.

- Check: `mcp__sidstack__task_get({ taskId })` → look at `planStatus`
- If `planStatus=revision_requested`: read `planReviewNotes`, revise diagnosis, resubmit

---

## Step 2: Fix + Verify

Targeted code change + verification in one step.

### Pre-check
Verify plan approval: `mcp__sidstack__task_get({ taskId })` → check `planStatus === 'approved'`
- If not approved: **STOP**. Tell user the solutionPlan needs approval before fix can proceed.
- If approved: `mcp__sidstack__task_update({ taskId, status: "in_progress" })` then proceed.

### Fix Rules
- Create branch: `git checkout -b fix/<name>`
- Change ONLY what's necessary to fix the bug
- Do NOT refactor surrounding code
- Follow project conventions

### Verify
1. **Fix verification** — Test that the specific bug is resolved
2. **Regression** — Run `pnpm test` to ensure fix didn't break anything
3. **Typecheck** — `pnpm typecheck` passes

### Gate
Fix verified. No regressions.

Update: `mcp__sidstack__task_update({ taskId, progress: 70, notes: "Fix applied and verified. Tests pass." })`

---

## Step 3: Review + Complete

Quick review and wrap up.

### Checklist
- [ ] Fix addresses root cause (not symptoms)
- [ ] No unintended side effects
- [ ] Tests cover the fix
- [ ] Typecheck passes

### UAT Summary

```markdown
## Fix Summary: [Bug Title]

**Root Cause:** [what was wrong]
**Fix:** [what was changed]
**Files:** [changed files list]
**Tests:** PASS ([X] passed)
**Regression:** None detected

### How to Verify
[Steps for human to confirm fix]
```

### Gate
Present summary. Ask user to approve.

### Complete

Submit implementSummary, then complete:

```
mcp__sidstack__task_update({
  taskId,
  implementSummary: "Root cause: [cause]. Fix: [what was changed]. Files: [list]."
})
mcp__sidstack__task_complete({ taskId, projectPath: "." })
```

### Feedback Loop

| Issue | Loop back to |
|-------|--------------|
| Wrong root cause | Step 1 (Diagnose) |
| Fix incomplete | Step 2 (Fix) |
| Minor issue | Fix in-place |

Max 2 loops.
