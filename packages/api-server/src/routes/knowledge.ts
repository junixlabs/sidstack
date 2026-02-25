/**
 * SidStack Knowledge API Routes
 *
 * REST API for the unified knowledge system.
 * Uses SidStackDB knowledge methods from @sidstack/shared for all operations.
 */

import { Router, type Request } from 'express';
import {
  getDB,
  detectWorkspace,
  DOCUMENT_TYPE_CONFIG,
  FOLDER_CONFIG,
  type DocumentType,
  type DocumentStatus,
  type KnowledgeTreeNode,
  type BuildContextOptions,
} from '@sidstack/shared';
import { emitSseEvent } from '../events';

export const knowledgeRouter: Router = Router();

// =============================================================================
// Helpers
// =============================================================================

/**
 * Resolve projectId from request.
 * Supports both `projectId` (direct) and `projectPath` (resolved via workspace detector).
 * When running on a remote server, workspace detection may fail — falls back to
 * DB lookup by path.
 */
async function resolveProjectId(req: Request): Promise<string> {
  const projectId = req.query.projectId as string || req.body?.projectId;
  if (projectId) return projectId;

  const projectPath = req.query.projectPath as string || req.body?.projectPath;
  if (!projectPath) throw new Error('projectId or projectPath is required');

  // Try local workspace detection first (works when API runs on same machine)
  try {
    const workspace = detectWorkspace(projectPath);
    if (workspace?.projectId) return workspace.projectId;
  } catch {
    // Workspace detection failed — fall through to DB lookup
  }

  // Fallback: look up project by path in the database
  const db = await getDB();
  const project = db.getProjectByPath(projectPath);
  if (project?.id) return project.id;

  throw new Error(`Cannot resolve projectId from path: ${projectPath}`);
}

/**
 * Generate a URL-friendly slug from a title.
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /api/knowledge
 * List all documents with optional filtering
 *
 * Query params:
 * - projectId or projectPath (required)
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
    const projectId = await resolveProjectId(req);
    const db = await getDB();

    const options: {
      type?: string | string[];
      status?: string | string[];
      module?: string;
      tags?: string[];
      search?: string;
      limit?: number;
      offset?: number;
      sortBy?: string;
      sortOrder?: string;
    } = {};

    if (req.query.type) {
      const types = (req.query.type as string).split(',');
      options.type = types.length === 1 ? types[0] : types;
    }

    if (req.query.status) {
      const statuses = (req.query.status as string).split(',');
      options.status = statuses.length === 1 ? statuses[0] : statuses;
    }

    if (req.query.module) {
      options.module = req.query.module as string;
    }

    if (req.query.tags) {
      options.tags = (req.query.tags as string).split(',');
    }

    if (req.query.search) {
      options.search = req.query.search as string;
    }

    if (req.query.limit) {
      options.limit = parseInt(req.query.limit as string, 10);
    }

    if (req.query.offset) {
      options.offset = parseInt(req.query.offset as string, 10);
    }

    if (req.query.sortBy) {
      options.sortBy = req.query.sortBy as string;
    }

    if (req.query.sortOrder) {
      options.sortOrder = req.query.sortOrder as string;
    }

    const result = db.listKnowledgeDocuments(projectId, options);

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
    const db = await getDB();
    const { id } = req.params;
    const document = db.getKnowledgeDocument(id);

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
    const projectId = await resolveProjectId(req);
    const db = await getDB();

    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const documents = db.searchKnowledgeDocuments(projectId, query, limit);

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
    const projectId = await resolveProjectId(req);
    const db = await getDB();
    const stats = db.getKnowledgeStats(projectId);

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
 * Groups documents by category (folder), then by type within each category.
 */
