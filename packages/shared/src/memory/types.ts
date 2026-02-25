/**
 * Mem0 Memory Types
 *
 * Types for the mem0 REST API server integration.
 * mem0 provides semantic (vector) search over stored memories.
 */

export interface Mem0Config {
  baseUrl: string;        // default: http://localhost:4321
  apiKey?: string;        // optional auth header
}

export interface Mem0Memory {
  id: string;
  memory: string;
  metadata?: Record<string, unknown>;
  score?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Mem0AddRequest {
  messages: Array<{ role: string; content: string }>;
  user_id?: string;
  agent_id?: string;
  run_id?: string;
  metadata?: Record<string, unknown>;
}

export interface Mem0SearchRequest {
  query: string;
  user_id?: string;
  agent_id?: string;
  limit?: number;
  metadata_filter?: Record<string, unknown>;
}

export type MemorySourceType =
  | 'knowledge_doc'
  | 'task_completion'
  | 'manual'
  | 'incident'
  | 'lesson'
  | 'validation_failure';

// TTL configuration per source type (null = never expires)
export const MEMORY_TTL_MS: Record<MemorySourceType, number | null> = {
  task_completion: 90 * 24 * 60 * 60 * 1000,
  incident: 180 * 24 * 60 * 60 * 1000,
  validation_failure: 90 * 24 * 60 * 60 * 1000,
  lesson: null,
  knowledge_doc: null,
  manual: null,
};

/** Compute ISO expiry timestamp based on sourceType TTL. Returns undefined if no TTL. */
export function computeExpiresAt(sourceType?: string): string | undefined {
  if (!sourceType || !(sourceType in MEMORY_TTL_MS)) return undefined;
  const ttl = MEMORY_TTL_MS[sourceType as MemorySourceType];
  if (ttl === null) return undefined;
  return new Date(Date.now() + ttl).toISOString();
}

/** Check if a memory has expired based on its expiresAt metadata. */
export function isMemoryExpired(memory: Mem0Memory): boolean {
  const expiresAt = memory.metadata?.expiresAt as string | undefined;
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}
