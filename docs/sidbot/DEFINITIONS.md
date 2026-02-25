# SidBot - Definitions

> Glossary for the SidBot feature. All docs in `docs/sidbot/` reference these terms.

## Core Concepts

| Term | Definition |
|------|-----------|
| SidBot | Conversational AI Orchestrator embedded in SidStack desktop app |
| Dual-Brain | Architecture pattern: Gemini (intent routing) + Claude Code (deep execution) |
| Bot Server | Standalone HTTP server hosting Gemini function calling + Claude Code bridge |
| Bubble | Floating circular button (bottom-right) that toggles the chat panel |
| Panel | Slide-up chat panel containing conversation UI |
| Conversation | A sequence of user messages and bot responses within a session |
| Message | A single user or bot turn in a conversation |
| Action Card | Clickable card rendered inside bot response to trigger app actions |
| Quick Action | Predefined prompt button shown on empty panel state |
| Learning Loop | Auto-capture of lessons/knowledge after Claude Code completes work |

## Architecture Terms

| Term | Definition |
|------|-----------|
| Intent Router | Gemini function calling layer that classifies user intent and picks the right tool |
| Function Calling | Gemini capability to invoke structured tools instead of generating free text |
| Claude Bridge | Bot server component that spawns Claude Code CLI and streams NDJSON output |
| One-shot Mode | `claude -p "prompt" --output-format stream-json` — single prompt, captured output |
| Persistent Mode | `claude --input-format stream-json --output-format stream-json` — multi-turn |
| SSE | Server-Sent Events — one-way server-to-client streaming over HTTP |
| NDJSON | Newline-Delimited JSON — Claude Code's structured output format |
| Context Window | Maximum token limit for a single Gemini API call (~500 tokens system prompt) |

## UI Terms

| Term | Definition |
|------|-----------|
| Idle State | Bubble shows default icon, no active conversation |
| Thinking State | Bubble pulses, Gemini is processing or Claude Code is working |
| Working State | Progress bar visible, Claude Code executing deep task |
| Unread State | Bubble shows dot badge, new response available while panel closed |
| Disabled State | Bubble grayed out, bot server unreachable |
| Welcome Screen | Empty panel state with greeting and quick action buttons |
| Config Panel | Settings view for bot server URL, API key, and model selection |
| Progress Card | Inline card showing Claude Code execution progress with cancel button |

## Cross-References

- **Proposal**: [`PROPOSAL-DUAL-BRAIN.md`](./PROPOSAL-DUAL-BRAIN.md) — approved architecture concept
- **PRD**: [`PRD.md`](./PRD.md) — requirements and success metrics
- **System Design**: [`SYSTEM-DESIGN.md`](./SYSTEM-DESIGN.md) — architecture diagrams
- **API Spec**: [`API-SPEC.md`](./API-SPEC.md) — HTTP/SSE contract
- **Backend**: [`BACKEND-DESIGN.md`](./BACKEND-DESIGN.md) — bot server internals
- **Frontend**: [`FRONTEND-DESIGN.md`](./FRONTEND-DESIGN.md) — components and store
- **UI Mockup**: [`UI-MOCKUP.md`](./UI-MOCKUP.md) — wireframes for all states
