/**
 * useAgentSDK Hook
 *
 * Provides a React hook for interacting with Claude through the Agent SDK sidecar.
 * Replaces useClaudeProcess for type-safe, reliable Claude interactions.
 */

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================================
// Types from sidecar protocol
// ============================================================================

export interface CreateSessionRequest {
  action: "createSession";
  id: string;
  model?: string;
  cwd?: string;
  systemPrompt?: string;
  /** MCP server configurations (optional - SDK auto-discovers from cwd/.mcp.json) */
  mcpServers?: Record<string, unknown>;
}

export interface ResumeSessionRequest {
  action: "resumeSession";
  id: string;
  sessionId: string;
  model?: string;
}

export interface SendMessageRequest {
  action: "send";
  sessionId: string;
  message: string;
}

export interface InterruptRequest {
  action: "interrupt";
  sessionId: string;
}

export interface CloseSessionRequest {
  action: "closeSession";
  sessionId: string;
}

export interface PingRequest {
  action: "ping";
}

export type ClientMessage =
  | CreateSessionRequest
  | ResumeSessionRequest
  | SendMessageRequest
  | InterruptRequest
  | CloseSessionRequest
  | PingRequest;

// Server messages
export interface SessionCreatedResponse {
  type: "session_created";
  requestId: string;
  sessionId: string;
}

export interface SDKMessageResponse {
  type: "sdk_message";
  sessionId: string;
  message: SDKMessage;
}

export interface ErrorResponse {
  type: "error";
  sessionId?: string;
  requestId?: string;
  error: string;
  code?: string;
}

export interface PongResponse {
  type: "pong";
}

export interface SessionClosedResponse {
  type: "session_closed";
  sessionId: string;
}

export interface SessionInterruptedResponse {
  type: "session_interrupted";
  sessionId: string;
}

export type ServerMessage =
  | SessionCreatedResponse
  | SDKMessageResponse
  | ErrorResponse
  | PongResponse
  | SessionClosedResponse
  | SessionInterruptedResponse;

// ============================================================================
// SDK Message Types (from @anthropic-ai/claude-agent-sdk)
// ============================================================================

export interface ContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface SDKAssistantMessage {
  type: "assistant";
  uuid: string;
  session_id: string;
  message: {
    content: ContentBlock[];
    model?: string;
  };
  parent_tool_use_id: string | null;
}

export interface SDKUserMessage {
  type: "user";
  uuid?: string;
  session_id: string;
  message: {
    role: "user";
    content: ContentBlock[] | string;
  };
  parent_tool_use_id: string | null;
}

export interface SDKSystemMessage {
  type: "system";
  subtype: "init" | "compact_boundary";
  uuid: string;
  session_id: string;
  tools?: string[];
  model?: string;
  cwd?: string;
  [key: string]: unknown;
}

export interface SDKResultMessage {
  type: "result";
  subtype?: string;
  uuid: string;
  session_id: string;
  duration_ms?: number;
  total_cost_usd?: number;
  num_turns?: number;
  result?: string;
  is_error?: boolean;
  [key: string]: unknown;
}

export interface SDKPartialMessage {
  type: "stream_event";
  uuid: string;
  session_id: string;
  event: unknown;
  parent_tool_use_id: string | null;
}

export type SDKMessage =
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKSystemMessage
  | SDKResultMessage
  | SDKPartialMessage;

// ============================================================================
// Hook State
// ============================================================================

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface AgentSDKState {
  status: ConnectionStatus;
  error: string | null;
  sessionId: string | null;
  isStreaming: boolean;
}

export interface UseAgentSDKOptions {
  /** Auto-connect on mount */
  autoConnect?: boolean;
  /** Model to use */
  model?: string;
  /** Working directory (SDK auto-discovers .mcp.json from here) */
  cwd?: string;
  /** MCP server configurations (optional override) */
  mcpServers?: Record<string, unknown>;
  /** Callback when SDK message received */
  onMessage?: (message: SDKMessage) => void;
  /** Callback on error */
  onError?: (error: string) => void;
  /** Callback when session created */
  onSessionCreated?: (sessionId: string) => void;
  /** Callback when streaming completes */
  onComplete?: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

const SIDECAR_PORT = 17433;
const RECONNECT_DELAY = 2000;
const MAX_RECONNECT_ATTEMPTS = 5;

export function useAgentSDK(options: UseAgentSDKOptions = {}) {
  const {
    autoConnect = false,
    model = "claude-sonnet-4-5-20250929",
    cwd,
    mcpServers,
    onMessage,
    onError,
    onSessionCreated,
    onComplete,
  } = options;

  const [state, setState] = useState<AgentSDKState>({
    status: "disconnected",
    error: null,
    sessionId: null,
    isStreaming: false,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const pendingRequestsRef = useRef<Map<string, (sessionId: string) => void>>(new Map());

  // Generate unique request ID
  const generateRequestId = useCallback(() => {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }, []);

  // Send message to sidecar
  const sendToSidecar = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  // Handle incoming messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data: ServerMessage = JSON.parse(event.data);

        switch (data.type) {
          case "session_created": {
            const callback = pendingRequestsRef.current.get(data.requestId);
            if (callback) {
              callback(data.sessionId);
              pendingRequestsRef.current.delete(data.requestId);
            }
            setState((s) => ({ ...s, sessionId: data.sessionId }));
            onSessionCreated?.(data.sessionId);
            break;
          }

          case "sdk_message": {
            onMessage?.(data.message);

            // Check for result message (turn complete)
            if (data.message.type === "result") {
              setState((s) => ({ ...s, isStreaming: false }));
              onComplete?.();
            }
            break;
          }

          case "error": {
            console.error("[useAgentSDK] Error:", data.error);
            setState((s) => ({ ...s, error: data.error, isStreaming: false }));
            onError?.(data.error);
            break;
          }

          case "session_closed": {
            if (state.sessionId === data.sessionId) {
              setState((s) => ({ ...s, sessionId: null }));
            }
            break;
          }

          case "session_interrupted": {
            setState((s) => ({ ...s, isStreaming: false }));
            break;
          }

          case "pong": {
            // Heartbeat received
            break;
          }
        }
      } catch (err) {
        console.error("[useAgentSDK] Failed to parse message:", err);
      }
    },
    [onMessage, onError, onSessionCreated, onComplete, state.sessionId]
  );

