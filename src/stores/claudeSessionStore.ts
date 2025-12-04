/**
 * Claude Session Store
 *
 * Zustand store for managing Claude Code sessions,
 * tracking their lifecycle, and linking to tasks/modules.
 */

import { create } from "zustand";

import type {
  ClaudeSession,
  SessionEvent,
  SessionStats,
  SessionFilters,
  WindowMode,
} from "@sidstack/shared";

const API_BASE = "http://localhost:19432/api/sessions";

interface ClaudeSessionStore {
  // Data
  sessions: ClaudeSession[];
  selectedSessionId: string | null;
  selectedSession: ClaudeSession | null;
  sessionEvents: SessionEvent[];
  stats: SessionStats | null;

  // Filters
  filters: SessionFilters;
  total: number;

  // Preferences
  windowMode: WindowMode;
  setWindowMode: (mode: WindowMode) => void;

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions - Fetch
  fetchSessions: (filters?: SessionFilters) => Promise<void>;
  fetchSession: (id: string) => Promise<void>;
  fetchSessionEvents: (id: string) => Promise<void>;
  fetchStats: (filters?: SessionFilters) => Promise<void>;
  fetchSessionsByTask: (taskId: string) => Promise<ClaudeSession[]>;
  fetchSessionsByModule: (moduleId: string) => Promise<ClaudeSession[]>;

  // Actions - Mutations
  launchSession: (options: {
    projectDir: string;
    taskId?: string;
    moduleId?: string;
    prompt?: string;
    terminal?: string;
    mode?: string;
    windowMode?: WindowMode;
  }) => Promise<{ success: boolean; sessionId?: string; error?: string }>;

  updateStatus: (
    id: string,
    status: string,
    options?: { exitCode?: number; errorMessage?: string }
  ) => Promise<void>;

  resumeSession: (
    id: string,
    additionalPrompt?: string,
    windowMode?: WindowMode
  ) => Promise<{ success: boolean; newSessionId?: string; error?: string }>;

  deleteSession: (id: string) => Promise<void>;

  // Actions - Sync
  syncSession: (id: string) => Promise<{ changed: boolean }>;
  syncAllSessions: (workspacePath?: string) => Promise<{ checked: number; changed: number }>;

  // Actions - UI
  selectSession: (id: string | null) => Promise<void>;
  setFilters: (filters: Partial<SessionFilters>) => void;
  clearError: () => void;
}

