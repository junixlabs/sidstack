/**
 * Knowledge MCP Tool Handlers
 *
 * Tools for accessing unified knowledge via the SidStack API server:
 * - knowledge_list: List all knowledge documents
 * - knowledge_get: Get single document with content
 * - knowledge_search: Search across knowledge base
 * - knowledge_context: Build session context for Claude
 * - knowledge_modules: List modules with knowledge stats
 *
 * Uses createApiClient from @sidstack/shared for HTTP access via api-server.
 */

import {
  createApiClient,
  ALL_DOCUMENT_TYPES,
  type DocumentType,
  // Workspace detection
  detectWorkspace,
} from '@sidstack/shared';
import { validateProjectPath } from './validate-path.js';
import { getSidMemoClientIfAvailable, getKnowledgeIndexer } from './memory.js';
import * as path from 'path';

// =============================================================================
// API Client (singleton)
// =============================================================================

const apiClient = createApiClient();

// =============================================================================
// Rate Limiter for knowledge_search (30 calls/min per projectPath)
// =============================================================================

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const searchCallTimestamps = new Map<string, number[]>();

function checkSearchRateLimit(projectPath: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const timestamps = searchCallTimestamps.get(projectPath) || [];

  // Prune entries outside the window
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX) {
    const oldestInWindow = recent[0];
    const retryAfterSeconds = Math.ceil((oldestInWindow + RATE_LIMIT_WINDOW_MS - now) / 1000);
    searchCallTimestamps.set(projectPath, recent);
    return { allowed: false, retryAfterSeconds };
  }

  recent.push(now);
  searchCallTimestamps.set(projectPath, recent);
  return { allowed: true };
}

/**
 * Resolve workspace path from projectPath (handles worktrees)
 * Returns the actual workspace root where .sidstack/ lives.
 * Falls back to projectPath as-is when workspace detection fails (remote mode).
 */
function resolveWorkspacePath(projectPath: string): string {
  try {
    const workspace = detectWorkspace(projectPath);
    if (workspace) {
      return workspace.workspaceRoot;
    }
  } catch {
    // Workspace detection can fail in remote mode — fall through
  }
  return projectPath;
}

// =============================================================================
// Tool Definitions
// =============================================================================

