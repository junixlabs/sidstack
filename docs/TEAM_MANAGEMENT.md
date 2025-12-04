# Team Management Guide

This guide covers how to use Agent Teams in SidStack for coordinated multi-agent work with automatic recovery capabilities.

## Overview

Agent Teams are logical groupings of agents working together on a shared goal. Teams provide:

- **Coordinated State Management**: All team members share context and progress
- **Automatic Recovery**: Failed agents are automatically replaced with context preserved
- **Pause/Resume**: Entire teams can be paused and resumed across app restarts
- **Session Continuity**: Claude sessions can be resumed after interruptions

## When to Use Teams

### Use Teams When:

- Multiple agents collaborate on a feature
- Long-running tasks need resilience
- You want pause/resume capability
- Automatic recovery is important

### Skip Teams When:

- Single agent for simple task
- One-off execution
- No recovery needed

## CLI Commands

### Create a Team

```bash
# Basic team creation
sidstack team create "Feature Team" \
  --orchestrator dev-lead \
  --workers dev-1,dev-2,qa-1

# With recovery settings
sidstack team create "Auth Team" \
  --orchestrator orchestrator-1 \
  --workers backend-dev,frontend-dev,qa \
  --auto-recovery \
  --max-attempts 3 \
  --recovery-delay 5000

# With description
sidstack team create "API Refactor Team" \
  --orchestrator lead-dev \
  --workers dev-1,dev-2 \
  --description "Refactoring REST API to GraphQL"
```

### List Teams

```bash
# List all teams for current project
sidstack team list

# Filter by status
sidstack team list --status active
sidstack team list --status paused

# JSON output for scripting
sidstack team list --json
```

### Show Team Details

```bash
# Detailed team view
sidstack team show <team-id>

# JSON output
sidstack team show <team-id> --json
```

### Quick Status Check

```bash
# One-time status
sidstack team status <team-id>

# Watch mode (refreshes every 5s)
sidstack team status <team-id> --watch
```

### Pause a Team

```bash
# Pause team (saves state for later resume)
sidstack team pause <team-id>
```

When paused, the following is saved:
- All member statuses
- Active tasks and progress
- Claude session IDs for resume
- Terminal working directories

### Resume a Team

```bash
# Resume paused team
sidstack team resume <team-id>

# Resume and spawn new terminals
sidstack team resume <team-id> --spawn
```

After resuming, you can manually resume Claude sessions:
```bash
claude --resume <session-id>
```

### Archive a Team

```bash
# Archive completed team (requires confirmation)
sidstack team archive <team-id>

# Skip confirmation
sidstack team archive <team-id> --force
```

Archived teams remain viewable but cannot be resumed.

### Manual Recovery

```bash
# Trigger recovery for a failed member
sidstack team recover <team-id> <member-id>

# With reason
sidstack team recover <team-id> <member-id> --reason "Token exhausted"
```

### View Recovery History

```bash
# View recovery events
sidstack team history <team-id>

# Limit results
sidstack team history <team-id> --limit 20

# Filter by member
sidstack team history <team-id> --member worker-1

# JSON output
sidstack team history <team-id> --json
```

## Team Lifecycle

```
creating → active → paused → archived
               ↓
           recovering
```

### States

| State | Description |
|-------|-------------|
| `creating` | Team being initialized |
| `active` | Team running normally |
| `paused` | Team paused, state saved |
| `recovering` | Automatic recovery in progress |
| `archived` | Team completed/archived |

## Recovery System

### Automatic Recovery

When enabled, the recovery watchdog monitors team health:

1. **Heartbeat Monitoring**: Agents must report progress regularly
2. **Failure Detection**: Stale heartbeats trigger recovery
3. **Replacement**: New agent spawned with same role
4. **Context Transfer**: Failed agent's context preserved

### Recovery Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `autoRecovery` | true | Enable automatic recovery |
| `maxRecoveryAttempts` | 3 | Max retries per member |
| `recoveryDelayMs` | 5000 | Delay before recovery attempt |

### Recovery Context

When an agent fails, the replacement receives:
- Task progress percentage
- Last known state notes
- Registered artifacts list
- Active spec information
- File locks to reacquire

### Agent Recovery Awareness

Agents should check for recovery context at startup:

