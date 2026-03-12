# Changelog

## [0.7.1] - 2026-03-12

### Changed
- **MCP Tools reduced 53 → 42:** Removed 11 niche/overlapping tools from MVP whitelist
  - Removed: `macro_run`, `session_save/restore`, `desk_health/conflicts/checkout`, `skill_create/list`, `okr_list/okr_update`, `traceability_matrix`
- **SidMemo full dependency:** `knowledge_search` now SidMemo-only (no keyword fallback)
- **`entity_context` resilience:** Entity-graph mode no longer requires SidMemo (optional overlay)

### Removed
- **`context_packs` handler:** Deleted, replaced by `entity_context` RAG mode
- **`memory_search` handler:** Removed dead code from memory.ts
- **`knowledge_context` handler:** Logic consolidated into `entity_context`
- **`quick_context` macro:** Removed from macros.ts
- **Legacy tool references:** Cleaned up across docs, skills, agents, and templates

### Fixed
- `entity_context` SidMemo regression — entity-graph mode no longer fails without SidMemo
- Tool count inconsistencies across documentation (now consistently 42)
- Missing `knowledge_module_overview` from doc tables
- Stale `session_launch` references in agent command templates
- Duplicate `knowledge_search` line in review-workflow template

## [0.7.0] - 2026-03-06

### Added
- **Context Packs (`context_pack`):** New MCP tool that combines knowledge search + semantic memory + related tasks into a single comprehensive context bundle per module — replaces 3-5 separate tool calls
- **Macro Tools (`macro_run`):** Composite MCP tool with 3 built-in macros:
  - `start_work` — create task + search knowledge + search memory in one call
  - `finish_work` — complete task + store learnings in memory
  - `quick_context` — search knowledge + memory + list active tasks
- **Session Continuity (`session_save` / `session_restore`):** MCP tools to persist and restore session state (decisions, blockers, files modified, progress) across conversations
- **Quality Gate Hook:** PreToolUse hook on `task_complete` that checks test results exist, progress >= 80%, acceptance criteria, and quality commands before allowing completion
- **Smart Session Bootstrap:** Enhanced `session-init.sh` with git branch-to-task correlation, uncommitted changes count, changed modules detection, top pending tasks with priorities, smart next-action suggestions, and automatic session state restore on resume
- **`chore` TaskType:** Added to task type enum for maintenance work
- **CI Deploy:** GitHub Actions workflow for Docker image deployment to GHCR

### Changed
- **Hook Templates:** Full hook configuration now distributed via `sidstack update` — 7 hook scripts (session-init, prompt-context, pre-compact, task-create-context, task-start-training, task-complete-learn, task-complete-gate)
- **Settings Template:** `.claude/settings.json` template updated with all hook registrations including quality gate PreToolUse matcher
- **CLAUDE.md Template:** Simplified governance section, streamlined workflow router, updated tool reference
- **CLI Presets:** Simplified preset configurations (minimal, fullstack-typescript, typescript-backend, python-data)
- **Skill Discovery:** Simplified `SkillDiscovery` class, removed unused methods
- **`sidstack-aware` Skill:** Updated with enhanced workflow classification and progress tracking

### Removed
- **Legacy CLI Skills:** `architecture-understanding`, `code-discovery`, `research-first`, `self-improvement`, `communication-protocol`, `contract-first`, `governance-compliance`, `implementation-analysis`, `workflow-negotiation`
- **Legacy Optional Skills:** `documentation-standards`, `performance-optimization`, `security-awareness`, `tdd-workflow`, `test-driven-development`
- **Dead Code:** `init-wizard.ts`, `skill-manager.ts`, `template-selector.ts`, `migrate-skills.ts`, `config/index.ts`
- **Legacy CLI Skill Files:** `sidstack-init.md` and `packages/cli/skills/core/` directory

### Fixed
- Missing `okr` type in frontend Record maps (CI typecheck)
- Unused imports in test files (CI typecheck)

## [0.6.0] - 2026-03-04

### Added
- **Knowledge RAG Pipeline:** Full retrieval-augmented generation stack
  - Markdown-aware semantic chunker (H2/H3 splits, preserves code blocks/tables/lists)
  - Knowledge indexer with SidMemo vector store integration
  - Hybrid search engine (keyword + vector fusion via Reciprocal Rank Fusion)
  - RAG context builder with deduplication, token truncation, Knowledge Graph enrichment
- **Agent Desk v2:** Persistent worktree-based desk model replacing acquire/release flow
  - `desk_create`, `desk_checkout`, `desk_status`, `desk_health`, `desk_conflicts`, `desk_remove` MCP tools
  - CLI commands: `desk create`, `desk checkout`, `desk status`, `desk health`, `desk conflicts`
