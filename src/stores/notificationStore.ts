/**
 * Notification Store
 *
 * Manages notifications for pending reviews, task updates, and agent messages.
 * Polls MCP server for spec status and emits notifications.
 */

import { create } from "zustand";

import { mcpCall } from "@/lib/ipcClient";

export interface Notification {
  id: string;
  type: "spec_pending" | "spec_approved" | "spec_rejected" | "task_update" | "agent_message";
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  data?: Record<string, unknown>;
}

export interface SpecSummary {
  total: number;
  draft: number;
  pending_review: number;
  approved: number;
  rejected: number;
}

interface NotificationState {
  // Notifications
  notifications: Notification[];
  unreadCount: number;

  // Spec counts for badges
  specSummary: SpecSummary;
  pendingSpecCount: number;

  // Polling state
  isPolling: boolean;
  lastPollTime: number | null;
  pollError: string | null;

  // Actions
  addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  removeNotification: (id: string) => void;

  // Polling
  startPolling: (intervalMs?: number) => void;
  stopPolling: () => void;
  fetchSpecSummary: () => Promise<void>;
}


let pollInterval: ReturnType<typeof setInterval> | null = null;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  // Initial state
  notifications: [],
  unreadCount: 0,
  specSummary: {
    total: 0,
    draft: 0,
    pending_review: 0,
    approved: 0,
    rejected: 0,
  },
  pendingSpecCount: 0,
  isPolling: false,
  lastPollTime: null,
  pollError: null,

  // Add notification
  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      read: false,
    };

    set((state) => ({
      notifications: [newNotification, ...state.notifications].slice(0, 100), // Keep last 100
      unreadCount: state.unreadCount + 1,
    }));
  },

  // Mark single notification as read
  markAsRead: (id) => {
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      if (!notification || notification.read) return state;

      return {
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    });
  },

  // Mark all as read
  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  // Clear all notifications
  clearNotifications: () => {
    set({ notifications: [], unreadCount: 0 });
  },

  // Remove single notification
  removeNotification: (id) => {
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      const wasUnread = notification && !notification.read;

      return {
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
      };
    });
  },

  // Fetch spec summary from MCP
  fetchSpecSummary: async () => {
    try {
      // Try to fetch specs by status
      const results = await Promise.allSettled([
        mcpCall<{ specs: unknown[]; count?: number }>("spec_list", { status: "draft", limit: 1 }),
        mcpCall<{ specs: unknown[]; count?: number }>("spec_list", { status: "pending_review", limit: 1 }),
        mcpCall<{ specs: unknown[]; count?: number }>("spec_list", { status: "approved", limit: 1 }),
        mcpCall<{ specs: unknown[]; count?: number }>("spec_list", { status: "rejected", limit: 1 }),
      ]);

      // Parse results from MCP
      const getCounts = (r: PromiseSettledResult<{ specs: unknown[]; count?: number }>) => {
        if (r.status === "fulfilled") {
          return r.value.count ?? r.value.specs?.length ?? 0;
        }
        return 0;
      };

      const prevPendingCount = get().pendingSpecCount;

      // Use real data only - no mock fallback
      const summary: SpecSummary = {
        total: results.reduce((sum, r) => sum + getCounts(r), 0),
        draft: getCounts(results[0]),
        pending_review: getCounts(results[1]),
        approved: getCounts(results[2]),
        rejected: getCounts(results[3]),
      };

      // Check if pending count increased
      if (summary.pending_review > prevPendingCount && prevPendingCount > 0) {
        get().addNotification({
          type: "spec_pending",
          title: "New Spec for Review",
          message: `${summary.pending_review} spec(s) awaiting your review`,
        });
      }

      set({
        specSummary: summary,
        pendingSpecCount: summary.pending_review,
        lastPollTime: Date.now(),
        pollError: null,
      });
    } catch (error) {
      set({
        pollError: error instanceof Error ? error.message : "Failed to fetch specs",
        lastPollTime: Date.now(),
      });
    }
  },

  // Start polling for updates
  startPolling: (intervalMs = 30000) => {
    if (get().isPolling) return;

    set({ isPolling: true });

    // Initial fetch
    get().fetchSpecSummary();

    // Set up interval
    pollInterval = setInterval(() => {
      get().fetchSpecSummary();
    }, intervalMs);
  },

  // Stop polling
  stopPolling: () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    set({ isPolling: false });
  },
}));

// Selector for pending spec count (for sidebar badge)
export const selectPendingSpecCount = (state: NotificationState) => state.pendingSpecCount;

// Selector for unread notification count
export const selectUnreadCount = (state: NotificationState) => state.unreadCount;

export default useNotificationStore;
