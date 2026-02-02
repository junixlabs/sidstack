# SidStack

[![CI](https://github.com/junixlabs/sidstack/actions/workflows/ci.yml/badge.svg)](https://github.com/junixlabs/sidstack/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@sidstack/cli.svg)](https://www.npmjs.com/package/@sidstack/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**AI-Powered Project Intelligence Platform.** Structured knowledge, impact analysis, governance, and training for Claude Code.

Local-first. SQLite-based. No external services required.

## What It Does

| Feature | Description |
|---------|-------------|
| **Knowledge System** | Structured project docs (`.sidstack/knowledge/`) that give every Claude session full context |
| **AI Auto-Bootstrap** | `init --scan` analyzes your codebase and generates knowledge docs automatically |
| **Impact Analysis** | Assess scope, risks, and blockers before making changes |
| **Task Management** | Track AI work with governance and quality gates |
| **Ticket Queue** | Intake external tickets, review, convert to tasks |
| **Training Room** | Capture lessons from incidents, build reusable skills and rules |
| **OKRs** | Define project goals, track progress through task completion |

## Quick Start

### MCP Server (Claude Code)

Initialize your project — this sets up governance, MCP config, and optionally generates knowledge docs with AI:

```bash
npx @sidstack/cli init --scan
```

Or configure MCP manually:

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

Claude Code now has access to 32 MCP tools for knowledge, tasks, impact analysis, tickets, training, and OKRs.

### Desktop App (macOS)

Download the `.dmg` from [Releases](https://github.com/junixlabs/sidstack/releases).

Or build from source:

```bash
git clone https://github.com/junixlabs/sidstack.git
cd sidstack
pnpm install && pnpm packages:build && pnpm tauri:build
```

See [Quick Start Guide](docs/QUICK_START.md) for full setup instructions.

## MCP Tools (32)

```
# Knowledge (9) - understand your project
knowledge_context       Build context for a task/module
knowledge_search        Search across knowledge docs
knowledge_list          List available docs
knowledge_get           Get single document with full content
knowledge_modules       List modules with stats
knowledge_create        Create knowledge document
knowledge_update        Update knowledge document
knowledge_delete        Delete knowledge document
knowledge_health        Check knowledge coverage health

# Tasks (5) - track AI work
task_create             Create task with governance
task_update             Update status/progress
task_list               List tasks with filtering
task_get                Get task details
task_complete           Complete with quality gate check

# Impact Analysis (3) - assess risk
impact_analyze          Run impact analysis on a change
impact_check_gate       Check gate status (blocked/warning/clear)
impact_list             List analyses

# Tickets (4) - external intake
ticket_create           Create ticket
ticket_list             List/filter tickets
ticket_update           Update status
ticket_convert_to_task  Convert to task

# Training (8) - learn from mistakes
incident_create         Report an incident
incident_list           List incidents
lesson_create           Create lesson from incident
lesson_list             List lessons
skill_create            Create reusable skill
skill_list              List skills
rule_check              Check rules for context
training_context_get    Get training context for session

# OKRs (2) - project goals
okr_list                List objectives and key results
okr_update              Update key result progress

# Sessions (1)
session_launch          Launch Claude session with context
```

## Desktop App - 7 Views

| View | Shortcut | Description |
|------|----------|-------------|
| Project Hub | `Cmd+1` | Capability tree, entity connections, OKR progress |
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
│   ├── cli/               # CLI (init, scan, doctor)
│   ├── shared/            # SQLite + shared types + impact engine
│   └── vscode-extension/  # VS Code sidebar integration
├── .sidstack/             # Governance, knowledge, skills
│   ├── governance.md      # Master governance doc
│   ├── knowledge/         # Project knowledge docs
│   ├── skills/            # Capability skills (implement, review)
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
| CLI | Oclif (TypeScript) |
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
- [Contributing](CONTRIBUTING.md) - Development setup and PR guidelines

## License

MIT
