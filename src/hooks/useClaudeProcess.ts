/**
 * useClaudeProcess Hook
 *
 * @deprecated This hook is deprecated. Use `useAgentSDK` instead for type-safe,
 * reliable Claude interactions through the Agent SDK sidecar.
 *
 * Migration: Replace `useClaudeProcess` with `useAgentSDK` from "@/hooks/useAgentSDK"
 *
 * ---
 *
 * Manages Claude CLI processes with stream-json output parsing.
 * Converts Claude events into structured blocks for UI rendering.
 *
 * Supports two modes:
 * 1. One-shot mode (legacy): spawn() creates new process per prompt
 * 2. Persistent session mode: spawnSession() + sendInput() for multi-turn
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useState, useCallback, useEffect, useRef } from "react";

import type {
  Block,
  BlockType,
  InputContent,
  ThinkingContent,
  ToolContent,
  OutputContent,
  ErrorContent,
  SystemContent,
} from "@/types/blocks";
import { generateBlockId } from "@/types/blocks";

// Re-export Block type for consumers
export type { Block, BlockType };

// =============================================================================
// Types matching Rust ClaudeEvent
// =============================================================================

export interface ContentBlock {
  type: "text" | "tool_use" | "tool_result" | "thinking" | "unknown";
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
  thinking?: string;
}

export interface AssistantMessage {
  content?: ContentBlock[];
  model?: string;
}

export interface UserMessage {
  // Content can be either:
  // - string: Slash command output (e.g., /context, /cost) wrapped in <local-command-stdout>
  // - ContentBlock[]: Regular user input
  content?: string | ContentBlock[];
}

export interface ErrorInfo {
  message?: string;
  code?: string;
}

export type ClaudeEventType =
  | "system"
  | "assistant"
  | "user"
  | "tool_use"
  | "tool_result"
  | "result"
  | "error"
  | "unknown";

export interface ClaudeEvent {
  type: ClaudeEventType;
  // System event
  subtype?: string;
  session_id?: string;
  tools?: string[];
  mcp_servers?: unknown[];
  // Assistant event
  message?: AssistantMessage | UserMessage;
  // Tool use
  tool?: string;
  input?: unknown;
  tool_use_id?: string;
  // Tool result
  output?: string;
  is_error?: boolean;
  // Result event
  result?: string;
  duration_ms?: number;
  duration_api_ms?: number;
  cost_usd?: number;
  num_turns?: number;
  // Error event
  error?: ErrorInfo;
}

export interface ClaudeProcessInfo {
  id: string;
  session_id?: string;
  role: string;
  working_dir: string;
  status: "starting" | "ready" | "processing" | "streaming" | "completed" | "error" | "terminated";
  pid: number;
  created_at: string;
}

export interface SpawnOptions {
  role: string;
  working_dir: string;
  prompt?: string;
  session_id?: string;
  max_turns?: number;
}

/** Options for spawning a persistent session */
export interface SpawnSessionOptions {
  role: string;
  working_dir: string;
  prompt?: string;
  /** Terminal ID for event routing */
  terminal_id?: string;
  /** Claude session ID to resume (uses --resume flag) */
  resume_session_id?: string;
}

// =============================================================================
// Hook
// =============================================================================

export interface UseClaudeProcessOptions {
  /** Unique identifier for this terminal/hook instance */
  terminalId?: string;
  onEvent?: (event: ClaudeEvent) => void;
  onBlock?: (block: Block) => void;
  onComplete?: (processId: string) => void;
  onError?: (error: string) => void;
  /** Called when Claude's session_id is received from system.init event */
  onClaudeSessionId?: (claudeSessionId: string) => void;
}

export interface UseClaudeProcessReturn {
  // Process state
  process: ClaudeProcessInfo | null;
  blocks: Block[];
  isRunning: boolean;
  error: string | null;
  /** Whether a persistent session is active */
  hasSession: boolean;
  /** The active session ID (if any) */
  sessionId: string | null;

  // Legacy one-shot actions
  spawn: (options: SpawnOptions) => Promise<ClaudeProcessInfo>;
  terminate: () => Promise<void>;
  clearBlocks: () => void;

