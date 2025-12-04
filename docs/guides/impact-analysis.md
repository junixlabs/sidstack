# Impact Analysis

Assess risks before implementing changes.

## Overview

The Impact Analyzer evaluates a proposed change and identifies:
- **Scope** - Which modules and files are affected
- **Risks** - Potential issues ranked by severity
- **Validations** - Checks to run before and after the change
- **Gate status** - Whether implementation can proceed

## Running an Analysis

### From Claude Code
```
Analyze the impact of adding user authentication
```
Uses `impact_analyze` tool.

### From the API
```bash
curl -X POST http://localhost:19432/api/impact/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task-123",
    "projectPath": "/path/to/project"
  }'
```

## Risk Rules

Built-in rules that trigger automatically:

| Rule | Description | Severity |
|------|-------------|----------|
| R001 | Core module modification | high |
| R002 | Multiple modules affected | medium |
| R003 | Breaking API changes | high |
| R004 | Database schema changes | high |
| R005 | Security-sensitive code | critical |
| R006 | High-traffic endpoint | medium |
| R007 | External integration | medium |
| R008 | Performance-critical path | medium |

## Gate System

The gate system controls whether a change can proceed:

| Status | Meaning |
|--------|---------|
| `blocked` | Must resolve blockers before implementing |
| `warning` | Warnings present but can proceed |
| `clear` | Safe to implement |

### Checking Gate Status
```
Check the gate status for impact analysis imp-001
```

### Approving Gate
```
Approve the gate for impact analysis imp-001
```

## Validations

Each analysis generates a validation checklist:
- Type check passes
- Unit tests pass
- API backward compatibility
- No security regressions
- Performance benchmarks

Run validations individually or all at once from the desktop UI.

## Pre-Edit Hook

SidStack automatically checks impact analysis gates before file edits in Claude Code sessions. If the affected module has blockers, you'll see a warning.

Bypass with environment variable:
```bash
SIDSTACK_SKIP_IMPACT_CHECK=1
```
