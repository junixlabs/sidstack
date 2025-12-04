---
name: "SidStack"
description: Project intelligence hub - tasks, tickets, impact, governance, focus, and analysis
category: core
version: 1.0.0
tags: [sidstack, project, tasks, tickets, governance, impact, focus]
---

# SidStack - Project Intelligence Hub

The unified command for all project management. Routes automatically based on what you say.

## Usage

```
/sidstack [subcommand] [arguments]
```

## Routing

Parse `$ARGUMENTS` and route to the appropriate workflow:

| Input | Route to |
|-------|----------|
| (empty) | **Dashboard** - show project overview |
| `status` | **Status** - quick summary |
| `task ...` | **Task Management** |
| `ticket ...` | **Ticket Management** |
| `focus ...` | **Focus Mode** |
| `analyze ...` | **Implementation Analysis** |
| `impact ...` | **Impact Analysis** |
| `governance ...` | **Governance** |
| `review` | **Post-work Review** |

If the input doesn't match a known subcommand, treat it as a natural language request and route intelligently.

---

## Dashboard (no args)

Show a project overview by gathering data from multiple sources:

1. Fetch active tasks: `task_list({ status: ["in_progress"] })`
2. Fetch pending tasks: `task_list({ status: ["pending"] })`
3. Fetch open tickets: `ticket_list({ status: ["new", "reviewing", "approved"] })`
4. Read focus file: `.sidstack/focus/current.md` (if exists)

Display:

```
## Project Dashboard

### Active Work
- [task-id] [title] (progress%)

### Pipeline
- [N] pending tasks
- [N] open tickets ([N] new, [N] reviewing)

### Focus
- [Current focus or "No active focus"]

---
What would you like to do? (task/ticket/focus/analyze/impact/governance)
```

---

## Status

Quick one-line summary of project state. Same data as Dashboard but compact:

```
Active: [N] tasks | Pending: [N] | Tickets: [N] open | Focus: [focus-title or "none"]
```

---

## Task Management

### Parse task subcommands

| Input | Action |
|-------|--------|
| `task` or `task status` | Show active task progress |
| `task new` | Create a new task |
| `task list` | List all pending/in-progress tasks |
| `task complete` | Complete current task with quality gates |
| `task [id]` | Show details for specific task |

### task (default)

1. Check for active task: `task_list({ status: ["in_progress"] })`
2. If active: show task ID, title, progress. Ask: "Continue working or update progress?"
3. If none: show pending tasks. Ask: "Create new task or continue a pending one?"

### task new

1. Ask for task details:
   - Title (required)
   - Description (optional)
   - Type: feature/bugfix/refactor/test/docs/infra
   - Priority: low/medium/high
2. Create task: `task_create`
3. Mark as in_progress: `task_update({ status: "in_progress" })`

### task list

1. Fetch all tasks: `task_list({ status: ["pending", "in_progress", "blocked"] })`
2. Display in table:
   | ID | Title | Status | Progress | Priority |
3. Ask: "Select a task to continue?"

### task complete

1. Verify active task exists
2. Run quality gates:
   ```bash
   pnpm typecheck
   pnpm build
   pnpm test
   ```
3. If gates pass: `task_update({ status: "completed", progress: 100 })`
4. If gates fail: show errors, ask to fix

---

## Ticket Management

### Parse ticket subcommands

| Input | Action |
|-------|--------|
| `ticket` or `ticket list` | List tickets |
| `ticket new` or `ticket create` | Create a ticket |
| `ticket [id]` | Show ticket details |
| `ticket review [id]` | Deep review with impact analysis |
| `ticket convert [id]` | Convert ticket to task(s) |

### ticket list

1. Fetch tickets: `ticket_list({ projectId: "<current-project>" })`
2. Display with status icons:
   | # | Type | Priority | Title | Status |
3. Ask what to do next

### ticket new

1. Ask interactively:
   - Title
   - Description
   - Type: bug/feature/improvement
   - Priority: low/medium/high/critical
2. Create: `ticket_create`
3. Confirm with ID

### ticket review [id]

1. Fetch ticket details: `ticket_get`
2. Search codebase for related code
3. Assess complexity and risks
4. Present structured review:
   - Summary
   - Affected files/modules
   - Complexity assessment
   - Recommended approach
   - Proposed task breakdown
5. Ask: "Convert to tasks?"