export const knowledgeTools = [
  {
    name: 'knowledge_list',
    description: 'List all knowledge documents from .sidstack/ (knowledge, skills, principles, modules). Returns summaries (not full content).',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the project directory',
        },
        type: {
          type: 'array',
          items: {
            type: 'string',
            enum: ALL_DOCUMENT_TYPES as unknown as string[],
          },
          description: 'Filter by document type(s)',
        },
        module: {
          type: 'string',
          description: 'Filter by module ID',
        },
        status: {
          type: 'string',
          description: 'Filter by status (draft, active, review, archived, in-progress, completed, etc.)',
        },
        search: {
          type: 'string',
          description: 'Full-text search query',
        },
        limit: {
          type: 'number',
          description: 'Max documents to return (default: 20)',
          default: 20,
        },
      },
      required: ['projectPath'],
    },
  },
  {
    name: 'knowledge_get',
    description: 'Get a single knowledge document by ID with full content.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the project directory',
        },
        docId: {
          type: 'string',
          description: 'Document ID to retrieve',
        },
      },
      required: ['projectPath', 'docId'],
    },
  },
  {
    name: 'knowledge_search',
    description: 'Search across all knowledge documents. Returns matching documents with summaries.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the project directory',
        },
        query: {
          type: 'string',
          description: 'Search query (searches in title, ID, summary, module, tags)',
        },
        type: {
          type: 'array',
          items: {
            type: 'string',
            enum: ALL_DOCUMENT_TYPES as unknown as string[],
          },
          description: 'Filter by document type(s)',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default: 20)',
          default: 20,
        },
      },
      required: ['projectPath', 'query'],
    },
  },
  {
    name: 'knowledge_context',
    description: 'Build session context for Claude from linked entities (task, module, spec, ticket) and/or semantic query. When query is provided, returns chunk-level RAG context with Knowledge Graph enrichment. Returns formatted markdown ready for injection.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the project directory',
        },
        query: {
          type: 'string',
          description: 'Semantic query for RAG context (searches knowledge chunks via vector similarity)',
        },
        taskId: {
          type: 'string',
          description: 'Task ID to get context for',
        },
        moduleId: {
          type: 'string',
          description: 'Module ID to get context for',
        },
        specId: {
          type: 'string',
          description: 'Spec/change ID to get context for',
        },
        ticketId: {
          type: 'string',
          description: 'Ticket ID to get context for',
        },
        maxLength: {
          type: 'number',
          description: 'Max context length in chars (default: 8000)',
          default: 8000,
        },
      },
      required: ['projectPath'],
    },
  },
  {
    name: 'knowledge_modules',
    description: 'List all modules with enriched details: document counts by type, health score, dependencies, last updated. Modules are knowledge documents of type "module" — use knowledge_create with type "module" to define new modules.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the project directory',
        },
      },
      required: ['projectPath'],
    },
  },
  {
    name: 'knowledge_module_overview',
    description: 'Get full overview for a module: definition, all documents grouped by type, dependencies (dependsOn/dependedBy/related), and health score with coverage gaps. Use this to understand a module before working on it.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the project directory',
        },
        moduleId: {
          type: 'string',
          description: 'Module ID (matches the module field value on knowledge documents)',
        },
      },
      required: ['projectPath', 'moduleId'],
    },
  },
  {
    name: 'knowledge_create',
    description: 'Create a new knowledge document in the database. Returns the created document with ID.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the project directory',
        },
        title: {
          type: 'string',
          description: 'Document title',
        },
        type: {
          type: 'string',
          enum: ALL_DOCUMENT_TYPES as unknown as string[],
          description: 'Document type',
        },
        content: {
          type: 'string',
          description: 'Document content (markdown)',
        },
        module: {
          type: 'string',
          description: 'Module ID to link to',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for the document',
        },
        status: {
          type: 'string',
          enum: ['draft', 'active', 'review', 'archived'],
          description: 'Document status (default: draft)',
        },
        owner: {
          type: 'string',
          description: 'Document owner',
        },
        category: {
          type: 'string',
          description: 'Subfolder under knowledge/ (overrides type-based default)',
        },
        related: {
          type: 'array',
          items: { type: 'string' },
          description: 'Related document IDs',
        },
        dependsOn: {
          type: 'array',
          items: { type: 'string' },
          description: 'Dependency document IDs',
        },
        covers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Source files this doc covers (for stale detection)',
        },
      },
      required: ['projectPath', 'title', 'type', 'content'],
    },
  },
  {
    name: 'knowledge_update',
    description: 'Update an existing knowledge document in the database. Merges provided fields into the existing document.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the project directory',
        },
        docId: {
          type: 'string',
          description: 'Document ID to update',
        },
        title: {
          type: 'string',
          description: 'New title',
        },
        content: {
          type: 'string',
          description: 'New content (markdown)',
        },
        status: {
          type: 'string',
          enum: ['draft', 'active', 'review', 'archived'],
          description: 'New status',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'New tags',
        },
        module: {
          type: 'string',
          description: 'New module ID',
        },
        owner: {
          type: 'string',
          description: 'New owner',
        },
        related: {
          type: 'array',
          items: { type: 'string' },
          description: 'New related document IDs',
        },
        dependsOn: {
          type: 'array',
          items: { type: 'string' },
          description: 'New dependency document IDs',
        },
        covers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Updated source files this doc covers',
        },
      },
      required: ['projectPath', 'docId'],
    },
  },
  {
    name: 'knowledge_delete',
    description: 'Delete or archive a knowledge document in the database. Defaults to archive (soft delete).',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the project directory',
        },
        docId: {
          type: 'string',
          description: 'Document ID to delete',
        },
        archive: {
          type: 'boolean',
          description: 'If true (default), move to archive instead of permanent delete',
          default: true,
        },
      },
      required: ['projectPath', 'docId'],
    },
  },
  {
    name: 'knowledge_health',
    description: 'Run health checks on the knowledge base. Detects stale docs, missing metadata, broken links, orphaned docs, and overdue reviews.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the project directory',
        },
        checks: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['stale', 'missing-metadata', 'broken-link', 'orphaned', 'overdue-review'],
          },
          description: 'Specific checks to run (default: all)',
        },
      },
      required: ['projectPath'],
    },
  },
];

// =============================================================================
// Tool Handlers - API Client Access
// =============================================================================

