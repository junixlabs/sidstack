# Contract-First Development

This skill defines the Contract-First Development workflow where specifications are created and approved before implementation begins.

## Overview

Contract-First Development ensures:
- Clear specifications before coding
- User approval gate before implementation
- Parallel development after contracts approved
- Validation against defined contracts

## Phases

### Phase 1: Negotiate
**Goal:** Gather requirements from user

**Orchestrator actions:**
1. Understand what user wants to build
2. Ask clarifying questions about features
3. Identify API consumers, database needs, integrations
4. Document high-level requirements

**Output:** Requirements document (can be informal conversation summary)

### Phase 2: Contract
**Goal:** Create formal specifications

**Orchestrator actions:**
1. Spawn Worker Agent for API contracts (OpenAPI/Swagger)
2. Spawn Worker Agent for database schema (Prisma, SQL DDL)
3. Spawn Worker Agent for component interfaces (TypeScript types)
4. Collect all contract artifacts

**Contract types:**
| Type | Format | Agent |
|------|--------|-------|
| API Contract | OpenAPI 3.0 YAML | Worker |
| Database Schema | Prisma schema | Worker |
| Component Interface | TypeScript interfaces | Worker |
| Event Contract | AsyncAPI | Worker |

**Skill assignment for contract phase:**
```
Worker Agent: contract-first.md, capabilities/design/api.md, capabilities/design/database.md
```

### Phase 3: Approve (CRITICAL GATE)

**Goal:** User reviews and approves contracts

**Orchestrator actions:**
1. Present all contracts to user in readable format
2. Explain each contract briefly
3. Ask for explicit approval
4. Handle revision requests

**Approval protocol:**
```
Contracts ready for review:

1. **API Contract** (api-spec.yaml)
   - Endpoints: [list main endpoints]
   - Auth: [auth method]

2. **Database Schema** (schema.prisma)
   - Models: [list main models]
   - Relations: [key relations]

Please review and confirm:
- "Approve" to proceed with implementation
- "Revise [item]" to request changes
```

**CRITICAL RULE:**
```
DO NOT spawn Worker agents for implementation until user explicitly says:
- "Approve" / "Approved"
- "Looks good" / "LGTM"
- "Proceed" / "Go ahead"
- "Yes" (in response to approval question)

If user says "Let me think" or similar → WAIT
If user asks questions → ANSWER, then ask again for approval
```

### Phase 4: Implement
**Goal:** Build according to approved contracts

**Orchestrator actions:**
1. Break contracts into implementation tasks
2. Spawn Worker agents with contract context
3. Agents implement against contracts (not guessing specs)
4. Track progress across parallel implementations

**Agent spawning with context:**
```typescript
// Include contract content in agent prompt
const agentPrompt = `
${baseAgentPrompt}

## Contract Context
You are implementing against these approved contracts:

### API Contract
${apiContractContent}

### Database Schema
${schemaContent}

IMPORTANT: Implement exactly as specified. Do not deviate from contracts.
`
```

**Parallel implementation:**
- Backend API can start immediately
- Frontend can start with API contract (mock responses)
- Database migrations can run in parallel
- Integration tests can be written against contracts

### Phase 5: Validate
**Goal:** Verify implementation matches contracts

**Orchestrator actions:**
1. Spawn Reviewer Agent for validation
2. Compare implementation against contracts
3. Run contract tests (API matches spec, schema matches design)
4. Report discrepancies

**Validation checks:**
- API responses match OpenAPI spec
- Database schema matches Prisma definition
- Component interfaces implemented correctly
- All endpoints from contract exist

## Contract Storage

Contracts are stored as files and referenced in graph:

```typescript
// After Worker creates API contract
agent_create_artifact({
  agentId: "worker-agent-1",
  artifactType: "schema",
  path: "specs/api-spec.yaml",
  description: "OpenAPI contract for user service"
})

// Link to task in graph
// Orchestrator tracks which contracts belong to which task
```

## Context Persistence

Save phase transitions:

```typescript
// After each phase completion
orchestrator_save_context({
  projectId: "...",
  context: {
    workflow: "contract-first",
    currentPhase: "implement", // negotiate → contract → approve → implement → validate
    completedPhases: ["negotiate", "contract", "approve"],
    contracts: [
      { type: "api", path: "specs/api-spec.yaml", approved: true },
      { type: "database", path: "prisma/schema.prisma", approved: true }
    ]
  },
  summary: "Contracts approved. Implementation in progress."
})
```

## Phase Transition Rules

```
negotiate → contract: When requirements are clear
contract → approve: When all contracts created
approve → implement: ONLY when user explicitly approves
implement → validate: When implementation complete
validate → done: When all validations pass
```

## Golden Rules

1. **Never skip approval** - Even if user seems eager, always get explicit approval
2. **Contracts are source of truth** - Worker agents follow contracts, not assumptions
3. **Track deviations** - If implementation must differ, document and get approval
4. **Validate before declaring done** - Run contract tests before marking complete
