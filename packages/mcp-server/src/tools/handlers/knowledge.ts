/**
 * Knowledge MCP Tool Handlers
 *
 * Tools for accessing unified knowledge directly from the filesystem:
 * - knowledge_list: List all knowledge documents
 * - knowledge_get: Get single document with content
 * - knowledge_search: Search across knowledge base
 * - knowledge_context: Build session context for Claude
 * - knowledge_modules: List modules with knowledge stats
 *
 * Uses KnowledgeService from @sidstack/shared for direct filesystem access.
 * No api-server dependency required.
 */

import {
  createKnowledgeService,
  type DocumentType,
} from '@sidstack/shared';
import { buildSessionContext, type ContextBuilderOptions } from '@sidstack/shared';
import { SidStackDB, getDB } from '@sidstack/shared';

// =============================================================================
// Service Cache (per project path)
// =============================================================================

const serviceCache = new Map<string, ReturnType<typeof createKnowledgeService>>();

function getService(projectPath: string): ReturnType<typeof createKnowledgeService> {
  if (!serviceCache.has(projectPath)) {
    serviceCache.set(projectPath, createKnowledgeService(projectPath));
  }
  return serviceCache.get(projectPath)!;
}

// Database instance
let db: SidStackDB | null = null;

async function getDatabase(): Promise<SidStackDB | null> {
  try {
    if (!db) {
      db = await getDB();
    }
    return db;
  } catch {
    return null;
  }
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
            enum: ['index', 'business-logic', 'api-endpoint', 'design-pattern', 'database-table', 'module', 'governance', 'spec', 'decision', 'proposal', 'guide', 'skill', 'principle', 'rule', 'tutorial', 'reference', 'explanation', 'concept', 'template', 'checklist', 'pattern'],
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
          description: 'Max documents to return (default: 50)',
          default: 50,
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
            enum: ['index', 'business-logic', 'api-endpoint', 'design-pattern', 'database-table', 'module', 'governance', 'spec', 'decision', 'proposal', 'guide', 'skill', 'principle', 'rule', 'tutorial', 'reference', 'explanation', 'concept', 'template', 'checklist', 'pattern'],
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
    description: 'Build session context for Claude from linked entities (task, module, spec, ticket). Returns formatted markdown ready for injection.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the project directory',
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
    description: 'List all modules with their knowledge document counts and types.',
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
];

// =============================================================================
// Tool Handlers - Direct Filesystem Access
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
    const service = getService(args.projectPath);
    const response = await service.listDocuments({
      type: args.type,
      module: args.module,
      status: args.status as any,
      search: args.search,
      limit: args.limit || 50,
    });

    const summary = {
      total: response.total,
      returned: response.documents.length,
      byType: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
    };

    for (const doc of response.documents) {
      summary.byType[doc.type] = (summary.byType[doc.type] || 0) + 1;
      summary.bySource[doc.source] = (summary.bySource[doc.source] || 0) + 1;
    }

    return {
      success: true,
      documents: response.documents.map(d => ({
        id: d.id,
        type: d.type,
        title: d.title,
        path: d.sourcePath,
        module: d.module,
        status: d.status,
        source: d.source,
        summary: d.summary,
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
    const service = getService(args.projectPath);
    const doc = await service.getDocument(args.docId);

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
    const service = getService(args.projectPath);
    const results = await service.searchDocuments(args.query, args.limit || 20);

    // Apply type filter if provided
    const filtered = args.type
      ? results.filter(d => args.type!.includes(d.type))
      : results;

    return {
      success: true,
      query: args.query,
      total: filtered.length,
      documents: filtered.map(d => ({
        id: d.id,
        type: d.type,
        title: d.title,
        path: d.sourcePath,
        module: d.module,
        status: d.status,
        source: d.source,
        summary: d.summary,
        score: d._score,
      })),
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
  taskId?: string;
  moduleId?: string;
  specId?: string;
  ticketId?: string;
  maxLength?: number;
}) {
  const database = await getDatabase();
  const service = getService(args.projectPath);

  const options: ContextBuilderOptions = {
    workspacePath: args.projectPath,
    taskId: args.taskId,
    moduleId: args.moduleId,
    specId: args.specId,
    ticketId: args.ticketId,
    maxContextLength: args.maxLength || 8000,

    // Data loaders
    getTask: database ? async (id) => database.getTask(id) : undefined,
    getTicket: database ? async (id) => database.getTicket(id) : undefined,

    // Module knowledge loader - direct filesystem
    getModuleKnowledge: async (modId) => {
      try {
        const response = await service.listDocuments({
          module: modId,
          limit: 10,
        });

        if (response.documents.length === 0) {
          return null;
        }

        return {
          moduleId: modId,
          name: modId,
          docs: response.documents.map(d => {
            const t = d.type as string;
            const mappedType = t === 'reference' ? 'api' : t === 'pattern' ? 'pattern' : t === 'module' ? 'general' : 'general';
            return {
              title: d.title,
              path: d.sourcePath,
              content: d.content || d.summary || '',
              type: mappedType as 'business-logic' | 'api' | 'pattern' | 'database' | 'general',
            };
          }),
        };
      } catch {
        return null;
      }
    },

    // Spec content loader - direct filesystem
    getSpecContent: async (specId) => {
      try {
        const doc = await service.getDocument(specId);
        if (!doc) return null;

        return {
          specId: doc.id,
          title: doc.title,
          content: doc.content || doc.summary || '',
          status: doc.status,
        };
      } catch {
        return null;
      }
    },
  };

  try {
    const context = await buildSessionContext(options);
    return {
      success: true,
      context: context.prompt,
      entities: context.metadata.entities,
      metadata: {
        totalLength: context.prompt.length,
        maxLength: args.maxLength || 8000,
        truncated: context.prompt.length >= (args.maxLength || 8000),
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
    const service = getService(args.projectPath);
    const stats = await service.getStats();

    const modules = Object.entries(stats.byModule || {}).map(([name, count]) => ({
      name,
      documentCount: count,
    }));

    return {
      success: true,
      modules,
      totalModules: modules.length,
      totalDocuments: stats.totalDocuments,
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
