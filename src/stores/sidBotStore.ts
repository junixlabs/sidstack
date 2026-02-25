import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  sendMessage as apiSendMessage,
  healthCheck as apiHealthCheck,
  cancelStream as apiCancelStream,
} from "@/services/sidBotApi";
import { useAppStore } from "@/stores/appStore";
import pkgJson from "../../package.json";

// =============================================================================
// Types
// =============================================================================

export type SidBotActionType =
  | "navigate"
  | "open_knowledge"
  | "create_task"
  | "run_impact"
  | "open_config"
  | "open_doc";

export interface SidBotAction {
  type: SidBotActionType;
  label: string;
  payload?: Record<string, string>;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface SidBotMessage {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: number;
  actions?: SidBotAction[];
  route?: string;
  usage?: TokenUsage;
}

export type SSEEventType =
  | "token"
  | "done"
  | "action"
  | "claude_start"
  | "claude_progress"
  | "claude_end"
  | "message_end"
  | "error";

export interface SSEEvent {
  type: SSEEventType;
  data?: string;
  action?: SidBotAction;
  status?: string;
  step?: string;
  detail?: string;
  error?: string;
  route?: string;
  usage?: TokenUsage;
}

export type ClaudeStatus = "idle" | "starting" | "working" | "done" | "error";

export type SidBotTab = "chat" | "config";

interface SidBotState {
  // Persisted
  serverUrl: string;
  isPanelOpen: boolean;
  activeTab: SidBotTab;
  messages: SidBotMessage[];
  conversationId: string;
  selectedModel: string;
  panelWidth: number;

  // Not persisted
  isStreaming: boolean;
  streamingText: string;
  abortController: AbortController | null;
  claudeStatus: ClaudeStatus;
  claudeStep: string;
  claudeDetail: string;
  claudeElapsed: number;
  connectionOk: boolean | null;

