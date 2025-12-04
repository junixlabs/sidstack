# Workflow Negotiation

This skill defines how the orchestrator gathers project context and recommends development workflows through terminal conversation.

## When to Trigger

Workflow negotiation is triggered when:
1. User requests to build a **new project** or **major feature**
2. User starts a new conversation without prior project context
3. User explicitly asks to change development workflow

**Skip negotiation** when:
- User says "just build it" or similar
- Resuming an existing project with saved workflow
- Simple bug fix or small enhancement

## Context Gathering Protocol

### Step 1: Ask Context Questions (3-5 questions max)

When user requests a new project, ask these questions **concisely**:

```
To recommend the best approach, I need to understand:

1. **Domain**: What type of project? (e-commerce, SaaS, API, mobile app, etc.)
2. **Scale**: MVP/prototype or production-ready?
3. **Tech Stack**: Any preferences? (Node.js, Go, Python, specific frameworks?)
4. **Constraints**: Timeline or resource limitations?
```

**Rules:**
- Ask all questions in ONE message (not one by one)
- Accept partial answers - not all questions need answers
- User can skip with "no preference" or similar

### Step 2: Recommend Workflow

Based on context, recommend ONE workflow with brief reasoning:

| Context | Recommended Workflow | Reason |
|---------|---------------------|--------|
| New product, unclear requirements | Contract-First | Define before building |
| Quality-critical, has test requirements | TDD | Tests define acceptance |
| Simple feature, bug fix, prototype | Feature-First | Fast iteration |
| API-focused, multiple consumers | Contract-First | API contracts first |
| Refactoring, existing codebase | TDD | Protect against regressions |

**Recommendation format:**
```
Based on your requirements, I recommend **Contract-First Development**:
- We'll define API contracts and database schema first
- You'll review and approve before implementation starts
- This ensures clear specs and parallel development

Do you agree, or would you prefer a different approach?
```

### Step 3: Handle User Response

**If user agrees:**
```
Workflow confirmed. Saving project context...
Starting Phase 1: [First phase of chosen workflow]
```

**If user disagrees:**
```
Understood. What approach would you prefer?
- Contract-First: Define specs before coding
- TDD: Write tests first, then implement
- Feature-First: Jump straight to implementation
```

**If user wants more info:**
Briefly explain the workflow they're asking about, then ask again.

## Save Workflow Decision

After user confirms workflow, save to graph:

```typescript
// Use orchestrator_save_context MCP tool
orchestrator_save_context({
  projectId: "<project-id>",
  context: {
    workflow: "contract-first", // or "tdd", "feature-first"
    domain: "<from user>",
    techStack: ["<from user>"],
    scale: "<mvp|production>",
    constraints: "<from user>",
    currentPhase: "<first phase of workflow>"
  },
  summary: "Workflow negotiation complete. Starting [workflow] development."
})
```

Also store as knowledge for agent reference:

```typescript
// Use knowledge_store MCP tool
knowledge_store({
  title: "Project Workflow Decision",
  content: "Workflow: [chosen]\nDomain: [domain]\nTech: [stack]\nReason: [why this workflow]",
  type: "decision",
  tags: ["workflow", "project-config"]
})
```

## Workflow Types Summary

### Contract-First Development
**Phases:** Negotiate → Contract → Approve → Implement → Validate
- Best for: New projects, API-heavy, multiple teams
- Key: Approval gate before implementation

### TDD (Test-Driven Development)
**Phases:** Define Tests → Implement → Validate
- Best for: Quality-critical, refactoring
- Key: Tests written before code

### Feature-First (Default)
**Phases:** Requirements → Implement → Test
- Best for: Simple features, prototypes, bug fixes
- Key: Fast iteration, test after

## Golden Rules

1. **Ask once** - Don't drag out negotiation with many back-and-forth messages
2. **Accept defaults** - If user is impatient, default to Feature-First
3. **Save immediately** - Save context right after confirmation
4. **Resume gracefully** - If context exists, inform user and ask to continue or restart