  // Connect to sidecar WebSocket
  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setState((s) => ({ ...s, status: "connecting", error: null }));

    try {
      // Ensure sidecar is running
      await invoke("ensure_sdk_sidecar");

      // Connect to WebSocket
      const ws = new WebSocket(`ws://localhost:${SIDECAR_PORT}`);

      ws.onopen = () => {
        console.log("[useAgentSDK] Connected to sidecar");
        reconnectAttemptsRef.current = 0;
        setState((s) => ({ ...s, status: "connected", error: null }));
      };

      ws.onmessage = handleMessage;

      ws.onerror = (err) => {
        console.error("[useAgentSDK] WebSocket error:", err);
        setState((s) => ({ ...s, status: "error", error: "WebSocket error" }));
      };

      ws.onclose = () => {
        console.log("[useAgentSDK] Disconnected from sidecar");
        wsRef.current = null;
        setState((s) => ({ ...s, status: "disconnected" }));

        // Auto-reconnect
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          setTimeout(connect, RECONNECT_DELAY);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error("[useAgentSDK] Failed to connect:", err);
      setState((s) => ({
        ...s,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [handleMessage]);

  // Disconnect from sidecar
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setState((s) => ({ ...s, status: "disconnected", sessionId: null }));
  }, []);

  // Create a new session
  const createSession = useCallback(
    async (sessionCwd?: string, sessionMcpServers?: Record<string, unknown>): Promise<string> => {
      return new Promise((resolve, reject) => {
        const requestId = generateRequestId();

        pendingRequestsRef.current.set(requestId, resolve);

        const request: CreateSessionRequest = {
          action: "createSession",
          id: requestId,
          model,
          cwd: sessionCwd || cwd,
        };

        // Add MCP servers if provided (explicit override) or from options
        const effectiveMcpServers = sessionMcpServers || mcpServers;
        if (effectiveMcpServers && Object.keys(effectiveMcpServers).length > 0) {
          request.mcpServers = effectiveMcpServers;
        }

        const success = sendToSidecar(request);

        if (!success) {
          pendingRequestsRef.current.delete(requestId);
          reject(new Error("Not connected to sidecar"));
        }

        // Timeout after 10 seconds
        setTimeout(() => {
          if (pendingRequestsRef.current.has(requestId)) {
            pendingRequestsRef.current.delete(requestId);
            reject(new Error("Create session timeout"));
          }
        }, 10000);
      });
    },
    [generateRequestId, sendToSidecar, model, cwd, mcpServers]
  );

  // Resume an existing session
  const resumeSession = useCallback(
    async (existingSessionId: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const requestId = generateRequestId();

        pendingRequestsRef.current.set(requestId, resolve);

        const success = sendToSidecar({
          action: "resumeSession",
          id: requestId,
          sessionId: existingSessionId,
          model,
        });

        if (!success) {
          pendingRequestsRef.current.delete(requestId);
          reject(new Error("Not connected to sidecar"));
        }

        // Timeout after 10 seconds
        setTimeout(() => {
          if (pendingRequestsRef.current.has(requestId)) {
            pendingRequestsRef.current.delete(requestId);
            reject(new Error("Resume session timeout"));
          }
        }, 10000);
      });
    },
    [generateRequestId, sendToSidecar, model]
  );

  // Send a message
  const sendMessage = useCallback(
    (message: string, sessionId?: string) => {
      const targetSession = sessionId || state.sessionId;
      if (!targetSession) {
        console.error("[useAgentSDK] No session to send message to");
        return false;
      }

      setState((s) => ({ ...s, isStreaming: true }));

      return sendToSidecar({
        action: "send",
        sessionId: targetSession,
        message,
      });
    },
    [sendToSidecar, state.sessionId]
  );

  // Interrupt streaming
  const interrupt = useCallback(
    (sessionId?: string) => {
      const targetSession = sessionId || state.sessionId;
      if (!targetSession) {
        return false;
      }

      return sendToSidecar({
        action: "interrupt",
        sessionId: targetSession,
      });
    },
    [sendToSidecar, state.sessionId]
  );

  // Close session
  const closeSession = useCallback(
    (sessionId?: string) => {
      const targetSession = sessionId || state.sessionId;
      if (!targetSession) {
        return false;
      }

      const success = sendToSidecar({
        action: "closeSession",
        sessionId: targetSession,
      });

      if (success && targetSession === state.sessionId) {
        setState((s) => ({ ...s, sessionId: null }));
      }

      return success;
    },
    [sendToSidecar, state.sessionId]
  );

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Heartbeat
  useEffect(() => {
    if (state.status !== "connected") return;

    const interval = setInterval(() => {
      sendToSidecar({ action: "ping" });
    }, 30000);

    return () => clearInterval(interval);
  }, [state.status, sendToSidecar]);

  return {
    // State
    ...state,

    // Actions
    connect,
    disconnect,
    createSession,
    resumeSession,
    sendMessage,
    interrupt,
    closeSession,

    // Utilities
    isConnected: state.status === "connected",
    hasSession: state.sessionId !== null,
  };
}

export default useAgentSDK;
