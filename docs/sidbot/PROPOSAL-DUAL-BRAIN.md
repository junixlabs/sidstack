# SidBot: Dual-Brain Orchestrator

> Proposal for SidBot architecture. Approved concept — all docs in `docs/sidbot/` reflect this design.

## Core Concept

SidBot is a **Conversational AI Orchestrator** — a thin intelligence layer (Gemini) that understands user intent and orchestrates the full SidStack ecosystem + Claude Code CLI to fulfill it. Gemini doesn't need to understand code. Claude Code doesn't need a UI. SidBot bridges both.

## Why Breakthrough

| Capability | Copilot Chat | Cursor | ChatGPT | **SidBot** |
|-----------|-------------|--------|---------|-----------|
| Cheap for simple questions | ❌ uses GPT-4 | ❌ | ❌ | ✅ Gemini |
| Deep code analysis | ❌ | ✅ | ❌ | ✅ Claude Code |
| Execute code changes | ❌ | limited | ❌ | ✅ Full CLI |
| Project knowledge | ❌ | ❌ | ❌ | ✅ .sidstack/ |
| Learns from mistakes | ❌ | ❌ | ❌ | ✅ Training Room |
| Task management | ❌ | ❌ | ❌ | ✅ Built-in |
| Multi-model cost optimization | ❌ | ❌ | ❌ | ✅ Gemini + Claude |

## Architecture

```
User ←→ SidBot Panel (Frontend)
              │
         Intent Router (Gemini, ~100-500 tokens/turn)
              │
    ┌─────────┼─────────────┐
    │         │             │
Direct     SidStack      Claude Code CLI
Answer     API/MCP       (one-shot or persistent)
(Gemini)   (70 tools)    (deep code work)
    │         │             │
    └─────────┼─────────────┘
              │
         Response Synthesizer (Gemini summarizes all results)
              │
         User sees clean response + action cards
```

## Gemini Function Calling — The Key

Gemini system prompt is ~500 tokens. No code context. Only tool descriptions:

| Tool | When | Cost |
|------|------|------|
| `respond(text)` | FAQ, help, navigation guidance | ~$0 |
| `search_knowledge(query)` | Question about project/module | ~$0 |
| `query_tasks(filter)` | "Show my tasks", "What's blocked?" | ~$0 |
| `query_tickets(filter)` | "Any new tickets?" | ~$0 |
| `navigate(view)` | "Open Task Manager" | ~$0 |
| `create_task(title, desc)` | "Create a task for this" | ~$0 |
| `create_ticket(title)` | "Log this as a ticket" | ~$0 |
| `open_doc(docId)` | "Show auth module docs" | ~$0 |
| `claude_analyze(prompt)` | "Why does X fail?" — needs code reading | ~$0.02 |
| `claude_implement(prompt, taskId?)` | "Fix this bug" — needs code changes | ~$0.05 |
| `claude_resume(sessionId)` | "Continue where we left off" | ~$0.03 |

## Cost Model

| Interaction Type | % usage | Gemini | Claude | Total |
|-----------------|---------|--------|--------|-------|
| Help/FAQ | 40% | ~$0.00001 | $0 | ~$0.00001 |
| Navigation/actions | 20% | ~$0.00001 | $0 | ~$0.00001 |
| Knowledge search | 20% | ~$0.00003 | $0 | ~$0.00003 |
| Code analysis | 15% | ~$0.00003 | ~$0.02 | ~$0.02 |
| Implementation | 5% | ~$0.00002 | ~$0.05 | ~$0.05 |

**Average: ~$0.004/interaction** — 80% cheaper than single-model approach.

## The Learning Loop

```
Round 1: User asks → Gemini routes → Claude Code analyzes ($0.05)
                                            │
                                   Auto-capture:
                                   ├── task_update(completed)
                                   ├── lesson_create("Login timeout fix")
                                   └── knowledge_update(auth module)

Round 2: Same question → Gemini → search_knowledge → Found!
                          Cost: $0.00003 (savings: 99.94%)
```

System gets cheaper over time as knowledge accumulates.

## Infrastructure Reuse

| Component | Status | Location |
|-----------|--------|----------|
| Claude Code one-shot + NDJSON parse | ✅ Exists | `src-tauri/src/claude_process.rs` |
| Claude Code persistent session | ✅ Exists | `spawn_persistent_session()` |
| Knowledge search (keyword-based) | ✅ Exists | `packages/shared/src/knowledge/service.ts` |
| Task/Ticket CRUD (10+6 MCP tools) | ✅ Exists | `packages/mcp-server/` |
| Training Room (15 MCP tools) | ✅ Exists | `packages/mcp-server/` |
| Session tracking + resume | ✅ Exists | 7 MCP tools + DB |
| Context builder | ✅ Exists | `buildSessionContext()` |
| Agent coordinator | ✅ Exists | 10 Tauri commands |
| REST API (14 routers) | ✅ Exists | `packages/api-server/` |
| **Bot Server (Gemini + routing)** | ❌ New | `packages/bot-server/` |
| **Frontend Panel** | ❌ New | `src/components/sidbot/` |
| **Claude Code bridge** | ❌ New | Bot server → CLI spawn |
| **Progress streaming** | ❌ New | SSE pipe |

~70% of infrastructure already exists.

## Claude Code Invocation Modes

| Mode | Command | Use Case |
|------|---------|----------|
| One-shot | `claude -p "prompt" --output-format stream-json` | Analysis, Q&A about code |
| Persistent | `claude --input-format stream-json --output-format stream-json` | Multi-turn implementation |
| Resume | `claude --resume {id} --output-format stream-json` | Continue previous work |

Output: NDJSON events (system, assistant, tool_use, tool_result, result, error).

## Scenario Walkthrough

**Simple help** → Gemini `respond()` directly → 0.1s, ~$0
**Project question** → Gemini `search_knowledge()` → API → `respond(summary)` → 0.5s, ~$0
**Code question** → Gemini `claude_analyze()` → spawn CLI → parse output → `respond(summary)` → 5s, ~$0.02
**Implementation** → Gemini `claude_implement()` → full session → progress bar → auto task update → 30s, ~$0.05
**Repeat question** → Gemini `search_knowledge()` → hit from previous lesson → 0.3s, $0

## Cross-References

- [`SYSTEM-DESIGN.md`](./SYSTEM-DESIGN.md) — Architecture diagrams reflecting dual-brain
- [`API-SPEC.md`](./API-SPEC.md) — SSE events including Claude progress
- [`BACKEND-DESIGN.md`](./BACKEND-DESIGN.md) — Bot server with Gemini function calling + Claude bridge
- [`FRONTEND-DESIGN.md`](./FRONTEND-DESIGN.md) — Components including progress UI
- [`UI-MOCKUP.md`](./UI-MOCKUP.md) — Wireframes for Claude working state
