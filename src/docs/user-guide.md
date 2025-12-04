# User Guide

## Getting Started

### Opening a Project

1. Launch SidStack
2. Click "Open Project" or press `Cmd/Ctrl + O`
3. Select your project folder
4. SidStack will initialize automatically if `.sidstack/` doesn't exist

### Navigation

Use the **sidebar** to switch between views:

| Icon | View | Shortcut |
|------|------|----------|
| Layers | Project Hub | `Cmd + 1` |
| ListTodo | Task Manager | `Cmd + 2` |
| Book | Knowledge Browser | `Cmd + 3` |
| Inbox | Ticket Queue | `Cmd + 4` |
| GraduationCap | Training Room | `Cmd + 5` |

**Note:** Project Hub is the default view when opening a project.

---

## Project Hub

View your project's capability tree and entity connections. This is the default view when opening a project.

### Features

- **Capability Tree** - L0/L1/L2 hierarchy of project capabilities
- **Entity Connections** - See how tasks, knowledge, and sessions relate
- **Context Builder** - Build Claude session context from the hub

---

## Knowledge Browser

Browse and search your project's knowledge documentation.

### Categories

- `business-logic/` - Business rules and workflows
- `api/` - API endpoints and schemas
- `patterns/` - Design patterns
- `database/` - Database documentation
- `modules/` - Module documentation

### Features

- **Tree Navigation** - Navigate by folder structure
- **Search** - Full-text search across all documents
- **Filter** - Filter by type and status
- **Preview** - Markdown preview with syntax highlighting

---

## Task Manager

Track AI work with governance and quality gates.

### Task States

| State | Meaning |
|-------|---------|
| `pending` | Not started |
| `in_progress` | Currently working |
| `completed` | Finished |
| `blocked` | Waiting on something |
| `failed` | Encountered error |

### View Modes

- **List** - Traditional task list
- **Kanban** - Board view by status
- **Timeline** - Gantt-style timeline
- **Detail** - Full task detail panel

---

## Ticket Queue

Manage external tickets and convert them to tasks.

### Status Flow

```
new → reviewing → approved → in_progress → completed
                ↘ rejected
```

---

## Training Room

Capture lessons from incidents and build rules over time.

### Components

- **Incidents** - Record what went wrong
- **Lessons** - Document what was learned
- **Skills** - Reusable capability definitions
- **Rules** - Automated checks and enforcement

---

## CLI Commands

SidStack includes a CLI for managing your project:

```bash
# Initialize project
sidstack init
sidstack init --scan    # With AI-powered knowledge generation

# Knowledge
sidstack knowledge list
sidstack knowledge create --type business-logic

# Governance
sidstack governance show
sidstack governance check
```

---

## Keyboard Shortcuts

| Action | macOS | Windows |
|--------|-------|---------|
| Open Project | `Cmd + O` | `Ctrl + O` |
| Switch View 1-5 | `Cmd + 1-5` | `Ctrl + 1-5` |
| Settings | `Cmd + ,` | `Ctrl + ,` |
| Global Search | `Cmd + K` | `Ctrl + K` |
| Close Panel | `Esc` | `Esc` |

---

## Troubleshooting

### App Won't Start
- Check that `.sidstack/` directory exists
- Run `sidstack doctor` to diagnose issues

### Knowledge Not Showing
- Check files are in `.sidstack/knowledge/`
- Ensure YAML frontmatter is valid
