/**
 * Event Sync Hook
 *
 * Listens for SSE-driven notifications and triggers query invalidation.
 * Maps notification types to TanStack Query cache keys with debouncing
 * to avoid rapid-fire re-fetches from burst events.
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNotificationStore } from "@/stores/notificationStore";
import { useTicketStore } from "@/stores/ticketStore";

const DEBOUNCE_MS = 500;

/**
 * Mount at App root to enable event-driven state sync.
 * When SSE events arrive via notificationStore, this hook debounces
 * and triggers the relevant cache invalidation or store refresh.
 */
export function useEventSync(): void {
  const notifications = useNotificationStore((s) => s.notifications);
  const lastProcessedRef = useRef<string | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const queryClient = useQueryClient();

  useEffect(() => {
    if (notifications.length === 0) return;

    const latest = notifications[0];
    // Skip if we already processed this notification
    if (!latest || latest.id === lastProcessedRef.current) return;
    lastProcessedRef.current = latest.id;

    // Determine which cache to invalidate based on notification type
    let refreshKey: string | null = null;

    switch (latest.type) {
      case "task_update":
      case "task_created":
      case "task_completed":
        refreshKey = "tasks";
        break;
      case "ticket_created":
      case "ticket_updated":
        refreshKey = "tickets";
        break;
      case "knowledge_changed":
        refreshKey = "knowledge";
        break;
      default:
        return; // No cache to invalidate for this type
    }

    // Debounce: clear existing timer for this key, set a new one
    if (debounceTimers.current[refreshKey]) {
      clearTimeout(debounceTimers.current[refreshKey]);
    }

    debounceTimers.current[refreshKey] = setTimeout(() => {
      switch (refreshKey) {
        case "tasks":
          // Invalidate all task queries (list + details + progress)
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          break;
        case "tickets":
          // Tickets still use Zustand store
          useTicketStore.getState().fetchTickets?.();
          break;
        case "knowledge":
          // Invalidate all knowledge queries
          queryClient.invalidateQueries({ queryKey: ['knowledge'] });
          break;
      }
      delete debounceTimers.current[refreshKey!];
    }, DEBOUNCE_MS);

    // Cleanup timers on unmount
    return () => {
      for (const timer of Object.values(debounceTimers.current)) {
        clearTimeout(timer);
      }
    };
  }, [notifications, queryClient]);
}
