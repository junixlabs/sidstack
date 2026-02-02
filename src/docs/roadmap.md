# Roadmap

## Current: v{{version}}

### Desktop App — 7 Views
- [x] Project Hub with capability tree and goal tracking
- [x] Task Manager with List, Kanban, and Timeline views
- [x] Knowledge Browser with tree navigation and search
- [x] Ticket Queue with status workflow and task conversion
- [x] Training Room for incidents, lessons, skills, and rules
- [x] Settings panel
- [x] Worktree Status with git branch management

### MCP Server — 20 Tools
- [x] Knowledge tools (context, search, list, get, modules, create, update, delete, health)
- [x] Task tools (create, update, list, get, complete)
- [x] Impact analysis (analyze, check_gate, list)
- [x] Ticket tools (create, list, update, convert_to_task)
- [x] Training tools (incident_create, lesson_create, skill_create, rule_check)
- [x] Session launch with role-based skill injection

### CLI
- [x] `sidstack init` with governance templates
- [x] `sidstack init --scan` for AI-powered knowledge generation
- [x] Knowledge management (list, create, validate, init, templates)
- [x] Governance commands (show, check)
- [x] Skill management (list, show, add, create, remove, update, eject, validate)
- [x] Diagnostics (`sidstack doctor`)

### Integrations
- [x] Ticket-to-task conversion with auto-complete
- [x] OKR tracking system
- [x] VS Code extension (initial scaffold)

---

## Planned

### Knowledge Editor
- [ ] Rich markdown editor in desktop app
- [ ] Auto-save and version tracking
- [ ] Code reference linking from knowledge to source files

### Cross-Platform
- [ ] Linux support
- [ ] Windows support

### External Integrations
- [ ] Jira webhook intake
- [ ] GitHub Issues sync
- [ ] Linear integration

### AI Enhancements
- [ ] Auto-knowledge generation from codebase changes
- [ ] Smart impact analysis with historical data
- [ ] Skill recommendations based on task patterns

---

## Design Principles

1. **Governance-First** — Quality gates and role separation, not agent orchestration
2. **Knowledge-Driven** — Persistent context that survives between sessions
3. **Local-First** — No cloud dependencies, no telemetry, your data stays yours
4. **MCP-Native** — Built for Claude Code integration via Model Context Protocol

---

## Out of Scope (Current)

- Cloud sync and multi-user collaboration
- Real-time co-editing
- Non-Claude AI tool integrations

---

## Feedback

Have suggestions? Open an issue on [GitHub](https://github.com/junixlabs/sidstack).
