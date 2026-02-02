# User Guide

## Getting Started

### Opening a Project

1. Launch SidStack
2. Click **Open Project** or press `Cmd/Ctrl + O`
3. Select your project folder
4. SidStack initializes automatically if `.sidstack/` doesn't exist

### First-Time Setup

If this is a new project, run the CLI to generate knowledge docs:

```bash
sidstack init              # Scaffold governance structure
sidstack init --scan       # AI-powered knowledge generation
```

This creates the `.sidstack/` directory with governance rules, knowledge templates, and skill definitions.

---

## Navigation

Use the **Activity Bar** on the left to switch between views:

| View | Shortcut | Purpose |
|------|----------|---------|
| Project Hub | `Cmd + 1` | Dashboard with capabilities, goals, and overview |
| Task Manager | `Cmd + 2` | Track work with governance and quality gates |
| Knowledge Browser | `Cmd + 3` | Browse and search project documentation |
| Ticket Queue | `Cmd + 4` | Manage external tickets and convert to tasks |
| Training Room | `Cmd + 5` | Capture lessons and build enforcement rules |

---

## Project Hub

Your project's command center. View capabilities, goals, and entity connections at a glance.

- **Capability Tree** — L0/L1/L2 hierarchy of what your project does
- **Goals & OKRs** — Track project objectives and key results
- **Entity Connections** — See how tasks, knowledge, specs, and sessions relate
- **Quick Actions** — Create tasks, launch sessions, and build context directly from the hub

---

## Knowledge Browser

Browse your project's structured documentation stored in `.sidstack/knowledge/`.

### Document Types

| Type | Purpose |
|------|---------|
| `business-logic` | Business rules and domain workflows |
| `api-endpoint` | API contracts, endpoints, and schemas |
| `design-pattern` | Architecture patterns and conventions |
| `database-table` | Database schema and relationships |
| `module` | Module boundaries and responsibilities |
| `index` | Module index and overview |

### Features

- **Tree Navigation** — Browse by folder structure
- **Search** — Full-text search across all documents
- **Type Filter** — Filter by document type
- **Preview** — Rendered markdown with syntax highlighting

---

## Task Manager

Track AI agent work with governance quality gates.

### Task Lifecycle

| Status | Meaning |
|--------|---------|
| `pending` | Created, not yet started |
| `in_progress` | Agent is working on it |
| `completed` | Done and validated |
| `blocked` | Waiting on a dependency |
| `failed` | Encountered an error |

### View Modes

- **List** — Traditional task list with sorting and filtering
- **Kanban** — Board view grouped by status columns
- **Timeline** — Gantt-style view for scheduling

### Quality Gates

Before a task can be marked complete, SidStack checks:
- Acceptance criteria are defined (for feature/bugfix/security tasks)
- Governance rules are satisfied
- Required fields are filled

---

## Ticket Queue

Manage incoming work from external sources (Jira, GitHub, Linear, or manual entry).

### Status Workflow

```
new → reviewing → approved → in_progress → completed
                ↘ rejected
```

### Key Actions

- **Create Ticket** — Add tickets manually or via external sources
- **Review & Approve** — Triage incoming tickets before work begins
- **Convert to Task** — Turn an approved ticket into a governed task with type mapping (bug → bugfix, feature → feature)
- **Auto-Complete** — When a linked task completes, the ticket is automatically marked complete

---

## Training Room

Capture what goes wrong, learn from it, and prevent it from happening again.

### The Learning Loop

1. **Incident** — Record what went wrong (mistake, failure, confusion)
2. **Lesson** — Analyze root cause and document prevention steps
3. **Skill** — Create reusable procedures, checklists, or templates
4. **Rule** — Enforce mandatory checks in future sessions

### Components

| Component | Purpose | Example |
|-----------|---------|---------|
| **Incidents** | Record what went wrong | "Agent deleted production data" |
| **Lessons** | Document root cause and prevention | "Always check environment before destructive operations" |
| **Skills** | Reusable capability definitions | "Database migration checklist" |
| **Rules** | Automated enforcement checks | "Block DROP TABLE without WHERE clause" |

---

## MCP Integration

SidStack connects to Claude Code via a **Model Context Protocol (MCP) server** that provides 32 tools:

| Category | Tools | Purpose |
|----------|-------|---------|
| Knowledge | `knowledge_context`, `knowledge_search`, `knowledge_list`, `knowledge_get`, `knowledge_modules` | Build context, search docs |
| Tasks | `task_create`, `task_update`, `task_list`, `task_get`, `task_complete` | Manage governed work |
| Impact | `impact_analyze`, `impact_check_gate`, `impact_list` | Assess change risk |
| Tickets | `ticket_create`, `ticket_list`, `ticket_update`, `ticket_convert_to_task` | Manage intake |
| Training | `incident_create`, `lesson_create`, `skill_create`, `rule_check` | Learn from mistakes |
| Sessions | `session_launch` | Launch governed Claude sessions |

---

## CLI Commands

```bash
# Project setup
sidstack init                    # Initialize governance structure
sidstack init --scan             # AI-powered knowledge generation
sidstack doctor                  # Diagnose project issues
sidstack update                  # Update to latest version

# Knowledge
sidstack knowledge list          # List knowledge documents
sidstack knowledge create        # Create a new knowledge doc
sidstack knowledge validate      # Validate knowledge frontmatter
sidstack knowledge init          # Initialize knowledge templates

# Governance
sidstack governance show         # Show governance configuration
sidstack governance check        # Check governance health

# Skills
sidstack skill list              # List available skills
sidstack skill show <name>       # Show skill details
sidstack skill add <name>        # Add a skill to project
sidstack skill create            # Create a custom skill
```

---

## Keyboard Shortcuts

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Open Project | `Cmd + O` | `Ctrl + O` |
| Switch View 1-5 | `Cmd + 1-5` | `Ctrl + 1-5` |
| Settings | `Cmd + ,` | `Ctrl + ,` |
| Global Search | `Cmd + K` | `Ctrl + K` |
| Documentation | `Cmd + Shift + D` | `Ctrl + Shift + D` |
| Keyboard Shortcuts | `?` or `Cmd + /` | `?` or `Ctrl + /` |
| Close Panel | `Esc` | `Esc` |

---

## Troubleshooting

### App Won't Start
- Ensure `.sidstack/` directory exists in your project
- Run `sidstack doctor` to diagnose common issues
- Check that the API server is running (port 19432)

### Knowledge Not Showing
- Verify files exist in `.sidstack/knowledge/`
- Ensure YAML frontmatter is valid (run `sidstack knowledge validate`)
- Check the Knowledge Browser's type filter isn't hiding results

### MCP Tools Not Working
- Verify the MCP server is configured in your Claude Code settings
- Check the API server is accessible at `http://localhost:19432`
- Run `sidstack doctor` to validate the MCP setup

### Tasks Not Updating
- Check that the project ID matches between desktop app and MCP tools
- Verify the SQLite database isn't locked by another process
