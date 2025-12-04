# TDD Workflow (Test-Driven Development)

This skill defines the TDD workflow where tests are written before implementation.

## Overview

TDD ensures:
- Tests define acceptance criteria
- Code is written to pass tests
- High test coverage from the start
- Refactoring with confidence

## Phases

### Phase 1: Define
**Goal:** Write test specifications first

**Orchestrator actions:**
1. Understand feature requirements from user
2. Spawn Worker Agent to write test specs first
3. Tests define what "done" looks like
4. Review test coverage with user

**Test types to define:**
| Test Type | Purpose | When |
|-----------|---------|------|
| Unit Tests | Individual functions | Always |
| Integration Tests | Component interactions | API, DB work |
| E2E Tests | Full user flows | Critical paths |
| Contract Tests | API compatibility | Multi-service |

**Worker Agent skill assignment (test phase):**
```
Worker Agent: tdd-workflow.md, capabilities/test/unit.md
```

**Test spec output:**
```typescript
// Example: User registration feature
describe('User Registration', () => {
  it('should create user with valid email and password')
  it('should reject invalid email format')
  it('should reject weak passwords')
  it('should hash password before storing')
  it('should send verification email')
  it('should prevent duplicate emails')
})
```

### Phase 2: Implement
**Goal:** Write code to pass tests (RED → GREEN)

**Orchestrator actions:**
1. Spawn Worker Agent with test specs
2. Worker implements minimum code to pass tests
3. Track test pass/fail status
4. Iterate until all tests pass

**RED → GREEN cycle:**
```
1. RED: Run tests - they should fail (no implementation yet)
2. GREEN: Write minimal code to pass tests
3. Verify: All tests pass
4. Repeat for next test case
```

**Worker Agent skill assignment (implement phase):**
```
Worker Agent: tdd-workflow.md, capabilities/implement/feature.md
```

**Implementation rules:**
- Write only enough code to pass the current failing test
- Don't add features not covered by tests
- Run tests frequently
- Commit after each test passes

### Phase 3: Validate (REFACTOR)
**Goal:** Improve code quality while keeping tests green

**Orchestrator actions:**
1. All tests passing - code works
2. Review code for refactoring opportunities
3. Refactor with confidence (tests protect)
4. Ensure tests still pass after refactor

**Refactoring opportunities:**
- Extract reusable functions
- Improve naming
- Remove duplication
- Optimize performance (with benchmarks)

**REFACTOR rules:**
```
1. Tests must pass BEFORE refactoring
2. Make small changes
3. Run tests AFTER each change
4. If tests fail → revert and try again
5. Never refactor and add features simultaneously
```

## TDD Cycle Visualization

```
┌─────────────────────────────────────┐
│                                     │
│  ┌─────┐    ┌───────┐    ┌────────┐ │
│  │ RED │ → │ GREEN │ → │REFACTOR│ │
│  └─────┘    └───────┘    └────────┘ │
│     ↑                         │     │
│     └─────────────────────────┘     │
│                                     │
│  RED: Write failing test            │
│  GREEN: Write code to pass          │
│  REFACTOR: Improve without breaking │
│                                     │
└─────────────────────────────────────┘
```

## Context for Agents

When spawning agents for TDD:

```typescript
// Worker Agent for test definition (TDD Phase 1)
const workerTestPrompt = `
${baseWorkerPrompt}

## TDD Context - Test Definition Phase
You are defining tests FIRST, before implementation.

Requirements from user:
${userRequirements}

Write comprehensive test specs that define:
- Happy path scenarios
- Edge cases
- Error handling
- Security considerations

Tests should be executable and specific.
`

// Worker Agent for implementation (TDD Phase 2)
const workerImplPrompt = `
${baseWorkerPrompt}

## TDD Context - Implementation Phase
You are implementing code to pass existing tests.

Test specs:
${testSpecs}

Rules:
- Run tests first (they should fail)
- Write minimal code to pass each test
- Don't add untested features
- Run tests after each change
`
```

## Context Persistence

Save TDD progress:

```typescript
orchestrator_save_context({
  projectId: "...",
  context: {
    workflow: "tdd",
    currentPhase: "implement", // define → implement → validate
    testStatus: {
      total: 10,
      passing: 6,
      failing: 4,
      pending: 0
    },
    completedFeatures: ["user-auth"],
    currentFeature: "user-registration"
  },
  summary: "TDD in progress. 6/10 tests passing for user-registration."
})
```

## When to Use TDD

**Good fit:**
- Quality-critical features (auth, payments)
- Refactoring existing code
- Complex business logic
- API development
- Bug fixes (write test to reproduce, then fix)

**Not ideal:**
- Rapid prototyping
- UI exploration
- Spike/research tasks
- One-off scripts

## Golden Rules

1. **Test first, always** - Never write implementation before tests
2. **One test at a time** - Focus on one failing test
3. **Minimal implementation** - Just enough to pass
4. **Green before refactor** - Only refactor passing code
5. **Tests are documentation** - Tests explain expected behavior
