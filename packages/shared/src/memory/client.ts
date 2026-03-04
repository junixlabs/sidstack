/**
 * SidMemo HTTP Client
 *
 * HTTP client for SidMemo API (mem.sidcorp.co).
 * Replaces Docker mem0 — uses managed vector store + Knowledge Graph.
 *
 * Usage:
 *   const client = new SidMemoClient({ apiKey: 'your-key' });
 *   await client.add('some content', 'project-id');
 *   const results = await client.search('query', 'project-id');
 */

import type {
  SidMemoMemory,
  SidMemoSearchResult,
  SidMemoListResponse,
  SidMemoHistoryEntry,
  EntityDetail,
  EntityListResponse,
  SubgraphResponse,
} from './types.js';
import { computeExpiresAt } from './types.js';

export class SidMemoClient {
  private baseUrl: string;
  private projectSlug: string;
  private headers: Record<string, string>;
  private available: boolean | null = null;
  private availableCheckedAt = 0;

  constructor(config?: { baseUrl?: string; apiKey?: string; projectSlug?: string }) {
    this.baseUrl = (
      config?.baseUrl
      || process.env.SIDMEMO_API_URL
      || 'https://mem.sidcorp.co'
    ).replace(/\/+$/, '');

    this.projectSlug = config?.projectSlug
      || process.env.SIDMEMO_PROJECT_SLUG
      || 'sidstack';

    const apiKey = config?.apiKey || process.env.SIDMEMO_API_KEY || '';

    this.headers = {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-API-Key': apiKey } : {}),
    };
  }

  /** Project-scoped API path prefix */
  private get prefix(): string {
    return `${this.baseUrl}/api/v1/projects/${this.projectSlug}`;
  }

  // ===========================================================================
  // Health
  // ===========================================================================

