/**
 * Notification Store
 *
 * Manages notifications for pending reviews, task updates, and agent messages.
 * Connects to API server via SSE for real-time events, with polling fallback.
 */

import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

import { mcpCall } from "@/lib/ipcClient";
import { getApiBaseUrl } from "@/lib/api-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType =
  | "spec_pending"
  | "spec_approved"
  | "spec_rejected"
  | "task_update"
  | "task_created"
  | "task_completed"
  | "ticket_created"
  | "ticket_updated"
  | "knowledge_changed"
  | "agent_message";

export interface Notification {
  id: string;
  type: NotificationType;
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

/** SSE event shape from the API server */
interface SseEventData {
  type: string;
  projectId: string;
  entityId: string;
  title?: string;
  summary?: string;
  timestamp: number;
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

  // SSE state
  sseConnected: boolean;

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

  // SSE
  connectSse: (projectId?: string) => void;
  disconnectSse: () => void;
}

// ---------------------------------------------------------------------------
// Module-level state (not in Zustand to avoid serialization issues)
// ---------------------------------------------------------------------------

let pollInterval: ReturnType<typeof setInterval> | null = null;
let eventSource: EventSource | null = null;
let sseReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let sseReconnectAttempts = 0;
const SSE_MAX_RECONNECT_ATTEMPTS = 10;
const SSE_RECONNECT_BASE_MS = 2000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map SSE event type to notification type */
function mapEventType(sseType: string): NotificationType {
  switch (sseType) {
    case "task_created":
      return "task_created";
    case "task_updated":
      return "task_update";
    case "task_completed":
      return "task_completed";
    case "ticket_created":
    case "ticket_updated":
      return "ticket_updated";
    case "knowledge_created":
    case "knowledge_updated":
    case "knowledge_deleted":
      return "knowledge_changed";
    default:
      return "task_update";
  }
}

/** Build human-readable notification from SSE event */
function buildNotification(data: SseEventData): Omit<Notification, "id" | "timestamp" | "read"> {
  const type = mapEventType(data.type);
  const title = data.title || "Update";
  const message = data.summary || `${data.type.replace(/_/g, " ")}`;

  return { type, title, message, data: { entityId: data.entityId, projectId: data.projectId } };
}

/** Show desktop notification via Tauri for important events */
async function showDesktopNotification(title: string, body: string): Promise<void> {
  try {
    await invoke("show_notification", { title, body });
  } catch {
    // Non-blocking: desktop notification failure is not critical
  }
}

// Events that trigger desktop (OS-level) notifications
const DESKTOP_NOTIFY_EVENTS = new Set([
  "task_created",
  "task_completed",
  "ticket_created",
]);

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

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
  sseConnected: false,

  // Add notification
  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      read: false,
    };

    set((state) => ({
      notifications: [newNotification, ...state.notifications].slice(0, 100),
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
      const results = await Promise.allSettled([
        mcpCall<{ specs: unknown[]; count?: number }>("spec_list", { status: "draft", limit: 1 }),
        mcpCall<{ specs: unknown[]; count?: number }>("spec_list", { status: "pending_review", limit: 1 }),
        mcpCall<{ specs: unknown[]; count?: number }>("spec_list", { status: "approved", limit: 1 }),
        mcpCall<{ specs: unknown[]; count?: number }>("spec_list", { status: "rejected", limit: 1 }),
      ]);

      const getCounts = (r: PromiseSettledResult<{ specs: unknown[]; count?: number }>) => {
        if (r.status === "fulfilled") {
          return r.value.count ?? r.value.specs?.length ?? 0;
        }
        return 0;
      };

      const prevPendingCount = get().pendingSpecCount;

      const summary: SpecSummary = {
        total: results.reduce((sum, r) => sum + getCounts(r), 0),
        draft: getCounts(results[0]),
        pending_review: getCounts(results[1]),
        approved: getCounts(results[2]),
        rejected: getCounts(results[3]),
      };

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

  // Start polling for updates (fallback when SSE is unavailable)
  startPolling: (intervalMs = 30000) => {
    if (get().isPolling) return;

    set({ isPolling: true });
    get().fetchSpecSummary();

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

  // -------------------------------------------------------------------------
  // SSE — real-time event stream from API server
  // -------------------------------------------------------------------------

  connectSse: (projectId?: string) => {
    // Avoid duplicate connections
    if (eventSource) {
      get().disconnectSse();
    }

    const baseUrl = getApiBaseUrl();
    const url = projectId
      ? `${baseUrl}/api/events/stream?projectId=${encodeURIComponent(projectId)}`
      : `${baseUrl}/api/events/stream`;

    try {
      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        sseReconnectAttempts = 0;
        set({ sseConnected: true });
      };

      // Listen for typed events
      const eventTypes = [
        "task_created",
        "task_updated",
        "task_completed",
        "ticket_created",
        "ticket_updated",
        "knowledge_created",
        "knowledge_updated",
        "knowledge_deleted",
      ];

      for (const eventType of eventTypes) {
        eventSource.addEventListener(eventType, (event: MessageEvent) => {
          try {
            const data: SseEventData = JSON.parse(event.data);
            const notification = buildNotification(data);
            get().addNotification(notification);

            // Desktop notification for important events
            if (DESKTOP_NOTIFY_EVENTS.has(data.type)) {
              showDesktopNotification(notification.title, notification.message);
            }
          } catch {
            // Ignore malformed events
          }
        });
      }

      eventSource.onerror = () => {
        set({ sseConnected: false });

        // Close the failed connection
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }

        // Reconnect with exponential backoff
        if (sseReconnectAttempts < SSE_MAX_RECONNECT_ATTEMPTS) {
          const delay = SSE_RECONNECT_BASE_MS * Math.pow(1.5, sseReconnectAttempts);
          sseReconnectAttempts++;

          sseReconnectTimer = setTimeout(() => {
            get().connectSse(projectId);
          }, delay);
        }
      };
    } catch {
      set({ sseConnected: false });
    }
  },

  disconnectSse: () => {
    if (sseReconnectTimer) {
      clearTimeout(sseReconnectTimer);
      sseReconnectTimer = null;
    }
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    sseReconnectAttempts = 0;
    set({ sseConnected: false });
  },
}));

// Selector for pending spec count (for sidebar badge)
export const selectPendingSpecCount = (state: NotificationState) => state.pendingSpecCount;

// Selector for unread notification count
export const selectUnreadCount = (state: NotificationState) => state.unreadCount;

// Selector for SSE connection status
export const selectSseConnected = (state: NotificationState) => state.sseConnected;

export default useNotificationStore;
