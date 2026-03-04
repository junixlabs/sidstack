/**
 * Memory MCP Tool Handlers
 *
 * Semantic memory tools powered by SidMemo API (mem.sidcorp.co).
 * All tools gracefully degrade when SidMemo is unavailable.
 *
 * Tools:
 * - memory_add: Store a memory (with conflict detection + TTL)
 * - memory_search: Semantic search (filters expired)
 * - memory_list: List all memories (filters expired)
 * - memory_delete: Delete a memory
 * - memory_index_knowledge: Bulk-index knowledge docs
 * - memory_cleanup: Batch sweep expired memories
 */

import {
  createSidMemoClient,
  createApiClient,
  detectWorkspace,
  isMemoryExpired,
  KnowledgeIndexer,
  type SidMemoClient,
  type SidMemoMemory,
  type Mem0Memory,
} from '@sidstack/shared';
import { validateProjectPath } from './validate-path.js';

// =============================================================================
// Singleton client (reused across tool calls)
// =============================================================================

let _client: SidMemoClient | null = null;

function getClient(): SidMemoClient {
  if (!_client) {
    _client = createSidMemoClient();
  }
  return _client;
}

function resolveWorkspacePath(projectPath: string): string {
  const workspace = detectWorkspace(projectPath);
  return workspace ? workspace.workspaceRoot : projectPath;
}

/** Partition memories into active and expired (works with both types). */
function partitionByExpiry(memories: Array<SidMemoMemory | Mem0Memory>): {
  active: Array<SidMemoMemory | Mem0Memory>;
  expired: Array<SidMemoMemory | Mem0Memory>;
} {
  const active: Array<SidMemoMemory | Mem0Memory> = [];
  const expired: Array<SidMemoMemory | Mem0Memory> = [];
  for (const mem of memories) {
    if (isMemoryExpired(mem as Mem0Memory)) {
      expired.push(mem);
    } else {
      active.push(mem);
    }
  }
  return { active, expired };
}

/** Background-delete expired memories (fire-and-forget). */
function backgroundDeleteExpired(client: SidMemoClient, expired: Array<SidMemoMemory | Mem0Memory>): void {
  const ids = expired.map(m => m.id);
  if (ids.length > 0) {
    client.bulkDelete(ids).catch(() => {});
  }
}

// =============================================================================
// Tool Definitions
// =============================================================================

export const memoryTools = [
  {
    name: 'memory_add',
    description: 'Store a memory in the semantic memory system. Memories are searchable by meaning, not just keywords. Use user_id for project isolation.',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The memory content to store',
        },
        projectId: {
          type: 'string',
          description: 'Project ID for memory isolation (used as user_id)',
        },
        metadata: {
          type: 'object',
          description: 'Optional metadata (e.g., sourceType, docId, taskId)',
        },
        conflictThreshold: {
          type: 'number',
          description: 'Similarity score threshold for conflict detection (0-1, default: 0.85). Memories with same sourceType and score >= threshold are replaced.',
        },
      },
      required: ['content', 'projectId'],
    },
  },
  {
    name: 'memory_search',
    description: 'Semantic search across memories. Finds results by meaning, not just keyword matching. For example, searching "authentication flow" will find memories about "login process".',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (semantic, not keyword-based)',
        },
        projectId: {
          type: 'string',
          description: 'Project ID to search within',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default: 10)',
          default: 10,
        },
      },
      required: ['query', 'projectId'],
    },
  },
  {
    name: 'memory_list',
    description: 'List all memories, optionally filtered by project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID to filter by (optional)',
        },
      },
    },
  },
  {
    name: 'memory_delete',
    description: 'Delete a specific memory by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        memoryId: {
          type: 'string',
          description: 'The memory ID to delete',
        },
        projectId: {
          type: 'string',
          description: 'Project ID for ownership verification',
        },
      },
      required: ['memoryId'],
    },
  },
  {
    name: 'memory_index_knowledge',
    description: 'Bulk-index all knowledge documents into semantic memory with chunking. Use this to bootstrap semantic search for an existing knowledge base.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the project directory',
        },
        projectId: {
          type: 'string',
          description: 'Project ID for memory isolation',
        },
      },
      required: ['projectPath', 'projectId'],
    },
  },
  {
    name: 'memory_cleanup',
    description: 'Batch sweep expired memories. Removes memories past their TTL. Use dryRun to preview what would be deleted.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID to clean up (optional, cleans all if omitted)',
        },
        dryRun: {
          type: 'boolean',
          description: 'If true, reports what would be deleted without actually deleting (default: false)',
        },
      },
    },
  },
];

