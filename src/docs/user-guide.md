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

## Agent Desk

Agent Desk gives each AI agent its own isolated workspace using git worktrees. All desks share one `.sidstack/` knowledge base, but each has independent code, branches, and local state.

### Key Concepts

| Term | Meaning |
|------|---------|
| **Agent Desk** | A git worktree assigned to an AI agent (Worker or Reviewer) |
| **`.sidstack/`** | Shared project knowledge, governance, and skills (1 per project) |
| **`.sidstack-local/`** | Per-desk state: role, status, current task, ports |

### Workspace Modes

**Mode A: `.bare/` Workspace** (recommended for new projects)

```
my-project-workspace/
├── .bare/                ← Git bare repository
├── .sidstack/            ← Shared knowledge & governance
├── main/                 ← Reference worktree (main branch)
├── worker-1/             ← Agent Desk (Worker)
└── reviewer-1/           ← Agent Desk (Reviewer)
```

Setup via CLI:
```bash
sidstack new my-project                              # Creates workspace
sidstack desk add worker-1 -b agent/worker-1 --role worker
sidstack desk add reviewer-1 -b agent/reviewer-1 --role reviewer
```

**Mode B: Normal Repo + Sibling Worktrees** (for existing repos)

```
/projects/
├── my-project/              ← Normal git repo (has .sidstack/)
├── worker-1/                ← Sibling worktree
└── reviewer-1/              ← Sibling worktree
```

Setup:
```bash
cd my-project
sidstack init                                         # Creates .sidstack/
git worktree add ../worker-1 -b agent/worker-1
```

### Creating an Agent Desk (Desktop App)

1. Click **+** in the sidebar Agent Desk section
2. Choose role: **Worker** or **Reviewer**
3. Enter agent name (e.g., "Worker 1")
4. Select or create a branch
5. Click **Create Agent Desk**

The app creates the worktree, writes `.sidstack-local/session.json`, and adds the desk to the sidebar.

### Managing Desks

```bash
sidstack desk list                    # List all agent desks
sidstack desk list --verbose          # Include git status
sidstack desk add <name> [flags]      # Add a new desk
sidstack desk remove <name>           # Remove a desk
```

### MCP Integration

From any agent desk directory, MCP tools automatically resolve the shared `.sidstack/`:

```bash
# From worker-1/ directory:
knowledge_context({ projectPath: "/path/to/worker-1" })
# → Resolves to shared .sidstack/ automatically
```

No configuration needed — workspace detection handles both modes transparently.

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

| Category | Purpose |
|----------|---------|
| `00-context` | Vision, glossary, onboarding, team structure |
| `01-architecture` | System design, module boundaries, patterns |
| `02-decisions` | ADRs, technical decisions (date-prefixed) |
| `03-standards` | Coding conventions, naming, testing rules |
| `04-data` | Database schema, ownership, retention |
| `05-api` | API contracts, schemas, versioning |
| `06-operations` | Deployment, monitoring, rollback strategy |
| `07-projects` | Project-specific docs (date-prefixed) |
| `08-incidents` | Incident reports, root cause analysis (date-prefixed) |

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

### Task Completion

When a task is completed via `task_complete`, SidStack automatically:

1. **Runs quality gates** — Executes typecheck, lint, and test commands
2. **Creates follow-up tasks:**
   - `[infra] Deploy` — assigned to human
   - `[test] Verify on production` — assigned to human
   - `[docs] Update docs` — assigned to reviewer (includes changed files context)
3. **Detects stale docs** — Warns if knowledge docs cover files that changed
4. **Validates governance** — Checks acceptance criteria, progress history, and title format
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

SidStack connects to Claude Code via a **Model Context Protocol (MCP) server** that provides 49 tools:

| Category | Tools | Purpose |
|----------|-------|---------|
| Knowledge (9) | `knowledge_context`, `knowledge_search`, `knowledge_list`, `knowledge_get`, `knowledge_modules`, `knowledge_create`, `knowledge_update`, `knowledge_delete`, `knowledge_health` | Build context, search docs |
| Tasks (5) | `task_create`, `task_update`, `task_list`, `task_get`, `task_complete` | Manage governed work |
| Impact (3) | `impact_analyze`, `impact_check_gate`, `impact_list` | Assess change risk |
| Tickets (4) | `ticket_create`, `ticket_list`, `ticket_update`, `ticket_convert_to_task` | Manage intake |
| Training (8) | `incident_create`, `incident_list`, `lesson_create`, `lesson_list`, `skill_create`, `skill_list`, `rule_check`, `training_context_get` | Learn from mistakes |
| OKRs (2) | `okr_list`, `okr_update` | Track project goals |
| Test Results (3) | `test_result_create`, `test_result_list`, `test_result_get` | Persist test execution |
| Agent Desk (5) | `desk_list`, `desk_status`, `desk_acquire`, `desk_release`, `desk_pool_init` | Workspace isolation |
| Memory (6) | `memory_add`, `memory_search`, `memory_list`, `memory_delete`, `memory_index_knowledge`, `memory_cleanup` | Semantic search |
| Traceability (1) | `traceability_matrix` | Spec-task-test coverage |
| Entity Refs (3) | `entity_link`, `entity_references`, `entity_context` | Cross-entity linking |

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

# Agent Desk
sidstack desk list               # List all agent desks
sidstack desk list --verbose     # Include git status per desk
sidstack desk add <name>         # Add a new agent desk
sidstack desk remove <name>      # Remove an agent desk
sidstack new <name>              # Create a new workspace with .bare/
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

### Agent Desk Not Detected
- Run `sidstack init` in the main project to create `.sidstack/config.json`
- For Mode A: ensure `.sidstack/config.json` is at workspace root (next to `.bare/`)
- For Mode B: run `git rev-parse --git-common-dir` from the desk directory — it should point to the main project's `.git`

### Agent Desk Can't Find Shared Knowledge
- Verify `.sidstack/` exists in the main project
- If `.sidstack/` is gitignored: it won't appear in worktrees (expected — git fallback resolves it)
- If `.sidstack/` is tracked in git: it appears in every worktree via git checkout

### Port Conflicts Between Desks
- Each desk gets unique ports auto-allocated by the Desktop App
- Check `.sidstack-local/session.json` for assigned ports
- Default ranges: dev 3000-3099, api 19432-19531, preview 4000-4099
