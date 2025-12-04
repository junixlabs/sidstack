# Session Manager

Launch, track, and resume Claude Code sessions.

## Launching Sessions

### From the Desktop App
1. Open **Sessions** from the sidebar
2. Click **+ Launch Session**
3. Select a task (optional) and terminal
4. Enter a prompt
5. The session opens in your default terminal (iTerm, Terminal.app, Warp, etc.)

### From Claude Code (MCP)
```
Launch a session to fix the login timeout
```

### From the API
```bash
curl -X POST http://localhost:19432/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "workspacePath": "/path/to/project",
    "taskId": "task-123",
    "prompt": "Fix the login timeout bug"
  }'
```

## Session Tracking

Each session tracks:
- **Status** - launching, active, completed, error, terminated
- **Duration** - How long the session has been running
- **Events** - Tool calls and actions within the session
- **Linked task** - The task being worked on

## Resuming Sessions

Resume a previous session with additional context:

```
Resume session ses-001 and continue the refactoring
```

## Supported Terminals

| Terminal | Platform |
|----------|----------|
| iTerm | macOS (default) |
| Terminal.app | macOS |
| Warp | macOS |
| Alacritty | Cross-platform |
| kitty | Cross-platform |
| ghostty | Cross-platform |

## Session Events

Sessions log events for auditing:
- Tool calls (Edit, Read, Bash, etc.)
- File modifications
- Task progress updates
