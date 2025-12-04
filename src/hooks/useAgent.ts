import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";

export type AgentStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "working"
  | "idle"
  | "error";

export interface AgentInfo {
  agent_id: string;
  status: AgentStatus;
  current_task: string | null;
  progress: number;
  last_activity: number;
}

export interface AgentOutput {
  agent_id: string;
  output_type: "stdout" | "stderr" | "tool_call" | "result";
  content: string;
  timestamp: number;
}

export function useAgentManager() {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initAgentManager = useCallback(async (apiUrl: string) => {
    try {
      await invoke("init_agent_manager", { apiUrl });
      setInitialized(true);
      setError(null);
    } catch (e) {
      setError(String(e));
      throw e;
    }
  }, []);

  return { initialized, error, initAgentManager };
}

export function useAgent(agentId: string) {
  const [status, setStatus] = useState<AgentStatus>("disconnected");
  const [progress, setProgress] = useState(0);
  const [outputs, setOutputs] = useState<AgentOutput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const unlistenersRef = useRef<UnlistenFn[]>([]);

  // Setup event listeners
  // Limit outputs to prevent memory issues with long-running agents
  const MAX_OUTPUTS = 1000;

  useEffect(() => {
    const setupListeners = async () => {
      const unlistenOutput = await listen<AgentOutput>("agent-output", (event) => {
        if (event.payload.agent_id === agentId) {
          setOutputs((prev) => {
            const updated = [...prev, event.payload];
            // Keep only the last MAX_OUTPUTS entries
            return updated.length > MAX_OUTPUTS
              ? updated.slice(-MAX_OUTPUTS)
              : updated;
          });
        }
      });

      const unlistenStatus = await listen<AgentInfo>("agent-status", (event) => {
        if (event.payload.agent_id === agentId) {
          setStatus(event.payload.status);
          setProgress(event.payload.progress);
        }
      });

      const unlistenError = await listen<{ agent_id: string; error: string }>(
        "agent-error",
        (event) => {
          if (event.payload.agent_id === agentId) {
            setError(event.payload.error);
            setStatus("error");
          }
        }
      );

      const unlistenDisconnected = await listen<string>(
        "agent-disconnected",
        (event) => {
          if (event.payload === agentId) {
            setStatus("disconnected");
          }
        }
      );

      unlistenersRef.current = [
        unlistenOutput,
        unlistenStatus,
        unlistenError,
        unlistenDisconnected,
      ];
    };

    setupListeners();

    return () => {
      unlistenersRef.current.forEach((unlisten) => unlisten());
    };
  }, [agentId]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      await invoke("connect_agent", { agentId });
      setStatus("connected");
    } catch (e) {
      setError(String(e));
      setStatus("error");
    } finally {
      setIsConnecting(false);
    }
  }, [agentId]);

  const disconnect = useCallback(async () => {
    try {
      await invoke("disconnect_agent", { agentId });
      setStatus("disconnected");
    } catch (e) {
      setError(String(e));
    }
  }, [agentId]);

  const sendPrompt = useCallback(
    async (prompt: string, context: string[] = []) => {
      try {
        await invoke("send_prompt", { agentId, prompt, context });
        setStatus("working");
      } catch (e) {
        setError(String(e));
      }
    },
    [agentId]
  );

  const clearOutputs = useCallback(() => {
    setOutputs([]);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    status,
    progress,
    outputs,
    error,
    isConnecting,
    connect,
    disconnect,
    sendPrompt,
    clearOutputs,
    clearError,
  };
}

