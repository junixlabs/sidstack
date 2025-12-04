# Impact Analysis User Guide

## Overview

The Change Impact Analyzer helps you understand the scope, risks, and required validations before implementing changes. It provides a systematic approach to:

1. **Identify affected areas** - Modules, files, and dependencies
2. **Assess risks** - Security, performance, breaking changes
3. **Generate validations** - Tests and manual checks
4. **Control implementation** - Gate system to ensure quality

## Quick Start

### 1. Analyze a Change

Via MCP tool:
```bash
impact_analyze({ description: "Add user authentication with OAuth2" })
```

Via API:
```bash
curl -X POST http://localhost:19432/api/impact/analyze \
  -H "Content-Type: application/json" \
  -d '{"description": "Add user authentication with OAuth2"}'
```

### 2. Review the Analysis

The analysis includes:

- **Scope**: Primary files, affected modules, dependencies
- **Data Flows**: Entity relationships and impact propagation
- **Risks**: Categorized by severity (critical, high, medium, low)
- **Validations**: Auto-generated checklist of tests and checks

### 3. Address Blockers

If the gate status is `blocked`:

1. Review each blocker in the analysis
2. Either resolve the underlying issue or request approval
3. Mark validations as complete as you progress

### 4. Proceed with Implementation

Once gate status is `clear` or `warning`, you can proceed with the implementation.

## Analysis Components

### Scope Detection

The scope detector identifies:

| Category | Description |
|----------|-------------|
| Primary Files | Directly mentioned or implied files |
| Primary Modules | Modules containing primary files |
| Affected Files | Files with dependencies on primary files |
| Affected Modules | Modules with dependencies on primary modules |
| Affected Entities | Database entities/models in scope |

### Risk Assessment

#### Built-in Rules

| Rule ID | Trigger | Severity |
|---------|---------|----------|
| R001 | Core module modification | high |
| R002 | 3+ modules affected | medium |
| R003 | Breaking API changes | high |
| R004 | Database schema changes | high |
| R005 | Security-sensitive code (auth, crypto) | critical |
| R006 | High-traffic endpoint | medium |
| R007 | External integration changes | medium |
| R008 | Performance-critical path | medium |

#### Severity Levels

| Level | Meaning | Action |
|-------|---------|--------|
| critical | Requires immediate attention | Must resolve before proceeding |
| high | Significant risk | Should resolve or get approval |
| medium | Notable concern | Should review and acknowledge |
| low | Minor consideration | Good to be aware |

### Data Flow Analysis

Maps how data moves through the system:

```
User Input → Validation → Service → Database → Response
     │                       │
     └─── Audit Log ─────────┘
```

Each flow includes:
- **Source/Target**: Start and end points
- **Impact Level**: direct, indirect, or cascade
- **Suggested Tests**: Auto-generated test ideas
- **Affected Operations**: CRUD operations impacted

### Validation Checklist

Auto-generated validations by category:

| Category | Examples |
|----------|----------|
| test | Unit tests, integration tests |
| data-flow | Data integrity checks |
| api | Endpoint testing, contract validation |
| migration | Schema migration tests |
| manual | Code review, security review |
| review | Documentation review |

## Gate System

### Status Values

| Status | Meaning | Can Proceed? |
|--------|---------|--------------|
| blocked | Unresolved critical/high risks | No |
| warning | Medium/low risks present | Yes |
| clear | All risks addressed | Yes |

### Resolving Blockers

Option 1: Address the underlying issue
```bash
# Complete required validations
impact_run_validation({ analysisId: "...", validationId: "..." })
```

Option 2: Request approval
```bash
impact_approve_gate({
  analysisId: "...",
  approver: "tech-lead",
  reason: "Reviewed and acceptable risk"
})
```

### Hook Integration

The `progress-hook.sh` automatically checks gate status before file modifications:

```bash
# Normal operation - gate check enabled
./scripts/progress-hook.sh

# Disable gate check
SIDSTACK_SKIP_GATE_CHECK=1 ./your-command
```

## API Reference

### POST /api/impact/analyze

Run impact analysis on a task, spec, or description.

