---
name: "SidStack: Agent"
description: Spawn a governed agent session with role-specific context
category: core
version: 2.0.0
tags: [sidstack, agent, spawn, governance]
---

# SidStack Agent

Spawn governed agent sessions using MCP `session_launch`.

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

### Step 2: Launch Session

Use MCP `session_launch` with role and task:

```
session_launch({
  projectDir: ".",
  taskId: "[task-id if known]",
  prompt: "[task description]",
  mode: "normal"
})
```

The session will automatically include:
- Role-specific skills
- Governance principles
- Quality gates

### Step 3: Confirm

Report session launch status to user.

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