export async function handleKnowledgeList(args: {
  projectPath: string;
  type?: DocumentType[];
  module?: string;
  status?: string;
  search?: string;
  limit?: number;
}) {
  try {
    validateProjectPath(args.projectPath);

    const response = await apiClient.knowledge.list({
      projectPath: args.projectPath,
      type: args.type?.join(','),
      module: args.module,
      status: args.status,
      search: args.search,
      limit: String(args.limit || 20),
    });

    const documents = response.documents || [];

    const summary = {
      total: response.total ?? documents.length,
      returned: documents.length,
      byType: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
    };

    for (const doc of documents) {
      summary.byType[doc.type] = (summary.byType[doc.type] || 0) + 1;
      if (doc.source) {
        summary.bySource[doc.source] = (summary.bySource[doc.source] || 0) + 1;
      }
    }

    return {
      success: true,
      documents: documents.map((d: any) => ({
        id: d.id,
        type: d.type,
        title: d.title,
        path: d.sourcePath,
        module: d.module,
        status: d.status,
        source: d.source,
        summary: d.summary ? d.summary.slice(0, 200) + (d.summary.length > 200 ? '...' : '') : undefined,
      })),
      summary,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list knowledge',
      documents: [],
      summary: { total: 0, returned: 0, byType: {}, bySource: {} },
    };
  }
}

export async function handleKnowledgeGet(args: {
  projectPath: string;
  docId: string;
}) {
  try {
    validateProjectPath(args.projectPath);

    const doc = await apiClient.knowledge.get(args.docId, {
      projectPath: args.projectPath,
    });

    if (!doc) {
      return {
        success: false,
        error: 'Document not found',
      };
    }

    return {
      success: true,
      document: {
        id: doc.id,
        type: doc.type,
        title: doc.title,
        path: doc.sourcePath,
        absolutePath: doc.absolutePath,
        source: doc.source,
        module: doc.module,
        status: doc.status,
        tags: doc.tags,
        content: doc.content,
        summary: doc.summary,
        related: doc.related,
        dependsOn: doc.dependsOn,
        covers: doc.covers,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Document not found',
    };
  }
}

export async function handleKnowledgeSearch(args: {
  projectPath: string;
  query: string;
  type?: DocumentType[];
  limit?: number;
}) {
  try {
    validateProjectPath(args.projectPath);

    // Rate limit check
    const rateCheck = checkSearchRateLimit(args.projectPath);
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: `Rate limit exceeded for knowledge_search (${RATE_LIMIT_MAX}/min). Retry after ${rateCheck.retryAfterSeconds} seconds.`,
        query: args.query,
        total: 0,
        documents: [],
      };
    }

    const response = await apiClient.knowledge.search({
      projectPath: args.projectPath,
      q: args.query,
      limit: String(args.limit || 20),
    });

    let results = response.results || [];

    // Apply type filter if provided
    if (args.type) {
      results = results.filter((d: any) => args.type!.includes(d.type));
    }

    // Semantic search via SidMemo (non-blocking, graceful degradation)
    let semanticMatches: Array<{ content: string; score?: number; metadata?: Record<string, unknown> }> = [];
    try {
      const sidmemoClient = await getSidMemoClientIfAvailable();
      if (sidmemoClient) {
        const workspacePath = resolveWorkspacePath(args.projectPath);
        const projectId = path.basename(workspacePath);
        const memories = await sidmemoClient.search(args.query, projectId, args.limit || 10, { sourceType: 'knowledge_chunk' });
        semanticMatches = memories.map(m => ({
          content: m.content,
          score: m.score,
          metadata: m.metadata_ as Record<string, unknown> | undefined,
        }));
      }
    } catch {
      // Non-blocking: keyword results still returned
    }

    // Deduplicate: remove semantic matches already in keyword results
    const docIds = new Set(results.map((d: any) => d.id));
    const uniqueSemanticMatches = semanticMatches.filter(
      m => !m.metadata?.docId || !docIds.has(m.metadata.docId as string)
    );

    return {
      success: true,
      query: args.query,
      total: results.length,
      documents: results.map((d: any) => ({
        id: d.id,
        type: d.type,
        title: d.title,
        path: d.sourcePath,
        module: d.module,
        status: d.status,
        source: d.source,
        summary: d.summary ? d.summary.slice(0, 200) + (d.summary.length > 200 ? '...' : '') : undefined,
        score: d._score,
      })),
      ...(uniqueSemanticMatches.length > 0 ? { semanticMatches: uniqueSemanticMatches } : {}),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Search failed',
      query: args.query,
      total: 0,
      documents: [],
    };
  }
}