**Request Body:**
```json
{
  "taskId": "task-123",       // Optional
  "specId": "spec-456",       // Optional
  "description": "...",       // Optional - used if no taskId/specId
  "projectPath": "/path"      // Required
}
```

**Response:**
```json
{
  "id": "impact-789",
  "status": "completed",
  "scope": { ... },
  "risks": [ ... ],
  "validations": [ ... ],
  "dataFlows": [ ... ],
  "gateStatus": "blocked"
}
```

### GET /api/impact/:id

Get analysis details.

### GET /api/impact/:id/gate

Get current gate status.

**Response:**
```json
{
  "status": "blocked",
  "blockers": [
    { "id": "...", "description": "...", "severity": "high" }
  ],
  "warnings": [ ... ],
  "approvals": [ ... ]
}
```

### POST /api/impact/:id/gate/approve

Approve the gate (override blockers).

**Request Body:**
```json
{
  "approver": "user-name",
  "reason": "Explanation for approval"
}
```

### POST /api/impact/:id/validations/:vid/run

Run a specific validation.

**Response:**
```json
{
  "id": "val-001",
  "status": "passed",
  "output": "...",
  "executedAt": "2026-01-19T..."
}
```

### GET /api/impact/:id/export/claude

Export analysis as Claude context.

**Response:**
```json
{
  "rules": "# Impact Analysis Context\n...",
  "summary": "...",
  "constraints": [ ... ]
}
```

## MCP Tools Reference

### impact_analyze

Analyze a task, spec, or description.

```typescript
impact_analyze({
  taskId?: string,
  specId?: string,
  description?: string,
  projectPath?: string
})
```

### impact_check_gate

Check gate status for an analysis.

```typescript
impact_check_gate({
  analysisId: string
})
```

### impact_run_validation

Run a specific validation.

```typescript
impact_run_validation({
  analysisId: string,
  validationId: string
})
```

### impact_get_context

Get Claude-compatible context export.

```typescript
impact_get_context({
  analysisId: string
})
```

### impact_approve_gate

Approve gate (override blockers).

```typescript
impact_approve_gate({
  analysisId: string,
  approver: string,
  reason: string
})
```

### impact_list

List analyses with optional filters.

```typescript
impact_list({
  projectPath?: string,
  status?: 'pending' | 'completed' | 'failed'
})
```

## Best Practices

### When to Analyze

Always run impact analysis for:
- New features affecting multiple modules
- Changes to core/shared code
- Database schema modifications
- API endpoint changes
- Security-related changes

### Review Process

1. **Read the scope** - Understand what's affected
2. **Check data flows** - See how changes propagate
3. **Address high risks first** - Focus on critical and high severity
4. **Run automated validations** - Let the system verify what it can
5. **Complete manual checks** - Review code, documentation, security

### Gate Approval Guidelines

Only approve gates when:
- The risk is understood and acceptable
- Mitigation is in place (monitoring, rollback plan)
- Stakeholders are aware
- Documentation exists for the decision

## Troubleshooting

### Analysis Returns Empty Scope

- Check that the description is specific enough
- Verify module knowledge is up to date
- Try adding explicit file paths

### Gate Always Blocked

- Review risk rules in `packages/shared/src/impact/risk-assessor.ts`
- Check if validations can be completed
- Consider if the change scope is too broad

### Validations Fail

- Check command syntax in validation definition
- Verify test files exist
- Review test dependencies

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Input Layer                     │
│  (Task/Spec/Description → Change Parser)        │
└─────────────────┬───────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────┐
│               Analysis Engine                    │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │   Scope    │ │    Risk    │ │    Data    │  │
│  │  Detector  │ │  Assessor  │ │   Flows    │  │
│  └────────────┘ └────────────┘ └────────────┘  │
└─────────────────┬───────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────┐
│              Validation Layer                    │
│  (Generator → Runner → Results)                 │
└─────────────────┬───────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────┐
│                Gate Controller                   │
│  (Blockers → Approvals → Status)                │
└─────────────────────────────────────────────────┘
```

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Project instructions with impact analysis section
- [Risk Rules](../packages/shared/src/impact/risk-assessor.ts) - Risk rule definitions
- [Validation Types](../packages/shared/src/impact/types.ts) - Type definitions
