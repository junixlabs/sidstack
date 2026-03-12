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

<!-- GOVERNANCE:START -->
## Governance
Task lifecycle, quality gates, lesson detection: managed by `sidstack-aware` skill. Every request is **classified by intent first** (via Workflow Router + sidstack-aware skill), then routed to the correct workflow. Use `/sidstack-dev` for explicit structured workflows. SidStack MCP tasks (`mcp__sidstack__task_*`) for persistence; built-in tasks for session-local sub-steps only.

**Integrated workflow — always follow this pattern:**
1. **Before work:** `knowledge_search` → find context. `entity_link` → link relevant docs to task.
2. **During work:** `entity_context` → get linked context. `task_update` → track progress.
3. **After work:** `test_result_create` → persist test results. `memory_add` → store learnings. `task_complete` → finish.
<!-- GOVERNANCE:END -->

# SidStack - Claude Code Instructions

## SidStack Governance

This project uses **SidStack** for task tracking, knowledge management, and quality enforcement.

---

## CRITICAL RULES

**1. QUALITY BEFORE COMPLETE**
- Run project's test/build commands before marking task done
- Verify the change works at runtime (not just static checks)
- Never mark completed if tests fail

**2. ASK WHEN UNCLEAR**
- Don't guess requirements - ask the user
- Don't assume scope - clarify before expanding

---

## Session Start

At the beginning of each session, check for active work:
```
task_list({ projectId: "sidstack", preset: "actionable" })
```
If there's an in_progress task, resume it. Otherwise, show pending tasks.

---

## Workflow Router

Classify every user request before acting. Match **semantic intent**, not keywords.

| User wants to... | Workflow | Action |
|-----------------|----------|--------|
| Ask, discuss, explore ideas | **discuss** | Answer directly. No task needed. |
| Create, list, or check task status | **track** | `task_list` / `task_create` / `task_update` only |
| Fix critical production issue NOW | **hotfix** | `task_create(bugfix, critical)` → `/sidstack-dev hotfix` |
| Fix a bug, error, broken behavior | **bugfix** | `task_create(bugfix)` → `/sidstack-dev fix` |
| Build new feature or capability | **implement** | `task_create(feature)` → `/sidstack-dev feature` |
| Refactor, optimize, clean up code | **improve** | `task_create(refactor/perf/debt)` → `/sidstack-dev feature` |
| Review code or audit existing work | **review** | `/sidstack-dev review` |
| Process a ticket from queue | **ticket** | `/sidstack ticket <id>` |
| Build or update documentation/knowledge | **knowledge** | `/sidstack-knowledge` |
| Record lessons from incidents | **learn** | `incident_create` → `lesson_create` |

### Classification Rules

1. **Intent over keywords.** "Fix the tests" = bugfix. "Add tests" = implement. "Why do tests fail?" = discuss.
2. **Urgency splits hotfix from bugfix.** Hotfix = production is broken NOW. Bugfix = known issue, can plan.
3. **Any language.** Classify by meaning — works in Vietnamese, English, etc.
4. **When ambiguous** — ask user: "This could be [X] or [Y], which fits?"
5. **Explicit `/sidstack-dev` always wins** over this router.

### Task Size → Flow Depth

| Size | Criteria | Flow |
|------|----------|------|
| **Trivial** | Typo, config, <5 lines | No task. Just do it. |
| **Small** | Bug fix, single-file | `task_create` → implement → `task_complete` |
| **Medium** | Multi-file feature | `task_create` → `entity_context` → implement → test → `task_complete` |
| **Large** | Architecture change | `/sidstack-dev feature` (full 4-step with plan review) |

---

## Project Overview
**SidStack** = AI-Powered Project Intelligence Platform
Core: Knowledge System, Impact Analysis, Task Management, Ticket Queue, Training Room.

## Technology Stack
Tauri 2.x (Rust + React) desktop | TypeScript MCP server | Express.js API | SQLite (better-sqlite3) | Zustand | Tailwind CSS

## Database Architecture
**GLOBAL only** — `~/.sidstack/sidstack.db` shared by all projects (`projectId` field). Project-local: `.sidstack/` (config, knowledge). **DO NOT** create per-project databases.

## Project Structure

