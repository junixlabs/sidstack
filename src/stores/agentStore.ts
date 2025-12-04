/**
 * Agent Store
 *
 * Zustand store for managing coordinated agent state,
 * messages, and multi-agent coordination.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { create } from "zustand";

// =============================================================================
// Types
// =============================================================================

import type { AgentRole } from '@sidstack/shared';
export type { AgentRole };

export type CoordinationStatus =
  | "idle"
  | "working"
  | "waiting_for_input"
  | "waiting_for_dependency"
  | "blocked"
  | "completed"
  | "error";

export type MessagePriority = "low" | "normal" | "high" | "urgent";

export interface CoordinatedAgent {
  id: string;
  role: AgentRole;
  specialty?: string;
  status: CoordinationStatus;
  current_task: string | null;
  progress: number; // 0-100
  last_activity: number; // unix timestamp
  health_score: number; // 0-100
}

export interface AgentMessage {
  id: string;
  from_agent: string;
  to_agent: string | null; // null = broadcast
  priority: MessagePriority;
  content: MessageContent;
  timestamp: number;
  correlation_id: string | null;
}

export type MessageContent =
  | {
      type: "task_delegation";
      task_id: string;
      description: string;
      context: string[];
      dependencies: string[];
    }
  | {
      type: "task_result";
      task_id: string;
      success: boolean;
      output: string;
      artifacts: string[];
    }
  | {
      type: "progress_update";
      task_id: string;
      progress: number;
      current_step: string;
    }
  | {
      type: "status_change";
      status: CoordinationStatus;
      reason: string | null;
    }
  | {
      type: "clarification";
      question: string;
      options: string[] | null;
    }
  | {
      type: "clarification_response";
      answer: string;
    }
  | {
      type: "blocker";
      task_id: string;
      blocker_type: string;
      description: string;
      blocked_by: string | null;
    }
  | { type: "ping" }
  | { type: "pong" }
  | {
      type: "custom";
      action: string;
      payload: unknown;
    };

export interface HealthIssue {
  agentId: string;
  healthScore: number;
  issue: string;
}

// =============================================================================
// Store Interface
// =============================================================================

interface AgentState {
  // Agent registry
  agents: Map<string, CoordinatedAgent>;
  orchestratorId: string | null;

  // Messages
  messages: AgentMessage[];
  unreadCount: number;

  // Health
  healthIssues: HealthIssue[];
  lastHealthCheck: number | null;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Coordinator availability
  coordinatorAvailable: boolean;
  lastConnectionAttempt: number | null;

  // Event listeners
  _unlisteners: UnlistenFn[];

  // Actions
  initialize: () => Promise<void>;
  cleanup: () => void;

  // Agent management
  registerAgent: (agentId: string, role: AgentRole) => Promise<void>;
  unregisterAgent: (agentId: string) => Promise<void>;
  refreshAgents: () => Promise<void>;
  getAgent: (agentId: string) => CoordinatedAgent | undefined;

  // Status updates
  updateAgentStatus: (
    agentId: string,
    status: CoordinationStatus,
    currentTask?: string,
    progress?: number
  ) => Promise<void>;

  // Messaging
  sendMessage: (
    fromAgent: string,
    toAgent: string | null,
    priority: MessagePriority,
    contentType: string,
    contentData: Record<string, unknown>
  ) => Promise<string>;
  clearMessages: () => void;
  markMessagesRead: () => void;

  // Task delegation
  delegateTask: (
    taskId: string,
    description: string,
    context: string[],
    dependencies: string[],
    preferredSpecialist?: string
  ) => Promise<string>;

  // Health
  runHealthCheck: () => Promise<void>;
  getIdleWorkers: () => Promise<CoordinatedAgent[]>;

  // Internal updates from events
  _updateAgent: (agent: CoordinatedAgent) => void;
  _addMessage: (message: AgentMessage) => void;
  _setHealthIssues: (issues: HealthIssue[]) => void;
}

// =============================================================================
// Store Implementation
// =============================================================================

export const useAgentStore = create<AgentState>((set, get) => ({
  // Initial state
  agents: new Map(),
  orchestratorId: null,
  messages: [],
  unreadCount: 0,
  healthIssues: [],
  lastHealthCheck: null,
  isLoading: false,
  error: null,
  coordinatorAvailable: false,
  lastConnectionAttempt: null,
  _unlisteners: [],

  // Initialize store and setup event listeners
  initialize: async () => {
    set({ isLoading: true, error: null, lastConnectionAttempt: Date.now() });

    try {
      // Setup event listeners (these should always work)
      const unlisteners: UnlistenFn[] = [];

      // Listen for agent status changes
      unlisteners.push(
        await listen<CoordinatedAgent>("coordinator-agent-status", (event) => {
          get()._updateAgent(event.payload);
          // Mark coordinator as available when we receive events
          set({ coordinatorAvailable: true, error: null });
        })
      );

      // Listen for messages
      unlisteners.push(
        await listen<AgentMessage>("coordinator-message", (event) => {
          get()._addMessage(event.payload);
        })
      );

      // Listen for health issues
      unlisteners.push(
        await listen<[string, number, string][]>("coordinator-health-issues", (event) => {
          const issues: HealthIssue[] = event.payload.map(([agentId, healthScore, issue]) => ({
            agentId,
            healthScore,
            issue,
          }));
          get()._setHealthIssues(issues);
        })
      );

      // Listen for task delegations
      unlisteners.push(
        await listen<{ task_id: string; worker_id: string }>(
          "coordinator-task-delegated",
          (event) => {
            console.log("Task delegated:", event.payload);
          }
        )
      );

      set({ _unlisteners: unlisteners });

      // Try to load initial data - gracefully handle failures
      try {
        await get().refreshAgents();

        // Get orchestrator ID
        const orchestratorId = await invoke<string | null>("coordinator_get_orchestrator");
        set({ orchestratorId, coordinatorAvailable: true });
      } catch (coordinatorErr) {
        // Coordinator commands failed - this is expected if coordinator is not running
        const errorMessage = coordinatorErr instanceof Error
          ? coordinatorErr.message
          : String(coordinatorErr);

        // Check if it's a "command not found" or connection error
        const isUnavailable = errorMessage.includes("not found") ||
                             errorMessage.includes("No such command") ||
                             errorMessage.includes("connection") ||
                             errorMessage.includes("failed");

        set({
          coordinatorAvailable: false,
          // Don't set error for expected "coordinator not running" state
          error: isUnavailable ? null : errorMessage,
        });

        console.log("Coordinator not available:", errorMessage);
      }

      set({ isLoading: false });
    } catch (err) {
      // Fatal error setting up event listeners
      set({
        isLoading: false,
        coordinatorAvailable: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  // Cleanup event listeners
  cleanup: () => {
    const { _unlisteners } = get();
    _unlisteners.forEach((unlisten) => unlisten());
    set({ _unlisteners: [] });
  },

  // Register a new agent
  registerAgent: async (agentId: string, role: AgentRole) => {
    try {
      await invoke("coordinator_register_agent", { agentId, role });
      await get().refreshAgents();

      if (role === "orchestrator") {
        set({ orchestratorId: agentId });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  // Unregister an agent
  unregisterAgent: async (agentId: string) => {
    try {
      await invoke("coordinator_unregister_agent", { agentId });

      const { orchestratorId } = get();
      if (orchestratorId === agentId) {
        set({ orchestratorId: null });
      }

      await get().refreshAgents();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  // Refresh agent list from backend
  refreshAgents: async () => {
    try {
      const agentList = await invoke<CoordinatedAgent[]>("coordinator_list_agents");
      const agentsMap = new Map<string, CoordinatedAgent>();
      agentList.forEach((agent) => agentsMap.set(agent.id, agent));
      set({ agents: agentsMap, coordinatorAvailable: true });
    } catch (err) {
      // Don't set error state for connection failures
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isConnectionError = errorMessage.includes("not found") ||
                                errorMessage.includes("No such command") ||
                                errorMessage.includes("connection");

      if (!isConnectionError) {
        set({ error: errorMessage });
      }
      set({ coordinatorAvailable: false });
      throw err; // Re-throw so caller knows it failed
    }
  },

  // Get a specific agent
  getAgent: (agentId: string) => {
    return get().agents.get(agentId);
  },

  // Update agent status
  updateAgentStatus: async (
    agentId: string,
    status: CoordinationStatus,
    currentTask?: string,
    progress?: number
  ) => {
    try {
      await invoke("coordinator_update_status", {
        agentId,
        status,
        currentTask: currentTask ?? null,
        progress: progress ?? null,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  // Send a message
  sendMessage: async (
    fromAgent: string,
    toAgent: string | null,
    priority: MessagePriority,
    contentType: string,
    contentData: Record<string, unknown>
  ) => {
    try {
      const messageId = await invoke<string>("coordinator_send_message", {
        fromAgent,
        toAgent,
        priority,
        contentType,
        contentData,
      });
      return messageId;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  // Clear messages
  clearMessages: () => {
    set({ messages: [], unreadCount: 0 });
  },

  // Mark messages as read
  markMessagesRead: () => {
    set({ unreadCount: 0 });
  },

  // Delegate a task
  delegateTask: async (
    taskId: string,
    description: string,
    context: string[],
    dependencies: string[],
    preferredSpecialist?: string
  ) => {
    try {
      const workerId = await invoke<string>("coordinator_delegate_task", {
        taskId,
        description,
        context,
        dependencies,
        preferredSpecialist: preferredSpecialist ?? null,
      });
      return workerId;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  // Run health check
  runHealthCheck: async () => {
    try {
      await invoke("coordinator_health_check");
      set({ lastHealthCheck: Date.now() });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  // Get idle workers
  getIdleWorkers: async () => {
    try {
      return await invoke<CoordinatedAgent[]>("coordinator_get_idle_workers");
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      return [];
    }
  },

  // Internal: Update agent from event
  _updateAgent: (agent: CoordinatedAgent) => {
    set((state) => {
      const newAgents = new Map(state.agents);
      newAgents.set(agent.id, agent);
      return { agents: newAgents };
    });
  },

  // Internal: Add message from event
  _addMessage: (message: AgentMessage) => {
    set((state) => ({
      messages: [...state.messages.slice(-999), message], // Keep last 1000
      unreadCount: state.unreadCount + 1,
    }));
  },

  // Internal: Set health issues
  _setHealthIssues: (issues: HealthIssue[]) => {
    set({ healthIssues: issues });
  },
}));

// =============================================================================
// Selectors
// =============================================================================

// Safe helper to convert agents Map to array
const safeAgentsArray = (agents: Map<string, CoordinatedAgent> | unknown): CoordinatedAgent[] => {
  if (agents instanceof Map) {
    return Array.from(agents.values());
  }
  return [];
};

export const selectAgentsByRole = (role: AgentRole) => (state: AgentState) =>
  safeAgentsArray(state.agents).filter((a) => a.role === role);

export const selectWorkingAgents = (state: AgentState) =>
  safeAgentsArray(state.agents).filter((a) => a.status === "working");

export const selectBlockedAgents = (state: AgentState) =>
  safeAgentsArray(state.agents).filter((a) => a.status === "blocked");

export const selectUnhealthyAgents = (state: AgentState) =>
  safeAgentsArray(state.agents).filter((a) => a.health_score < 50);

export const selectRecentMessages = (limit: number) => (state: AgentState) =>
  state.messages.slice(-limit);

export const selectMessagesForAgent = (agentId: string) => (state: AgentState) =>
  state.messages.filter(
    (m) => m.to_agent === agentId || m.to_agent === null || m.from_agent === agentId
  );
