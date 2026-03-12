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

## Tools (42)

### Knowledge (9)
- `knowledge_search` - Semantic search across knowledge and memory (SidMemo)
- `knowledge_list` - List available docs
- `knowledge_get` - Get single document with full content
- `knowledge_modules` - List modules with stats
- `knowledge_module_overview` - Get module architecture overview
- `knowledge_create` - Create knowledge document
- `knowledge_update` - Update knowledge document
- `knowledge_delete` - Delete knowledge document
- `knowledge_health` - Check knowledge coverage health

### Tasks (5)
- `task_create` - Create task with governance
- `task_update` - Update status/progress
- `task_list` - List tasks with filtering
- `task_get` - Get task details
- `task_complete` - Complete with quality gate check

### Impact Analysis (3)
- `impact_analyze` - Run impact analysis on a planned change
- `impact_check_gate` - Check gate status (blocked/warning/clear)
- `impact_list` - List analyses

### Tickets (4)
- `ticket_create` - Create ticket
- `ticket_list` - List/filter tickets
- `ticket_update` - Update status
- `ticket_convert_to_task` - Convert ticket to task

### Training (6)
- `incident_create` - Report an incident
- `incident_list` - List incidents
- `lesson_create` - Create lesson from incident
- `lesson_list` - List lessons
- `rule_check` - Check rules for context
- `training_context_get` - Get training context for session

### Test Results (3)
- `test_result_create` - Persist test execution results
- `test_result_list` - List test results with filtering
- `test_result_get` - Get detailed test result

### Agent Desk (4)
- `desk_create` - Create agent desk (git worktree)
- `desk_list` - List all agent desks
- `desk_status` - Get desk status and current task
- `desk_remove` - Remove agent desk

### Memory (5)
- `memory_add` - Add a memory entry
- `memory_list` - List memory entries
- `memory_delete` - Delete a memory entry
- `memory_index_knowledge` - Index knowledge docs into memory
- `memory_cleanup` - Clean up stale entries

### Entity References (3)
- `entity_link` - Link entities (task↔knowledge, etc.)
- `entity_references` - Get references for an entity
- `entity_context` - Build context from linked entities (entity mode + RAG mode)

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
