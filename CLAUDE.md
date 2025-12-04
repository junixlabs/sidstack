<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

<!-- TASK-MANAGEMENT:START -->
## MANDATORY: Task Management Protocol

**Only create tasks for explicit implementation/code change requests.**

### When to CREATE a task
- User requests a code change, feature, bugfix, refactor, or deployment

### When NOT to create a task
- Questions, discussions, research, planning, auditing without changes

### CRITICAL: Analyze BEFORE creating a task
1. **Understand** - Read the request, clarify if ambiguous
2. **Analyze** - Explore code, identify root cause, understand scope
3. **Plan** - Determine solution approach
4. **Then create** - With substantive description reflecting analysis

### Task creation requirements
- **Title**: `[TYPE] clear imperative description`
- **Description**: Problem statement, root cause, solution approach (min 20 chars)
- **Acceptance criteria**: At least 1 specific, verifiable criterion

### Workflow

| Phase | Action | MCP Tool |
|-------|--------|----------|
| Before | Check existing tasks | `task_list` |
| Before | Analyze the problem | (use Read, Grep, Explore) |
| Before | Create task | `task_create` (projectId: `sidstack`) |
| Start | Mark in_progress | `task_update` (status: `in_progress`) |
| During | Update progress | `task_update` (progress: 0-100) |
| Done | Mark completed | `task_update` (status: `completed`, progress: 100) |
<!-- TASK-MANAGEMENT:END -->

<!-- QUALITY-GATES:START -->
## MANDATORY: Quality Gates Before Task Completion

### Required Checklist
- [ ] `pnpm typecheck` - no new errors
- [ ] `pnpm build` - build succeeds
- [ ] `cargo check` (if Rust changes) - compiles
- [ ] Start the app and verify basic functionality
<!-- QUALITY-GATES:END -->

<!-- LESSON-DETECTION:START -->
## PROACTIVE: Lesson Detection

After fixing bugs or solving non-trivial problems, suggest creating a lesson.

| Trigger | Action |
|---------|--------|
| Bug >30min to debug | Ask: "Create a lesson?" |
| Reusable pattern | Ask: "Document as skill?" |
| Preventable error | Ask: "Create a rule?" |

Flow: `incident_create -> lesson_create -> skill_create -> rule_create`
Rules: Ask first, be selective, use English.
<!-- LESSON-DETECTION:END -->

# SidStack - Claude Code Instructions

## Project Overview

**SidStack** = AI-Powered Project Intelligence Platform

Core mission:
- **Knowledge System** with AI auto-bootstrap for persistent context
- **Impact Analysis** for change risk assessment
- **Task Management** with governance and quality gates
- **Ticket Queue** for external issue intake
- **Training Room** for lessons-learned capture

**Path:** (project root)

## Technology Stack

| Component | Technology |
|-----------|------------|
| Desktop App | Tauri 2.x (Rust + React) |
| MCP Server | TypeScript (@modelcontextprotocol/sdk) |
| API Server | Express.js |
| Database | SQLite (better-sqlite3) |
| State | Zustand (React) |
| Styling | Tailwind CSS |

## Project Structure

```
sidstack/
├── src/                   # React frontend (Tauri)
├── src-tauri/             # Rust backend (Tauri)
├── packages/
│   ├── cli/               # Oclif CLI
│   ├── mcp-server/        # MCP Server for Claude Code
│   ├── api-server/        # REST API
│   └── shared/            # Shared types + SQLite
├── openspec/              # Change proposals
├── docs/                  # Documentation
└── .sidstack/             # Local data (SQLite, configs)
```

## Development Commands

```bash
pnpm install              # Install dependencies
pnpm dev                  # Vite dev server (frontend only)
pnpm tauri:dev            # Full Tauri app (Rust + React)
pnpm tauri:build          # Production build
pnpm packages:build       # Build all packages
pnpm test                 # Run tests
pnpm typecheck            # Type checking
```

## MCP Tools (MVP - 20 tools)