- **Repository Layer:** Database abstraction supporting SQLite and PostgreSQL
  - `packages/shared/src/repository/` with IRepository interface, SQLite + Postgres implementations
  - SQLite-to-PostgreSQL migration utilities
- **Socket.IO Real-time Events:** WebSocket server for live task/event broadcasting
- **Web UI Pages:** Dashboard, Activity, Kanban, Impact, Task Detail, Traceability, Training, Settings
- **Skills:** `sidstack-knowledge` and `sidstack-plan` skill templates
- **Docker:** PostgreSQL support, init-db scripts, deploy configs
- **SidMemo Knowledge Graph APIs:** `getEntity()`, `listEntities()`, `getSubgraph()` on SidMemoClient
- **Test Suite:** 70+ new tests across knowledge and memory modules
  - Chunker unit tests (12), SidMemoClient unit tests (19), Indexer unit tests (10)
  - Hybrid search + RAG context tests (17), E2E tests against live SidMemo API (8)
  - Shared test utilities in `__test-utils.ts`

### Changed
- **Knowledge System:** Replaced adapter/service pattern with direct chunker → indexer → hybrid search pipeline
- **Database:** Refactored to repository pattern with PostgreSQL option
- **MCP Agent Desk:** Complete rewrite for Desk v2 (7 tools)
- **MCP Knowledge Tools:** Updated with hybrid search and RAG context
- **MCP Memory Tools:** Exposed Knowledge Graph APIs
- **Desktop Stores:** Simplified `projectStore`, `knowledgeStore`, `taskStore`
- **API Server:** Socket.IO integration, enhanced knowledge/task/ticket routes
- **Docker Compose:** Full stack with PostgreSQL + Caddy reverse proxy
- **Docs:** Updated API reference, getting started, quick start, roadmap

### Removed
- **Knowledge Adapters:** `packages/shared/src/knowledge/adapters.ts` (replaced by RAG pipeline)
- **Knowledge Service:** `packages/shared/src/knowledge/service.ts` (replaced by repository + indexer)
- **Agent Desk v1:** `desk acquire`, `desk add`, `desk init`, `desk release` CLI commands
- **Desktop Dialogs:** `AcquireDeskDialog`, `PoolInitDialog`, `ReleaseDeskDialog`
- **Session Manager Guide:** `docs/guides/session-manager.md`

### Fixed
- Schema consistency test updated with missing `okr` document type

## [0.5.0] - 2026-02-25