```
sidstack/
├── src/                   # React frontend (Tauri)
├── src-tauri/             # Rust backend (Tauri)
├── packages/
│   ├── cli/               # Oclif CLI
│   ├── mcp-server/        # MCP Server for Claude Code
│   ├── api-server/        # REST API (central gateway)
│   ├── bot-server/        # SidBot (Gemini intent router)
│   ├── web-ui/            # React SPA (browser access)
│   └── shared/            # Shared types + SQLite
├── docker/                # Docker deployment configs
├── openspec/              # Change proposals
├── docs/                  # Documentation
└── .sidstack/             # Local data (configs, knowledge)
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

## Architecture Reference

**MCP Tools:** knowledge (9), tasks (5), impact (3), tickets (4), training (6), test results (3), agent desk (4), memory (5), entity refs (3) — 42 tools.
**Agents:** Worker (`sidstack-worker`) for implementation, Reviewer (`sidstack-reviewer`) for verification. Skills auto-trigger per role.
**Knowledge:** `.sidstack/knowledge/` in 9 categories (`00-context` through `08-incidents`).
**Impact:** `impact_analyze` → `impact_check_gate`. Gates: `blocked`, `warning`, `clear`.
**Tickets:** `new → reviewing → approved → in_progress → completed` (or `rejected`).

---

## SidStack Tools Reference

| Workflow Moment | Tool | Purpose |
|----------------|------|---------|
| **Starting Work** | `task_list(preset: "actionable")` | See what needs doing |
| | `entity_context(entityType: "task", entityId: taskId)` | Load ALL linked context in one call |
| | `task_create(projectId, title, taskType)` | Create new task |
| **During Work** | `task_update(taskId, progress: 0-100)` | Track progress |
| | `impact_analyze(description, targetFiles)` | Before touching core/risky code |
| | `knowledge_search(query)` | Find project patterns, docs |
| **Finishing Work** | `task_complete(taskId)` | After quality gates pass |
| | `memory_add(content, projectId)` | Store learnings for future |
| | `lesson_create(...)` | After fixing tricky bugs (ask user first) |

> **Tip:** `entity_context` loads everything linked to a task (knowledge, memory, references) in one call — use it instead of calling `knowledge_search` + `entity_references` separately. It also supports RAG mode with `projectPath` + `query`/`moduleId`.

---

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/sidstack` | Dashboard - tasks, tickets, focus, governance |
| `/sidstack:knowledge` | Knowledge system - search, explore, build context |
| `/sidstack:agent` | Spawn governed agent (worker/reviewer) |

---

## Quality Checks

Run before completing any task:
```bash
pnpm test
pnpm packages:build
pnpm typecheck
```

---

## Common Mistakes to Avoid

| Mistake | Consequence | Correct Approach |
|---------|-------------|------------------|
| Skip task_create for "quick fix" | No audit trail, no acceptance criteria | Always create task, even for small changes |
| Mark complete before testing | Broken code merged | Run tests + verify runtime first |
| Expand scope without asking | Wasted effort, wrong direction | Clarify with user before expanding |
| Ignore existing knowledge | Reinvent patterns, miss constraints | Call `knowledge_search` before implementing |

---

## Task Systems: SidStack MCP vs Built-in

| System | Use For |
|--------|---------|
| **SidStack MCP** (`mcp__sidstack__task_*`) | Governance, quality gates, cross-session persistence |
| **Built-in** (`TaskCreate/TaskUpdate`) | Session-local sub-step coordination |

Rule: Always create the SidStack MCP task first (for governance), then optionally use built-in tasks for sub-steps.

---

## Agent Teams

For multi-agent orchestration with Worker + Reviewer teammates:
- Use `/sidstack:agent` slash command to spawn governed agents
- See `.sidstack/governance.md` for spawn templates and orchestration workflow

---

<!-- DOCUMENTATION-DISCIPLINE:START -->
## MANDATORY: Documentation Discipline

### Session Continuity
- **Read `JOURNAL.md`** at session start for recent context
- **Write to `JOURNAL.md`** after significant changes (features, architecture, non-trivial fixes)
- Entry format: date, what changed, which files, why, decisions made

### Changelog
- **Update `CHANGELOG.md`** when bumping versions
- Follow [Keep a Changelog](https://keepachangelog.com) format: Added, Changed, Fixed, Removed, Security

### Commit Messages
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`
- Include context in commit body for non-obvious changes
<!-- DOCUMENTATION-DISCIPLINE:END -->

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

---

## More Details

For comprehensive governance documentation:
- `.sidstack/governance.md` - Full governance rules, agent teams guide
- `.claude/skills/` - Auto-triggered Claude Code skills
- `.claude/agents/` - Role-specific agent definitions (Worker, Reviewer)
