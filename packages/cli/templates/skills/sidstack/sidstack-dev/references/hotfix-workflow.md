# Hotfix Mode (2 Steps)

Critical production fix. Minimal change. Branch: `hotfix/<name>`

---

## Step 1: Quick Fix

Smallest possible change for the critical issue.

### Rules
- Branch: `git checkout -b hotfix/<name>`
- **Smallest possible change** — no refactoring, no cleanup
- Focus: fix the immediate problem only
- If unsure about scope, ask user with `AskUserQuestion`

### Process
1. Identify the crash/critical issue
2. Find the minimal code change to resolve it
3. Apply the fix
4. Run `pnpm typecheck` to confirm it compiles

### Gate
Fix applied. Code compiles.

Update: `mcp__sidstack__task_update({ taskId, progress: 50, notes: "Hotfix applied. Compiles." })`

---

## Step 2: Smoke Test + Complete

Quick verification and wrap up.

### Verify
1. **Fix works** — Confirm the specific issue is resolved
2. **Critical paths OK** — Run `pnpm test` (fail-fast)
3. **No obvious breaks** — Quick manual check

### Output

```markdown
## Hotfix: [Issue Title]

**Issue:** [what was broken]
**Fix:** [minimal change applied]
**Files:** [1-2 files changed]
**Tests:** PASS
**Verified:** [how]
```

### Gate
Present summary. Ask user to approve + commit.

### Complete

```
mcp__sidstack__task_complete({ taskId, projectPath: "." })
```

### After Deploy
Suggest follow-up if hotfix was a band-aid:
- "Consider creating a proper fix task for root cause analysis"