### Added
- **Server Deployment:** Docker infrastructure for remote API + MCP Server
  - `docker/api-server/Dockerfile` — API Server container (Express.js + SQLite)
  - `docker/mcp-server/Dockerfile` — MCP Server container (Streamable HTTP mode)
  - `docker/web-ui/Dockerfile` — Web UI container (React SPA + Caddy)
  - `docker/bot-server/Dockerfile` — Bot Server container (SidBot + Gemini)
  - `docker/docker-compose.yml` — Full stack: API + MCP + Bot + Web UI + mem0 + LiteLLM + Caddy
  - `docker/caddy/Caddyfile` — Reverse proxy with auto TLS (Let's Encrypt)
- **Knowledge Sync CLI:** `sidstack knowledge sync` pushes local `.sidstack/knowledge/` files to remote API
  - Supports `--dry-run`, `--json`, `--api-url`, `--api-key` flags
  - Reports created/updated/unchanged/errors
- **Web UI:** Standalone React SPA at `packages/web-ui/` for browser-based access
  - Knowledge browser (list, tree, detail, create, edit, delete, search)
  - Task management (list, detail, update)
  - Ticket management (list, detail, update, convert-to-task)
  - Responsive layout with mobile support
- **Desktop Notifications:** SSE-based real-time notifications from API Server
  - `packages/api-server/src/events.ts` — Server-Sent Events endpoint
  - Event-driven store sync (`useEventSync` hook with 500ms debounce)
  - Notification preferences in project settings
- **Claude Code Launcher:** Launch Claude Code with knowledge context from task detail panel
- **Rate Limiting:** In-memory rate limiter on API Server (100 writes/15min, 600 reads/15min)
- **Remote MCP Config:** `.mcp.json` now supports `streamable-http` transport for remote servers
- **Remote Setup Docs:** QUICK_START.md Option C + CLAUDE_CODE_INTEGRATION.md Option 3
- **Connection Setup:** Desktop app shows server connection screen on first launch
  - Enter Server URL + API Key, test connection before saving
  - Stored in localStorage, injected into all API calls
- **Multi-Project Web UI:** Project selector page at `/` with search
  - Switch between projects from sidebar
- **Bot Server in Docker:** `docker/bot-server/Dockerfile` added to compose stack

### Changed
- **Architecture:** API Server is now the central gateway — all services (MCP, CLI, Desktop, Web UI) connect via HTTP
  - MCP Server calls API Server via `SidStackApiClient` (no direct SQLite access)
  - Updated `technical-design.md` to v3 with remote server topology
- **MCP Server:** Added API fallback for `projectId` resolution when local filesystem unavailable
- **Knowledge Routes:** `resolveProjectId()` gracefully falls back to DB lookup when `detectWorkspace()` fails
- **SSE Auth:** `/api/events/stream` exempted from Bearer token auth (EventSource limitation)
- **TypeScript:** Added `downlevelIteration` to `tsconfig.base.json` for Docker build compatibility
- **.env.example:** Added production/remote server configuration section
- **Desktop App:** No longer auto-starts local API Server — connects to remote server via ConnectionSetup
- **Auth Headers:** All frontend API calls use `apiFetch()` wrapper with auto-injected Bearer token
- **Service Health:** Dynamic URL from connection config (was hardcoded localhost)
- **Hardcoded URLs removed:** All `localhost:19432` references replaced with `getApiBaseUrl()`

### Removed
- Capability registry (`packages/shared/src/capability-registry.ts`)
- External session management (`packages/shared/src/external-session.ts`)
- Session routes from API Server
- Worktree/session UI components from desktop app
- Legacy CLI agent templates and knowledge templates
- Legacy skills (impact-safe, knowledge-first, lesson-detector, training-context)

## [0.4.7] - 2026-02-03

### Fixed
- **Init Re-init:** Preserve existing projectId when running `sidstack init --force`
  - Prevents task/ticket data loss when re-initializing a project
  - Old tasks remain accessible after re-init with different project name

### Changed
- **MCP Config:** Use `@sidstack/mcp-server@latest` in generated `.mcp.json`
  - Projects will automatically use the newest MCP server version
  - No need to manually update version numbers

## [0.4.6] - 2026-02-03

### Fixed
- **NPM Publish:** Fixed workspace:* protocol not being resolved during npm publish
  - Used pnpm publish instead of npm publish to correctly resolve workspace dependencies
  - @sidstack/shared is now correctly referenced as 0.4.6 instead of workspace:*

## [0.4.5] - 2026-02-03

### Fixed
- **NPM Publish:** Fixed broken npm packages missing compiled JavaScript files
  - 0.4.4 was published without dist/*.js files due to stale turbo cache
  - Republished with full build including all .js and .d.ts files

## [0.4.4] - 2026-02-03

### Fixed
- **Skills Format:** Rewrote all SidStack skills to follow skill-creator standard
  - Removed invalid `user-invocable` field from frontmatter
  - Added clear trigger keywords in descriptions
  - Trimmed verbose content for better Claude Code integration

## [0.4.3] - 2026-02-03

### Changed
- **Simplified Init Flow:** Streamlined from 5 questions to 2 setup modes
  - Guided Setup (~10 min): Claude interviews you and generates comprehensive docs
  - Custom Setup (~3 min): Quick install with optional preset and AI scan
- **Removed OpenSpec from init:** OpenSpec is no longer installed by default
- **Improved Tech Stack Detection:** Added PHP/Laravel, Ruby/Rails, Java/Spring, Go detection

### Added
- **Auto-Learning System:** New skills for lesson detection and training context injection
  - `sidstack-lesson-detector`: Suggests creating lessons after debugging
  - `sidstack-training-context`: Auto-injects training at task start
- **Training Command:** `/sidstack:training` for managing incidents, lessons, skills, rules

### Removed
- OpenSpec installation from init wizard
- "Components to install" checkbox
- "Proceed?" confirmation step

## [0.4.2] - 2026-02-03

### Added
- **Linux Build:** Release pipeline now builds `.deb` and `.AppImage` for x86_64 Linux
- **Download Page:** Linux download with `.deb` (primary) and `.AppImage` (alt) options
- **macOS Instructions:** Gatekeeper bypass guide for first-time app launch on macOS

### Fixed
- Block view registration tree-shaking issue in production builds (BlockRegistry refactor)

### Changed
- Updated download page SEO metadata to include Linux
- Updated FinalCTA to reflect Linux platform support

## [0.4.0] - 2026-02-02

### Added
- **Ticket → Delivery Flow:** Complete end-to-end pipeline from ticket intake to task completion
  - Auto-complete linked ticket when task is completed (MCP + API)
  - Ticket-to-task conversion with type mapping (bug→bugfix, feature→feature, etc.)
  - Full E2E integration test covering the entire ticket lifecycle
- **Knowledge System Enhancements:**
  - Knowledge API routes (list, search, get, modules, context)
  - Improved knowledge parser with better frontmatter handling
  - Knowledge service with enhanced search and context building
  - New knowledge adapter types and exports
- **Worktree Management:**
  - Enhanced WorktreeStatusBlockView with overview mode
  - WorktreeOverviewBlockView component
  - Git worktree commands in Tauri backend
  - Improved worktree list UI with tooltips and context menus
- **UI/UX Improvements:**
  - CreateTaskDialog component for Project Hub
  - Improved dialog component with better accessibility
  - Enhanced block navigation with useBlockNavigation hook
  - Better empty states and badge components
  - Improved onboarding modal and progress tracking
  - Settings panel enhancements
- **CLI Improvements:**
  - Refactored init command with modular prompts, verification, and prerequisites
  - Improved doctor command diagnostics
  - Enhanced update command
- **Testing:**
  - Ticket handler smoke tests (11 tests) for MCP server
  - Ticket integration tests (14 tests) for API server
  - Entity reference smoke tests
- **VS Code Extension:** Initial extension scaffold
- **Training Room:** Enhanced training room handlers with feedback support
- **OKR System:** Added Happy Flow objectives (Ticket→Delivery, OKRs→Delivery)

### Fixed
- API server: feature/bugfix/security tasks now correctly reject when missing acceptance criteria
- Task create/update: added `branch` field support for git branch tracking
- Session context builder: improved context injection and role-based filtering
- Knowledge store: better error handling and state management
- Unified context store: improved suggestion and linked content handling

### Changed
- Bumped Tauri app version
- Improved CLAUDE.md governance instructions
- Enhanced npm publish workflow
- Updated task and ticket stores with better type safety

## [0.3.2] - 2026-02-02

### Fixed
- Regenerate oclif manifest with correct version 0.3.2 (was generated at 0.3.0 before version bump, causing version mismatch warning when running via npx)

## [0.3.1] - 2026-02-02

### Changed
- Bump all packages to v0.3.1 for npm publish
- Add oclif manifest to CLI package
- Update shared package dependencies

## [0.3.0] - Initial Public Release - 2026-02-02

### Added
- **Desktop App (Tauri 2.x):** Full desktop application with React frontend
  - Project Hub with capability navigation and goal tracking
  - Task Manager with Kanban, tree, and list views
  - Knowledge Browser with document tree and search
  - Ticket Queue for external ticket intake and conversion
  - Session Manager for launching/tracking Claude Code sessions
  - Training Room for incidents, lessons, skills, and enforcement rules
  - Impact Analysis with risk assessment and gate system
  - Keyboard shortcut help dialog (? or Cmd+/)
  - Getting Started onboarding modal for new users
  - Workspace tab management with multi-project support

- **API Server (Express.js):** REST API on localhost:19432
  - Task CRUD, governance, and completion endpoints
  - Ticket lifecycle (create, review, approve, convert to task)
  - Session launch, tracking, and event logging
  - Knowledge listing, search, and context building
  - Training room (incidents, lessons, skills, rules)
  - Impact analysis with validation and gate approval

- **MCP Server:** 25+ tools for Claude Code integration
  - Knowledge: context, search, list, get, modules
  - Tasks: create, update, list, get, complete (with governance)
  - Impact: analyze, check_gate, list
  - Tickets: create, list, update, convert_to_task
  - Training: lesson_create, rule_check
  - Sessions: session_launch

- **CLI (Oclif v3):** Developer support tool
  - `sidstack init` with AI-powered knowledge bootstrap (`--scan`)
  - Governance show and check commands
  - Knowledge init, create, list commands

- **Governance System:** Agent quality standards
  - 2-role model (Worker, Reviewer)
  - Quality gates (typecheck, lint, test, build)
  - Principles and capability skills
  - Lesson detection and suggestion system

### Technical
- Tauri 2.x backend (Rust + React 19)
- SQLite database (better-sqlite3, embedded)
- Zustand state management
- Tailwind CSS styling

### Security
- CORS restricted to localhost origins only
- Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- SECURITY.md vulnerability reporting policy

### Accessibility
- ARIA roles for menus, trees, tabs, and dialogs
- Keyboard navigation for context menus and tree views
- Focus-visible styles across all interactive elements
- prefers-reduced-motion support
- WCAG AA contrast improvements