// Load windowMode preference from localStorage
const getStoredWindowMode = (): WindowMode => {
  try {
    const stored = localStorage.getItem("claude-session-window-mode");
    if (stored === "always-new" || stored === "per-project-tabs") {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return "always-new"; // default
};

export const useClaudeSessionStore = create<ClaudeSessionStore>((set, get) => ({
  // Initial State
  sessions: [],
  selectedSessionId: null,
  selectedSession: null,
  sessionEvents: [],
  stats: null,
  filters: {},
  total: 0,
  windowMode: getStoredWindowMode(),
  isLoading: false,
  error: null,

  // Set window mode preference
  setWindowMode: (mode) => {
    try {
      localStorage.setItem("claude-session-window-mode", mode);
    } catch {
      // localStorage not available
    }
    set({ windowMode: mode });
  },

  // Fetch sessions with filters
  fetchSessions: async (filters?: SessionFilters) => {
    set({ isLoading: true, error: null });

    const appliedFilters = filters || get().filters;
    const params = new URLSearchParams();

    if (appliedFilters.workspacePath)
      params.append("workspacePath", appliedFilters.workspacePath);
    if (appliedFilters.taskId) params.append("taskId", appliedFilters.taskId);
    if (appliedFilters.moduleId)
      params.append("moduleId", appliedFilters.moduleId);
    if (appliedFilters.status) {
      const statuses = Array.isArray(appliedFilters.status)
        ? appliedFilters.status
        : [appliedFilters.status];
      params.append("status", statuses.join(","));
    }
    if (appliedFilters.limit) params.append("limit", String(appliedFilters.limit));
    if (appliedFilters.offset)
      params.append("offset", String(appliedFilters.offset));

    try {
      const res = await fetch(`${API_BASE}?${params}`);
      const data = await res.json();

      if (data.success) {
        set({
          sessions: data.sessions,
          total: data.total,
          filters: appliedFilters,
          isLoading: false,
        });
      } else {
        set({ error: data.error, isLoading: false });
      }
    } catch (err) {
      set({ error: "Failed to fetch sessions", isLoading: false });
    }
  },

  // Fetch single session
  fetchSession: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const res = await fetch(`${API_BASE}/${id}`);
      const data = await res.json();

      if (data.success) {
        set({
          selectedSession: data.session,
          selectedSessionId: id,
          isLoading: false,
        });
      } else {
        set({ error: data.error, isLoading: false });
      }
    } catch (err) {
      set({ error: "Failed to fetch session", isLoading: false });
    }
  },

  // Fetch session events
  fetchSessionEvents: async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/${id}/events`);
      const data = await res.json();

      if (data.success) {
        set({ sessionEvents: data.events });
      }
    } catch (err) {
      console.error("Failed to fetch events:", err);
    }
  },

  // Fetch stats
  fetchStats: async (filters?: SessionFilters) => {
    try {
      const params = new URLSearchParams();
      if (filters?.workspacePath)
        params.append("workspacePath", filters.workspacePath);
      if (filters?.taskId) params.append("taskId", filters.taskId);
      if (filters?.moduleId) params.append("moduleId", filters.moduleId);

      const res = await fetch(`${API_BASE}/stats/overview?${params}`);
      const data = await res.json();

      if (data.success) {
        set({ stats: data.stats });
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  },

  // Fetch sessions by task
  fetchSessionsByTask: async (taskId: string) => {
    try {
      const res = await fetch(`${API_BASE}/by-task/${taskId}`);
      const data = await res.json();
      return data.success ? data.sessions : [];
    } catch (err) {
      console.error("Failed to fetch sessions by task:", err);
      return [];
    }
  },

  // Fetch sessions by module
  fetchSessionsByModule: async (moduleId: string) => {
    try {
      const res = await fetch(`${API_BASE}/by-module/${moduleId}`);
      const data = await res.json();
      return data.success ? data.sessions : [];
    } catch (err) {
      console.error("Failed to fetch sessions by module:", err);
      return [];
    }
  },

  // Launch new session in external terminal
  launchSession: async (options) => {
    set({ isLoading: true, error: null });

    // Use provided windowMode or fall back to store preference
    const windowMode = options.windowMode || get().windowMode;

    try {
      const res = await fetch(`${API_BASE}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectDir: options.projectDir,
          taskId: options.taskId,
          moduleId: options.moduleId,
          terminal: options.terminal || "iTerm",
          mode: options.mode || "normal",
          prompt: options.prompt,
          windowMode,
        }),
      });

      const data = await res.json();

      if (data.success) {
        // Refresh sessions list
        await get().fetchSessions();
        set({ isLoading: false });
        return { success: true, sessionId: data.session.id };
      } else {
        set({ error: data.error, isLoading: false });
        return { success: false, error: data.error };
      }
    } catch (err) {
      const errorMsg = "Failed to launch session";
      set({ error: errorMsg, isLoading: false });
      return { success: false, error: errorMsg };
    }
  },

  // Update session status - optimized to avoid redundant fetches
  updateStatus: async (id, status, options) => {
    try {
      const res = await fetch(`${API_BASE}/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...options }),
      });

      const data = await res.json();

      if (data.success && data.session) {
        // Optimistic update - update local state directly instead of re-fetching
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, ...data.session } : s
          ),
          selectedSession:
            state.selectedSessionId === id
              ? { ...state.selectedSession, ...data.session }
              : state.selectedSession,
        }));
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  },

  // Resume session
  resumeSession: async (id, additionalPrompt, windowMode) => {
    set({ isLoading: true, error: null });

    // Use provided windowMode or fall back to store preference
    const effectiveWindowMode = windowMode || get().windowMode;

    try {
      const res = await fetch(`${API_BASE}/${id}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ additionalPrompt, windowMode: effectiveWindowMode }),
      });

      const data = await res.json();

      if (data.success) {
        await get().fetchSessions();
        set({ isLoading: false });
        return { success: true, newSessionId: data.session?.id };
      } else {
        set({ error: data.error, isLoading: false });
        return { success: false, error: data.error };
      }
    } catch (err) {
      const errorMsg = "Failed to resume session";
      set({ error: errorMsg, isLoading: false });
      return { success: false, error: errorMsg };
    }
  },

  // Delete session
  deleteSession: async (id) => {
    try {
      await fetch(`${API_BASE}/${id}`, { method: "DELETE" });

      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== id),
        selectedSessionId:
          state.selectedSessionId === id ? null : state.selectedSessionId,
        selectedSession:
          state.selectedSessionId === id ? null : state.selectedSession,
      }));
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  },

  // Sync single session status with actual terminal state
  syncSession: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/${id}/sync`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.success && data.sync?.statusChanged) {
        // Refresh sessions to get updated status
        await get().fetchSessions();
        return { changed: true };
      }
      return { changed: false };
    } catch (err) {
      console.error("Failed to sync session:", err);
      return { changed: false };
    }
  },

  // Sync all active sessions
  syncAllSessions: async (workspacePath) => {
    try {
      const res = await fetch(`${API_BASE}/sync-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspacePath }),
      });
      const data = await res.json();

      if (data.success && data.changed > 0) {
        // Refresh sessions to get updated statuses
        await get().fetchSessions();
      }

      return { checked: data.checked || 0, changed: data.changed || 0 };
    } catch (err) {
      console.error("Failed to sync sessions:", err);
      return { checked: 0, changed: 0 };
    }
  },

  // Select session - optimized to batch API calls
  selectSession: async (id) => {
    if (id) {
      // Set selection immediately for responsive UI
      set({ selectedSessionId: id });

      // Batch both fetches in parallel
      await Promise.all([
        get().fetchSession(id),
        get().fetchSessionEvents(id),
      ]);
    } else {
      set({
        selectedSessionId: null,
        selectedSession: null,
        sessionEvents: [],
      });
    }
  },

  // Set filters
  setFilters: (filters) => {
    const newFilters = { ...get().filters, ...filters };
    set({ filters: newFilters });
    get().fetchSessions(newFilters);
  },

  // Clear error
  clearError: () => set({ error: null }),
}));
