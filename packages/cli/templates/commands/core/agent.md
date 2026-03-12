---
name: "SidStack: Agent"
description: Spawn a governed agent with role-specific skills and principles
category: core
version: 2.0.0
tags: [sidstack, agent, spawn, governance]
---

# SidStack Agent

Spawn governed agents using Claude Code's Agent tool with role-specific context.

## Usage

```
/sidstack:agent [role] [task description]
```

**Roles:**
- `worker` — Implementation (features, bugs, refactoring)
- `reviewer` — Review (code, security, performance)

## Instructions

### Step 1: Parse Arguments

From `$ARGUMENTS`:
1. **Role** — First word (worker/reviewer)
2. **Task** — Remaining text

If role missing, ask user.

### Step 2: Load Context

1. Fetch active task: `task_list({ preset: "actionable" })`
2. Load context: `entity_context({ entityType: "task", entityId: taskId })`
3. Load agent definition from `.claude/agents/sidstack-{role}.md`

### Step 3: Spawn Agent

Use Claude Code's Agent tool with the role-specific agent definition (`subagent_type: "sidstack-worker"` or `"sidstack-reviewer"`).

The agent will automatically follow:
- Role-specific skills
- Governance principles
- Quality gates

### Step 4: Confirm

Report agent spawn status to user.

## When to Spawn

- **Parallel work** — Multiple independent modules
- **Independent review** — Fresh perspective on code
- **Token exhaustion** — Long sessions need fresh context

## When NOT to Spawn

- Single task that fits in current context
- Just because "that's how human orgs work"
- For simple questions or small fixes

## Arguments

`$ARGUMENTS` — Role and task description.
