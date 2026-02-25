# SidBot - UI Mockups

> ASCII wireframes for all SidBot states. See [`FRONTEND-DESIGN.md`](./FRONTEND-DESIGN.md) for component details.

## 1. Bubble Only (Panel Closed)

```
┌───────────────────────────────────────┐
│ [Logo]  Workspace Tabs...    [Header] │
├───────────────────────────────────────┤
│ │Side│                                │
│ │bar │  (Active View Content) ┌───┐   │
│ │    │                        │🤖 │   │
├───────────────────────────────┴───┴───┤
│ [Status Bar]                          │
└───────────────────────────────────────┘
```

## 2. Panel Empty (Welcome State)

```
                                ┌──────────────────┐
                                │ SidBot  [Chat|⚙] X│
                                ├──────────────────┤
                                │                  │
                                │   👋 Hi there!   │
                                │   I'm SidBot.    │
                                │   How can I help?│
                                │                  │
                                │  ┌──────────────┐│
                                │  │ What can      ││
                                │  │ SidStack do?  ││
                                │  └──────────────┘│
                                │  ┌──────────────┐│
                                │  │ Create a task ││
                                │  └──────────────┘│
                                │  ┌──────────────┐│
                                │  │ Analyze my    ││
                                │  │ code          ││
                                │  └──────────────┘│
                                │  ┌──────────────┐│
                                │  │ Show settings ││
                                │  └──────────────┘│
                                │                  │
                                ├──────────────────┤
                                │ Ask anything...  │
                                │            [Send]│
                                └──────────────────┘
                                              ┌───┐
                                              │🤖 │
                                              └───┘
```

## 3. Active Conversation (Gemini Direct)

```
                                ┌──────────────────┐
                                │ SidBot  [Chat|⚙] X│
                                ├──────────────────┤
                                │ ┌──────────────┐ │
                                │ │ How do I      │ │
                                │ │ create a task?│ │ ← User
                                │ └──────────────┘ │
                                │                  │
                                │ ┌──────────────┐ │
                                │ │ Go to Task    │ │ ← Bot (Gemini direct)
                                │ │ Manager (⌘2). │ │
                                │ │               │ │
                                │ │ ┌────────────┐│ │
                                │ │ │▶ Open Task ││ │ ← Action
                                │ │ │  Manager   ││ │
                                │ │ └────────────┘│ │
                                │ └──────────────┘ │
                                │                  │
                                ├──────────────────┤
                                │ Ask anything...  │
                                │            [Send]│
                                └──────────────────┘
```

## 4. Streaming State (Gemini)

```
                                ┌──────────────────┐
                                │ SidBot  [Chat|⚙] X│
                                ├──────────────────┤
                                │ ┌──────────────┐ │
                                │ │ What features │ │
                                │ │ are available?│ │
                                │ └──────────────┘ │
                                │                  │
                                │ ┌──────────────┐ │
                                │ │ SidStack has  │ │
                                │ │ several key   │ │
                                │ │ features:     │ │
                                │ │ 1. **Task     │ │
                                │ │ Manager**█    │ │ ← Cursor
                                │ └──────────────┘ │
                                │                  │
                                ├──────────────────┤
                                │ Bot is typing... │
                                │          [Cancel]│
                                └──────────────────┘
```

## 5. Claude Code Working (Dual-Brain)

```
                                ┌──────────────────┐
                                │ SidBot  [Chat|⚙] X│
                                ├──────────────────┤
                                │ ┌──────────────┐ │
                                │ │ Why does the  │ │
                                │ │ login timeout?│ │ ← User
                                │ └──────────────┘ │
                                │                  │
                                │ ┌──────────────┐ │
                                │ │ Let me analyze│ │ ← Gemini intro
                                │ │ the code...   │ │
                                │ └──────────────┘ │
                                │                  │
                                │ ┌──────────────┐ │
                                │ │ 🔄 Claude     │ │ ← Progress Card
                                │ │ analyzing...  │ │
                                │ │ ░░░░░░░░░░░░  │ │ ← Progress bar
                                │ │               │ │
                                │ │ Reading       │ │
                                │ │ src/auth/     │ │
                                │ │ login.ts      │ │
                                │ │        [Stop] │ │
                                │ └──────────────┘ │
                                │                  │
                                ├──────────────────┤
                                │ Claude working.. │
                                │                  │
                                └──────────────────┘
                                              ┌───┐
                                              │⚡ │ ← Working
                                              └───┘
```

