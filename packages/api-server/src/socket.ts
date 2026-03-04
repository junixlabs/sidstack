/**
 * Socket.IO server — real-time events via WebSocket.
 *
 * Provides:
 * - initSocketIO(httpServer, corsOptions) — create & attach Socket.IO
 * - getIO() — singleton accessor
 * - broadcastToProject(projectId, event, data) — emit to a project room
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let io: Server | null = null;

// ---------------------------------------------------------------------------
// CORS types (mirror what Socket.IO accepts)
// ---------------------------------------------------------------------------

interface CorsOptions {
  origin?: string | string[] | ((origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => void);
  credentials?: boolean;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export function initSocketIO(httpServer: HttpServer, corsOptions: CorsOptions): Server {
  if (io) return io;

  io = new Server(httpServer, {
    cors: corsOptions,
    // Only use websocket (skip long-polling for cleaner behavior)
    transports: ['websocket', 'polling'],
  });

  // -----------------------------------------------------------------------
  // Auth middleware — validate SIDSTACK_API_KEY on connection
  // -----------------------------------------------------------------------
  const apiKey = process.env.SIDSTACK_API_KEY;

  io.use((socket: Socket, next) => {
    // If no API key configured, allow all connections (local dev)
    if (!apiKey) return next();

    const token = socket.handshake.auth?.token as string | undefined;
    if (!token || token !== apiKey) {
      return next(new Error('Authentication failed — invalid or missing token'));
    }
    next();
  });

  // -----------------------------------------------------------------------
  // Connection handler
  // -----------------------------------------------------------------------

  io.on('connection', (socket: Socket) => {
    const projectId = socket.handshake.query.projectId as string | undefined;

    if (projectId) {
      const room = `project:${projectId}`;
      socket.join(room);
      console.log(`[Socket.IO] Client ${socket.id} connected → room ${room}`);
    } else {
      console.log(`[Socket.IO] Client ${socket.id} connected (no project room)`);
    }

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Client ${socket.id} disconnected (${reason})`);
    });
  });

  console.log('[Socket.IO] Server initialized');
  return io;
}

// ---------------------------------------------------------------------------
// Accessor
// ---------------------------------------------------------------------------

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.IO not initialized — call initSocketIO() first');
  }
  return io;
}

// ---------------------------------------------------------------------------
// Broadcast helper
// ---------------------------------------------------------------------------

export function broadcastToProject(projectId: string, event: string, data: unknown): void {
  if (!io) return; // silently skip if not initialized
  io.to(`project:${projectId}`).emit(event, data);
}
