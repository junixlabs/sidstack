/**
 * Socket.IO Client for Web UI
 *
 * Singleton WebSocket connection to the API server.
 * Used by useSocketInvalidation hook (P2-3) to trigger TanStack Query cache invalidation.
 */
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/** All event types the server broadcasts */
export const SOCKET_EVENTS = [
  'task_created',
  'task_updated',
  'task_completed',
  'ticket_created',
  'ticket_updated',
  'knowledge_created',
  'knowledge_updated',
  'knowledge_deleted',
] as const;

export type SocketEventType = (typeof SOCKET_EVENTS)[number];

export interface SocketEventData {
  type: SocketEventType;
  projectId: string;
  entityId: string;
  title?: string;
  summary?: string;
  timestamp: number;
}

export interface ConnectOptions {
  url: string;
  projectId?: string;
  token?: string;
}

export function connectSocket(options: ConnectOptions): Socket {
  if (socket?.connected) return socket;
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(options.url, {
    transports: ['websocket', 'polling'],
    auth: options.token ? { token: options.token } : undefined,
    query: options.projectId ? { projectId: options.projectId } : undefined,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
  });

  socket.on('connect', () => {
    console.log('[Socket.IO] Connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket.IO] Disconnected:', reason);
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
