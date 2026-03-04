# Step 2: Implement (Feature Mode)

Code implementation after research approval. Follow detected patterns.

## Pre-Implementation

1. **Verify plan approval**: `mcp__sidstack__task_get({ taskId })` → check `planStatus === 'approved'`
   - If not approved: **STOP**. Tell user to run `/sidstack-plan [task-id]` and approve the plan first.
   - If approved: read `solutionPlan` — this is the **contract** for this implementation.
2. **Read the approved solutionPlan thoroughly** — extract:
   - Files to change (scope boundary)
   - Approach and logic changes
   - Acceptance verification mapping
   - Risks to watch for
3. Mark in_progress: `mcp__sidstack__task_update({ taskId, status: "in_progress" })`
4. Create feature branch (if not exists): `git checkout -b feature/<name>`
5. Identify needed layers from the approved plan:

| Layer | When Needed | Key Files |
|-------|-------------|-----------|
| Shared | New types, DB schema, services | `packages/shared/src/` |
| MCP Server | New MCP tools, handlers | `packages/mcp-server/src/tools/` |
| API Server | New REST endpoints | `packages/api-server/src/routes/` |
| CLI | New CLI commands | `packages/cli/src/commands/` |
| React Frontend | New views, components, stores | `src/components/`, `src/stores/` |
| Tauri Backend | New Rust commands | `src-tauri/src/commands/` |

## Implementation Order

Always: **Shared -> Backend (MCP/API/Tauri) -> Frontend**

Dependencies flow down. Build foundation first.

## Standards (from Step 0 detection)

- TypeScript: strict mode, no `any`
- React: functional components, Zustand stores
- Styling: Tailwind CSS, shadcn/ui components
- API: Express routes with proper error handling
- MCP: Tool handlers in `packages/mcp-server/src/tools/handlers/`
- DB: SQLite via better-sqlite3 singleton

## Code Quality

- No `any` types in TypeScript
- Functions max 40 lines
- Single responsibility
- Meaningful names

## Security

- Validate all input
- No hardcoded secrets
- Sanitize output

## Progress Tracking

Update at natural milestones:

```
mcp__sidstack__task_update({ taskId, progress: 40, notes: "Shared types + DB schema done" })
mcp__sidstack__task_update({ taskId, progress: 55, notes: "MCP handler implemented" })
mcp__sidstack__task_update({ taskId, progress: 70, notes: "Frontend component done" })
```

Tag observations for later synthesis:
- `[NOTE:decision] Chose X over Y because...`
- `[NOTE:pattern] Found reusable pattern in...`
- `[NOTE:issue] Potential problem with...`

## Self-Verification (MANDATORY before handoff)

Before proceeding to Step 3, verify your output against **both** the task AND the approved plan:

1. `mcp__sidstack__task_get({ taskId })` — re-read acceptance criteria AND solutionPlan
2. For EACH acceptance criterion, verify: does the implementation satisfy it?
3. **Plan compliance check**: did you follow the approved approach? Any deviations?
4. **Scope check**: `git diff --stat` — are all changed files in the plan's "Files to Change" list? Any unexpected files?
5. If a file NOT in the plan was changed: note it explicitly and explain why
6. Run the feature manually if possible (API call, UI check, etc.)

Record self-verification result:
```
mcp__sidstack__task_update({
  taskId,
  progress: 75,
  notes: "Self-verified:\n- [criterion 1]: PASS\n- [criterion 2]: PASS\n- Diff review: clean"
})
```

**If any criterion FAILS -> fix before proceeding.**

## Anti-Bias Handoff Protocol

> **Why This Matters**: Same-session self-review leads to confirmation bias.
> The implementer should NEVER review their own code in the same session.

When implementation complete:
1. **DO NOT** offer to review your own code
2. **DO NOT** mark task as complete without review
3. **ALWAYS** hand off to an independent reviewer

**Standalone:** Tell user to open a NEW terminal and run `/sidstack-dev review [task-id]`
**Teammate:** SendMessage to reviewer teammate with file list + quality gate results

## Gate

Code compiles. Run quick check:

```bash
pnpm typecheck
```

If errors, fix before proceeding. Update task:

```
mcp__sidstack__task_update({ taskId, progress: 75, notes: "Implementation complete. Typecheck pass." })
```