knowledgeRouter.get('/tree', async (req, res) => {
  try {
    const projectId = await resolveProjectId(req);
    const db = await getDB();

    // Get all documents for this project
    const { documents } = db.listKnowledgeDocuments(projectId, { limit: 10000 });

    // Build tree: group by category, then by type
    const categoryMap = new Map<string, typeof documents>();
    for (const doc of documents) {
      const category = doc.category || DOCUMENT_TYPE_CONFIG[doc.type as DocumentType]?.folder || 'uncategorized';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(doc);
    }

    // Build tree nodes from FOLDER_CONFIG order
    const tree: KnowledgeTreeNode[] = [];

    for (const folder of FOLDER_CONFIG) {
      const docs = categoryMap.get(folder.name) || [];
      categoryMap.delete(folder.name);

      const children: KnowledgeTreeNode[] = docs.map(doc => ({
        id: doc.id,
        name: doc.title,
        type: 'document' as const,
        path: `${folder.name}/${doc.slug}`,
        documentType: doc.type as DocumentType,
        status: doc.status as DocumentStatus,
      }));

      tree.push({
        id: folder.name,
        name: folder.title,
        type: 'folder',
        path: folder.name,
        children,
        documentCount: docs.length,
      });
    }

    // Add any remaining categories not in FOLDER_CONFIG
    for (const [category, docs] of categoryMap) {
      const children: KnowledgeTreeNode[] = docs.map(doc => ({
        id: doc.id,
        name: doc.title,
        type: 'document' as const,
        path: `${category}/${doc.slug}`,
        documentType: doc.type as DocumentType,
        status: doc.status as DocumentStatus,
      }));

      tree.push({
        id: category,
        name: category,
        type: 'folder',
        path: category,
        children,
        documentCount: docs.length,
      });
    }

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
    const projectId = await resolveProjectId(req);
    const db = await getDB();

    const options: BuildContextOptions = {};

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

    // Build context from DB documents
    const format = options.format || 'summary';
    const maxLength = options.maxLength || 8000;

    // Fetch relevant documents based on options
    let documents: any[] = [];

    if (options.documentIds && options.documentIds.length > 0) {
      // Fetch specific documents by ID
      for (const docId of options.documentIds) {
        const doc = db.getKnowledgeDocument(docId);
        if (doc) documents.push(doc);
      }
    } else {
      // Fetch by filters
      const queryOptions: { type?: string[]; module?: string; limit?: number } = { limit: 50 };
      if (options.types) {
        queryOptions.type = options.types;
      }
      if (options.moduleId) {
        queryOptions.module = options.moduleId;
      }
      const result = db.listKnowledgeDocuments(projectId, queryOptions);
      documents = result.documents;
    }

    // Build formatted context
    let totalCharacters = 0;
    const contextDocs: Array<{
      id: string;
      title: string;
      type: DocumentType;
      summary?: string;
      content?: string;
    }> = [];

    const promptParts: string[] = [];
    promptParts.push('# Knowledge Context\n');

    for (const doc of documents) {
      if (totalCharacters >= maxLength) break;

      const entry: typeof contextDocs[number] = {
        id: doc.id,
        title: doc.title,
        type: doc.type,
      };

      let section = `## ${doc.title} (${doc.type})\n`;

      if (format === 'titles') {
        section = `- ${doc.title} [${doc.type}]\n`;
      } else if (format === 'summary') {
        entry.summary = doc.summary || (doc.content ? doc.content.substring(0, 200) + '...' : '');
        section += `${entry.summary}\n\n`;
      } else {
        entry.content = doc.content;
        entry.summary = doc.summary;
        section += `${doc.content}\n\n`;
      }

      if (totalCharacters + section.length > maxLength) {
        // Truncate last section to fit
        const remaining = maxLength - totalCharacters;
        if (remaining > 50) {
          section = section.substring(0, remaining) + '\n...(truncated)';
          totalCharacters += section.length;
          promptParts.push(section);
          contextDocs.push(entry);
        }
        break;
      }

      totalCharacters += section.length;
      promptParts.push(section);
      contextDocs.push(entry);
    }

    res.json({
      documents: contextDocs,
      totalDocuments: documents.length,
      includedDocuments: contextDocs.length,
      totalCharacters,
      prompt: promptParts.join('\n'),
    });
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
    const projectId = await resolveProjectId(req);
    const db = await getDB();
    const stats = db.getKnowledgeStats(projectId);

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
    const projectId = await resolveProjectId(req);
    const db = await getDB();
    const stats = db.getKnowledgeStats(projectId);

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
    const projectId = await resolveProjectId(req);
    const db = await getDB();

    const { title, type, content, module, tags, status, owner, category, related, dependsOn, covers, summary } = req.body;

    if (!title || !type || content === undefined) {
      return res.status(400).json({ error: 'title, type, and content are required' });
    }

    const slug = slugify(title);

    // Check for duplicate slug
    const existing = db.getKnowledgeDocumentBySlug(projectId, slug);
    if (existing) {
      return res.status(409).json({
        error: 'Failed to create document',
        details: `Document with slug "${slug}" already exists`,
      });
    }

    const doc = db.createKnowledgeDocument({
      projectId,
      slug,
      title,
      type,
      content,
      status,
      summary,
      module,
      tags,
      category: category || DOCUMENT_TYPE_CONFIG[type as DocumentType]?.folder,
      owner,
      related,
      dependsOn,
      covers,
    });

    emitSseEvent({
      type: 'knowledge_created',
      projectId,
      entityId: doc.id,
      title: doc.title,
      summary: `New ${type} document created`,
      timestamp: Date.now(),
    });

    res.status(201).json(doc);
  } catch (error) {
    console.error('Error creating document:', error);
    const statusCode = (error instanceof Error && error.message.includes('already exists')) ? 409 : 500;
    res.status(statusCode).json({
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
    const db = await getDB();
    const { id } = req.params;
    const { title, content, status, tags, module, owner, related, dependsOn, covers, summary, category } = req.body;

    const updates: {
      title?: string;
      content?: string;
      status?: string;
      summary?: string;
      module?: string;
      tags?: string[];
      category?: string;
      owner?: string;
      related?: string[];
      dependsOn?: string[];
      covers?: string[];
    } = {};

    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (status !== undefined) updates.status = status;
    if (summary !== undefined) updates.summary = summary;
    if (tags !== undefined) updates.tags = tags;
    if (module !== undefined) updates.module = module;
    if (owner !== undefined) updates.owner = owner;
    if (category !== undefined) updates.category = category;
    if (related !== undefined) updates.related = related;
    if (dependsOn !== undefined) updates.dependsOn = dependsOn;
    if (covers !== undefined) updates.covers = covers;

    const doc = db.updateKnowledgeDocument(id, updates);

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    emitSseEvent({
      type: 'knowledge_updated',
      projectId: doc.projectId,
      entityId: doc.id,
      title: doc.title,
      summary: 'Knowledge document updated',
      timestamp: Date.now(),
    });

    res.json(doc);
  } catch (error) {
    console.error('Error updating document:', error);
    const statusCode = (error instanceof Error && error.message.includes('not found')) ? 404 : 500;
    res.status(statusCode).json({
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
    const db = await getDB();
    const { id } = req.params;
    const archive = req.query.archive !== 'false'; // default true

    // Get doc info before deleting for the event
    const docBeforeDelete = db.getKnowledgeDocument(id);

    const success = db.deleteKnowledgeDocument(id, archive);

    if (!success) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (docBeforeDelete) {
      emitSseEvent({
        type: 'knowledge_deleted',
        projectId: docBeforeDelete.projectId,
        entityId: id,
        title: docBeforeDelete.title,
        summary: archive ? 'Knowledge document archived' : 'Knowledge document deleted',
        timestamp: Date.now(),
      });
    }

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
 * Basic health check on the knowledge base
 */
knowledgeRouter.get('/health', async (req, res) => {
  try {
    const projectId = await resolveProjectId(req);
    const db = await getDB();
    const stats = db.getKnowledgeStats(projectId);

    const issues: Array<{ severity: string; category: string; message: string }> = [];

    if (stats.needsReview.length > 0) {
      for (const doc of stats.needsReview) {
        issues.push({
          severity: 'warning',
          category: 'overdue-review',
          message: `Document "${doc.title}" needs review`,
        });
      }
    }

    res.json({
      totalDocuments: stats.totalDocuments,
      issues,
      summary: {
        errors: issues.filter(i => i.severity === 'error').length,
        warnings: issues.filter(i => i.severity === 'warning').length,
        info: issues.filter(i => i.severity === 'info').length,
      },
    });
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
 * No-op (no filesystem cache with DB backend)
 */
knowledgeRouter.post('/cache/invalidate', async (_req, res) => {
  res.json({ success: true, message: 'No-op: database backend has no cache to invalidate' });
});

/**
 * GET /api/knowledge/cache/stats
 * Return empty stats (no filesystem cache with DB backend)
 */
knowledgeRouter.get('/cache/stats', async (_req, res) => {
  res.json({
    cachedProjects: 0,
    projects: [],
  });
});

export default knowledgeRouter;