export function useConnectedAgents() {
  const [agents, setAgents] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<string[]>("list_connected_agents");
      setAgents(result);
    } catch (e) {
      console.error("Failed to list agents:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { agents, loading, refresh };
}

// =============================================================================
// CLAUDE CLI SESSION HOOKS (Direct Process Management)
// =============================================================================

// User-friendly error message mapping
function getClaudeErrorMessage(error: string): string {
  const errorStr = error.toLowerCase();

  if (errorStr.includes("not found") || errorStr.includes("no such file") || errorStr.includes("command not found")) {
    return "Claude CLI not found. Please install it with: npm install -g @anthropic-ai/claude-code";
  }

  if (errorStr.includes("permission denied")) {
    return "Permission denied. Please check that Claude CLI is executable.";
  }

  if (errorStr.includes("enoent") || errorStr.includes("spawn")) {
    return "Failed to start Claude CLI. Is it installed and in your PATH?";
  }

  if (errorStr.includes("api key") || errorStr.includes("unauthorized") || errorStr.includes("authentication")) {
    return "Claude CLI authentication failed. Run 'claude login' to authenticate.";
  }

  if (errorStr.includes("rate limit") || errorStr.includes("too many requests")) {
    return "Rate limit exceeded. Please wait a moment before trying again.";
  }

  if (errorStr.includes("timeout")) {
    return "Request timed out. Please check your internet connection.";
  }

  // Return original error if no match
  return error;
}

export interface ClaudeSession {
  id: string;
  pid: number;
  role: string;
  working_dir: string;
  status: "starting" | "ready" | "streaming" | "stopped" | "error";
}

export interface ClaudeChunk {
  session_id: string;
  content: string;
  is_complete: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  timestamp: Date;
  status: "sending" | "streaming" | "complete" | "error";
}

export function useAgentChat(workingDir: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlistenersRef = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    const setupListeners = async () => {
      // Listen for Claude output chunks
      const unlistenChunk = await listen<ClaudeChunk>("claude-chunk", (event) => {
        if (event.payload.session_id === sessionId) {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.status === "streaming") {
              return [
                ...prev.slice(0, -1),
                { ...last, content: last.content + event.payload.content + "\n" },
              ];
            }
            return prev;
          });
        }
      });

      // Listen for completion
      const unlistenComplete = await listen<ClaudeChunk>("claude-complete", (event) => {
        if (event.payload.session_id === sessionId) {
          setIsStreaming(false);
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.status === "streaming") {
              return [...prev.slice(0, -1), { ...last, status: "complete" }];
            }
            return prev;
          });
        }
      });

      // Listen for errors
      const unlistenError = await listen<{ session_id: string; error: string }>(
        "claude-error",
        (event) => {
          if (event.payload.session_id === sessionId) {
            setError(getClaudeErrorMessage(event.payload.error));
            setIsStreaming(false);
          }
        }
      );

      unlistenersRef.current = [unlistenChunk, unlistenComplete, unlistenError];
    };

    if (sessionId) {
      setupListeners();
    }

    return () => {
      unlistenersRef.current.forEach((unlisten) => unlisten());
    };
  }, [sessionId]);

  const sendMessage = useCallback(
    async (content: string) => {
      // Add user message
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date(),
        status: "complete",
      };
      setMessages((prev) => [...prev, userMsg]);

      // Spawn session if not exists
      let sid = sessionId;
      if (!sid) {
        try {
          const session = await invoke<ClaudeSession>("spawn_claude_session", {
            role: "default",
            workingDir,
          });
          sid = session.id;
          setSessionId(sid);
        } catch (e) {
          setError(getClaudeErrorMessage(String(e)));
          return;
        }
      }

      // Add streaming placeholder
      const agentMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "agent",
        content: "",
        timestamp: new Date(),
        status: "streaming",
      };
      setMessages((prev) => [...prev, agentMsg]);
      setIsStreaming(true);

      try {
        await invoke("send_to_claude_session", { sessionId: sid, message: content });
      } catch (e) {
        setError(getClaudeErrorMessage(String(e)));
        setIsStreaming(false);
        // Mark the last message as error
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.status === "streaming") {
            return [...prev.slice(0, -1), { ...last, status: "error", content: "Failed to get response." }];
          }
          return prev;
        });
      }
    },
    [sessionId, workingDir]
  );

  const stopAgent = useCallback(async () => {
    if (sessionId) {
      try {
        await invoke("stop_claude_session", { sessionId });
        setSessionId(null);
        setIsStreaming(false);
      } catch (e) {
        setError(String(e));
      }
    }
  }, [sessionId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    isStreaming,
    error,
    sessionId,
    sendMessage,
    stopAgent,
    clearMessages,
    clearError,
  };
}

const HISTORY_STORAGE_KEY = "sidstack-command-history";
const MAX_HISTORY = 100;

export function useCommandHistory() {
  const [history, setHistory] = useState<string[]>([]);
  const [index, setIndex] = useState(-1);
  const [tempInput, setTempInput] = useState("");

  // Load history from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  const addToHistory = useCallback((command: string) => {
    if (!command.trim()) return;
    setHistory((prev) => {
      const updated = [command, ...prev.filter((c) => c !== command)].slice(
        0,
        MAX_HISTORY
      );
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    setIndex(-1);
  }, []);

  const navigateHistory = useCallback(
    (direction: "up" | "down", currentInput?: string) => {
      if (history.length === 0) return null;
      if (index === -1 && currentInput) setTempInput(currentInput);

      const newIndex =
        direction === "up"
          ? Math.min(index + 1, history.length - 1)
          : Math.max(index - 1, -1);

      setIndex(newIndex);
      return newIndex === -1 ? tempInput : history[newIndex];
    },
    [history, index, tempInput]
  );

  const resetNavigation = useCallback(() => {
    setIndex(-1);
    setTempInput("");
  }, []);

  return { history, addToHistory, navigateHistory, resetNavigation };
}

export function useBackgroundMonitor() {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // Check if running on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const running = await invoke<boolean>("is_background_monitor_running");
        setIsRunning(running);
      } catch (e) {
        console.error("Failed to check monitor status:", e);
      }
    };
    checkStatus();
  }, []);

  // Listen for status change events
  useEffect(() => {
    const setup = async () => {
      unlistenRef.current = await listen<AgentInfo>("agent-status-change", (event) => {
        console.log("Agent status changed:", event.payload);
      });
    };
    setup();

    return () => {
      unlistenRef.current?.();
    };
  }, []);

  const startMonitor = useCallback(async (pollIntervalSecs?: number) => {
    try {
      await invoke("start_background_monitor", { pollIntervalSecs });
      setIsRunning(true);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const stopMonitor = useCallback(async () => {
    try {
      await invoke("stop_background_monitor");
      setIsRunning(false);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  return { isRunning, error, startMonitor, stopMonitor };
}