  // Actions
  togglePanel: () => void;
  setActiveTab: (tab: SidBotTab) => void;
  sendMessage: (text: string) => Promise<void>;
  cancelStream: () => void;
  clearConversation: () => void;
  executeAction: (action: SidBotAction) => void;
  testConnection: () => Promise<void>;
  setServerUrl: (url: string) => void;
  setPanelWidth: (width: number) => void;
}

let claudeTimer: ReturnType<typeof setInterval> | null = null;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const useSidBotStore = create<SidBotState>()(
  persist(
    (set, get) => ({
      // Persisted defaults
      serverUrl: "http://localhost:3222",
      isPanelOpen: false,
      activeTab: "chat",
      messages: [],
      conversationId: generateId(),
      selectedModel: "gemini-3-flash-preview",
      panelWidth: 320,

      // Not persisted defaults
      isStreaming: false,
      streamingText: "",
      abortController: null,
      claudeStatus: "idle",
      claudeStep: "",
      claudeDetail: "",
      claudeElapsed: 0,
      connectionOk: null,

      togglePanel: () =>
        set((state) => ({ isPanelOpen: !state.isPanelOpen })),

      setActiveTab: (tab) => set({ activeTab: tab }),

      sendMessage: async (text: string) => {
        const { isStreaming } = get();
        if (isStreaming) return;

        const userMsg: SidBotMessage = {
          id: generateId(),
          role: "user",
          content: text,
          timestamp: Date.now(),
        };

        const abortController = new AbortController();
        set((state) => ({
          messages: [...state.messages, userMsg],
          isStreaming: true,
          streamingText: "",
          abortController,
          claudeStatus: "idle",
          claudeStep: "",
          claudeDetail: "",
          claudeElapsed: 0,
        }));

        const { serverUrl, conversationId, selectedModel } = get();
        const projectPath = useAppStore.getState().projectPath;
        const projectName = projectPath?.split("/").pop() || undefined;

        let fullText = "";
        const actions: SidBotAction[] = [];
        let msgRoute: string | undefined;
        let msgUsage: TokenUsage | undefined;

        try {
          for await (const event of apiSendMessage({
            serverUrl,
            message: text,
            conversationId,
            model: selectedModel,
            context: {
              projectName,
              projectPath: projectPath || undefined,
              projectVersion: pkgJson.version,
            },
            signal: abortController.signal,
          })) {
            if (abortController.signal.aborted) break;

            switch (event.type) {
              case "token":
                fullText += event.data ?? "";
                set({ streamingText: fullText });
                break;
              case "done":
                break;
              case "message_end":
                msgRoute = event.route;
                msgUsage = event.usage;
                break;
              case "action":
                if (event.action) actions.push(event.action);
                break;
              case "claude_start":
                if (claudeTimer) clearInterval(claudeTimer);
                set({ claudeStatus: "starting", claudeStep: event.step ?? "Initializing...", claudeDetail: "", claudeElapsed: 0 });
                claudeTimer = setInterval(() => {
                  set((s) => ({ claudeElapsed: s.claudeElapsed + 1 }));
                }, 1000);
                break;
              case "claude_progress":
                set({ claudeStatus: "working", claudeStep: event.step ?? "", claudeDetail: event.detail ?? "" });
                break;
              case "claude_end":
                if (claudeTimer) { clearInterval(claudeTimer); claudeTimer = null; }
                set({ claudeStatus: event.status === "error" ? "error" : "done" });
                break;
              case "error":
                fullText += `\n\n*Error: ${event.error ?? "Unknown error"}*`;
                set({ streamingText: fullText });
                break;
            }
          }
        } catch {
          // Aborted or network error — just finalize what we have
        }

        if (claudeTimer) { clearInterval(claudeTimer); claudeTimer = null; }

        const botMsg: SidBotMessage = {
          id: generateId(),
          role: "bot",
          content: fullText,
          timestamp: Date.now(),
          actions: actions.length > 0 ? actions : undefined,
          route: msgRoute,
          usage: msgUsage,
        };

        set((state) => ({
          messages: [...state.messages, botMsg],
          isStreaming: false,
          streamingText: "",
          abortController: null,
          claudeStatus: "idle",
        }));
      },

      cancelStream: () => {
        const { abortController, serverUrl, conversationId } = get();
        if (abortController) abortController.abort();
        apiCancelStream(serverUrl, conversationId);
        if (claudeTimer) { clearInterval(claudeTimer); claudeTimer = null; }
        set({ isStreaming: false, streamingText: "", abortController: null, claudeStatus: "idle" });
      },

      clearConversation: () =>
        set({
          messages: [],
          conversationId: generateId(),
          streamingText: "",
          isStreaming: false,
          claudeStatus: "idle",
        }),

      executeAction: (action: SidBotAction) => {
        const viewId = action.payload?.view || action.payload?.viewId;

        switch (action.type) {
          case "navigate":
            if (viewId) {
              window.dispatchEvent(
                new CustomEvent("sidbot-navigate", {
                  detail: { viewId },
                }),
              );
            }
            break;
          case "open_knowledge":
            window.dispatchEvent(
              new CustomEvent("sidbot-navigate", {
                detail: { viewId: "knowledge" },
              }),
            );
            break;
          case "create_task":
            window.dispatchEvent(
              new CustomEvent("sidbot-navigate", {
                detail: { viewId: "task-manager" },
              }),
            );
            break;
          case "run_impact":
            window.dispatchEvent(
              new CustomEvent("sidbot-navigate", {
                detail: { viewId: "project-hub" },
              }),
            );
            break;
          case "open_doc":
            window.dispatchEvent(
              new CustomEvent("sidbot-navigate", {
                detail: { viewId: "knowledge" },
              }),
            );
            break;
          case "open_config":
            set({ activeTab: "config" });
            break;
        }
      },

      testConnection: async () => {
        const { serverUrl } = get();
        try {
          const result = await apiHealthCheck(serverUrl);
          set({ connectionOk: result.status === "ok" });
        } catch {
          set({ connectionOk: false });
        }
      },

      setServerUrl: (url: string) => set({ serverUrl: url }),

      setPanelWidth: (width: number) =>
        set({ panelWidth: Math.min(480, Math.max(280, width)) }),
    }),
    {
      name: "sidstack-sidbot",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        serverUrl: state.serverUrl,
        isPanelOpen: state.isPanelOpen,
        activeTab: state.activeTab,
        messages: state.messages,
        conversationId: state.conversationId,
        selectedModel: state.selectedModel,
        panelWidth: state.panelWidth,
      }),
    },
  ),
);
