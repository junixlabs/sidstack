# Changelog

All notable changes to SidStack are documented here.

---

## [1.0.0] - 2026-02-01

### Added

#### Desktop App (7 Views)
- **Project Hub** - Capability tree, entity connections, project overview
- **Task Manager** - List, kanban, timeline, and detail views with governance
- **Knowledge Browser** - Browse and search project documentation
- **Ticket Queue** - External ticket intake, review workflow, convert to tasks
- **Training Room** - Incidents, lessons, skills, rules
- **Settings** - Project configuration
- **Worktree Status** - Git branch and file status

#### MCP Server (20 Tools)
- Knowledge: context, search, list, get, modules
- Tasks: create, update, list, get, complete (with governance)
- Impact: analyze, check_gate, list
- Tickets: create, list, update, convert_to_task
- Training: lesson_create, rule_check
- Sessions: session_launch

#### CLI
- `sidstack init` - Initialize project with governance templates
- `sidstack init --scan` - AI-powered knowledge generation
- Governance commands (show, check)
- Knowledge commands (list, create, templates)
- JSON output mode (`--json`) for all commands

#### Governance System
- 2-role model (Worker, Reviewer)
- Quality gates (typecheck, lint, test, build)
- 8 principles, 17 capability skills
- Task validation with 6 rules
- Violation logging and audit trail

### Technical
- Tauri 2.x backend (Rust)
- React 19 frontend with Tailwind CSS
- SQLite database (better-sqlite3)
- MCP Server (@modelcontextprotocol/sdk)
- Oclif v3 CLI framework

---

## [0.9.0] - 2026-01-15

### Added
- Initial terminal block view
- Basic workspace management
- OpenSpec integration

---

## [0.8.0] - 2026-01-10

### Added
- Workspace tabs
- Multi-workspace support
- Session persistence

---

## Future Plans

See [Roadmap](roadmap.md) for upcoming features.