## 6. Claude Code Result

```
                                ┌──────────────────┐
                                │ SidBot  [Chat|⚙] X│
                                ├──────────────────┤
                                │  (previous msgs) │
                                │                  │
                                │ ┌──────────────┐ │
                                │ │ ✅ Analysis   │ │ ← Completed
                                │ │ done (8.5s)   │ │
                                │ └──────────────┘ │
                                │                  │
                                │ ┌──────────────┐ │
                                │ │ The timeout   │ │ ← Gemini summary
                                │ │ occurs in     │ │
                                │ │ `fetchUser()` │ │
                                │ │ — missing     │ │
                                │ │ AbortController│ │
                                │ │               │ │
                                │ │ ┌────────────┐│ │
                                │ │ │▶ Fix this   ││ │ ← Action
                                │ │ │  bug        ││ │
                                │ │ └────────────┘│ │
                                │ └──────────────┘ │
                                │                  │
                                ├──────────────────┤
                                │ Ask anything...  │
                                │            [Send]│
                                └──────────────────┘
```

## 7. Config Panel

```
                                ┌──────────────────┐
                                │ SidBot  [Chat|⚙] X│
                                ├──────────────────┤
                                │ Bot Server URL   │
                                │ ┌──────────────┐ │
                                │ │localhost:3200 │ │
                                │ └──────────────┘ │
                                │ API Key          │
                                │ ┌──────────────┐ │
                                │ │ ••••••••••••  │ │
                                │ └──────────────┘ │
                                │ Model            │
                                │ ┌──────────────┐ │
                                │ │gemini-2.0  ▼ │ │
                                │ └──────────────┘ │
                                │ [Test Connection] │
                                │ ✅ Server OK      │
                                │ ✅ Claude CLI OK   │
                                ├──────────────────┤
                                │          [Save]  │
                                └──────────────────┘
```

## 8. Error State

```
                                ┌──────────────────┐
                                │ SidBot  [Chat|⚙] X│
                                ├──────────────────┤
                                │  (previous msgs) │
                                │                  │
                                │ ┌──────────────┐ │
                                │ │ ⚠ Connection  │ │
                                │ │ to bot server │ │
                                │ │ failed.       │ │
                                │ │ [Retry] [⚙]   │ │
                                │ └──────────────┘ │
                                │                  │
                                ├──────────────────┤
                                │ Ask anything...  │
                                │            [Send]│ ← Disabled
                                └──────────────────┘
```

## 9. Bubble States

```
Idle:       Thinking:    Working:     Unread:      Disabled:
┌───┐       ┌───┐        ┌───┐        ┌───┐        ┌───┐
│🤖 │       │💬 │ pulse  │⚡ │ ring   │🤖•│ dot    │🤖 │ gray
└───┘       └───┘        └───┘        └───┘        └───┘
```

| State | Trigger | Visual |
|-------|---------|--------|
| Idle | No active work | Default icon |
| Thinking | `isStreaming === true` | Pulsing icon |
| Working | `claudeStatus !== "idle"` | Pulsing + blue ring |
| Unread | New message, panel closed | Red dot badge |
| Disabled | `isConnected === false` | Grayed out |

## 10. Panel Position in App Layout

```
┌─────────────────────────────────────────────┐
│ [Logo]  [Tabs...]                  [Header] │
├─────────────────────────────────────────────┤
│ │Sidebar│                   ┌──────────┐    │
│ │ w:48  │  Main Content     │ SidBot   │    │
│ │  or   │  (z: 0-1)        │ Panel    │    │
│ │ w:192 │                   │ (z: 60)  │    │
│ │       │                   └──────────┘    │
│ │       │                         ┌────┐    │
│ │       │                         │ 🤖 │    │
│ │       │                         └────┘    │
├─────────────────────────────────────────────┤
│ [Status Bar]                                │
└─────────────────────────────────────────────┘
Bubble: fixed, bottom:16px, right:16px, z:60
Panel:  fixed, bottom:64px, right:16px, z:60
```
