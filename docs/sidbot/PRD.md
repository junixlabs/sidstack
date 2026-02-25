# SidBot - Product Requirements Document

> See [`DEFINITIONS.md`](./DEFINITIONS.md) for terminology. Architecture: [`PROPOSAL-DUAL-BRAIN.md`](./PROPOSAL-DUAL-BRAIN.md).

## Problem Statement

| Pain Point | Severity | Frequency |
|-----------|----------|-----------|
| New users don't know what SidStack can do or where to start | High | Every new user |
| Users must read docs externally to understand features | Medium | Weekly |
| No quick way to ask "how do I do X?" within the app | High | Daily |
| Deep code questions require switching to Claude Code CLI manually | High | Daily |
| Sending full code context to LLM is expensive and slow | Medium | Every interaction |

## Goals

- **G1**: Reduce time-to-first-action for new users via guided onboarding chat
- **G2**: Provide in-context help so users never leave the app to find answers
- **G3**: Enable action shortcuts — bot suggests clickable cards that navigate or create entities
- **G4**: Delegate deep code tasks to Claude Code CLI automatically, show progress in-panel
- **G5**: Minimize LLM token cost — Gemini handles 80% of interactions, Claude Code only when needed
- **G6**: Auto-capture lessons/knowledge after Claude Code work to make future queries cheaper

## Non-Goals

- **NG1**: Bot does NOT replace Claude Code — it orchestrates it for deep tasks
- **NG2**: Bot does NOT have direct write access to database — dispatches to existing app functions
- **NG3**: No voice input/output
- **NG4**: No multi-user/team chat
- **NG5**: No custom model fine-tuning — uses Gemini API + Claude Code CLI as-is

## Feature Requirements

### FR1: Bubble (P0)

| Item | Priority | Description |
|------|----------|-------------|
| Floating button | P0 | Fixed bottom-right, z-[60], always visible |
| State indicators | P0 | 5 states: idle, thinking, working, unread, disabled |
| Toggle panel | P0 | Click opens/closes panel |
| Keyboard shortcut | P0 | `Cmd+.` toggles panel |

### FR2: Panel (P0)

| Item | Priority | Description |
|------|----------|-------------|
| Slide-up animation | P0 | Panel slides up from bubble position |
| Welcome screen | P0 | Greeting + 4 quick action buttons on empty state |
| Conversation view | P0 | Scrollable message list with auto-scroll |
| Input area | P0 | Auto-resize textarea + send button |
| Close button | P0 | X button or Esc key |

### FR3: Conversation (P0)

| Item | Priority | Description |
|------|----------|-------------|
| User messages | P0 | Right-aligned, styled differently from bot |
| Bot messages | P0 | Left-aligned, markdown rendered |
| Streaming display | P0 | Token-by-token with blinking cursor (Gemini responses) |
| Progress card | P1 | Inline card showing Claude Code work with cancel button |
| Cancel streaming | P1 | Stop button during Gemini generation or Claude execution |

### FR4: Actions (P1)

| Item | Priority | Description |
|------|----------|-------------|
| Navigate action | P1 | Switch to a view (e.g., Task Manager) |
| Open doc action | P1 | Open a knowledge document |
| Create task action | P1 | Open NewTaskDialog pre-filled |
| Open knowledge action | P1 | Navigate to knowledge browser with search |
| Claude analyze action | P1 | Trigger one-shot Claude Code analysis |
| Claude implement action | P1 | Launch full Claude Code session |

### FR5: Config (P0)

| Item | Priority | Description |
|------|----------|-------------|
| Bot server URL | P0 | Default: `http://localhost:3200` |
| Connection test | P0 | 1-click test with status indicator |
| API key input | P0 | Gemini API key, masked, stored in app settings |
| Model selector | P1 | Dropdown of available Gemini models |

### FR6: Dual-Brain Routing (P0)

| Item | Priority | Description |
|------|----------|-------------|
| Intent classification | P0 | Gemini determines: direct answer vs knowledge search vs Claude Code |
| Knowledge-first lookup | P0 | Always check .sidstack/knowledge/ before calling Claude Code |
| Claude Code delegation | P1 | Spawn CLI for deep code tasks, stream progress back |
| Learning capture | P1 | After Claude completes, suggest lesson/knowledge creation |

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Bot adoption | >30% weekly active users | Track `panel_open` events per unique user/week |
| First-token latency | P95 < 2s (Gemini direct) | Timestamp diff: send → first SSE token |
| Claude delegation accuracy | >90% correct routing | Sample 50 queries: did Gemini pick right tool? |
| Knowledge hit rate | >40% queries answered from knowledge | Track `search_knowledge` success vs `claude_analyze` fallback |
| Cost per interaction | <$0.005 average | Sum Gemini + Claude costs / total interactions |

## Dependencies

| Dependency | Type | Status |
|-----------|------|--------|
| Bot Server (Gemini + Claude bridge) | New service | To be built |
| Gemini API key | External, user-provided | Required |
| Claude Code CLI on user machine | External | Required for deep tasks |
| SidStack API Server (:19432) | Internal, existing | Available |
| Knowledge system (.sidstack/) | Internal, existing | Available |

## Release Plan

| Phase | Scope | Dependency |
|-------|-------|-----------|
| Phase 1 (P0) | Bubble + Panel + Gemini direct answers + Config | Bot server with Gemini |
| Phase 2 (P1) | Knowledge search + SidStack API tools + Actions | Knowledge API integration |
| Phase 3 (P1) | Claude Code delegation + progress streaming | Claude bridge in bot server |
| Phase 4 (P1) | Learning loop + auto-capture | Training Room API integration |
