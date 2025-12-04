# SidStack Desktop App User Guide

## Overview

The SidStack Desktop App provides a **view-only** interface for browsing and exploring your project's knowledge base, module structure, and task management. All modifications are made through the CLI - the app is designed for visualization and navigation only.

## Key Features

### 1. Knowledge Browser

Browse and search your project's knowledge documentation.

**What you can do:**
- Navigate the knowledge tree by category (business-logic, api, patterns, database, modules)
- Search across all knowledge documents
- Preview documents with syntax highlighting
- Filter by status (draft, review, published)
- Validate document structure
- Open documents in VS Code for editing

**Categories:**
- `business-logic/` - Business rules, workflows, state machines
- `api/` - API endpoints, request/response schemas
- `patterns/` - Design patterns used in the project
- `database/` - Database schemas, relationships
- `modules/` - Module documentation

### 2. Project Hub

Central dashboard for navigating all SidStack features.

**What you can do:**
- View project stats (modules, tasks, sessions, knowledge)
- Browse recent activity across all features
- Quick access to any feature from sidebar
- Check workspace status (Worktree Status)
- Switch between workspaces
- See real-time updates

**Dashboard Shows:**
- Module count
- Active tasks and progress
- Recent sessions
- Knowledge document count
- Latest activity timeline

### 3. Task Manager

Monitor task progress from Claude Code agents.

**What you can do:**
- View all tasks (active, completed, blocked)
- See task hierarchy (parent tasks and subtasks)
- Monitor progress percentage
- View assigned agent
- See task timeline (created, started, updated)
- Read progress notes

**Task States:**
- `pending` - Not started
- `in_progress` - Currently being worked on
- `completed` - Finished successfully
- `blocked` - Waiting on something
- `failed` - Encountered an error
- `cancelled` - Stopped by user

## Navigation

### Sidebar
- Click on workspace sections to switch views
- Knowledge Browser, Project Hub, and Task Manager are available
- Use keyboard shortcuts for quick navigation

### Search
- Global search across all content
- Filter results by type
- Keyboard shortcut: `Cmd/Ctrl + K`

## View-Only Design

The app is intentionally **view-only**. This design provides:

1. **Safety** - No accidental modifications to your project
2. **Speed** - Fast reads without write overhead
3. **Simplicity** - Focus on visualization, not editing
4. **CLI Integration** - Encourages proper CLI workflows

### Making Changes

To modify your project, use the SidStack CLI:

```bash
# Create knowledge document
sidstack knowledge create --type business-logic --title "User Auth"

# Check governance
sidstack governance check

# Initialize new preset
sidstack init --preset fullstack-typescript
```

### Open in Editor

Throughout the app, you'll see "Open in Editor" buttons. These open the file directly in VS Code (or your default editor), where you can make modifications.

## CLI Commands Reference

### Module Commands
```bash
sidstack knowledge list            # List knowledge docs
sidstack knowledge create          # Create knowledge doc
sidstack governance show           # View governance
sidstack governance check          # Check compliance
```

### Governance Commands
```bash
sidstack governance show          # Show governance overview
sidstack governance check         # Check compliance
```

### Knowledge Commands
```bash
sidstack knowledge list           # List knowledge docs
sidstack knowledge create         # Create from template
sidstack knowledge templates      # List available templates
sidstack knowledge validate       # Validate documents
```

### Preset Commands
```bash
sidstack preset list              # List available presets
sidstack preset show <name>       # Show preset details
sidstack init --preset <name>     # Initialize with preset
```

## Agent-Friendly Features

The CLI is designed to work seamlessly with Claude Code agents:

### JSON Output
Add `--json` to any command for structured output:
```bash
sidstack governance check --json
```

### Exit Codes
- `0` - Success
- `1` - Error
- `2` - Warning
- `3` - Validation failed
- `4` - Not initialized

### Quiet Mode
Add `--quiet` for minimal output (great for CI):
```bash
sidstack governance check --quiet
```

### Strict Mode
Add `--strict` to treat warnings as errors:
```bash
sidstack governance check --strict
```

## Troubleshooting

### App Won't Start
1. Check that `.sidstack/` directory exists in your project
2. Run `sidstack doctor` to diagnose issues
3. Ensure SQLite database is not corrupted

### Knowledge Not Showing
1. Run `sidstack knowledge validate` to check for errors
2. Ensure documents are in `.sidstack/knowledge/`
3. Check file extensions (.md)

### Project Hub Not Loading
1. Check that `.sidstack/` directory exists in your project
2. Run `sidstack doctor` to diagnose issues
3. Verify SQLite database is accessible

### Tasks Not Updating
1. Ensure API server is running (port 19432)
2. Check database connection
3. Verify task IDs are correct

## Keyboard Shortcuts

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Project Hub | `⌘ 1` | `Ctrl 1` |
| Task Manager | `⌘ 2` | `Ctrl 2` |
| Knowledge Browser | `⌘ 3` | `Ctrl 3` |
| Ticket Queue | `⌘ 4` | `Ctrl 4` |
| Training Room | `⌘ 5` | `Ctrl 5` |
| Settings | `⌘ ,` | `Ctrl ,` |
| Open Project | `⌘ O` | `Ctrl O` |
| Global Search | `⌘ K` | `Ctrl K` |
| Refresh | `⌘ R` | `Ctrl R` |
| Close Panel | `Esc` | `Esc` |

## Getting Help

- Run `sidstack --help` for CLI help
- Run `sidstack <command> --help` for command-specific help
- Visit documentation at `/docs/` in the project
- Check `CLAUDE.md` for AI assistant instructions
