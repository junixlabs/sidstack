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
Task lifecycle, quality gates, lesson detection: managed by `sidstack-aware` skill. Use `/sidstack-dev` for structured workflows. SidStack MCP tasks (`mcp__sidstack__task_*`) for persistence; built-in tasks for session-local sub-steps only.

**Integrated workflow — always follow this pattern:**
1. **Before work:** `knowledge_search` + `memory_search` → find context. `entity_link` → link relevant docs to task.
2. **During work:** `entity_context` → get linked context. `task_update` → track progress.
3. **After work:** `test_result_create` → persist test results. `memory_add` → store learnings. `task_complete` → finish.
<!-- GOVERNANCE:END -->

# SidStack - Claude Code Instructions

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
│   ├── api-server/        # REST API
│   └── shared/            # Shared types + SQLite
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

**MCP Tools:** knowledge (5), tasks (5), impact (3), tickets (4), training (2) — 19 core tools.
**Agents:** Worker (`sidstack-worker`) for implementation, Reviewer (`sidstack-reviewer`) for verification. Skills auto-trigger per role.
**Knowledge:** `.sidstack/knowledge/` in 9 categories (`00-context` through `08-incidents`).
**Impact:** `impact_analyze` → `impact_check_gate`. Gates: `blocked`, `warning`, `clear`.
**Tickets:** `new → reviewing → approved → in_progress → completed` (or `rejected`).

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
