/**
 * Mem0 HTTP Client
 *
 * HTTP client for mem0 REST API server.
 * No npm dependency needed - uses native fetch().
 *
 * Usage:
 *   const client = new Mem0Client({ baseUrl: 'http://localhost:4321' });
 *   await client.add('some content', 'project-id');
 *   const results = await client.search('query', 'project-id');
 */

import type { Mem0Memory } from './types.js';
import { computeExpiresAt } from './types.js';

/** Unwrap nested results: { results: { results: [...] } } or { results: [...] } or [...] */
function extractResults(data: unknown): Mem0Memory[] {
  if (Array.isArray(data)) return data as Mem0Memory[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (obj.results) return extractResults(obj.results);
  }
  return [];
}

export class Mem0Client {
  private baseUrl: string;
  private headers: Record<string, string>;
  private available: boolean | null = null;
  private availableCheckedAt = 0;

  constructor(config?: { baseUrl?: string; apiKey?: string }) {
    this.baseUrl = (
      config?.baseUrl
      || process.env.MEM0_API_URL
      || 'http://localhost:4321'
    ).replace(/\/+$/, ''); // strip trailing slashes

    this.headers = { 'Content-Type': 'application/json' };
    if (config?.apiKey || process.env.MEM0_API_KEY) {
      this.headers['Authorization'] = `Bearer ${config?.apiKey || process.env.MEM0_API_KEY}`;
    }
  }

  /** Check if mem0 server is reachable. Caches true permanently, retries false after 60s. */
  async isAvailable(): Promise<boolean> {
    if (this.available === true) return true;
    if (this.available === false && Date.now() - this.availableCheckedAt < 60_000) return false;
    try {
      const res = await fetch(`${this.baseUrl}/`, {
        method: 'GET',
        headers: this.headers,
        signal: AbortSignal.timeout(3000),
      });
      this.available = res.ok;
    } catch {
      this.available = false;
    }
    this.availableCheckedAt = Date.now();
    return this.available;
  }

  /** Reset availability cache (e.g. after server restart) */
  resetAvailability(): void {
    this.available = null;
  }

  /** Add a memory. user_id is used for project isolation (projectId). */
  async add(
    content: string,
    userId: string,
    metadata?: Record<string, unknown>,
  ): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/v1/memories/`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        messages: [{ role: 'user', content }],
        user_id: userId,
        metadata,
      }),
    });
    return res.json();
  }

  /** Semantic search across memories for a given project (userId). */
  async search(
    query: string,
    userId: string,
    limit = 10,
    filters?: Record<string, unknown>,
  ): Promise<Mem0Memory[]> {
    const body: Record<string, unknown> = { query, user_id: userId, limit };
    if (filters) {
      body.metadata_filter = filters;
    }
    const res = await fetch(`${this.baseUrl}/v1/memories/search/`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as Record<string, unknown>;
    return extractResults(data);
  }

  /** List all memories, optionally filtered by userId (projectId). */
  async list(userId?: string): Promise<Mem0Memory[]> {
    const params = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
    const res = await fetch(`${this.baseUrl}/v1/memories/${params}`, {
      headers: this.headers,
    });
    const data = (await res.json()) as Record<string, unknown>;
    return extractResults(data);
  }

  /** Delete a memory by ID. Requires userId for ownership verification. */
  async delete(memoryId: string, userId?: string): Promise<boolean> {
    const params = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
    const res = await fetch(`${this.baseUrl}/v1/memories/${memoryId}/${params}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    return res.ok;
  }

  /** Get edit history for a memory. Requires userId for ownership verification. */
  async history(memoryId: string, userId?: string): Promise<unknown[]> {
    const params = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
    const res = await fetch(
      `${this.baseUrl}/v1/memories/${memoryId}/history/${params}`,
      { headers: this.headers },
    );
    return (await res.json()) as unknown[];
  }

  /** Update a memory's content by ID. Requires userId for ownership verification. */
  async update(memoryId: string, content: string, userId?: string): Promise<unknown> {
    const params = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
    const res = await fetch(`${this.baseUrl}/v1/memories/${memoryId}/${params}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify({ text: content }),
    });
    return res.json();
  }

  /**
   * Smart add: conflict detection + TTL stamping.
   * Searches for semantically similar memories with the same sourceType.
   * If found above threshold, replaces them. Stamps expiresAt from TTL config.
   */
  async addSmart(
    content: string,
    userId: string,
    metadata?: Record<string, unknown>,
    options?: { conflictThreshold?: number },
  ): Promise<{ result: unknown; replaced: string[] }> {
    const threshold = options?.conflictThreshold ?? 0.85;
    const sourceType = metadata?.sourceType as string | undefined;
    const replaced: string[] = [];

    // Search for conflicting memories
    if (sourceType) {
      try {
        const similar = await this.search(content, userId, 5);
        for (const mem of similar) {
          if (
            mem.score !== undefined
            && mem.score >= threshold
            && mem.metadata?.sourceType === sourceType
          ) {
            await this.delete(mem.id, userId);
            replaced.push(mem.id);
          }
        }
      } catch {
        // Non-blocking: proceed with add even if conflict check fails
      }
    }

    // Enrich metadata with TTL expiry
    const enrichedMetadata = { ...metadata };
    const expiresAt = computeExpiresAt(sourceType);
    if (expiresAt) {
      enrichedMetadata.expiresAt = expiresAt;
    }

    const result = await this.add(content, userId, enrichedMetadata);
    return { result, replaced };
  }
}

/** Convenience factory */
export function createMem0Client(config?: {
  baseUrl?: string;
  apiKey?: string;
}): Mem0Client {
  return new Mem0Client(config);
}
