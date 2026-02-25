# SidBot - Frontend Design

> See [`SYSTEM-DESIGN.md`](./SYSTEM-DESIGN.md) for architecture. See [`API-SPEC.md`](./API-SPEC.md) for API contract.

## Mount Point

In `src/App.tsx`, mount `<SidBotBubble />` and `<SidBotPanel />` at root level, after `<StatusBar />`, before `<Toaster />`. Z-index: `60` (above dialogs at z-50).

## Component Tree

```
App.tsx
└── SidBotBubble          (toggle, 5 state indicators)
└── SidBotPanel            (container, animation)
    ├── SidBotHeader       (title, tabs, close button)
    ├── SidBotChat         (tab: chat)
    │   ├── SidBotWelcome  (empty state, quick actions)
    │   ├── SidBotMessages (message list, streaming)
    │   │   ├── SidBotMessage      (single message, markdown)
    │   │   ├── SidBotActionCard   (clickable action)
    │   │   └── SidBotProgressCard (Claude Code progress)
    │   └── SidBotInput    (textarea, send/cancel)
    └── SidBotConfig       (tab: config)
```

## Component Props

### SidBotBubble / SidBotPanel

No props — both read from `sidBotStore` directly. Bubble renders 5 states (idle/thinking/working/unread/disabled). Panel animates slide-up 200ms.

### SidBotHeader

```typescript
interface SidBotHeaderProps {
  activeTab: "chat" | "config";
  onTabChange: (tab: "chat" | "config") => void;
  onClose: () => void;
}
```

### SidBotMessage

```typescript
interface SidBotMessageProps {
  message: SidBotMessageType;
  isStreaming?: boolean;       // show blinking cursor
}
```

### SidBotActionCard

```typescript
interface SidBotActionCardProps {
  action: SidBotAction;        // from API-SPEC.md — 8 action types
  onExecute: (action: SidBotAction) => void;
}
```

### SidBotProgressCard (NEW — for Claude Code delegation)

```typescript
interface SidBotProgressCardProps {
  status: "analyzing" | "implementing" | "done" | "error";
  step: string;               // "Reading src/auth/login.ts"
  detail: string;             // "tool_use: Read"
  elapsed: number;            // ms since start
  onCancel: () => void;
}
```

### SidBotInput

```typescript
interface SidBotInputProps {
  onSend: (text: string) => void;
  onCancel: () => void;
  isStreaming: boolean;        // Gemini streaming
  isClaudeWorking: boolean;    // Claude Code executing
  disabled: boolean;
}
```

### SidBotWelcome

```typescript
interface SidBotWelcomeProps {
  onQuickAction: (prompt: string) => void;
}
// Quick actions: "What can SidStack do?", "Create a task", "Analyze my code", "Show settings"
```

### SidBotConfig

```typescript
interface SidBotConfigProps {
  serverUrl: string;
  isConnected: boolean;
  claudeAvailable: boolean;    // Claude Code CLI detected
  onSave: (config: { serverUrl: string }) => void;
  onTest: () => Promise<boolean>;
}
```

## Reuse Map

| Need | Existing Component | Import Path |
|------|-------------------|-------------|
| Markdown rendering | `MarkdownPreview` | `src/components/MarkdownPreview.tsx` |
| Scrollable area | `ScrollArea` | `src/components/ui/scroll-area.tsx` |
| Buttons | `Button` (outline, ghost, sm, icon-sm) | `src/components/ui/button.tsx` |
| Auto-resize textarea | `react-textarea-autosize` | `package.json` (installed) |
| Icons | `lucide-react` (Bot, Send, X, Loader2, Settings, Cpu, etc.) | `package.json` (installed) |
| State management | Zustand `create()` | `src/stores/` pattern |
| Input field | `Input` | `src/components/ui/input.tsx` |
| Tabs | `Tabs, TabsList, TabsTrigger` | `src/components/ui/tabs.tsx` |
| Progress bar | `Progress` | `src/components/ui/progress.tsx` |
| Card styling | `Card` | `src/components/ui/card.tsx` |

## Store: sidBotStore

File: `src/stores/sidBotStore.ts`

```typescript
interface SidBotMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  actions: SidBotAction[];
  route: "direct" | "knowledge" | "claude" | null;  // which brain answered
  timestamp: number;
}

interface SidBotStore {
  // Config
  serverUrl: string;
  isConnected: boolean;
  claudeAvailable: boolean;
  selectedModel: string;
  // Conversation
  conversationId: string | null;
  messages: SidBotMessage[];
  isStreaming: boolean;
  streamingText: string;
  abortController: AbortController | null;
  // Claude Code delegation
  claudeStatus: "idle" | "analyzing" | "implementing" | "done" | "error";
  claudeProgress: { step: string; detail: string; elapsed: number } | null;
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

## SSE Event Handling

Store processes 9 SSE event types from bot server:

| Event | Store Update |
|-------|-------------|
| `message_start` | Set `conversationId`, `route` |
| `token` | Append to `streamingText` |
| `action` | Push to current message `actions[]` |
| `claude_start` | Set `claudeStatus`, `claudeSessionId` |
| `claude_progress` | Update `claudeProgress` |
| `claude_end` | Set `claudeStatus: "done"` |
| `error` | Show error in conversation |
| `message_end` | Finalize message |
| `done` | Reset streaming state |

## Action Executor

| Action Type | Execution |
|------------|-----------|
| `navigate` | `appStore.setActiveView(payload.view)` |
| `open_doc` | Open DocsDialog with specific doc |
| `create_task` | Open NewTaskDialog, pre-filled |
| `open_knowledge` | Navigate to knowledge view + search |
| `open_ticket` | Navigate to ticket-queue view |
| `external_link` | Tauri shell open or `window.open()` |
| `claude_analyze` | Send new message triggering analysis |
| `claude_implement` | Send new message triggering implementation |

## Keyboard Shortcuts

| Shortcut | Action | Scope |
|----------|--------|-------|
| `Cmd+.` | Toggle panel | Global |
| `Escape` | Close panel | Panel open |
| `Enter` | Send message | Input focused |
| `Shift+Enter` | New line | Input focused |

## Responsive Layout

| Breakpoint | Panel Width | Panel Height |
|-----------|-------------|--------------|
| `< 640px` (sm) | 100vw | 70vh |
| `640-1024px` (md) | 400px | 500px |
| `> 1024px` (lg) | 420px | 560px |

Panel position: fixed bottom-right, `right: 16px`, `bottom: 64px`, `border-radius: 12px`.

## Animation

| Element | Animation | Duration |
|---------|-----------|----------|
| Panel open | `translateY(100%) → translateY(0)` | 200ms ease-out |
| Panel close | `translateY(0) → translateY(100%)` | 150ms ease-in |
| Bubble thinking | `pulse` (opacity 0.7→1) | 1.5s infinite |
| Bubble working | `pulse` + blue ring | 2s infinite |
| Streaming cursor | `blink` (opacity 0→1) | 800ms step-end |
| Progress card | Indeterminate progress bar | continuous |

## File Structure

All components in `src/components/sidbot/` (SidBotBubble, SidBotPanel, SidBotHeader, SidBotChat, SidBotMessages, SidBotMessage, SidBotActionCard, SidBotProgressCard, SidBotInput, SidBotWelcome, SidBotConfig). Store in `src/stores/sidBotStore.ts`.
