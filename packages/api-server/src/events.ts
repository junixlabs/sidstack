/**
 * Server-Sent Events (SSE) system for real-time notifications.
 *
 * Module-level singleton EventEmitter that route handlers use to broadcast
 * events to connected SSE clients.
 */

import { EventEmitter } from 'events';
import { Router, Request, Response } from 'express';

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export type SseEventType =
  | 'task_created'
  | 'task_updated'
  | 'task_completed'
  | 'ticket_created'
  | 'ticket_updated'
  | 'knowledge_created'
  | 'knowledge_updated'
  | 'knowledge_deleted';

export interface SseEvent {
  type: SseEventType;
  projectId: string;
  entityId: string;
  title?: string;
  summary?: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Singleton emitter
// ---------------------------------------------------------------------------

const emitter = new EventEmitter();
emitter.setMaxListeners(50); // support many concurrent SSE clients

/**
 * Emit an event to all connected SSE clients.
 * Call this from route handlers after successful mutations.
 */
export function emitSseEvent(event: SseEvent): void {
  emitter.emit('sse', event);
}

// ---------------------------------------------------------------------------
// SSE Router
// ---------------------------------------------------------------------------

export const eventsRouter: Router = Router();

/**
 * GET /api/events/stream
 * Server-Sent Events endpoint. Clients connect and receive real-time events.
 *
 * Query params:
 * - projectId: Filter events to a specific project (optional)
 */
eventsRouter.get('/stream', (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

  // Keep-alive ping every 30s to prevent proxy/browser timeout
  const keepAlive = setInterval(() => {
    res.write(': ping\n\n');
  }, 30000);

  // Listen for events
  const handler = (event: SseEvent) => {
    // Filter by projectId if specified
    if (projectId && event.projectId !== projectId) return;

    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  emitter.on('sse', handler);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(keepAlive);
    emitter.off('sse', handler);
  });
});
