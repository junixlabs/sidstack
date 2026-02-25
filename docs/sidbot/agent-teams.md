# Agent Teams with SidStack

## Overview

Claude Code Agent Teams (experimental) allows multiple Claude sessions to collaborate as teammates. SidStack's Worker/Reviewer governance pattern maps naturally to Agent Teams.

## Prerequisites

- Claude Code v2.1.x or later
- Enable experimental feature:

```json
// .claude/settings.json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

## Worker + Reviewer Pattern

### Flow

1. Lead session creates an implementation task via `mcp__sidstack__task_create`
2. Worker teammate implements the code using `/sidstack-dev feature [task-id]`
3. Worker marks task "ready for review" at progress 95%
4. Reviewer teammate (sidstack-reviewer agent) picks up the task
5. Reviewer reports PASS/FAIL back to lead

### Recommended Setup

| Setting | Value | Why |
|---------|-------|-----|
| teammateMode | `tmux` | Visual monitoring of both agents |
| Worker skills | sidstack-dev | Full implementation workflow |
| Reviewer skills | sidstack-aware | Task lifecycle + completion tracking |

### How It Works

The Worker and Reviewer are separate Claude sessions that share the same SidStack database. This means:

- Tasks created by the Worker are visible to the Reviewer
- Progress updates are real-time via the shared SQLite database
- Quality gates are enforced independently per agent role
- The anti-bias protocol (no self-review) is naturally enforced since each agent is a separate session

### Configuration Example

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "teammates": {
    "worker": {
      "skills": ["sidstack-dev", "sidstack-aware"],
      "description": "Implements features following SidStack governance"
    },
    "reviewer": {
      "skills": ["sidstack-dev", "sidstack-aware"],
      "description": "Reviews implementations for quality and correctness"
    }
  }
}
```

## Why Documentation-First

Agent Teams is currently in research preview and may change. Rather than hard-coding integration that could break on updates, this guide lets users opt-in safely and adapt as the feature evolves.

## Without Agent Teams

If Agent Teams is not available or not desired, the same Worker/Reviewer handoff works manually:

1. Worker session: `/sidstack-dev feature [task-id]` (marks ready for review at 95%)
2. Open a NEW terminal
3. Spawn a `sidstack-reviewer` agent for independent review

The key principle is the same: **never self-review in the same session**.