  /** Check if SidMemo API is reachable. Caches true permanently, retries false after 60s. */
  async isAvailable(): Promise<boolean> {
    if (this.available === true) return true;
    if (this.available === false && Date.now() - this.availableCheckedAt < 60_000) return false;
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
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

  // ===========================================================================
  // Memories CRUD
  // ===========================================================================

  /** Add a memory. user_id is used for project isolation. */
  async add(
    content: string,
    userId: string,
    metadata?: Record<string, unknown>,
  ): Promise<SidMemoMemory> {
    const res = await fetch(`${this.prefix}/memories`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        messages: [{ role: 'user', content }],
        user_id: userId,
        metadata: metadata || {},
      }),
    });
    if (!res.ok) throw new Error(`SidMemo add failed: ${res.status} ${await res.text()}`);
    return res.json() as Promise<SidMemoMemory>;
  }

  /** Semantic search across memories for a given user. */
  async search(
    query: string,
    userId: string,
    limit = 10,
    filters?: Record<string, unknown>,
  ): Promise<SidMemoSearchResult[]> {
    const body: Record<string, unknown> = { query, user_id: userId, limit };
    if (filters) {
      body.filters = filters;
    }
    const res = await fetch(`${this.prefix}/memories/search`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`SidMemo search failed: ${res.status}`);
    const data = await res.json() as Record<string, unknown>;
    // Handle { results: [...] } or direct array
    if (Array.isArray(data)) return data;
    return (data.results || data.items || []) as SidMemoSearchResult[];
  }

  /** List all memories, optionally filtered by userId. */
  async list(userId?: string, page?: number, pageSize?: number): Promise<SidMemoListResponse> {
    const params = new URLSearchParams();
    if (userId) params.set('user_id', userId);
    if (page) params.set('page', String(page));
    if (pageSize) params.set('page_size', String(pageSize));

    const qs = params.toString();
    const res = await fetch(`${this.prefix}/memories${qs ? `?${qs}` : ''}`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`SidMemo list failed: ${res.status}`);
    const data = await res.json() as any;
    // Normalize response
    if (Array.isArray(data)) {
      return { items: data, total: data.length, page: 1, page_size: data.length };
    }
    const items = data.items || data.results || [];
    return {
      items,
      total: data.total ?? items.length,
      page: data.page ?? 1,
      page_size: data.page_size ?? items.length,
    };
  }

  /** Get a single memory by ID. */
  async get(memoryId: string): Promise<SidMemoMemory> {
    const res = await fetch(`${this.prefix}/memories/${memoryId}`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`SidMemo get failed: ${res.status}`);
    return res.json() as Promise<SidMemoMemory>;
  }

  /** Update a memory's content by ID. */
  async update(memoryId: string, content: string): Promise<SidMemoMemory> {
    const res = await fetch(`${this.prefix}/memories/${memoryId}`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error(`SidMemo update failed: ${res.status}`);
    return res.json() as Promise<SidMemoMemory>;
  }

  /** Delete a memory by ID. */
  async delete(memoryId: string): Promise<void> {
    const res = await fetch(`${this.prefix}/memories/${memoryId}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`SidMemo delete failed: ${res.status}`);
  }

  /** Bulk delete memories by IDs or userId. */
  async bulkDelete(ids?: string[], userId?: string): Promise<{ deleted: number }> {
    const body: Record<string, unknown> = {};
    if (ids) body.ids = ids;
    if (userId) body.user_id = userId;

    const res = await fetch(`${this.prefix}/memories/bulk-delete`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`SidMemo bulk-delete failed: ${res.status}`);
    return res.json() as Promise<{ deleted: number }>;
  }

  /** Get edit history for a memory. */
  async history(memoryId: string): Promise<SidMemoHistoryEntry[]> {
    const res = await fetch(`${this.prefix}/memories/${memoryId}/history`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`SidMemo history failed: ${res.status}`);
    return res.json() as Promise<SidMemoHistoryEntry[]>;
  }

  // ===========================================================================
  // Smart add (conflict detection + TTL)
  // ===========================================================================

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
  ): Promise<{ result: SidMemoMemory; replaced: string[] }> {
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
            && mem.metadata_?.sourceType === sourceType
          ) {
            await this.delete(mem.id);
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

  // ===========================================================================
  // Knowledge Graph
  // ===========================================================================

  /** Get entity details including relations. */
  async getEntity(entityName: string): Promise<EntityDetail> {
    const res = await fetch(
      `${this.prefix}/graph/entities/${encodeURIComponent(entityName)}`,
      { headers: this.headers },
    );
    if (!res.ok) throw new Error(`SidMemo getEntity failed: ${res.status}`);
    return res.json() as Promise<EntityDetail>;
  }

  /** List/search graph entities. */
  async listEntities(search?: string, page?: number): Promise<EntityListResponse> {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (page) params.set('page', String(page));

    const qs = params.toString();
    const res = await fetch(`${this.prefix}/graph/entities${qs ? `?${qs}` : ''}`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`SidMemo listEntities failed: ${res.status}`);
    return res.json() as Promise<EntityListResponse>;
  }

  /** Get subgraph for entities (N-hop traversal). */
  async getSubgraph(entities: string[], hops = 2): Promise<SubgraphResponse> {
    const params = new URLSearchParams();
    params.set('entities', entities.join(','));
    params.set('hops', String(hops));

    const res = await fetch(`${this.prefix}/graph/subgraph?${params.toString()}`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`SidMemo getSubgraph failed: ${res.status}`);
    return res.json() as Promise<SubgraphResponse>;
  }
}

/** Convenience factory */
export function createSidMemoClient(config?: {
  baseUrl?: string;
  apiKey?: string;
  projectSlug?: string;
}): SidMemoClient {
  return new SidMemoClient(config);
}

/** @deprecated Use createSidMemoClient instead */
export const createMem0Client = createSidMemoClient;

/** @deprecated Use SidMemoClient instead */
export { SidMemoClient as Mem0Client };
