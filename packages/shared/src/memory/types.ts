/**
 * SidMemo Memory Types
 *
 * Types for the SidMemo API server integration (mem.sidcorp.co).
 * SidMemo provides semantic (vector) search + Knowledge Graph over stored memories.
 */

// =============================================================================
// SidMemo Types
// =============================================================================

export interface SidMemoConfig {
  baseUrl: string;           // default: https://mem.sidcorp.co
  apiKey: string;            // X-API-Key header
  projectSlug?: string;      // default: sidstack
}

export interface SidMemoMemory {
  id: string;
  content: string;
  mem0_user_id?: string;
  mem0_agent_id?: string;
  metadata_?: Record<string, unknown>;
  categories?: string[];
  score?: number;
  created_at: string;
  updated_at: string;
}

export interface SidMemoSearchResult {
  id: string;
  content: string;
  score?: number;
  mem0_user_id?: string;
  metadata_?: Record<string, unknown>;
}

export interface SidMemoListResponse {
  items: SidMemoMemory[];
  total: number;
  page: number;
  page_size: number;
}

export interface SidMemoHistoryEntry {
  id: string;
  memory_id: string;
  old_content: string;
  new_content: string;
  event: string;
  created_at: string;
}

// =============================================================================
// Knowledge Graph Types
// =============================================================================

export interface EntityDetail {
  name: string;
  type?: string;
  properties: Record<string, unknown>;
  relations: Array<{ id: string; source: string; target: string; type: string }>;
}

export interface EntityListResponse {
  entities: Array<{ name: string; type?: string; properties: Record<string, unknown> }>;
  total: number;
  page: number;
  page_size: number;
}

export interface SubgraphResponse {
  entities: Array<{ name: string; type?: string; properties: Record<string, unknown> }>;
  relations: Array<{ id: string; source: string; target: string; type: string; properties: Record<string, unknown> }>;
}

// =============================================================================
// Legacy Compat (used by isMemoryExpired, partitionByExpiry)
// =============================================================================

/** @deprecated Use SidMemoMemory instead */
export interface Mem0Memory {
  id: string;
  memory: string;
  metadata?: Record<string, unknown>;
  score?: number;
  created_at?: string;
  updated_at?: string;
}

// =============================================================================
// Memory Lifecycle (TTL, source types)
// =============================================================================

export type MemorySourceType =
  | 'knowledge_doc'
  | 'knowledge_chunk'
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
  knowledge_chunk: null,
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
export function isMemoryExpired(memory: Mem0Memory | SidMemoMemory): boolean {
  // SidMemoMemory uses metadata_, Mem0Memory uses metadata
  const meta = (memory as SidMemoMemory).metadata_ || (memory as Mem0Memory).metadata;
  const expiresAt = meta?.expiresAt as string | undefined;
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}