export async function handleKnowledgeContext(args: {
  projectPath: string;
  query?: string;
  taskId?: string;
  moduleId?: string;
  specId?: string;
  ticketId?: string;
  maxLength?: number;
}) {
  validateProjectPath(args.projectPath);

  try {
    // Build query params for the API call
    const query: Record<string, string | undefined> = {
      projectPath: args.projectPath,
      taskId: args.taskId,
      moduleId: args.moduleId,
      maxLength: args.maxLength ? String(args.maxLength) : undefined,
    };

    const contextResult = await apiClient.knowledge.context(query);

    // Semantic memory overlay via SidMemo (non-blocking, graceful degradation)
    let semanticSection = '';
    try {
      const sidmemoClient = await getSidMemoClientIfAvailable();
      if (sidmemoClient) {
        const projectId = path.basename(resolveWorkspacePath(args.projectPath));

        // Build semantic query from context result, not just IDs
        const ctxText = typeof contextResult === 'string'
          ? contextResult
          : (contextResult.context || contextResult.prompt || '');
        const searchQuery = args.query
          || (ctxText ? ctxText.substring(0, 200) : '')
          || args.taskId || args.moduleId || args.specId || 'project context';

        // Single search, partition client-side
        const allMemories = await sidmemoClient.search(searchQuery, projectId, 10).catch(() => []);
        const memories = allMemories.filter((m: any) => m.metadata_?.sourceType !== 'validation_failure').slice(0, 5);
        const failures = allMemories.filter((m: any) => m.metadata_?.sourceType === 'validation_failure').slice(0, 5);

        if (memories.length > 0) {
          semanticSection += '\n\n## Relevant Knowledge\n';
          for (const m of memories) {
            semanticSection += `- ${m.content}\n`;
          }
        }
        if (failures.length > 0) {
          semanticSection += '\n\n## Past Validation Failures\n';
          for (const f of failures) {
            semanticSection += `- ${f.content}\n`;
          }
        }
      }
    } catch {
      // Non-blocking
    }

    // The context API returns the knowledge context object directly
    // Adapt to the expected MCP response format
    const contextText = typeof contextResult === 'string'
      ? contextResult
      : (contextResult.context || contextResult.prompt || JSON.stringify(contextResult));
    const fullContext = contextText + semanticSection;

    return {
      success: true,
      context: fullContext,
      entities: contextResult.entities || contextResult.metadata?.entities || [],
      metadata: {
        totalLength: fullContext.length,
        maxLength: args.maxLength || 8000,
        truncated: fullContext.length >= (args.maxLength || 8000),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to build context',
    };
  }
}

export async function handleKnowledgeModules(args: {
  projectPath: string;
}) {
  try {
    validateProjectPath(args.projectPath);

    const modules = await apiClient.knowledge.modules({
      projectPath: args.projectPath,
    });

    // API now returns enriched modules with details
    const moduleList = Array.isArray(modules) ? modules : [];

    return {
      success: true,
      modules: moduleList.map((m: any) => ({
        name: m.id || m.name,
        title: m.title || m.id || m.name,
        summary: m.summary,
        documentCount: m.documentCount || 0,
        byType: m.byType || {},
        healthScore: m.healthScore ?? 0,
        lastUpdated: m.lastUpdated || '',
        dependsOn: m.dependsOn || [],
        related: m.related || [],
        hasModuleDoc: m.hasModuleDoc ?? false,
      })),
      totalModules: moduleList.length,
      totalDocuments: moduleList.reduce((sum: number, m: any) => sum + (m.documentCount || 0), 0),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load modules',
      modules: [],
      totalModules: 0,
      totalDocuments: 0,
    };
  }
}

export async function handleKnowledgeModuleOverview(args: {
  projectPath: string;
  moduleId: string;
}) {
  try {
    validateProjectPath(args.projectPath);

    if (!args.moduleId) {
      return { success: false, error: 'moduleId is required' };
    }

    const overview = await apiClient.knowledge.moduleOverview({
      projectPath: args.projectPath,
      moduleId: args.moduleId,
    });

    if (!overview) {
      return { success: false, error: `Module "${args.moduleId}" not found` };
    }

    return {
      success: true,
      ...overview,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get module overview',
    };
  }
}

export async function handleKnowledgeCreate(args: {
  projectPath: string;
  title: string;
  type: string;
  content: string;
  module?: string;
  tags?: string[];
  status?: string;
  owner?: string;
  category?: string;
  related?: string[];
  dependsOn?: string[];
  covers?: string[];
}) {
  try {
    validateProjectPath(args.projectPath);

    const doc = await apiClient.knowledge.create({
      projectPath: args.projectPath,
      title: args.title,
      type: args.type,
      content: args.content,
      module: args.module,
      tags: args.tags,
      status: args.status,
      owner: args.owner,
      category: args.category,
      related: args.related,
      dependsOn: args.dependsOn,
      covers: args.covers,
    });

    // Write-through: index to SidMemo via chunker (non-blocking)
    try {
      const indexer = await getKnowledgeIndexer();
      if (indexer) {
        const projectId = path.basename(resolveWorkspacePath(args.projectPath));
        indexer.indexDocument(doc, projectId).catch(() => {});
      }
    } catch {
      // Non-blocking: doc created successfully
    }

    return {
      success: true,
      document: {
        id: doc.id,
        type: doc.type,
        title: doc.title,
        path: doc.sourcePath,
        status: doc.status,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create document',
    };
  }
}

export async function handleKnowledgeUpdate(args: {
  projectPath: string;
  docId: string;
  title?: string;
  content?: string;
  status?: string;
  tags?: string[];
  module?: string;
  owner?: string;
  related?: string[];
  dependsOn?: string[];
  covers?: string[];
}) {
  try {
    validateProjectPath(args.projectPath);

    const body: Record<string, unknown> = {};
    if (args.title !== undefined) body.title = args.title;
    if (args.content !== undefined) body.content = args.content;
    if (args.status !== undefined) body.status = args.status;
    if (args.tags !== undefined) body.tags = args.tags;
    if (args.module !== undefined) body.module = args.module;
    if (args.owner !== undefined) body.owner = args.owner;
    if (args.related !== undefined) body.related = args.related;
    if (args.dependsOn !== undefined) body.dependsOn = args.dependsOn;
    if (args.covers !== undefined) body.covers = args.covers;

    const doc = await apiClient.knowledge.update(args.docId, body, {
      projectPath: args.projectPath,
    });

    // Write-through: reindex to SidMemo if content or title changed (non-blocking)
    if (args.content || args.title) {
      try {
        const indexer = await getKnowledgeIndexer();
        if (indexer) {
          const projectId = path.basename(resolveWorkspacePath(args.projectPath));
          indexer.reindexDocument(doc, projectId).catch(() => {});
        }
      } catch {
        // Non-blocking: doc updated successfully
      }
    }

    return {
      success: true,
      document: {
        id: doc.id,
        type: doc.type,
        title: doc.title,
        path: doc.sourcePath,
        status: doc.status,
        updatedAt: doc.updatedAt,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update document',
    };
  }
}

export async function handleKnowledgeDelete(args: {
  projectPath: string;
  docId: string;
  archive?: boolean;
}) {
  try {
    validateProjectPath(args.projectPath);

    const archive = args.archive !== false; // default true
    const result = await apiClient.knowledge.delete(args.docId, {
      projectPath: args.projectPath,
      archive: String(archive),
    });

    // Write-through: remove from SidMemo (non-blocking)
    try {
      const indexer = await getKnowledgeIndexer();
      if (indexer) {
        const projectId = path.basename(resolveWorkspacePath(args.projectPath));
        indexer.removeDocument(args.docId, projectId).catch(() => {});
      }
    } catch {
      // Non-blocking: doc deleted/archived successfully
    }

    return {
      success: true,
      docId: args.docId,
      action: result?.action || (archive ? 'archived' : 'deleted'),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete document',
    };
  }
}

export async function handleKnowledgeHealth(args: {
  projectPath: string;
  checks?: string[];
}) {
  try {
    validateProjectPath(args.projectPath);

    const result = await apiClient.knowledge.health({
      projectPath: args.projectPath,
      checks: args.checks?.join(','),
    });

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to run health check',
    };
  }
}
