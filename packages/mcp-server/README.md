# @sidstack/mcp-server

MCP Server for SidStack - knowledge, task management, impact analysis, and governance for Claude Code.

## Install

Add to your Claude Code MCP settings (`~/.claude/settings.json`):

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

Or in a project `.mcp.json`:

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

## Tools (20)

### Knowledge
- `knowledge_context` - Build session context for a task/module
- `knowledge_search` - Search across knowledge docs
- `knowledge_list` - List available docs
- `knowledge_modules` - List modules with stats

### Tasks
- `task_create` - Create task with governance
- `task_update` - Update status/progress
- `task_list` - List tasks
- `task_complete` - Complete with quality gate check

### Impact Analysis
- `impact_analyze` - Run impact analysis on a planned change
- `impact_check_gate` - Check gate status (blocked/warning/clear)
- `impact_list` - List analyses

### Tickets
- `ticket_create` - Create ticket
- `ticket_list` - List/filter tickets
- `ticket_update` - Update status
- `ticket_convert_to_task` - Convert ticket to task

### Training
- `lesson_create` - Create lesson from incident
- `rule_check` - Check rules for context

### Sessions
- `session_launch` - Launch Claude session with role and context

## Setup

Initialize a project with SidStack:

```bash
npx @sidstack/cli init         # Basic init
npx @sidstack/cli init --scan  # Init + AI-powered knowledge scan
```

## Development

```bash
pnpm build    # Build
pnpm dev      # Watch mode
pnpm start    # Run server
```

## License

MIT
