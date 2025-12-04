# SidStack - Getting Started Guide

## Quick Start (1 minute)

### Step 1: Initialize Your Project

```bash
cd /path/to/your/project

# Initialize with governance (recommended)
sidstack init --governance
```

Or use interactive mode:
```bash
sidstack init
# Select "Governance" from the prompt
```

### Step 2: Start Using

In Claude Code, spawn a governed agent:

```
/sidstack:agent worker Implement user authentication with JWT
```

Your agent now has:
- Quality principles (code-quality, testing, security)
- Capability-based skills (implement, design, test, review)
- Quality gates before completion

---

## What is SidStack?

SidStack is a **Project Knowledge Browser & Agent Workspace** for Claude Code.

| Feature | Description |
|---------|-------------|
| **Project Hub** | Central dashboard for navigating all SidStack features |
| **Knowledge Browser** | Browse and search project knowledge documents |
| **Task Manager** | Kanban, tree, and list views |
| **Session Manager** | Launch and track Claude Code sessions |
| **Ticket Queue** | Intake, review, and convert external tickets |
| **Training Room** | Incident tracking, lessons learned, skills |
| **Governance** | Principles, skills, and workflows for agent quality |
| **Impact Analysis** | Scope, risk, and validation analysis |

---

## Installation Options

### Option 1: With Governance (Recommended)

```bash
sidstack init --governance
```

Creates:
- `.sidstack/` - Governance structure (principles, skills, workflows)
- `.claude/commands/sidstack/` - Slash commands
- `.mcp.json` - MCP configuration

### Option 2: With OpenSpec + Governance

```bash
sidstack init --openspec --governance
```

Adds:
- `openspec/` - Spec-driven development workflow

### Option 3: Interactive

```bash
sidstack init
```

### Option 4: Minimal

```bash
sidstack init --no-frameworks
```

---

## Project Structure After Init

```
your-project/
├── .sidstack/
│   ├── config.json               # Project configuration
│   ├── version.json              # Governance version
│   ├── governance.md             # Overview
│   ├── principles/               # Quality standards
│   │   ├── code-standards.md     # Code quality rules
│   │   ├── testing-qa.md         # Testing requirements
│   │   ├── security.md           # Security rules
│   │   ├── collaboration.md      # Multi-agent work
│   │   ├── git-workflow.md       # Git conventions
│   │   ├── task-management.md    # Task tracking
│   │   ├── ui-standards.md       # UI/UX standards
│   │   └── knowledge-sync.md    # Knowledge maintenance
│   ├── skills/
│   │   ├── capabilities/
│   │   │   ├── implement/        # feature, bugfix, refactor
│   │   │   ├── design/           # architecture, database, api
│   │   │   ├── test/             # unit, integration, e2e
│   │   │   ├── review/           # code, security, performance
│   │   │   └── deploy/           # ci-cd, release
│   │   └── shared/
│   │       ├── handoff-simple.md
│   │       └── lesson-detection.md
│   └── workflows/
│       └── new-feature.md        # End-to-end feature workflow
├── .claude/
│   ├── settings.local.json       # MCP auto-approval
│   └── commands/sidstack/        # Slash commands
│       ├── agent.md              # /sidstack:agent
│       ├── knowledge.md          # /sidstack:knowledge
│       └── sidstack.md           # /sidstack:sidstack
└── .mcp.json                     # Claude Code MCP config
```

---

## Using Governance

### Spawn a Governed Agent

```
/sidstack:agent [role] [task description]
```

**Examples:**
```
/sidstack:agent worker Implement user registration API
/sidstack:agent worker Fix the login bug in auth service
/sidstack:agent reviewer Review the payment module for security issues
```

### Agent Roles

| Role | Responsibilities |
|------|------------------|
| **Worker** | All implementation - features, bugs, design, tests, docs |
| **Reviewer** | Independent verification - code review, security audit |

### When to Spawn vs Do Directly

**Do directly (single Worker):**
- Feature + tests (same context)
- Bug fix + regression test
- Refactoring
- Code + documentation

**Spawn new agent:**
- Parallel module work
- Independent review (Reviewer != author)
- Fresh context needed (token exhaustion)
- Security audit

### Quality Gates

Every governed agent must pass before completing:

```bash
pnpm typecheck   # 0 errors
pnpm lint        # 0 errors
pnpm test        # All pass
```

### Agent Principles

Agents follow these principles:

| Principle | Key Rules |
|-----------|-----------|
| **Code Standards** | No `any` types, functions < 40 lines, explicit returns |
| **Testing** | Tests for all new code, cover edge cases |
| **Security** | Validate input, no hardcoded secrets, parameterized queries |
| **Collaboration** | Clear handoffs, document decisions |
| **Git Workflow** | Conventional commits, PR requirements |
| **Task Management** | No work without task, update progress |

---

## Slash Commands Reference

| Command | Description |
|---------|-------------|
| `/sidstack:agent [role] [task]` | Spawn a governed agent |
| `/sidstack:knowledge` | Knowledge system - build, explore, search |
| `/sidstack:sidstack` | Project intelligence hub |

---

## Desktop App

### Starting the App

```bash
# Development mode
pnpm tauri:dev

# Or frontend only
pnpm dev
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘1` | Project Hub |
| `⌘2` | Task Manager |
| `⌘3` | Knowledge Browser |
| `⌘4` | Ticket Queue |
| `⌘5` | Training Room |
| `⌘,` | Settings |
| `⌘O` | Open project |
| `⌘W` | Close active block |

### Views

| View | What it shows |
|------|---------------|
| **Project Hub** | Central dashboard with project stats and quick actions |
| **Knowledge Browser** | Project knowledge documents with search and filters |
| **Task Manager** | Tasks in Kanban, tree, or list view |
| **Ticket Queue** | External tickets with status flow (new > reviewing > approved > in_progress) |
| **Sessions** | Claude Code sessions with launch/resume/track |
| **Training Room** | Incidents, lessons, skills, and rules |
| **Settings** | Per-project configuration |

---

## Updating Governance

```bash
# Check and update
sidstack update --governance-only

# Force update (overwrite existing)
sidstack update --governance-only --force
```

---

## CLI Commands Reference

```bash
# Initialize
sidstack init                           # Interactive
sidstack init --governance              # With governance
sidstack init --governance --openspec   # With both

# Governance
sidstack governance show                # Overview
sidstack governance check               # Compliance check

# Knowledge
sidstack knowledge templates            # List templates
sidstack knowledge create --type business-logic --title "Auth"

# Update
sidstack update                         # Update all
sidstack update --governance-only       # Governance only

# Health check
sidstack doctor                         # Check services
```

---

## Troubleshooting

### "Command not found: sidstack"

```bash
cd packages/cli && pnpm link --global
```

### "Governance not installed"

```bash
sidstack init --governance
```

### Update failed

```bash
sidstack update --governance-only --force
```

---

## Next Steps

1. **Read governance docs:** `.sidstack/governance.md`
2. **Spawn an agent:** `/sidstack:agent worker [your task]`
3. **Explore the desktop app:** `pnpm tauri:dev`
4. **Build knowledge:** `/sidstack:knowledge-builder`

---

## Documentation

- [README](../README.md) - Project overview
- [Roadmap Q1 2026](ROADMAP_Q1_2026.md) - Current sprint plan
- [Product Strategy](PRODUCT_STRATEGY.md) - Vision and strategy
- [Impact Analysis](IMPACT_ANALYSIS.md) - Change impact guide
- [User Guide (View-Only App)](USER_GUIDE_VIEW_ONLY_APP.md) - Desktop app guide
