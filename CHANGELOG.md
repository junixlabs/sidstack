# Changelog

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