### Knowledge (core value)
| Tool | Purpose |
|------|---------|
| `knowledge_context` | Build context for Claude session |
| `knowledge_search` | Search knowledge docs |
| `knowledge_list` | List available docs |
| `knowledge_get` | Get single document |
| `knowledge_modules` | List modules with stats |

### Tasks (workflow)
| Tool | Purpose |
|------|---------|
| `task_create` | Create task with governance |
| `task_update` | Update status/progress |
| `task_list` | List tasks |
| `task_get` | Get task details |
| `task_complete` | Complete with quality gate check |

### Impact (differentiator)
| Tool | Purpose |
|------|---------|
| `impact_analyze` | Run impact analysis |
| `impact_check_gate` | Check if safe to proceed |
| `impact_list` | List analyses |

### Tickets (intake)
| Tool | Purpose |
|------|---------|
| `ticket_create` | Create ticket |
| `ticket_list` | List/filter tickets |
| `ticket_update` | Update status |
| `ticket_convert_to_task` | Convert to task |

### Training (learning)
| Tool | Purpose |
|------|---------|
| `lesson_create` | Create lesson from incident |
| `rule_check` | Check rules for context |

### Sessions
| Tool | Purpose |
|------|---------|
| `session_launch` | Launch Claude session with role + skills |

## Desktop App - 7 Views

| View | Shortcut | Description |
|------|----------|-------------|
| Project Hub | ⌘1 | Capability tree, entity references |
| Task Manager | ⌘2 | 4 view modes, governance, detail panel |
| Knowledge Browser | ⌘3 | Tree + preview, search, type filtering |
| Ticket Queue | ⌘4 | Status workflow, convert to task |
| Training Room | ⌘5 | Incidents, lessons, skills, rules |
| Settings | ⌘, | Project configuration |
| Worktree Status | - | Git branch/status (via sidebar) |

## Agent Roles (Governance, NOT Orchestration)

| Role | MVP Usage |
|------|-----------|
| **Worker** | Default for implementation. Gets `implement/*` skills. |
| **Reviewer** | For verification. Gets `review/*` skills. |

Key files:
- `packages/shared/src/types.ts` - `AgentRole`, `normalizeRole()`
- `.sidstack/skills/capabilities/` - Role-specific skills

## Governance System

```
.sidstack/
├── governance.md           # Master overview
├── principles/             # MUST follow rules
├── skills/capabilities/    # Role-specific skills
│   ├── implement/          # feature, bugfix, refactor, build-resolve
│   ├── review/             # code, security, performance
│   └── ...
└── workflows/              # End-to-end processes
```

Quality gates (MUST pass before completion):
```bash
pnpm typecheck  # 0 errors
pnpm lint       # 0 errors
pnpm test       # all pass
```

## Impact Analysis

MCP tools: `impact_analyze`, `impact_check_gate`, `impact_list`

Risk rules: Core module modification (high), multiple modules affected (medium), breaking API changes (high), database schema changes (high), security-sensitive code (critical).

Gate status: `blocked` (must resolve), `warning` (can proceed), `clear` (safe).

## Knowledge System

Knowledge sources: `.sidstack/knowledge/` (business logic, API docs, patterns)

Document types: `index`, `business-logic`, `api-endpoint`, `design-pattern`, `database-table`, `module`, `governance`

Context formats: `full` (JSON), `compact` (summary), `claude` (raw markdown)

## Ticket Queue

Status flow: `new -> reviewing -> approved -> in_progress -> completed` (or `rejected`)

MCP tools: `ticket_create`, `ticket_list`, `ticket_update`, `ticket_convert_to_task`

## Guidelines

### DO
1. Use MCP tools for task management
2. Run quality gates before completing tasks
3. Use OpenSpec workflow for significant changes
4. Test locally before commit

### DON'T
1. Add Neo4j, Qdrant, or Go service dependencies
2. Skip quality gates
3. Create tasks without analysis
