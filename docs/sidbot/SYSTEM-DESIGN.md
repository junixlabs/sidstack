# SidBot - System Design

> Dual-Brain Orchestrator. See [`PROPOSAL-DUAL-BRAIN.md`](./PROPOSAL-DUAL-BRAIN.md) for concept. See [`API-SPEC.md`](./API-SPEC.md) for contract.

## Component Diagram

```mermaid
graph TB
    subgraph Desktop [SidStack Desktop App]
        Bubble[SidBot Bubble]
        Panel[SidBot Panel]
        Store[sidBotStore]
        Executor[Action Executor]
    end

    subgraph BotServer [Bot Server :3200]
        Router[Express Router]
        Auth[Auth Middleware]
        Intent[Intent Router<br/>Gemini Function Calling]
        KB[Knowledge Search]
        API[SidStack API Client]
        Bridge[Claude Bridge]
        Synth[Response Synthesizer]

        Router --> Auth --> Intent
        Intent -->|respond| Synth
        Intent -->|search_knowledge| KB --> Synth
        Intent -->|query_tasks, create_task| API --> Synth
        Intent -->|claude_analyze, claude_implement| Bridge --> Synth
    end

    subgraph External [External Services]
        Gemini[Gemini API<br/>Function Calling]
        Claude[Claude Code CLI<br/>on user machine]
        SidAPI[SidStack API :19432]
    end

    Panel -- "POST /api/chat (SSE)" --> Router
    Intent -- "tools + intent" --> Gemini
    Bridge -- "claude -p ... --output-format stream-json" --> Claude
    KB -- "GET /api/knowledge/search" --> SidAPI
    API -- "REST calls" --> SidAPI
    Synth -- "SSE stream" --> Store
    Store --> Executor -- "dispatch" --> Desktop
```

## Message Flow (Sequence)

```mermaid
sequenceDiagram
    participant U as User
    participant P as Panel
    participant S as sidBotStore
    participant B as Bot Server
    participant G as Gemini API
    participant K as Knowledge API
    participant C as Claude Code CLI

    U->>P: Type message + Enter
    P->>S: addMessage(user, text)
    S->>B: POST /api/chat (SSE)

    B->>G: Send message + tool definitions
    G-->>B: Function call decision

    alt respond() — direct answer
        B-->>S: SSE: token stream
    else search_knowledge(query)
        B->>K: GET /api/knowledge/search?q=...
        K-->>B: Results
        B->>G: Tool result → generate response
        G-->>B: Token stream
        B-->>S: SSE: tokens + action cards
    else claude_analyze(prompt)
        B-->>S: SSE: claude_start {status: "analyzing"}
        B->>C: claude -p "prompt" --output-format stream-json
        loop NDJSON events
            C-->>B: {type: "assistant", content: [...]}
            B-->>S: SSE: claude_progress {step, detail}
        end
        C-->>B: {type: "result", result: "..."}
        B->>G: Claude output → summarize
        G-->>B: Summary tokens
        B-->>S: SSE: tokens + claude_end
    end

    B-->>S: SSE: done
    S->>P: Re-render
```

## Component Boundaries

| Component | File Path | Responsibility |
|-----------|-----------|---------------|
| SidBotBubble | `src/components/sidbot/SidBotBubble.tsx` | Floating button, 5 state indicators |
| SidBotPanel | `src/components/sidbot/SidBotPanel.tsx` | Panel container, open/close animation |
| SidBotMessages | `src/components/sidbot/SidBotMessages.tsx` | Message list, auto-scroll, streaming |
| SidBotInput | `src/components/sidbot/SidBotInput.tsx` | Textarea, send/cancel buttons |
| SidBotActionCard | `src/components/sidbot/SidBotActionCard.tsx` | Clickable action card |
| SidBotProgressCard | `src/components/sidbot/SidBotProgressCard.tsx` | Claude Code execution progress |
| SidBotWelcome | `src/components/sidbot/SidBotWelcome.tsx` | Empty state with quick actions |
| SidBotConfig | `src/components/sidbot/SidBotConfig.tsx` | Server URL, API key, model |
| sidBotStore | `src/stores/sidBotStore.ts` | Messages, streaming, config, claude status |

## State Shape

```typescript
interface SidBotStore {
  // Config
  serverUrl: string;              // default: "http://localhost:3200"
  isConnected: boolean;
  selectedModel: string;
  // Conversation
  conversationId: string | null;
  messages: SidBotMessage[];
  isStreaming: boolean;           // Gemini token streaming
  streamingText: string;
  abortController: AbortController | null;
  // Claude Code delegation
  claudeStatus: "idle" | "analyzing" | "implementing" | "done" | "error";
  claudeProgress: { step: string; detail: string } | null;
  claudeSessionId: string | null;
  // UI
  isPanelOpen: boolean;
  hasUnread: boolean;
  activeTab: "chat" | "config";
  // Actions
  togglePanel: () => void;
  sendMessage: (text: string) => Promise<void>;
  cancelStream: () => void;
  executeAction: (action: SidBotAction) => void;
  testConnection: () => Promise<boolean>;
  clearConversation: () => void;
}
```

## Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Gemini API key in frontend | Sent per-request to bot server, never stored on disk unencrypted |
| XSS via bot/Claude responses | Rendered via existing `MarkdownPreview` which sanitizes HTML |
| Claude Code execution safety | One-shot mode is read-only; implement mode requires user confirmation |
| Bot server CORS | Restricts to `tauri://localhost` and `http://localhost:*` |

## Integration Map

| Existing System | Integration | Change |
|----------------|-------------|--------|
| `App.tsx` | Mount `<SidBotBubble />` + `<SidBotPanel />` at z-[60] | Add 2 components |
| `packages/api-server/` | Bot server calls REST endpoints for knowledge, tasks, tickets | No changes |
| Claude Code CLI | Bot server spawns via `claude -p` or persistent mode | No changes |
| `src/stores/appStore.ts` | Bot reads `activeViewId`, `projectPath` for context | Read-only |
| Training Room | After Claude completes, bot suggests lesson capture via API | No changes |

## Performance Budget

| Metric | Budget |
|--------|--------|
| Gemini first-token (direct answer) | P95 < 2s |
| Gemini first-token (after knowledge search) | P95 < 3s |
| Claude Code one-shot (analysis) | P95 < 15s |
| Panel open animation | < 200ms |
| Bundle size (sidbot components) | < 50KB gzipped |
