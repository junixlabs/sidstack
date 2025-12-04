# Changelog

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
