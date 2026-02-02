# SidStack

[![CI](https://github.com/junixlabs/sidstack/actions/workflows/ci.yml/badge.svg)](https://github.com/junixlabs/sidstack/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.3.2-blue.svg)](https://github.com/junixlabs/sidstack/releases)

**Knowledge-powered AI coding assistant.** Structured project knowledge, impact analysis, and governance for Claude Code.

Local-first. SQLite-based. Zero external dependencies.

## What It Does

| Feature | Description |
|---------|-------------|
| **Knowledge System** | Structured project docs (`.sidstack/knowledge/`) that make every Claude session smarter |
| **AI Auto-Bootstrap** | `init --scan` analyzes your codebase and generates knowledge docs automatically |
| **Impact Analysis** | Assess scope, risks, and blockers before making changes |
| **Task Management** | Track AI work with governance and quality gates |
| **Ticket Queue** | Intake external tickets, review, convert to tasks |
| **Training Room** | Capture lessons from incidents, build rules over time |

## Quick Start

### MCP Server (Claude Code)

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "sidstack": {
      "command": "npx",
      "args": ["-y", "@sidstack/mcp-server"]
    }
  }
}
```

Initialize and scan your project:

```bash
npx @sidstack/cli init --scan
```

Claude Code now has access to 20 MCP tools for knowledge, tasks, impact analysis, tickets, and training.

### Desktop App (macOS)

Download the `.dmg` from [Releases](https://github.com/junixlabs/sidstack/releases).

Or build from source:

```bash
git clone https://github.com/junixlabs/sidstack.git
cd sidstack
pnpm install && pnpm packages:build && pnpm tauri:build
```

See [Quick Start Guide](docs/QUICK_START.md) for full setup instructions.

## MCP Tools

```
# Knowledge - understand your project
knowledge_context     Build context for a task/module
knowledge_search      Search across knowledge docs
knowledge_list        List available docs
knowledge_modules     List modules with stats

# Tasks - track AI work
task_create           Create task with governance
task_update           Update status/progress
task_list             List tasks
task_complete         Complete with quality gate check

# Impact Analysis - assess risk
impact_analyze        Run impact analysis on a change
impact_check_gate     Check gate status (blocked/warning/clear)
impact_list           List analyses

# Tickets - external intake
ticket_create         Create ticket
ticket_list           List/filter tickets
ticket_update         Update status
ticket_convert_to_task Convert to task

# Training - learn from mistakes
lesson_create         Create lesson from incident
rule_check            Check rules for context

# Sessions
session_launch        Launch Claude session with context
```

## Desktop App - 7 Views

| View | Shortcut | Description |
|------|----------|-------------|
| Project Hub | `Cmd+1` | Capability tree, entity connections |
| Task Manager | `Cmd+2` | List, kanban, timeline, detail views |
| Knowledge Browser | `Cmd+3` | Tree view, search, type filtering |
| Ticket Queue | `Cmd+4` | Status workflow, convert to tasks |
| Training Room | `Cmd+5` | Incidents, lessons, skills, rules |
| Settings | `Cmd+,` | Project configuration |
| Worktree Status | - | Git branch and file status |

## Architecture

```
sidstack/
├── src/                   # React frontend (Tauri)
├── src-tauri/             # Rust backend (Tauri)
├── packages/
│   ├── mcp-server/        # MCP Server (standalone, npx-ready)
│   ├── api-server/        # REST API (Express.js)
│   ├── cli/               # Oclif CLI
│   └── shared/            # SQLite + shared types + impact engine
├── .sidstack/             # Governance, knowledge, skills
│   ├── governance.md      # Master governance doc
│   ├── knowledge/         # Project knowledge docs
│   ├── skills/            # Capability skills (implement, review, deploy)
│   └── principles/        # Quality standards
└── docs/                  # Documentation
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Desktop App | Tauri 2.x (Rust + React) |
| Frontend | React 19, Tailwind CSS, Zustand |
| Database | SQLite (better-sqlite3, embedded) |
| MCP Server | @modelcontextprotocol/sdk |
| CLI | Oclif v3 (TypeScript) |
| API Server | Express.js |

## Development

```bash
pnpm install               # Install dependencies
pnpm dev                   # Vite dev server (frontend)
pnpm tauri:dev             # Full Tauri app (Rust + React)
pnpm packages:build        # Build all packages
pnpm test                  # Run tests
pnpm typecheck             # TypeScript check
```

## Documentation

- [Quick Start](docs/QUICK_START.md) - Setup guide for MCP and Desktop
- [Claude Code Integration](docs/CLAUDE_CODE_INTEGRATION.md) - MCP configuration
- [API Reference](docs/API_REFERENCE.md) - REST API documentation

## License

MIT
