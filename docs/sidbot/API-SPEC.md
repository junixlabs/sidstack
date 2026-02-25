# SidBot - API Specification

> Contract between frontend and backend. Dual-Brain architecture: see [`PROPOSAL-DUAL-BRAIN.md`](./PROPOSAL-DUAL-BRAIN.md).

## Base URL

Default: `http://localhost:3200` (configurable in SidBot Config panel)

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/chat` | Send message, receive SSE stream (may involve Claude Code) |
| POST | `/api/chat/cancel` | Cancel active Gemini stream or Claude Code execution |
| GET | `/health` | Health check (bot server + Claude Code CLI availability) |
| GET | `/models` | List available Gemini models |
| DELETE | `/api/conversations/:id` | Clear conversation history |

---

## POST /api/chat

### Request

```json
{
  "message": "Why does the login function timeout?",
  "conversationId": "conv_abc123",
  "context": {
    "projectName": "my-project",
    "activeView": "task-manager",
    "projectPath": "/Users/me/projects/my-project"
  },
  "model": "gemini-2.0-flash"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | User message text |
| `conversationId` | string | No | Reuse existing conversation |
| `context.projectName` | string | No | Active project name |
| `context.activeView` | string | No | Current sidebar view ID |
| `context.projectPath` | string | No | Project path (needed for Claude Code + knowledge search) |
| `model` | string | No | Gemini model ID. Default: `gemini-2.0-flash` |

### Response: SSE Stream

Content-Type: `text/event-stream`

#### SSE Event Types (9 types)

**1. `message_start`** — First event, contains routing decision

```
event: message_start
data: {"conversationId":"conv_abc123","messageId":"msg_xyz","route":"direct|knowledge|claude"}
```

**2. `token`** — Incremental text token (from Gemini)

```
event: token
data: {"text":"To create a task"}
```

**3. `action`** — Actionable card for the user

```
event: action
data: {"type":"navigate","payload":{"view":"task-manager"},"label":"Open Task Manager"}
```

**4. `claude_start`** — Claude Code execution begins

```
event: claude_start
data: {"mode":"analyze|implement","prompt":"Analyze login timeout...","sessionId":"ses_abc"}
```

**5. `claude_progress`** — Claude Code work progress

```
event: claude_progress
data: {"step":"Reading src/auth/login.ts","detail":"tool_use: Read","elapsed":2400}
```

**6. `claude_end`** — Claude Code execution complete

```
event: claude_end
data: {"sessionId":"ses_abc","duration":8500,"cost":0.02,"result":"Found timeout..."}
```

**7. `error`** — Non-fatal error

```
event: error
data: {"code":"CLAUDE_TIMEOUT","message":"Claude Code did not respond in 60s"}
```

**8. `message_end`** — Final message summary

```
event: message_end
data: {"messageId":"msg_xyz","route":"claude","tokenCount":142,"claudeCost":0.02}
```

**9. `done`** — Stream complete

```
event: done
data: {}
```

### Action Types

| Type | Payload | Description |
|------|---------|-------------|
| `navigate` | `{ view: string }` | Switch to a sidebar view |
| `open_doc` | `{ docId: string }` | Open documentation dialog |
| `create_task` | `{ title?: string, description?: string }` | Open NewTaskDialog |
| `open_knowledge` | `{ query?: string, docId?: string }` | Navigate to knowledge browser |
| `open_ticket` | `{ ticketId?: string }` | Navigate to ticket queue |
| `external_link` | `{ url: string, label: string }` | Open URL in browser |
| `claude_analyze` | `{ prompt: string }` | Trigger Claude Code analysis |
| `claude_implement` | `{ prompt: string, taskId?: string }` | Launch Claude Code session |

---

## POST /api/chat/cancel

Cancel active Gemini stream AND/OR Claude Code process.

```json
{ "conversationId": "conv_abc123" }
```

Response: `{ "ok": true, "cancelled": ["gemini", "claude"] }`

---

## GET /health

```json
{
  "status": "ok",
  "version": "0.1.0",
  "geminiModel": "gemini-2.0-flash",
  "claudeAvailable": true,
  "claudePath": "/opt/homebrew/bin/claude",
  "sidstackApiUrl": "http://localhost:19432",
  "sidstackApiAvailable": true
}
```

---

## GET /models

```json
{
  "models": [
    { "id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash", "default": true },
    { "id": "gemini-2.0-pro", "name": "Gemini 2.0 Pro", "default": false }
  ]
}
```

---

## DELETE /api/conversations/:id

Response: `{ "ok": true }`

---

## Error Responses

Format: `{ "error": { "code": "ERROR_CODE", "message": "description" } }`

| HTTP Status | Code | When |
|------------|------|------|
| 400 | `INVALID_REQUEST` | Missing required fields |
| 401 | `UNAUTHORIZED` | Invalid API key |
| 429 | `RATE_LIMITED` | Gemini API rate limit |
| 500 | `INTERNAL_ERROR` | Server error |
| 503 | `SERVICE_UNAVAILABLE` | Gemini unreachable |
| 503 | `CLAUDE_UNAVAILABLE` | Claude Code CLI not found |

Stream always ends with `done` event, even on error.

## Headers

| Header | Value | Required |
|--------|-------|----------|
| `Content-Type` | `application/json` | Yes (for POST) |
| `X-API-Key` | Gemini API key | Yes |
