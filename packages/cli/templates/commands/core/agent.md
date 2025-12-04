---
name: "SidStack: Agent"
description: Spawn a governed agent with role-specific skills and principles
category: core
version: 2.0.0
tags: [sidstack, agent, spawn, governance]
---

# SidStack Agent Spawner

Spawn agents with governance compliance baked in.

## Usage

```
/sidstack:agent [role] [task description]
```

**Roles:**
- `worker` - Implementation agent (features, bugs, design, tests)
- `reviewer` - Review agent (code review, security audit, verification)

## Instructions

### Step 1: Parse Arguments

From `$ARGUMENTS`, extract:
1. **Role** - First word (worker, reviewer)
2. **Task** - Remaining text

If role is missing or invalid, ask user to specify.

### Step 2: Load Governance Context

**For Worker agent:**
```bash
# Principles
Read .sidstack/principles/code-quality.md
Read .sidstack/principles/testing.md
Read .sidstack/principles/security.md
Read .sidstack/principles/task-management.md

# Capability Skills (based on task type)
Read .sidstack/skills/capabilities/implement/feature.md
Read .sidstack/skills/capabilities/implement/bugfix.md
Read .sidstack/skills/capabilities/design/architecture.md

# Always include
Read .sidstack/skills/shared/handoff-simple.md
Read .sidstack/skills/shared/lesson-detection.md
```

**For Reviewer agent:**
```bash
# Principles
Read .sidstack/principles/testing.md
Read .sidstack/principles/security.md
Read .sidstack/principles/task-management.md

# Capability Skills
Read .sidstack/skills/capabilities/review/code.md
Read .sidstack/skills/capabilities/review/security.md
Read .sidstack/skills/capabilities/review/performance.md

# Always include
Read .sidstack/skills/shared/handoff-simple.md
```

### Step 3: Create Agent Prompt

Generate a prompt that includes:

```markdown
# [Role] Agent - Governance Enabled

## Your Role
[Worker: You implement features, fix bugs, design systems, and write tests.]
[Reviewer: You review code independently, focusing on quality, security, and performance.]

## Your Task
[Task description from arguments]

## Governance Context

### Principles You MUST Follow
[Summarize key rules from loaded principles]

### Your Capability Process
[Include step-by-step from appropriate capability skill]

### Quality Gates
Before marking complete, you MUST:
- [ ] Run `pnpm typecheck` - 0 errors
- [ ] Run `pnpm lint` - 0 errors
- [ ] Run `pnpm test` - all pass

### Handoff (Simplified)
When complete, use this format:
\```markdown
## Handoff: [Role] -> [Next Role]

**Task:** [task-id] - [title]
**Status:** [Ready for review | Complete]
**Files:** [list]
**Test:** `pnpm test [path]`
**Notes:** [1-2 sentences]
\```

## Begin Work
Read the codebase to understand context, then follow your capability process.
```

### Step 4: Output Agent Instructions

Display the complete agent instructions so user can:
1. Copy to a new Claude Code terminal
2. Or use with MCP `terminal_spawn`

## Key Principle

> **"Spawn when genuinely needed, not because human orgs do it that way"**

- Spawn for **parallel work** (multiple modules)
- Spawn for **independent review** (quality gate)
- Spawn for **fresh context** (token exhaustion)
- **Don't spawn** just to match human roles

## Notes

- This command generates instructions only - it doesn't spawn terminals
- User should copy output to a new Claude Code session
- For auto-spawning, use MCP `terminal_spawn` with the generated prompt
- Worker can do feature + test + docs in single session (no need to split)
