# Communication Protocol (CRITICAL - Prevents Infinite Loops)

This skill defines when agents should and should NOT send messages to prevent infinite ping-pong loops.

## STOP CONDITIONS - When NOT to Message:

### 1. Acknowledgments Only
- Orchestrator assigns task → Reply ONCE "Task received", then WORK SILENTLY
- DO NOT send multiple "I'm working on it" messages
- DO NOT send "Understood" or "OK" responses

### 2. Progress Updates via MCP Only
- Use `agent_report_progress()` MCP tool, NOT @mentions
- DO NOT message orchestrator for every step
- Report progress through tools, not chat messages

### 3. After Task Completion
- Send TASK_COMPLETED signal ONCE
- DO NOT expect or wait for acknowledgment
- Move to next task or terminate

### 4. After Receiving Acknowledgment
- If orchestrator says "OK" or "Thanks" → DO NOT respond
- Acknowledgments are conversation terminators

### 5. When No Question Was Asked
- Decision/broadcast from orchestrator → Note internally, NO response
- "Use JWT for auth" → Just follow it, don't reply "OK will do"

## WHEN TO Message:

1. **BLOCKED** - Cannot proceed without input
2. **QUESTION** - Need clarification on requirements
3. **TASK_COMPLETED** - Work is done (send once only)
4. **Critical Issue** - Security vulnerability, breaking change, etc.

## Message Flow Examples

**GOOD - Minimal messages:**
```
Orchestrator: @agent Implement feature X
Agent: Task received. Starting implementation.
[Works silently, uses MCP tools for progress]
Agent: TASK_COMPLETED - Feature X implemented
[Done - no more messages]
```

**BAD - Message spam:**
```
Orchestrator: @agent Implement feature X
Agent: Task received
Agent: Looking at requirements  ← UNNECESSARY
Agent: Starting to code now  ← UNNECESSARY
Orchestrator: Great  ← UNNECESSARY
Agent: Will let you know when done  ← UNNECESSARY
...
```

## Ping/Pong Protocol

When orchestrator sends "Ping":
- Respond with "Pong @orchestrator" ONCE
- Include brief status if relevant
- DO NOT wait for acknowledgment
- DO NOT continue the conversation

## Decision Tree

```
Received message?
├─ Is it a new TASK? → Acknowledge ONCE, work silently
├─ Is it a QUESTION? → Answer ONCE
├─ Is it a PING? → Pong ONCE with status
├─ Is it a DECISION/BROADCAST? → NO response
├─ Is it an ACKNOWLEDGMENT? → DO NOT respond
└─ Does it explicitly ask for response? → Respond once / Do nothing
```

## Golden Rule

**Use MCP tools for status reporting, use @mentions only for blockers and completion.**

```bash
# CORRECT: Report progress via MCP (silent)
agent_report_progress({
  agentId: "your-id",
  progress: 50,
  currentStep: "Working on feature"
})

# WRONG: Report progress via chat (noisy)
@orchestrator I'm 50% done  ← DON'T DO THIS
```
