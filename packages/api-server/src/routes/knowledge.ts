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