  // Persistent session actions (multi-turn)
  /** Spawn a persistent session (only for first message) */
  spawnSession: (options: SpawnSessionOptions) => Promise<ClaudeProcessInfo>;
  /** Send input to existing session (for subsequent messages) */
  sendInput: (input: string) => Promise<void>;
  /** Terminate the persistent session */
  terminateSession: () => Promise<void>;
  /** Load session history from Claude's .jsonl file and prepend to blocks */
  loadSessionHistory: (workingDir: string, claudeSessionId: string) => Promise<void>;

  // List processes
  listProcesses: () => Promise<ClaudeProcessInfo[]>;

  // Manual block manipulation (for slash commands, notifications, etc.)
  addBlock: (block: Block) => void;
}

export function useClaudeProcess(
  options: UseClaudeProcessOptions = {}
): UseClaudeProcessReturn {
  const { terminalId, onEvent, onBlock, onComplete, onError, onClaudeSessionId } = options;

  const [process, setProcess] = useState<ClaudeProcessInfo | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Persistent session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);

  const processIdRef = useRef<string | null>(null);
  const currentToolBlockRef = useRef<string | null>(null);
  const unlistenersRef = useRef<UnlistenFn[]>([]);
  const mountedRef = useRef(true);
  const hookIdRef = useRef(terminalId || `hook-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  // Track processed events to prevent duplicates (StrictMode, multiple listeners)
  const processedEventsRef = useRef<Set<string>>(new Set());

  // Add a new block
  const addBlock = useCallback(
    (block: Block) => {
      setBlocks((prev) => [...prev, block]);
      onBlock?.(block);
    },
    [onBlock]
  );

  // Update an existing block (kept for potential future use)

  // Convert Claude event to Block
  const processEvent = useCallback(
    (event: ClaudeEvent) => {
      onEvent?.(event);

      switch (event.type) {
        case "system": {
          // Call callback if this is init event with session_id
          // This allows consumers to persist the Claude session ID for resume functionality
          if (event.subtype === "init" && event.session_id) {
            onClaudeSessionId?.(event.session_id);
          }

          const block: Block = {
            id: generateBlockId(),
            type: "system",
            timestamp: new Date(),
            status: "completed",
            isCollapsed: true,
            content: {
              type: "system",
              data: {
                subtype: event.subtype || "init",
                sessionId: event.session_id,
                tools: event.tools,
              } as SystemContent,
            },
          };
          addBlock(block);
          break;
        }

        case "user": {
          const userMsg = event.message as UserMessage | undefined;

          // Handle two formats:
          // 1. Regular user input: content is array [{type: "text", text: "..."}]
          // 2. Slash command output: content is string "<local-command-stdout>..."

          if (typeof userMsg?.content === "string") {
            // Slash command output - content is a string
            let text = userMsg.content;

            // Extract content from <local-command-stdout> wrapper
            const localCmdMatch = text.match(/<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/);
            if (localCmdMatch) {
              text = localCmdMatch[1].trim();
            }

            // Display as output block (not input) since it's command result
            if (text) {
              const block: Block = {
                id: generateBlockId(),
                type: "output",
                timestamp: new Date(),
                status: "completed",
                isCollapsed: false,
                content: {
                  type: "output",
                  data: {
                    text,
                    source: "cli",
                  } as OutputContent,
                },
              };
              addBlock(block);
            }
          } else if (Array.isArray(userMsg?.content)) {
            // Regular user input - content is array of content objects
            const textContent = userMsg.content.find((c) => c.type === "text");
            if (textContent?.text) {
              const block: Block = {
                id: generateBlockId(),
                type: "input",
                timestamp: new Date(),
                status: "completed",
                isCollapsed: false,
                content: {
                  type: "input",
                  data: {
                    prompt: textContent.text,
                  } as InputContent,
                },
              };
              addBlock(block);
            }
          }
          break;
        }

        case "assistant": {
          const msg = event.message as AssistantMessage | undefined;
          if (msg?.content) {
            for (const content of msg.content) {
              if (content.type === "text" && content.text) {
                const block: Block = {
                  id: generateBlockId(),
                  type: "output",
                  timestamp: new Date(),
                  status: "completed",
                  isCollapsed: false,
                  content: {
                    type: "output",
                    data: {
                      text: content.text,
                      model: msg.model,
                    } as OutputContent,
                  },
                };
                addBlock(block);
              } else if (content.type === "thinking" && content.thinking) {
                const block: Block = {
                  id: generateBlockId(),
                  type: "thinking",
                  timestamp: new Date(),
                  status: "completed",
                  isCollapsed: true,
                  content: {
                    type: "thinking",
                    data: {
                      thinking: content.thinking,
                    } as ThinkingContent,
                  },
                };
                addBlock(block);
              }
            }
          }
          break;
        }

        case "tool_use": {
          const blockId = generateBlockId();
          currentToolBlockRef.current = blockId;
          const block: Block = {
            id: blockId,
            type: "tool",
            timestamp: new Date(),
            status: "streaming",
            isCollapsed: false,
            content: {
              type: "tool",
              data: {
                toolName: event.tool || "unknown",
                toolInput: event.input,
                toolUseId: event.tool_use_id,
              } as ToolContent,
            },
          };
          addBlock(block);
          break;
        }

        case "tool_result": {
          if (currentToolBlockRef.current) {
            setBlocks((prev) =>
              prev.map((b) => {
                if (b.id !== currentToolBlockRef.current) return b;
                const existingData = b.content.data as ToolContent;
                return {
                  ...b,
                  status: "completed" as const,
                  content: {
                    type: "tool" as const,
                    data: {
                      ...existingData,
                      toolOutput: event.output,
                      isError: event.is_error,
                    } as ToolContent,
                  },
                };
              })
            );
            currentToolBlockRef.current = null;
          }
          break;
        }

        case "result": {
          // Claude finished responding - unlock input for next message
          // This is critical for persistent sessions where process stays alive
          setIsRunning(false);

          // Update the last output block with result metadata
          setBlocks((prev) => {
            let lastOutputIndex = -1;
            for (let i = prev.length - 1; i >= 0; i--) {
              if (prev[i].type === "output") {
                lastOutputIndex = i;
                break;
              }
            }
            if (lastOutputIndex >= 0) {
              const updated = [...prev];
              const existingData = updated[lastOutputIndex].content.data as OutputContent;
              updated[lastOutputIndex] = {
                ...updated[lastOutputIndex],
                content: {
                  type: "output" as const,
                  data: {
                    ...existingData,
                    costUsd: event.cost_usd,
                    durationMs: event.duration_ms,
                    numTurns: event.num_turns,
                  } as OutputContent,
                },
              };
              return updated;
            }
            return prev;
          });
          break;
        }

        case "error": {
          const block: Block = {
            id: generateBlockId(),
            type: "error",
            timestamp: new Date(),
            status: "error",
            isCollapsed: false,
            content: {
              type: "error",
              data: {
                message: event.error?.message || "Unknown error",
                code: event.error?.code,
              } as ErrorContent,
            },
          };
          addBlock(block);
          setError(event.error?.message || "Unknown error");
          onError?.(event.error?.message || "Unknown error");
          break;
        }

        default:
          // Unknown event type, ignore
          break;
      }
    },
    [addBlock, onEvent, onError, onClaudeSessionId, setBlocks]
  );

  // Store callbacks in refs to avoid re-creating listeners on every render
  const processEventRef = useRef(processEvent);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    processEventRef.current = processEvent;
  }, [processEvent]);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Setup event listeners - only once on mount
  useEffect(() => {
    const hookId = hookIdRef.current;
    let aborted = false;
    // Use a Promise to track when all listeners are set up
    let setupPromise: Promise<UnlistenFn[]> | null = null;

    mountedRef.current = true;

    // Generate event key for deduplication
    const getEventKey = (processId: string, event: ClaudeEvent): string => {
      const baseKey = `${processId}:${event.type}`;
      // Add specific identifiers based on event type
      if (event.type === "system" && event.subtype) {
        return `${baseKey}:${event.subtype}:${event.session_id || ""}`;
      }
      if (event.type === "assistant" || event.type === "user") {
        // Use message content hash
        const msg = event.message;
        const content = msg?.content;
        // Handle both string content (slash commands) and array content (regular messages)
        if (typeof content === "string") {
          return `${baseKey}:${content.substring(0, 50)}`;
        }
        if (Array.isArray(content) && content[0] && typeof content[0] === "object" && "text" in content[0]) {
          return `${baseKey}:${(content[0] as { text?: string }).text?.substring(0, 50)}`;
        }
      }
      if (event.type === "result") {
        return `${baseKey}:${event.duration_ms}:${event.num_turns}`;
      }
      return `${baseKey}:${Date.now()}`;
    };

    const setupListeners = async (): Promise<UnlistenFn[]> => {
      const listeners: UnlistenFn[] = [];

      try {
        // Listen for Claude events
        const unlistenEvent = await listen<{ process_id: string; event: ClaudeEvent }>(
          "claude-event",
          (e) => {
            if (aborted || !mountedRef.current) return;
            const currentProcessId = processIdRef.current;
            if (e.payload.process_id === currentProcessId) {
              // Deduplicate events
              const eventKey = getEventKey(e.payload.process_id, e.payload.event);
              if (processedEventsRef.current.has(eventKey)) {
                return; // Skip duplicate
              }
              processedEventsRef.current.add(eventKey);
              // Limit set size to prevent memory leak
              if (processedEventsRef.current.size > 1000) {
                const entries = Array.from(processedEventsRef.current);
                processedEventsRef.current = new Set(entries.slice(-500));
              }
              processEventRef.current(e.payload.event);
            }
          }
        );
        listeners.push(unlistenEvent);
        if (aborted) return listeners;

        // Listen for process completion
        const unlistenComplete = await listen<{ process_id: string }>(
          "claude-process-complete",
          (e) => {
            if (aborted || !mountedRef.current) return;
            if (e.payload.process_id === processIdRef.current) {
              setIsRunning(false);
              setProcess((prev) =>
                prev ? { ...prev, status: "completed" } : null
              );
              onCompleteRef.current?.(e.payload.process_id);
            }
          }
        );
        listeners.push(unlistenComplete);
        if (aborted) return listeners;

        // Listen for stderr
        const unlistenStderr = await listen<{ process_id: string; content: string }>(
          "claude-stderr",
          (e) => {
            if (aborted || !mountedRef.current) return;
            if (e.payload.process_id === processIdRef.current) {
              console.warn(`[useClaudeProcess:${hookId}] stderr:`, e.payload.content);
            }
          }
        );
        listeners.push(unlistenStderr);
        if (aborted) return listeners;

        // Listen for parse errors - display raw output from Claude CLI
        // This handles slash command output like /context, /cost etc. which are plain text
        const unlistenParseError = await listen<{
          process_id: string;
          line: string;
          error: string;
        }>("claude-parse-error", (e) => {
          if (aborted || !mountedRef.current) return;
          if (e.payload.process_id === processIdRef.current) {
            console.warn(`[useClaudeProcess:${hookId}] Parse error (raw output):`, e.payload.line);
            // Display the raw line as output - this is likely slash command output
            const rawLine = e.payload.line?.trim();
            if (rawLine && rawLine.length > 0) {
              const block: Block = {
                id: generateBlockId(),
                type: "output",
                timestamp: new Date(),
                status: "completed",
                isCollapsed: false,
                content: {
                  type: "output",
                  data: {
                    text: rawLine,
                    source: "cli",
                  } as OutputContent,
                },
              };
              addBlock(block);
            }
          }
        });
        listeners.push(unlistenParseError);

        if (!aborted) {
          unlistenersRef.current = listeners;
          console.log(`[useClaudeProcess:${hookId}] Event listeners ready`);
        }
      } catch (err) {
        console.error(`[useClaudeProcess:${hookId}] Failed to setup listeners:`, err);
      }

      return listeners;
    };

    setupPromise = setupListeners();

    return () => {
      console.log(`[useClaudeProcess:${hookId}] Cleaning up listeners...`);
      aborted = true;
      mountedRef.current = false;

      // Wait for setup to complete before cleaning up
      // This prevents race condition where cleanup runs before listeners are registered
      if (setupPromise) {
        setupPromise.then((listeners) => {
          listeners.forEach((unlisten) => {
            try {
              unlisten();
            } catch (e) {
              // Ignore cleanup errors - listener may already be removed
            }
          });
        }).catch(() => {
          // Ignore - setup failed
        });
      }

      // Also clean up any listeners in ref
      unlistenersRef.current.forEach((unlisten) => {
        try {
          unlisten();
        } catch (e) {
          // Ignore cleanup errors
        }
      });
      unlistenersRef.current = [];
    };
  }, []); // Empty deps - only run once on mount

  // Spawn a new Claude process
  const spawn = useCallback(async (spawnOptions: SpawnOptions): Promise<ClaudeProcessInfo> => {
    const hookId = hookIdRef.current;
    try {
      console.log(`[useClaudeProcess:${hookId}] Spawning with options:`, spawnOptions);
      setError(null);
      setIsRunning(true);
      // Clear dedup set for new process
      processedEventsRef.current.clear();

      const result = await invoke<ClaudeProcessInfo>("claude_spawn", {
        options: spawnOptions,
      });

      console.log(`[useClaudeProcess:${hookId}] Spawn success, process ID:`, result.id);
      processIdRef.current = result.id;
      setProcess(result);

      return result;
    } catch (err) {
      console.error(`[useClaudeProcess:${hookId}] Spawn failed:`, err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setIsRunning(false);
      throw err;
    }
  }, []);

  // Terminate the current process
  const terminate = useCallback(async (): Promise<void> => {
    if (processIdRef.current) {
      try {
        await invoke("claude_terminate", { processId: processIdRef.current });
        setIsRunning(false);
        setProcess((prev) =>
          prev ? { ...prev, status: "terminated" } : null
        );
      } catch (err) {
        console.error("Failed to terminate process:", err);
      }
    }
  }, []);

  // Clear all blocks
  const clearBlocks = useCallback(() => {
    setBlocks([]);
  }, []);

  // List all processes
  const listProcesses = useCallback(async (): Promise<ClaudeProcessInfo[]> => {
    return invoke<ClaudeProcessInfo[]>("claude_list_processes");
  }, []);

  // =========================================================================
  // Persistent Session Methods (for multi-turn conversations)
  // =========================================================================

  // Spawn a new persistent session
  const spawnSession = useCallback(async (spawnOptions: SpawnSessionOptions): Promise<ClaudeProcessInfo> => {
    const hookId = hookIdRef.current;
    try {
      console.log(`[useClaudeProcess:${hookId}] Spawning persistent session:`, spawnOptions);
      setError(null);

      // Immediately add input block to show user what they sent
      if (spawnOptions.prompt) {
        const inputBlock: Block = {
          id: generateBlockId(),
          type: "input",
          timestamp: new Date(),
          status: "completed",
          isCollapsed: false,
          content: {
            type: "input",
            data: {
              prompt: spawnOptions.prompt,
            } as InputContent,
          },
        };
        addBlock(inputBlock);
      }

      setIsRunning(true);
      // Clear dedup set for new session
      processedEventsRef.current.clear();

      const result = await invoke<ClaudeProcessInfo>("claude_spawn_session", {
        options: spawnOptions,
      });

      console.log(`[useClaudeProcess:${hookId}] Session spawned, ID:`, result.id);
      processIdRef.current = result.id;
      setProcess(result);
      setSessionId(result.id);
      setHasSession(true);

      return result;
    } catch (err) {
      console.error(`[useClaudeProcess:${hookId}] Spawn session failed:`, err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setIsRunning(false);
      throw err;
    }
  }, [addBlock]);

  // Send input to existing persistent session
  const sendInput = useCallback(async (input: string): Promise<void> => {
    const hookId = hookIdRef.current;
    if (!sessionId) {
      throw new Error("No active session. Call spawnSession first.");
    }

    try {
      console.log(`[useClaudeProcess:${hookId}] Sending input to session ${sessionId}:`, input.substring(0, 50));

      // Immediately add input block to show user what they sent
      const inputBlock: Block = {
        id: generateBlockId(),
        type: "input",
        timestamp: new Date(),
        status: "completed",
        isCollapsed: false,
        content: {
          type: "input",
          data: {
            prompt: input,
          } as InputContent,
        },
      };
      addBlock(inputBlock);

      setIsRunning(true);

      await invoke("claude_send_input", {
        sessionId,
        input,
      });

      console.log(`[useClaudeProcess:${hookId}] Input sent successfully`);
    } catch (err) {
      console.error(`[useClaudeProcess:${hookId}] Send input failed:`, err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    }
  }, [sessionId, addBlock]);

  // Terminate the persistent session
  const terminateSession = useCallback(async (): Promise<void> => {
    const hookId = hookIdRef.current;
    if (!sessionId) {
      console.log(`[useClaudeProcess:${hookId}] No session to terminate`);
      return;
    }

    try {
      console.log(`[useClaudeProcess:${hookId}] Terminating session ${sessionId}`);
      await invoke("claude_terminate_session", { sessionId });
      setIsRunning(false);
      setProcess((prev) => prev ? { ...prev, status: "terminated" } : null);
      setSessionId(null);
      setHasSession(false);
      processIdRef.current = null;
      console.log(`[useClaudeProcess:${hookId}] Session terminated`);
    } catch (err) {
      console.error(`[useClaudeProcess:${hookId}] Failed to terminate session:`, err);
    }
  }, [sessionId]);

  // Load session history from Claude's .jsonl file
  const loadSessionHistory = useCallback(async (workingDir: string, claudeSessionId: string): Promise<void> => {
    const hookId = hookIdRef.current;
    try {
      console.log(`[useClaudeProcess:${hookId}] Loading session history for ${claudeSessionId}`);

      const events = await invoke<Array<Record<string, unknown>>>("claude_load_session_history", {
        workingDir,
        claudeSessionId,
      });

      console.log(`[useClaudeProcess:${hookId}] Loaded ${events.length} history events`);

      // Convert events to blocks
      const historyBlocks: Block[] = [];

      for (const event of events) {
        const eventType = event.type as string;

        switch (eventType) {
          case "user": {
            const message = event.message as { role?: string; content?: string | Array<{ type: string; text?: string }> } | undefined;
            let text = "";
            if (typeof message?.content === "string") {
              text = message.content;
            } else if (Array.isArray(message?.content)) {
              const textContent = message.content.find((c) => c.type === "text");
              text = textContent?.text || "";
            }
            if (text) {
              historyBlocks.push({
                id: generateBlockId(),
                type: "input",
                timestamp: new Date(event.timestamp as string || Date.now()),
                status: "completed",
                isCollapsed: false,
                content: {
                  type: "input",
                  data: { prompt: text } as InputContent,
                },
              });
            }
            break;
          }

          case "assistant": {
            const message = event.message as { content?: Array<{ type: string; text?: string; thinking?: string }> } | undefined;
            if (message?.content) {
              for (const content of message.content) {
                if (content.type === "text" && content.text) {
                  historyBlocks.push({
                    id: generateBlockId(),
                    type: "output",
                    timestamp: new Date(event.timestamp as string || Date.now()),
                    status: "completed",
                    isCollapsed: false,
                    content: {
                      type: "output",
                      data: { text: content.text } as OutputContent,
                    },
                  });
                } else if (content.type === "thinking" && content.thinking) {
                  historyBlocks.push({
                    id: generateBlockId(),
                    type: "thinking",
                    timestamp: new Date(event.timestamp as string || Date.now()),
                    status: "completed",
                    isCollapsed: true,
                    content: {
                      type: "thinking",
                      data: { thinking: content.thinking } as ThinkingContent,
                    },
                  });
                }
              }
            }
            break;
          }

          case "tool_use": {
            historyBlocks.push({
              id: generateBlockId(),
              type: "tool",
              timestamp: new Date(event.timestamp as string || Date.now()),
              status: "completed",
              isCollapsed: true,
              content: {
                type: "tool",
                data: {
                  toolName: event.tool as string || "unknown",
                  toolInput: event.input,
                  toolUseId: event.tool_use_id as string,
                } as ToolContent,
              },
            });
            break;
          }

          case "tool_result": {
            // Find the last tool block and update it
            const lastToolIndex = historyBlocks.findLastIndex((b) => b.type === "tool");
            if (lastToolIndex >= 0) {
              const existingData = historyBlocks[lastToolIndex].content.data as ToolContent;
              historyBlocks[lastToolIndex] = {
                ...historyBlocks[lastToolIndex],
                content: {
                  type: "tool",
                  data: {
                    ...existingData,
                    toolOutput: event.output as string,
                    isError: event.is_error as boolean,
                  } as ToolContent,
                },
              };
            }
            break;
          }
        }
      }

      // Prepend history blocks to current blocks
      if (historyBlocks.length > 0) {
        setBlocks((prev) => [...historyBlocks, ...prev]);
        console.log(`[useClaudeProcess:${hookId}] Added ${historyBlocks.length} history blocks`);
      }
    } catch (err) {
      console.error(`[useClaudeProcess:${hookId}] Failed to load session history:`, err);
      // Don't throw - history loading failure shouldn't block the session
    }
  }, []);

  return {
    process,
    blocks,
    isRunning,
    error,
    hasSession,
    sessionId,
    // Legacy one-shot
    spawn,
    terminate,
    clearBlocks,
    // Persistent session
    spawnSession,
    sendInput,
    terminateSession,
    loadSessionHistory,
    // List
    listProcesses,
    // Manual block manipulation (for slash commands)
    addBlock,
  };
}

export default useClaudeProcess;
