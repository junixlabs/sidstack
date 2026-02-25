# Step 3: Test (Feature Mode)

Feature verification — test the feature works, not just that code compiles.

## Phase 1: Test Plan

Before testing, create a plan from task's acceptance criteria:

```markdown
## Test Plan: [Feature Name]

| # | Scenario | Type | Input | Expected Output | Priority |
|---|----------|------|-------|-----------------|----------|
| 1 | [happy path] | E2E | [data] | [result] | P0 |
| 2 | [edge case] | Unit | [data] | [result] | P1 |
| 3 | [error case] | API | [data] | [error response] | P1 |
```

**Derive scenarios from:**
- Acceptance criteria (from task)
- Changed files (from git diff)
- User workflows affected
- Edge cases: empty data, invalid input, auth failures

## Phase 2: Feature Verification

Test the feature actually works end-to-end:

**For MCP tools:**
```bash
# Start MCP server and test via direct invocation
# Verify tool input/output matches expected behavior
```

**For API endpoints:**
```bash
# Test endpoint responses
curl -s http://localhost:PORT/api/[endpoint] | head -50
```

**For UI components:**
- Start dev server: `pnpm dev` or `pnpm tauri:dev`
- Navigate to the feature
- Verify interactions work as expected
- Check console for errors

**For CLI commands:**
```bash
# Test command execution
npx sidstack [command] [args]
```

## Phase 3: Regression Check

Ensure nothing broke:

```bash
pnpm test          # Existing tests still pass
pnpm typecheck     # No new type errors
```

## Phase 4: Record Results

For each scenario in test plan:

| # | Scenario | Result | Actual Output | Notes |
|---|----------|--------|---------------|-------|
| 1 | [scenario] | PASS/FAIL | [what happened] | - |

## Phase 5: Persist Results in SidStack

Record test results for traceability coverage:

```
mcp__sidstack__test_result_create({
  projectPath: ".",
  projectId: "[project]",
  taskId: "[taskId]",
  specId: "[specId]",          // If task implements a spec, pass its ID
  featureName: "[Feature Name]",
  verdict: "pass|fail|partial",
  totalScenarios: X,
  passed: Y,
  failed: Z,
  testPlan: [{ scenario: "...", type: "E2E", expected: "..." }],
  results: [{ scenario: "...", result: "pass|fail", actual: "..." }]
})
```

This auto-creates entity references: test_result → task (validates), test_result → spec (validates).

**Important:** Always pass `taskId`. Pass `specId` if the task was linked to a spec — this enables traceability matrix coverage tracking.

## Gate

All P0 scenarios PASS. No regressions.

```
AskUserQuestion: "Test results: [X/Y passed]. Approve to proceed to review?"
```

Update task:

```
mcp__sidstack__task_update({ taskId, progress: 85, notes: "Testing complete. [X/Y] scenarios passed." })
```
