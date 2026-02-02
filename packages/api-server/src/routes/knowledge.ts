/**
 * SidStack Knowledge API Routes
 *
 * REST API for the unified knowledge system.
 * Uses KnowledgeService from @sidstack/shared for all operations.
 */

import { Router } from 'express';
import {
  createKnowledgeService,
  DOCUMENT_TYPE_CONFIG,
  type KnowledgeDocument,
  type DocumentType,
  type DocumentStatus,
  type ListDocumentsQuery,
  type CreateDocumentInput,
  type UpdateDocumentInput,
} from '@sidstack/shared';

export const knowledgeRouter: Router = Router();

// =============================================================================
// Service Cache
// =============================================================================

const serviceCache = new Map<string, ReturnType<typeof createKnowledgeService>>();

function getService(projectPath: string) {
  if (!serviceCache.has(projectPath)) {
    serviceCache.set(projectPath, createKnowledgeService(projectPath));
  }
  return serviceCache.get(projectPath)!;
}

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /api/knowledge
 * List all documents with optional filtering
 *
 * Query params:
 * - type: DocumentType or comma-separated types
 * - status: DocumentStatus or comma-separated statuses
 * - module: Module ID filter
 * - tags: Comma-separated tags
 * - search: Full-text search query
 * - limit: Max results (default 50)
 * - offset: Pagination offset (default 0)
 * - sortBy: title | updatedAt | createdAt | type
 * - sortOrder: asc | desc
 */
