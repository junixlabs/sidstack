# SidStack for VS Code

AI-Powered Project Intelligence — manage tasks, knowledge, tickets, impact analysis, and governance directly from VS Code.

## Features

- **Tasks** — Create, update, and complete tasks with governance quality gates
- **Knowledge** — Browse and search project knowledge documents
- **Tickets** — Intake external issues, review, and convert to tasks
- **Training** — View lessons learned, skills, and rules
- **Impact Analysis** — Run change risk analysis before implementing
- **Status Bar** — Live connection status and quick access to project dashboard
- **Command Palette** — All actions available via `Cmd+Shift+P` / `Ctrl+Shift+P`
- **Context Menus** — Complete tasks and convert tickets inline from tree views

## Requirements

1. Initialize SidStack in your project:

```bash
npx @sidstack/cli init
```

2. The API server starts automatically when the extension activates. You can also start it manually:

```bash
npx @sidstack/cli serve
```

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `sidstack.apiPort` | `19432` | Port for the SidStack API server |
| `sidstack.autoStartServer` | `true` | Automatically start the API server if not running |
| `sidstack.refreshInterval` | `30` | Auto-refresh interval in seconds (5–300) |
| `sidstack.projectId` | `sidstack` | Default project ID for task operations |

## How It Works

The extension communicates with the SidStack API server over HTTP (`localhost:19432`). The API server reads from the `.sidstack/` directory in your workspace, which contains your project's knowledge base, governance rules, and SQLite database.

## Links

- [GitHub](https://github.com/junixlabs/sidstack)
- [Documentation](https://sidstack.dev)
