import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket, SOCKET_EVENTS, type SocketEventData } from '@/lib/socket';
import { queryKeys } from '@/lib/query-keys';

/**
 * Maps Socket.IO event prefixes to the query key families they should invalidate.
 */
function getInvalidationKeys(event: SocketEventData) {
  const { type, projectId, entityId } = event;
  const keys: (readonly unknown[])[] = [];

  if (type.startsWith('task_')) {
    keys.push(queryKeys.tasks.all(projectId));
    if (entityId) keys.push(queryKeys.tasks.detail(projectId, entityId));
    // Tasks affect dashboard and activity too
    keys.push(queryKeys.dashboard.all(projectId));
    keys.push(queryKeys.activity.all(projectId));
  } else if (type.startsWith('ticket_')) {
    keys.push(queryKeys.tickets.all(projectId));
    if (entityId) keys.push(queryKeys.tickets.detail(projectId, entityId));
    keys.push(queryKeys.dashboard.all(projectId));
  } else if (type.startsWith('knowledge_')) {
    keys.push(queryKeys.knowledge.all(projectId));
    if (entityId) keys.push(queryKeys.knowledge.detail(projectId, entityId));
    keys.push(queryKeys.dashboard.all(projectId));
  }

  return keys;
}

/**
 * Bridges Socket.IO server events to TanStack Query cache invalidation.
 * Debounces rapid invalidations within a 100ms window.
 * Mount once at app root (Layout).
 */
export function useSocketInvalidation(projectId: string | null) {
  const queryClient = useQueryClient();
  const pendingKeys = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const socket = getSocket();
    if (!socket) return;

    function flush() {
      const keys = Array.from(pendingKeys.current);
      pendingKeys.current.clear();
      timerRef.current = null;

      for (const serialized of keys) {
        const key = JSON.parse(serialized) as readonly unknown[];
        queryClient.invalidateQueries({ queryKey: key });
      }
    }

    function handleEvent(data: SocketEventData) {
      if (data.projectId !== projectId) return;

      const keys = getInvalidationKeys(data);
      for (const key of keys) {
        pendingKeys.current.add(JSON.stringify(key));
      }

      if (!timerRef.current) {
        timerRef.current = setTimeout(flush, 100);
      }
    }

    // Listen to all known events
    for (const event of SOCKET_EVENTS) {
      socket.on(event, handleEvent);
    }

    return () => {
      for (const event of SOCKET_EVENTS) {
        socket.off(event, handleEvent);
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingKeys.current.clear();
    };
  }, [projectId, queryClient]);
}
