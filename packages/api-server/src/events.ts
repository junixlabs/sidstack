/**
 * Real-time event broadcasting via Socket.IO.
 */

import { broadcastToProject } from './socket.js';

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

/**
 * Broadcast an event to all connected Socket.IO clients for the project.
 * Call this from route handlers after successful mutations.
 */
export function emitSseEvent(event: SseEvent): void {
  broadcastToProject(event.projectId, event.type, event);
}
