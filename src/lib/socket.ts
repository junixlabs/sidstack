/**
 * Socket.IO client singleton for Tauri desktop app.
 *
 * Connects to the API server's Socket.IO endpoint, auto-joins the
 * project room, and handles reconnection with exponential backoff.
 */

import { io, Socket } from "socket.io-client";

import { getApiBaseUrl, getConnectionConfig } from "@/lib/api-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectionState = "connected" | "disconnected" | "reconnecting";

export interface ConnectOptions {
  projectId?: string;
  token?: string;
  onStateChange?: (state: ConnectionState) => void;
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let socket: Socket | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create (or return existing) Socket.IO connection.
 * Auto-joins the project room via query param and authenticates via token.
 */
export function connectSocket(options: ConnectOptions = {}): Socket {
  if (socket?.connected) return socket;

  // Clean up any stale socket
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  const baseUrl = getApiBaseUrl();
  const { apiKey } = getConnectionConfig();
  const token = options.token || apiKey;

  socket = io(baseUrl, {
    transports: ["websocket", "polling"],
    query: options.projectId ? { projectId: options.projectId } : undefined,
    auth: token ? { token } : undefined,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
  });

  // Connection state callbacks
  if (options.onStateChange) {
    const cb = options.onStateChange;

    socket.on("connect", () => cb("connected"));
    socket.on("disconnect", () => cb("disconnected"));
    socket.io.on("reconnect_attempt", () => cb("reconnecting"));
  }

  return socket;
}

/** Get the current socket instance (null if not connected). */
export function getSocket(): Socket | null {
  return socket;
}

/** Disconnect and clean up the socket. */
export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