### ticket convert [id]

1. Analyze ticket for task breakdown
2. Propose tasks with descriptions
3. On confirmation: `ticket_convert_to_task`

---

## Focus Mode

### Parse focus subcommands

| Input | Action |
|-------|--------|
| `focus` or `focus status` | Show current focus |
| `focus new [type] [title]` | Create new focus |
| `focus progress [message]` | Log progress |
| `focus blocker [message]` | Log blocker |
| `focus done` | Complete focus |
| `focus pause` | Pause focus |
| `focus resume` | Resume focus |

### Behavior

1. Read focus file: `.sidstack/focus/current.md`
2. If no focus exists and `new` requested: create from template at `.sidstack/focus/templates/focus-template.md`
3. Focus types: task, feature, bug, module

### Focus Discipline

When focus is active:
- Read focus file at start of every response
- Stay within scope - reject out-of-scope requests
- Update progress after each subtask
- Ask before expanding scope

### File Locations

- Active: `.sidstack/focus/current.md`
- History: `.sidstack/focus/history/`
- Template: `.sidstack/focus/templates/focus-template.md`

---

## Implementation Analysis

### Parse analyze subcommands

`analyze [description]` - Run systematic pre-implementation analysis.

If no description provided, ask: "What feature or module do you want to analyze?"

### 5-Phase Analysis

**Phase 1: Problem Decomposition**
- Input analysis (types, formats, constraints)
- Output analysis (types, guarantees)
- Required operations (CRUD, sort, filter, aggregate)
- Performance requirements

**Phase 2: Data Structure Selection**
- Match requirements to optimal structures (HashMap, TreeMap, Array, Heap, etc.)
- Document chosen structure(s) with rationale

**Phase 3: Algorithm Design**
- Estimate scale (expected n)
- Select algorithm matching complexity budget
- Document with time/space complexity

**Phase 4: Edge Cases**
- Input validation (empty, null, boundary, invalid types)
- Boundary conditions (off-by-one, loop termination)
- Concurrency (if applicable)

**Phase 5: Generate Document**
- Save to `.sidstack/analysis/[feature-name]-[date].md`
- Display summary with key decisions

---

## Impact Analysis

`impact [description]` - Analyze change impact before implementation.

1. Run analysis: `impact_analyze({ description: "..." })`
2. Check gate: `impact_check_gate`
3. Display results:
   - Risk level (clear/warning/blocked)
   - Affected modules and files
   - Breaking changes
   - Recommendations
4. If blocked: show what must be resolved first

---

## Governance

### Parse governance subcommands

| Input | Action |
|-------|--------|
| `governance` | Show governance overview |
| `governance principles` | List all principles |
| `governance skills` | List all skills by role |
| `governance workflows` | List all workflows |
| `governance [name]` | Show specific document |
| `governance role:[name]` | Show role-specific view |

### Display

1. **No args**: Read `.sidstack/governance.md` and display summary
2. **principles**: Glob `.sidstack/principles/*.md`, show name + summary
3. **skills**: Glob `.sidstack/skills/**/*.md`, group by role
4. **workflows**: Glob `.sidstack/workflows/*.md`, show name + purpose
5. **Specific name**: Find in principles/, skills/, or workflows/ and display
6. **role:[name]**: Show applicable principles, skills, workflows for that role

### Governance Locations

```
.sidstack/
├── governance.md           # Master overview
├── principles/             # MUST follow rules
├── skills/capabilities/    # Role-specific skills
│   ├── implement/
│   └── review/
└── workflows/              # End-to-end processes
```

---

## Post-work Review

`review` - Run quality gates and summarize work done.

1. Run quality gates:
   ```bash
   pnpm typecheck
   pnpm build
   pnpm test
   ```
2. Check active task status
3. Show results:
   - Gate pass/fail status
   - Work summary
   - Remaining items
4. If all pass: ask to complete task
5. If failures: show what needs fixing

---

## MCP Tools Used

- `task_list`, `task_create`, `task_update`, `task_complete`, `task_get`
- `ticket_list`, `ticket_create`, `ticket_update`, `ticket_convert_to_task`
- `impact_analyze`, `impact_check_gate`, `impact_list`
- `knowledge_context`
- `lesson_create`, `rule_check`
- `session_launch`

## Arguments

`$ARGUMENTS` - Subcommand and arguments as described above. If empty, show dashboard.