knowledgeRouter.get('/', async (req, res) => {
  try {
    const projectPath = req.query.projectPath as string;
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }

    const service = getService(projectPath);

    // Build query from request params
    const query: ListDocumentsQuery = {};

    if (req.query.type) {
      const types = (req.query.type as string).split(',') as DocumentType[];
      query.type = types.length === 1 ? types[0] : types;
    }

    if (req.query.status) {
      const statuses = (req.query.status as string).split(',') as DocumentStatus[];
      query.status = statuses.length === 1 ? statuses[0] : statuses;
    }

    if (req.query.module) {
      query.module = req.query.module as string;
    }

    if (req.query.tags) {
      query.tags = (req.query.tags as string).split(',');
    }

    if (req.query.search) {
      query.search = req.query.search as string;
    }

    if (req.query.limit) {
      query.limit = parseInt(req.query.limit as string, 10);
    }

    if (req.query.offset) {
      query.offset = parseInt(req.query.offset as string, 10);
    }

    if (req.query.sortBy) {
      query.sortBy = req.query.sortBy as ListDocumentsQuery['sortBy'];
    }

    if (req.query.sortOrder) {
      query.sortOrder = req.query.sortOrder as ListDocumentsQuery['sortOrder'];
    }

    const result = await service.listDocuments(query);

    res.json(result);
  } catch (error) {
    console.error('Error listing knowledge documents:', error);
    res.status(500).json({
      error: 'Failed to list documents',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/knowledge/doc/:id
 * Get a single document by ID
 */
knowledgeRouter.get('/doc/:id', async (req, res) => {
  try {
    const projectPath = req.query.projectPath as string;
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }

    const { id } = req.params;
    const service = getService(projectPath);
    const document = await service.getDocument(id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    console.error('Error getting document:', error);
    res.status(500).json({
      error: 'Failed to get document',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/knowledge/search
 * Full-text search across all documents
 */
knowledgeRouter.get('/search', async (req, res) => {
  try {
    const projectPath = req.query.projectPath as string;
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }

    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const service = getService(projectPath);
    const documents = await service.searchDocuments(query, limit);

    res.json({
      query,
      results: documents,
      total: documents.length,
    });
  } catch (error) {
    console.error('Error searching documents:', error);
    res.status(500).json({
      error: 'Failed to search documents',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/knowledge/stats
 * Get knowledge base statistics
 */
knowledgeRouter.get('/stats', async (req, res) => {
  try {
    const projectPath = req.query.projectPath as string;
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }

    const service = getService(projectPath);
    const stats = await service.getStats();

    res.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      error: 'Failed to get stats',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/knowledge/tree
 * Get tree structure for sidebar navigation
 */
knowledgeRouter.get('/tree', async (req, res) => {
  try {
    const projectPath = req.query.projectPath as string;
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }

    const service = getService(projectPath);
    const tree = await service.buildTree();

    res.json(tree);
  } catch (error) {
    console.error('Error building tree:', error);
    res.status(500).json({
      error: 'Failed to build tree',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/knowledge/context
 * Build context for Claude sessions
 */
knowledgeRouter.get('/context', async (req, res) => {
  try {
    const projectPath = req.query.projectPath as string;
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }

    const service = getService(projectPath);

    const options: Parameters<typeof service.buildContext>[0] = {};

    if (req.query.taskId) {
      options.taskId = req.query.taskId as string;
    }

    if (req.query.moduleId) {
      options.moduleId = req.query.moduleId as string;
    }

    if (req.query.documentIds) {
      options.documentIds = (req.query.documentIds as string).split(',');
    }

    if (req.query.types) {
      options.types = (req.query.types as string).split(',') as DocumentType[];
    }

    if (req.query.maxLength) {
      options.maxLength = parseInt(req.query.maxLength as string, 10);
    }

    if (req.query.format) {
      options.format = req.query.format as 'full' | 'summary' | 'titles';
    }

    const context = await service.buildContext(options);

    res.json(context);
  } catch (error) {
    console.error('Error building context:', error);
    res.status(500).json({
      error: 'Failed to build context',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/knowledge/types
 * List available document types with counts
 */
knowledgeRouter.get('/types', async (req, res) => {
  try {
    const projectPath = req.query.projectPath as string;
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }

    const service = getService(projectPath);
    const stats = await service.getStats();

    const types = Object.entries(stats.byType).map(([type, count]) => ({
      type,
      count,
      ...(DOCUMENT_TYPE_CONFIG[type as DocumentType] || {}),
    }));

    res.json(types);
  } catch (error) {
    console.error('Error listing types:', error);
    res.status(500).json({
      error: 'Failed to list types',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/knowledge/modules
 * List modules with document counts
 */
knowledgeRouter.get('/modules', async (req, res) => {
  try {
    const projectPath = req.query.projectPath as string;
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }

    const service = getService(projectPath);
    const stats = await service.getStats();

    const modules = Object.entries(stats.byModule).map(([module, count]) => ({
      id: module,
      documentCount: count,
    }));

    res.json(modules);
  } catch (error) {
    console.error('Error listing modules:', error);
    res.status(500).json({
      error: 'Failed to list modules',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/knowledge
 * Create a new knowledge document
 */
knowledgeRouter.post('/', async (req, res) => {
  try {
    const { projectPath, title, type, content, module, tags, status, owner, category, related, dependsOn } = req.body;

    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }
    if (!title || !type || content === undefined) {
      return res.status(400).json({ error: 'title, type, and content are required' });
    }

    const service = getService(projectPath);
    const input: CreateDocumentInput = { title, type, content, module, tags, status, owner, category, related, dependsOn };
    const doc = await service.createDocument(input);

    res.status(201).json(doc);
  } catch (error) {
    console.error('Error creating document:', error);
    const status = (error instanceof Error && error.message.includes('already exists')) ? 409 : 500;
    res.status(status).json({
      error: 'Failed to create document',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/knowledge/doc/:id
 * Update an existing knowledge document
 */
knowledgeRouter.put('/doc/:id', async (req, res) => {
  try {
    const projectPath = req.query.projectPath as string || req.body.projectPath;
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }

    const { id } = req.params;
    const { title, content, status, tags, module, owner, related, dependsOn } = req.body;

    const service = getService(projectPath);
    const updates: UpdateDocumentInput = {};
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (status !== undefined) updates.status = status;
    if (tags !== undefined) updates.tags = tags;
    if (module !== undefined) updates.module = module;
    if (owner !== undefined) updates.owner = owner;
    if (related !== undefined) updates.related = related;
    if (dependsOn !== undefined) updates.dependsOn = dependsOn;

    const doc = await service.updateDocument(id, updates);
    res.json(doc);
  } catch (error) {
    console.error('Error updating document:', error);
    const status = (error instanceof Error && error.message.includes('not found')) ? 404 : 500;
    res.status(status).json({
      error: 'Failed to update document',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/knowledge/doc/:id
 * Delete (archive) a knowledge document
 */
knowledgeRouter.delete('/doc/:id', async (req, res) => {
  try {
    const projectPath = req.query.projectPath as string;
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }

    const { id } = req.params;
    const archive = req.query.archive !== 'false'; // default true

    const service = getService(projectPath);
    await service.deleteDocument(id, archive);

    res.json({ success: true, action: archive ? 'archived' : 'deleted' });
  } catch (error) {
    console.error('Error deleting document:', error);
    const statusCode = (error instanceof Error && error.message.includes('not found')) ? 404 : 500;
    res.status(statusCode).json({
      error: 'Failed to delete document',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/knowledge/health
 * Run health checks on the knowledge base
 */
knowledgeRouter.get('/health', async (req, res) => {
  try {
    const projectPath = req.query.projectPath as string;
    if (!projectPath) {
      return res.status(400).json({ error: 'projectPath is required' });
    }

    const checks = req.query.checks ? (req.query.checks as string).split(',') : undefined;

    const service = getService(projectPath);
    const result = await service.healthCheck(checks);

    res.json(result);
  } catch (error) {
    console.error('Error running health check:', error);
    res.status(500).json({
      error: 'Failed to run health check',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/knowledge/cache/invalidate
 * Invalidate cache for a project
 */
knowledgeRouter.post('/cache/invalidate', async (req, res) => {
  try {
    const { projectPath } = req.body;

    if (projectPath) {
      const service = serviceCache.get(projectPath);
      if (service) {
        service.invalidateCache();
      }
      res.json({ success: true, message: `Cache invalidated for ${projectPath}` });
    } else {
      // Invalidate all
      for (const service of serviceCache.values()) {
        service.invalidateCache();
      }
      res.json({ success: true, message: 'All caches invalidated' });
    }
  } catch (error) {
    console.error('Error invalidating cache:', error);
    res.status(500).json({
      error: 'Failed to invalidate cache',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/knowledge/cache/stats
 * Get cache statistics
 */
knowledgeRouter.get('/cache/stats', async (_req, res) => {
  try {
    const stats = {
      cachedProjects: serviceCache.size,
      projects: Array.from(serviceCache.keys()),
    };

    res.json(stats);
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({
      error: 'Failed to get cache stats',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default knowledgeRouter;
