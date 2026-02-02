# SidStack - Getting Started Guide

## Quick Start

### Step 1: Initialize Your Project

```bash
cd /path/to/your/project

# Initialize with AI-powered knowledge scan (recommended)
npx @sidstack/cli init --scan

# Or initialize without scan
npx @sidstack/cli init
```

This creates:
- `.sidstack/` - Governance structure (principles, skills, knowledge)
- `.mcp.json` - MCP server config for Claude Code
- `.claude/settings.local.json` - Tool auto-approval
- `CLAUDE.md` - Project instructions for Claude Code

### Step 2: Use in Claude Code

Open Claude Code in your project. SidStack tools are available immediately:

```
"Search knowledge about the auth module"
→ Claude calls knowledge_search + knowledge_context

"Create a task to fix the login bug"
→ Claude calls task_create

"Analyze the impact of refactoring the database layer"
→ Claude calls impact_analyze
```

Or use the slash command for a project dashboard:
```
/sidstack
```

---

## What is SidStack?

SidStack is an **AI-Powered Project Intelligence Platform** for Claude Code.

| Feature | Description |
|---------|-------------|
| **Knowledge System** | Structured project docs that give every Claude session full context |
| **AI Auto-Bootstrap** | `init --scan` analyzes your codebase and generates knowledge docs |
| **Task Management** | Track AI work with governance and quality gates |
| **Impact Analysis** | Assess scope, risks, and blockers before making changes |
| **Ticket Queue** | Intake external tickets, review, convert to tasks |
| **Training Room** | Capture lessons from incidents, build reusable skills and rules |
| **OKRs** | Define project goals, track progress through task completion |

---

## CLI Commands

```bash
# Initialize
npx @sidstack/cli init              # Interactive setup
npx @sidstack/cli init --scan       # Setup + AI knowledge scan

# Knowledge
npx @sidstack/cli knowledge list    # List knowledge docs
npx @sidstack/cli knowledge create  # Create from template
npx @sidstack/cli knowledge templates  # List available templates

# Governance
npx @sidstack/cli governance show   # View governance overview
npx @sidstack/cli governance check  # Check compliance

# Health check
npx @sidstack/cli doctor            # Diagnose issues

# Update
npx @sidstack/cli update            # Update governance files
```

---

## Project Structure After Init

```
your-project/
├── .sidstack/
│   ├── config.json               # Project configuration
│   ├── governance.md             # Governance overview
│   ├── principles/               # Quality standards
│   │   ├── code-standards.md
│   │   ├── testing-qa.md
│   │   ├── security.md
│   │   └── ...
│   ├── skills/
│   │   └── capabilities/
│   │       ├── implement/        # feature, bugfix, refactor
│   │       └── review/           # code, security, performance
│   └── knowledge/                # Project knowledge docs (from --scan)
│       ├── modules/
│       ├── business-logic/
│       └── api-endpoints/
├── .claude/
│   └── settings.local.json       # MCP tool auto-approval
├── .mcp.json                     # Claude Code MCP config
└── CLAUDE.md                     # Project instructions
```

---

## Desktop App

### Install

Download the `.dmg` from [Releases](https://github.com/junixlabs/sidstack/releases).

Or build from source:
```bash
git clone https://github.com/junixlabs/sidstack.git
cd sidstack
pnpm install && pnpm packages:build && pnpm tauri:build
```

### Keyboard Shortcuts

| Action | macOS |
|--------|-------|
| Project Hub | `Cmd+1` |
| Task Manager | `Cmd+2` |
| Knowledge Browser | `Cmd+3` |
| Ticket Queue | `Cmd+4` |
| Training Room | `Cmd+5` |
| Settings | `Cmd+,` |
| Open Project | `Cmd+O` |

### 7 Views

| View | Description |
|------|-------------|
| **Project Hub** | Central dashboard with project stats, OKR progress, quick actions |
| **Task Manager** | Kanban, list, timeline views with governance |
| **Knowledge Browser** | Browse and search project knowledge documents |
| **Ticket Queue** | External ticket intake, review workflow, convert to tasks |
| **Training Room** | Incidents, lessons, skills, and enforcement rules |
| **Settings** | Per-project configuration |
| **Worktree Status** | Git branch and file status |

---

## Agent Roles

| Role | Responsibilities |
|------|------------------|
| **Worker** | All implementation - features, bugs, design, tests, docs |
| **Reviewer** | Independent verification - code review, security audit |

### Quality Gates

Every governed agent must pass before completing:

```bash
pnpm typecheck   # 0 errors
pnpm lint        # 0 errors
pnpm test        # All pass
```

---

## Troubleshooting

### MCP tools not available in Claude Code

1. Check `.mcp.json` exists in project root
2. Run `npx @sidstack/cli doctor` to diagnose
3. Restart Claude Code

### Knowledge not generated

1. Run `npx @sidstack/cli init --scan`
2. Check `.sidstack/knowledge/` directory
3. Ensure project has source files to analyze

### Desktop app won't start

1. Check that `.sidstack/` directory exists in your project
2. Run `npx @sidstack/cli doctor` to diagnose

---

## Documentation

- [Quick Start](QUICK_START.md) - Condensed setup guide
- [Claude Code Integration](CLAUDE_CODE_INTEGRATION.md) - MCP tools reference
- [API Reference](API_REFERENCE.md) - REST API documentation
- [Impact Analysis](IMPACT_ANALYSIS.md) - Change impact guide