// =============================================================================
// Tool Handlers
// =============================================================================

export async function handleMemoryAdd(args: {
  content: string;
  projectId: string;
  metadata?: Record<string, unknown>;
  conflictThreshold?: number;
}): Promise<Record<string, unknown>> {
  const client = getClient();

  if (!(await client.isAvailable())) {
    return {
      success: false,
      error: 'SidMemo API is not available. Check SIDMEMO_API_KEY environment variable.',
    };
  }

  try {
    const { result, replaced } = await client.addSmart(
      args.content,
      args.projectId,
      args.metadata,
      args.conflictThreshold !== undefined
        ? { conflictThreshold: args.conflictThreshold }
        : undefined,
    );
    return {
      success: true,
      result,
      ...(replaced.length > 0 ? { conflictsResolved: replaced.length, replaced } : {}),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add memory',
    };
  }
}

export async function handleMemorySearch(args: {
  query: string;
  projectId: string;
  limit?: number;
}): Promise<Record<string, unknown>> {
  const client = getClient();

  if (!(await client.isAvailable())) {
    return {
      success: false,
      error: 'SidMemo API is not available.',
      memories: [],
    };
  }

  try {
    const rawMemories = await client.search(args.query, args.projectId, args.limit || 10);
    // Map to Mem0Memory shape for partitioning
    const asMem0 = rawMemories.map(m => ({
      id: m.id,
      memory: m.content,
      metadata: m.metadata_ as Record<string, unknown> | undefined,
      score: m.score,
    }));
    const { active, expired } = partitionByExpiry(asMem0);

    // Background-delete expired results
    if (expired.length > 0) {
      backgroundDeleteExpired(client, expired);
    }

    return {
      success: true,
      query: args.query,
      total: active.length,
      memories: active.map(m => ({
        id: m.id,
        memory: (m as Mem0Memory).memory || (m as SidMemoMemory).content,
        score: (m as Mem0Memory).score ?? (m as SidMemoMemory).score,
        metadata: (m as Mem0Memory).metadata || (m as SidMemoMemory).metadata_,
      })),
      ...(expired.length > 0 ? { expiredFiltered: expired.length } : {}),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Search failed',
      memories: [],
    };
  }
}

export async function handleMemoryList(args: {
  projectId?: string;
}): Promise<Record<string, unknown>> {
  const client = getClient();

  if (!(await client.isAvailable())) {
    return {
      success: false,
      error: 'SidMemo API is not available.',
      memories: [],
    };
  }

  try {
    const response = await client.list(args.projectId);
    const rawMemories = response.items;
    // Map to Mem0Memory shape for partitioning
    const asMem0 = rawMemories.map(m => ({
      id: m.id,
      memory: m.content,
      metadata: m.metadata_ as Record<string, unknown> | undefined,
      score: m.score,
    }));
    const { active, expired } = partitionByExpiry(asMem0);

    // Background-delete expired entries
    if (expired.length > 0) {
      backgroundDeleteExpired(client, expired);
    }

    return {
      success: true,
      total: active.length,
      memories: active.map(m => ({
        id: m.id,
        memory: (m as Mem0Memory).memory || (m as SidMemoMemory).content,
        metadata: (m as Mem0Memory).metadata || (m as SidMemoMemory).metadata_,
      })),
      ...(expired.length > 0 ? { expiredFiltered: expired.length } : {}),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list memories',
      memories: [],
    };
  }
}

