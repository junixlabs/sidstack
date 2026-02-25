import type { SSEEvent, SidBotAction } from "@/stores/sidBotStore";

// =============================================================================
// Real SSE API for SidBot — connects to bot-server on configurable URL
// =============================================================================

interface SendMessageParams {
  serverUrl: string;
  message: string;
  conversationId: string;
  model: string;
  context: {
    projectName?: string;
    activeView?: string;
    projectPath?: string;
    projectVersion?: string;
  };
  signal: AbortSignal;
}

/**
 * POST /api/chat with SSE streaming. Parses server-sent events and yields
 * them as SSEEvent objects matching the store's expected format.
 */
export async function* sendMessage(
  params: SendMessageParams,
): AsyncGenerator<SSEEvent> {
  const { serverUrl, message, conversationId, model, context, signal } = params;

  const res = await fetch(`${serverUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversationId, model, context }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    yield { type: "error", error: `HTTP ${res.status}: ${text}` };
    yield { type: "done" };
    return;
  }

  if (!res.body) {
    yield { type: "error", error: "No response body" };
    yield { type: "done" };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep last incomplete line in buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ") && currentEvent) {
          let data: Record<string, unknown> = {};
          try {
            data = JSON.parse(line.slice(6));
          } catch {
            // Ignore malformed JSON
          }
          const mapped = mapEvent(currentEvent, data);
          if (mapped) yield mapped;
          currentEvent = "";
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Map bot-server SSE event to frontend SSEEvent format.
 */
function mapEvent(
  event: string,
  data: Record<string, unknown>,
): SSEEvent | null {
  switch (event) {
    case "token":
      return { type: "token", data: (data.text as string) || "" };

    case "done":
      return { type: "done" };

    case "action":
      return {
        type: "action",
        action: {
          type: (data.type as SidBotAction["type"]) || "navigate",
          label: (data.label as string) || "",
          payload: data.payload as Record<string, string> | undefined,
        },
      };

    case "claude_start":
      return {
        type: "claude_start",
        step: `Launching Claude (${(data.mode as string) || "analyze"})...`,
      };

    case "claude_progress":
      return {
        type: "claude_progress",
        step: (data.step as string) || "",
        detail: (data.detail as string) || "",
      };

    case "claude_end":
      return { type: "claude_end", status: "success" };

    case "error":
      return {
        type: "error",
        error: (data.message as string) || (data.code as string) || "Unknown error",
      };

    case "message_end": {
      const usage = data.usage as { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined;
      return {
        type: "message_end",
        route: (data.route as string) || undefined,
        usage: usage ? {
          promptTokens: usage.promptTokens || 0,
          completionTokens: usage.completionTokens || 0,
          totalTokens: usage.totalTokens || 0,
        } : undefined,
      };
    }

    default:
      return null;
  }
}

/**
 * GET /health — check bot-server connectivity.
 */
export async function healthCheck(serverUrl: string): Promise<{
  status: string;
  claudeAvailable: boolean;
  geminiModel?: string;
}> {
  const res = await fetch(`${serverUrl}/health`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * POST /api/chat/cancel — cancel active stream.
 */
export async function cancelStream(
  serverUrl: string,
  conversationId: string,
): Promise<void> {
  await fetch(`${serverUrl}/api/chat/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId }),
  }).catch(() => {
    // Best-effort cancel
  });
}
