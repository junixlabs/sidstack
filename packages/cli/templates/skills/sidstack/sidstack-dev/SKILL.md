---
name: sidstack-dev
description: "Runs structured development workflows (review, feature, fix, hotfix) with plan-first gates, quality checks, and step-by-step implementation. Triggers on: /sidstack-dev, or when user wants to implement, fix, or review tasks."
disable-model-invocation: true
argument-hint: "[review|feature|fix|hotfix] [task-id(s) or description]"
---

# SidStack Development Workflow

4 modes. Step-by-step. Gate between each phase.

## Usage

```
/sidstack-dev review task-1 task-2 task-3
/sidstack-dev review pending
/sidstack-dev feature task-123
/sidstack-dev fix task-123
/sidstack-dev hotfix "Fix crash on startup"
```

## Step 0: Initialize

Run EVERY time before any mode:

1. **Detect mode** from first argument. Default `feature` if not specified.
2. **Read CLAUDE.md** — extract project standards, architecture, conventions
3. **Detect stack** from `package.json`, `Cargo.toml`, `vite.config.ts`, `tsconfig.json`
4. **Create or resume SidStack task:**
   - If task-id provided: `mcp__sidstack__task_get({ taskId })`
   - If description provided: `mcp__sidstack__task_create({ projectId: "sidstack", title: "[TYPE] description", description: "...", taskType: "feature|bugfix|refactor" })`
   - **review mode**: Load multiple tasks (no status change yet — each task updated individually during analysis)
   - **feature/fix mode**: Check `planStatus` — if not `approved`, redirect to `/sidstack-plan [task-id]` first
   - **hotfix mode**: Mark `in_progress` immediately (skip review): `mcp__sidstack__task_update({ taskId, status: "in_progress", progress: 5 })`
5. **Plan-First Gate** (feature/fix modes only):
   - `task_get({ taskId })` → check `planStatus`
   - If `planStatus !== "approved"`: **STOP.** Tell user to run `/sidstack-plan [task-id]` and approve the plan first.
   - If `planStatus === "approved"`: read `solutionPlan` — this is the contract for implementation.
6. **Initialize TodoWrite** with all steps for selected mode

## Mode Selection

| Mode | Steps | Branch | Depth |
|------|-------|--------|-------|
| **review** | 1 (Analyze → Submit Plans) | none | Analysis only |
| **feature** | 4 (Research → Implement → Test → Review) | `feature/<name>` | Full |
| **fix** | 3 (Diagnose → Fix → Verify) | `fix/<name>` | Targeted |
| **hotfix** | 2 (Quick Fix → Smoke Test) | `hotfix/<name>` | Minimal |

## Review Mode (1 Step)

Batch analysis: create solutionPlans for multiple tasks. No implementation.
**Tip:** For a more focused plan review experience, use `/sidstack-plan` instead.

Load: `references/review-workflow.md`

Input formats:
- Task IDs: `review task-1 task-2 task-3`
- Filter: `review pending` (all pending tasks for this project)

**Gate**: All tasks have solutionPlans submitted. User reviews/approves in UI or via MCP.

## Feature Mode (4 Steps)

### Step 1: Research
Load: `references/feature-step-1-research.md`
**Gate**: Research report presented. User approves before Step 2.

### Step 2: Implement
Load: `references/feature-step-2-implement.md`
**Gate**: Code compiles, no syntax errors. Progress updated.

### Step 3: Test
Load: `references/feature-step-3-test.md`
**Gate**: Test plan created + all verifications pass.

### Step 4: Review
Load: `references/feature-step-4-review.md`
**Gate**: UAT report generated. Human approves or provides feedback.

## Fix Mode (3 Steps)

Load: `references/fix-workflow.md` for all steps.

## Hotfix Mode (2 Steps)

Load: `references/hotfix-workflow.md` for all steps.

## Teammate Mode (Agent Teams)

Load: `references/teammate-mode.md`

## Execution Rules

**CRITICAL — Lazy Loading:**
- Do NOT read all reference files upfront. Only read the ONE file needed for the current step.
- For review mode: read `references/review-workflow.md` once — it contains the full batch analysis flow.
- For fix mode: read `references/fix-workflow.md` once — it contains all 3 steps in one file.
- For hotfix mode: read `references/hotfix-workflow.md` once — it contains both steps in one file.
- For feature mode: read ONLY the current step's file (e.g., `references/feature-step-1-research.md` for Step 1). Do NOT pre-read Step 2/3/4 files until you reach that step.

1. Run Step 0 first, every time
2. **Plan-First Gate**: feature/fix modes MUST have `planStatus === "approved"` before implementation starts. If not, redirect to `/sidstack-plan`.
3. Load ONLY the current step's reference file
4. **Follow the approved `solutionPlan`**: implementation must match the plan's approach, files, and scope. Deviations require user approval.
5. Complete each step fully before loading the next
6. Use `AskUserQuestion` at gates for user approval
7. Update SidStack task progress at each step transition
8. Follow project's own conventions detected in Step 0
9. If plan proves wrong during implementation: **STOP**, move task back to `review`, update `solutionPlan` with findings, wait for re-approval