export async function handleMemoryDelete(args: {
  memoryId: string;
  projectId?: string;
}): Promise<Record<string, unknown>> {
  const client = getClient();

  if (!(await client.isAvailable())) {
    return {
      success: false,
      error: 'SidMemo API is not available.',
    };
  }

  try {
    await client.delete(args.memoryId);
    return {
      success: true,
      memoryId: args.memoryId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete memory',
    };
  }
}

export async function handleMemoryIndexKnowledge(args: {
  projectPath: string;
  projectId: string;
}): Promise<Record<string, unknown>> {
  validateProjectPath(args.projectPath);
  const client = getClient();

  if (!(await client.isAvailable())) {
    return {
      success: false,
      error: 'SidMemo API is not available. Check SIDMEMO_API_KEY environment variable.',
    };
  }

  try {
    const workspacePath = resolveWorkspacePath(args.projectPath);
    const knowledgeApiClient = createApiClient();
    const response = await knowledgeApiClient.knowledge.list({ projectPath: workspacePath, limit: '1000' } as any);
    const docs = response.documents || [];

    const indexer = new KnowledgeIndexer(client);
    const result = await indexer.indexAll(docs, args.projectId);

    return {
      success: true,
      total: result.total,
      indexed: result.indexed,
      failed: result.failed,
      ...(result.errors.length > 0 ? { errors: result.errors.slice(0, 10) } : {}),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to index knowledge',
    };
  }
}

export async function handleMemoryCleanup(args: {
  projectId?: string;
  dryRun?: boolean;
}): Promise<Record<string, unknown>> {
  const client = getClient();

  if (!(await client.isAvailable())) {
    return {
      success: false,
      error: 'SidMemo API is not available.',
    };
  }

  try {
    const response = await client.list(args.projectId);
    const allMemories = response.items;
    const asMem0 = allMemories.map(m => ({
      id: m.id,
      memory: m.content,
      metadata: m.metadata_ as Record<string, unknown> | undefined,
    }));
    const { active, expired } = partitionByExpiry(asMem0);

    if (!args.dryRun) {
      let deleted = 0;
      if (expired.length > 0) {
        const ids = expired.map(m => m.id);
        try {
          const result = await client.bulkDelete(ids);
          deleted = result.deleted;
        } catch {
          // Fall back to individual deletes
          for (const mem of expired) {
            try {
              await client.delete(mem.id);
              deleted++;
            } catch {
              // skip
            }
          }
        }
      }
      return {
        success: true,
        scanned: allMemories.length,
        active: active.length,
        deleted,
      };
    }

    return {
      success: true,
      dryRun: true,
      scanned: allMemories.length,
      active: active.length,
      wouldDelete: expired.length,
      expiredMemories: expired.map(m => ({
        id: m.id,
        memory: (m as Mem0Memory).memory?.substring(0, 100),
        sourceType: (m as Mem0Memory).metadata?.sourceType,
        expiresAt: (m as Mem0Memory).metadata?.expiresAt,
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Cleanup failed',
    };
  }
}

/**
 * Get the singleton SidMemoClient for use in other handlers.
 * Returns null if SidMemo is not available.
 */
export async function getSidMemoClientIfAvailable(): Promise<SidMemoClient | null> {
  const client = getClient();
  const available = await client.isAvailable();
  return available ? client : null;
}

/** @deprecated Use getSidMemoClientIfAvailable */
export const getMem0ClientIfAvailable = getSidMemoClientIfAvailable;

/**
 * Get a KnowledgeIndexer backed by the singleton SidMemoClient.
 * Returns null if SidMemo is not available.
 */
export async function getKnowledgeIndexer(): Promise<KnowledgeIndexer | null> {
  const client = await getSidMemoClientIfAvailable();
  if (!client) return null;
  return new KnowledgeIndexer(client);
}
