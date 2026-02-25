/**
 * Memory MCP Tool Handlers
 *
 * Semantic memory tools powered by mem0 REST API server.
 * All tools gracefully degrade when mem0 server is unavailable.
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
  createMem0Client,
  createApiClient,
  detectWorkspace,
  isMemoryExpired,
  type Mem0Client,
  type Mem0Memory,
} from '@sidstack/shared';
import { validateProjectPath } from './validate-path.js';

// =============================================================================
// Singleton client (reused across tool calls)
// =============================================================================

let _client: Mem0Client | null = null;

function getClient(): Mem0Client {
  if (!_client) {
    _client = createMem0Client();
  }
  return _client;
}

function resolveWorkspacePath(projectPath: string): string {
  const workspace = detectWorkspace(projectPath);
  return workspace ? workspace.workspaceRoot : projectPath;
}

/** Partition memories into active and expired. */
function partitionByExpiry(memories: Mem0Memory[]): {
  active: Mem0Memory[];
  expired: Mem0Memory[];
} {
  const active: Mem0Memory[] = [];
  const expired: Mem0Memory[] = [];
  for (const mem of memories) {
    if (isMemoryExpired(mem)) {
      expired.push(mem);
    } else {
      active.push(mem);
    }
  }
  return { active, expired };
}

/** Background-delete expired memories (fire-and-forget). */
function backgroundDeleteExpired(client: Mem0Client, expired: Mem0Memory[], userId?: string): void {
  for (const mem of expired) {
    client.delete(mem.id, userId).catch(() => {});
  }
}

// =============================================================================
// Tool Definitions
// =============================================================================

export const memoryTools = [
  {
    name: 'memory_add',
    description: 'Store a memory in the semantic memory system (mem0). Memories are searchable by meaning, not just keywords. Use user_id for project isolation.',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The memory content to store',
        },
        projectId: {
          type: 'string',
          description: 'Project ID for memory isolation (used as user_id in mem0)',
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
          description: 'Project ID for ownership verification (used as user_id in mem0)',
        },
      },
      required: ['memoryId'],
    },
  },
  {
    name: 'memory_index_knowledge',
    description: 'Bulk-index all knowledge documents from .sidstack/knowledge/ into semantic memory. Use this to bootstrap semantic search for an existing knowledge base.',
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
      error: 'mem0 server is not available. Start the mem0 Docker container to enable semantic memory.',
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
      error: 'mem0 server is not available. Start the mem0 Docker container to enable semantic search.',
      memories: [],
    };
  }

  try {
    const rawMemories = await client.search(args.query, args.projectId, args.limit || 10);
    const { active, expired } = partitionByExpiry(rawMemories);

    // Background-delete expired results
    if (expired.length > 0) {
      backgroundDeleteExpired(client, expired, args.projectId);
    }

    return {
      success: true,
      query: args.query,
      total: active.length,
      memories: active,
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
      error: 'mem0 server is not available.',
      memories: [],
    };
  }

  try {
    const rawMemories = await client.list(args.projectId);
    const { active, expired } = partitionByExpiry(rawMemories);

    // Background-delete expired entries
    if (expired.length > 0) {
      backgroundDeleteExpired(client, expired, args.projectId);
    }

    return {
      success: true,
      total: active.length,
      memories: active,
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
      error: 'mem0 server is not available.',
    };
  }

  try {
    const deleted = await client.delete(args.memoryId, args.projectId);
    return {
      success: deleted,
      memoryId: args.memoryId,
      ...(deleted ? {} : { error: 'Failed to delete memory' }),
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
      error: 'mem0 server is not available. Start the mem0 Docker container first.',
    };
  }

  try {
    const workspacePath = resolveWorkspacePath(args.projectPath);
    const knowledgeApiClient = createApiClient();
    const response = await knowledgeApiClient.knowledge.list({ projectPath: workspacePath, limit: '1000' } as any);
    const docs = response.documents || [];

    let indexed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const doc of docs) {
      try {
        const content = [
          `Title: ${doc.title}`,
          doc.summary ? `Summary: ${doc.summary}` : '',
          `Type: ${doc.type}`,
          doc.module ? `Module: ${doc.module}` : '',
          doc.tags?.length ? `Tags: ${doc.tags.join(', ')}` : '',
          '',
          doc.content,
        ]
          .filter(Boolean)
          .join('\n');

        await client.addSmart(content, args.projectId, {
          sourceType: 'knowledge_doc',
          docId: doc.id,
          docType: doc.type,
          module: doc.module,
        });
        indexed++;
      } catch (err) {
        failed++;
        errors.push(`${doc.id}: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    }

    return {
      success: true,
      total: docs.length,
      indexed,
      failed,
      ...(errors.length > 0 ? { errors: errors.slice(0, 10) } : {}),
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
      error: 'mem0 server is not available.',
    };
  }

  try {
    const allMemories = await client.list(args.projectId);
    const { active, expired } = partitionByExpiry(allMemories);

    if (!args.dryRun) {
      let deleted = 0;
      let failedDeletes = 0;
      for (const mem of expired) {
        try {
          await client.delete(mem.id, args.projectId);
          deleted++;
        } catch {
          failedDeletes++;
        }
      }
      return {
        success: true,
        scanned: allMemories.length,
        active: active.length,
        deleted,
        ...(failedDeletes > 0 ? { failedDeletes } : {}),
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
        memory: m.memory?.substring(0, 100),
        sourceType: m.metadata?.sourceType,
        expiresAt: m.metadata?.expiresAt,
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
 * Get the singleton Mem0Client for use in other handlers.
 * Returns null if mem0 is not available.
 */
export async function getMem0ClientIfAvailable(): Promise<Mem0Client | null> {
  const client = getClient();
  const available = await client.isAvailable();
  return available ? client : null;
}
