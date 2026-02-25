# Step 1: Research (Feature Mode)

Research before implementation. Understand what exists, what's needed, what's risky.

## Objectives

1. **Business Logic** — Understand requirement context, user stories, expected behavior
2. **Codebase Patterns** — Find existing similar features, reuse patterns
3. **Impact Scope** — Identify affected modules, files, data flows
4. **Integration Points** — Map: DB schemas, API contracts, UI state, MCP tools
5. **Clarify** — Use `AskUserQuestion` for any ambiguous requirements

## Research Checklist

- [ ] Read project instructions (CLAUDE.md, relevant knowledge docs)
- [ ] Find similar existing features as reference (Grep/Glob)
- [ ] Identify which layers are affected (Tauri Rust / TypeScript packages / React frontend)
- [ ] Check existing services/modules for reuse opportunities
- [ ] Review DB schema if data changes needed (`packages/shared/src/database.ts`)
- [ ] Review API/MCP tool format if new tools needed
- [ ] Check for conflicts with existing routes/handlers

## SidStack-Specific Research

Use MCP tools for targeted context:

1. **Search knowledge** for relevant docs:
   `mcp__sidstack__knowledge_search({ projectPath: ".", query: "[feature topic]" })`

2. **Search semantic memory** for past learnings and related solutions:
   `mcp__sidstack__memory_search({ query: "[feature topic]", projectId: "[project]" })`

3. **Build entity context** if working on an existing task with linked entities:
   `mcp__sidstack__entity_context({ entityType: "task", entityId: "[taskId]", format: "claude" })`

4. **Impact analysis** if touching core modules:
   `mcp__sidstack__impact_analyze({ description: "[what you're changing]", targetModules: ["shared", "mcp-server"] })`

5. **Link knowledge to task** — for each relevant knowledge doc found:
   `mcp__sidstack__entity_link({ sourceType: "task", sourceId: "[taskId]", targetType: "knowledge", targetId: "[docId]", relationship: "requires_context" })`
   This builds the traceability chain (spec → task → test).

## Parallel Research (if complex feature)

Use Explore subagents for parallel investigation:
- Explorer 1: Business logic + requirement analysis
- Explorer 2: Codebase patterns + existing code
- Explorer 3: Technical feasibility + dependency mapping

## Output

Present research report to user:

```markdown
## Research Report: [Feature Name]

### Requirement Summary
[What this feature does, who it's for, expected behavior]

### Affected Layers
| Layer | Impact | Files |
|-------|--------|-------|
| Shared package | [what changes] | [files] |
| MCP Server | [what changes] | [files] |
| React Frontend | [what changes] | [files] |
| Tauri Backend | [what changes] | [files] |

### Existing Patterns to Follow
[Similar features found, conventions to match]

### Implementation Approach
[Proposed solution, key decisions]

### Risks
[What could go wrong, dependencies, breaking changes]

### Open Questions
[Anything unclear that needs user input]
```

## Gate

Include in solutionPlan:
- Root cause / requirement summary
- Proposed approach
- **Referenced knowledge docs** (list IDs linked via entity_link)
- Risk assessment

Present report to user. Submit as solutionPlan and move task to `review`:

```
mcp__sidstack__task_update({
  taskId,
  status: "review",
  solutionPlan: "[research report / approach summary]",
  progress: 25
})
```

Plan submitted for review. **Wait for `planStatus=approved` before Step 2.**

- Check: `mcp__sidstack__task_get({ taskId })` → look at `planStatus`
- If `planStatus=approved`: proceed to Step 2
- If `planStatus=revision_requested`: read `planReviewNotes`, revise the plan, resubmit with updated `solutionPlan`

```
AskUserQuestion: "Research submitted as solutionPlan (status: review). Approve the plan to start implementation?"
```