```typescript
// In agent startup
const task = await agent_read_task({ agentId: myId });
if (task.recoveredFrom) {
  // I'm a replacement agent
  // Resume from last checkpoint instead of starting fresh
}
```

## MCP Tools

Teams can also be managed via MCP tools from the orchestrator:

### Team Operations

```typescript
// Create team
team_create({
  projectPath: "/path/to/project",
  name: "Feature Team",
  orchestrator: { id: "orch-1", role: "lead", agentType: "dev" },
  workers: [
    { id: "dev-1", role: "developer", agentType: "dev" }
  ],
  autoRecovery: true
});

// List teams
team_list({ projectPath: "/path/to/project" });

// Get team details
team_get({ projectPath: "/path/to/project", teamId: "team-123" });

// Pause team
team_pause({ projectPath: "/path/to/project", teamId: "team-123" });

// Resume team
team_resume({ projectPath: "/path/to/project", teamId: "team-123" });
```

### Member Operations

```typescript
// Add member
team_add_member({
  projectPath: "/path/to/project",
  teamId: "team-123",
  member: { id: "qa-1", role: "qa", agentType: "qa" }
});

// Remove member
team_remove_member({
  projectPath: "/path/to/project",
  teamId: "team-123",
  memberId: "dev-1"
});
```

### Recovery Operations

```typescript
// Report failure
team_report_member_failure({
  projectPath: "/path/to/project",
  teamId: "team-123",
  memberId: "dev-1",
  reason: "Token exhausted"
});

// Create replacement
team_create_replacement({
  projectPath: "/path/to/project",
  teamId: "team-123",
  failedMemberId: "dev-1"
});

// Get recovery history
team_get_recovery_history({
  projectPath: "/path/to/project",
  teamId: "team-123",
  limit: 10
});
```

## UI Components

### Team Panel

The Agent Manager UI includes a Teams panel showing:
- List of teams with status indicators
- Member counts
- Quick action buttons (Resume, Archive)

### Team Creation Dialog

Create teams with:
- Team name and description
- Member role selection
- Auto-recovery toggle
- Advanced recovery settings

### Resume Dialog

On app start, if paused teams exist:
- List of paused teams with details
- Checkbox selection
- Resume Selected / Start Fresh buttons

### Recovery Notifications

Toast notifications appear when:
- Recovery starts
- Recovery succeeds
- Recovery fails

## Best Practices

### 1. Use Descriptive Names

```bash
# Good
sidstack team create "User Auth Implementation"

# Bad
sidstack team create "team1"
```

### 2. Set Appropriate Recovery Limits

```bash
# For critical work, increase attempts
sidstack team create "Critical Feature" \
  --max-attempts 5 \
  --recovery-delay 3000

# For quick tasks, reduce overhead
sidstack team create "Quick Fix" \
  --max-attempts 1
```

### 3. Monitor Team Health

```bash
# Use watch mode for long-running teams
sidstack team status <team-id> --watch
```

### 4. Pause Before Long Breaks

```bash
# Before leaving for the day
sidstack team pause <team-id>
```

### 5. Review Recovery History

```bash
# Check for patterns indicating issues
sidstack team history <team-id> --limit 50
```

## Troubleshooting

### Team Won't Resume

1. Check Agent Manager is running
2. Verify team is in 'paused' state
3. Check for file lock conflicts

### Recovery Not Triggering

1. Verify `autoRecovery` is enabled
2. Check `maxRecoveryAttempts` not exceeded
3. Review watchdog logs in Agent Manager

### Claude Session Resume Fails

1. Session may have expired
2. Try starting fresh: `sidstack team resume <id>` without `--spawn`
3. Manually start agents in terminals

### Member Stuck in 'failed' State

1. Use manual recovery: `sidstack team recover <team-id> <member-id>`
2. Or remove and re-add member

## Data Storage

Team data is stored in:

```
~/.sidstack/teams/
├── index.json           # Team index for project
├── <team-id>/
│   ├── config.json      # Team configuration
│   ├── state.json       # Current state
│   └── sessions/        # Saved session data
│       └── <timestamp>.json
```

## Integration with OpenSpec

Teams work seamlessly with OpenSpec workflow:

1. Create team for spec implementation
2. Assign spec to team's orchestrator
3. Team members work on subtasks
4. Recovery preserves spec progress
5. Archive team after spec completion
