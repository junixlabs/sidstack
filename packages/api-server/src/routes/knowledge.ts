/**
 * SidStack Knowledge API Routes
 *
 * REST API for the unified knowledge system.
 * Uses async repository pattern from @sidstack/shared for all operations.
 */

import { Router, type Request } from 'express';
import {
  getRepository,
  detectWorkspace,
  DOCUMENT_TYPE_CONFIG,
  FOLDER_CONFIG,
  TYPE_GROUPS,
  getTypeGroup,
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
  const repo = await getRepository();
  const project = await repo.projects.getByPath(projectPath);
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
    const repo = await getRepository();

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

    const result = await repo.knowledge.list(projectId, options);

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
    const repo = await getRepository();
    const { id } = req.params;
    const document = await repo.knowledge.get(id);

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
    const repo = await getRepository();

    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const documents = await repo.knowledge.search(projectId, query, limit);

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
    const repo = await getRepository();
    const stats = await repo.knowledge.getStats(projectId);

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
 * Get tree structure for sidebar navigation.
 *
 * Module-first organization:
 *   Level 1: Module (or "Project-level" for docs without module)
 *   Level 2: Type group (Guides, References, Decisions, Governance)
 *   Level 3: Documents
 *
 * Query params:
 *   ?view=folders — legacy folder-first view (backward compat)
 */
knowledgeRouter.get('/tree', async (req, res) => {
  try {
    const projectId = await resolveProjectId(req);
    const repo = await getRepository();
    const view = req.query.view as string | undefined;

    const { documents } = await repo.knowledge.list(projectId, { limit: 10000 });

    // Legacy folder-first view
    if (view === 'folders') {
      const categoryMap = new Map<string, typeof documents>();
      for (const doc of documents) {
        const category = doc.category || DOCUMENT_TYPE_CONFIG[doc.type as DocumentType]?.folder || 'uncategorized';
        if (!categoryMap.has(category)) categoryMap.set(category, []);
        categoryMap.get(category)!.push(doc);
      }
      const tree: KnowledgeTreeNode[] = [];
      for (const folder of FOLDER_CONFIG) {
        const docs = categoryMap.get(folder.name) || [];
        categoryMap.delete(folder.name);
        tree.push({
          id: folder.name, name: folder.title, type: 'folder', path: folder.name,
          children: docs.map(doc => ({
            id: doc.id, name: doc.title, type: 'document' as const,
            path: `${folder.name}/${doc.slug}`,
            documentType: doc.type as DocumentType, status: doc.status as DocumentStatus,
          })),
          documentCount: docs.length,
        });
      }
      for (const [category, docs] of categoryMap) {
        tree.push({
          id: category, name: category, type: 'folder', path: category,
          children: docs.map(doc => ({
            id: doc.id, name: doc.title, type: 'document' as const,
            path: `${category}/${doc.slug}`,
            documentType: doc.type as DocumentType, status: doc.status as DocumentStatus,
          })),
          documentCount: docs.length,
        });
      }
      return res.json(tree);
    }

    // Module-first tree (default)
    const moduleMap = new Map<string, typeof documents>(); // moduleId → docs
    const moduleDocs = new Map<string, any>(); // moduleId → module definition doc

    for (const doc of documents) {
      const moduleId = doc.module || '_project';

      // Track module definition docs
      if (doc.type === 'module') {
        moduleDocs.set(doc.module || doc.id, doc);
      }

      if (!moduleMap.has(moduleId)) moduleMap.set(moduleId, []);
      moduleMap.get(moduleId)!.push(doc);
    }

    const tree: KnowledgeTreeNode[] = [];

    // Sort: named modules first (alphabetical), then _project
    const sortedModuleIds = [...moduleMap.keys()].sort((a, b) => {
      if (a === '_project') return 1;
      if (b === '_project') return -1;
      return a.localeCompare(b);
    });

    for (const moduleId of sortedModuleIds) {
      const docs = moduleMap.get(moduleId)!;
      const modDoc = moduleDocs.get(moduleId);
      const moduleName = moduleId === '_project'
        ? 'Project-level'
        : (modDoc?.title || moduleId);

      // Group docs by type group
      const groupedDocs = new Map<string, typeof docs>();
      for (const doc of docs) {
        if (doc.type === 'module') continue; // Module def shown as module header
        const group = getTypeGroup(doc.type as DocumentType) || 'references';
        if (!groupedDocs.has(group)) groupedDocs.set(group, []);
        groupedDocs.get(group)!.push(doc);
      }

      // Build type group children
      const typeGroupNodes: KnowledgeTreeNode[] = [];
      const groupOrder = ['guides', 'references', 'decisions', 'governance'];
      for (const groupKey of groupOrder) {
        const groupDocs = groupedDocs.get(groupKey);
        if (!groupDocs || groupDocs.length === 0) continue;

        const groupConfig = TYPE_GROUPS[groupKey];
        typeGroupNodes.push({
          id: `${moduleId}/${groupKey}`,
          name: groupConfig.label,
          type: 'folder',
          path: `${moduleId}/${groupKey}`,
          children: groupDocs.map(doc => ({
            id: doc.id,
            name: doc.title,
            type: 'document' as const,
            path: `${moduleId}/${groupKey}/${doc.slug}`,
            documentType: doc.type as DocumentType,
            status: doc.status as DocumentStatus,
          })),
          documentCount: groupDocs.length,
        });
      }

      const totalDocs = docs.filter(d => d.type !== 'module').length;
      tree.push({
        id: moduleId === '_project' ? '_project' : `module:${moduleId}`,
        name: moduleName,
        type: 'folder',
        path: moduleId,
        children: typeGroupNodes,
        documentCount: totalDocs,
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
    const repo = await getRepository();

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
        const doc = await repo.knowledge.get(docId);
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
      const result = await repo.knowledge.list(projectId, queryOptions);
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
    const repo = await getRepository();
    const stats = await repo.knowledge.getStats(projectId);

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
 * List modules with enriched details: doc counts by type, health score, dependencies
 */
knowledgeRouter.get('/modules', async (req, res) => {
  try {
    const projectId = await resolveProjectId(req);
    const repo = await getRepository();
    const modules = await repo.knowledge.getModulesWithDetails(projectId);

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
 * GET /api/knowledge/modules/:moduleId/overview
 * Full module overview: definition + all docs + dependencies + health
 */
knowledgeRouter.get('/modules/:moduleId/overview', async (req, res) => {
  try {
    const projectId = await resolveProjectId(req);
    const repo = await getRepository();
    const overview = await repo.knowledge.getModuleOverview(projectId, req.params.moduleId);

    if (!overview) {
      return res.status(404).json({ error: 'Module not found' });
    }

    res.json(overview);
  } catch (error) {
    console.error('Error getting module overview:', error);
    res.status(500).json({
      error: 'Failed to get module overview',
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
    const repo = await getRepository();

    const { title, type, content, module, tags, status, owner, category, related, dependsOn, covers, summary } = req.body;

    if (!title || !type || content === undefined) {
      return res.status(400).json({ error: 'title, type, and content are required' });
    }

    const slug = slugify(title);

    // Check for duplicate slug
    const existing = await repo.knowledge.getBySlug(projectId, slug);
    if (existing) {
      return res.status(409).json({
        error: 'Failed to create document',
        details: `Document with slug "${slug}" already exists`,
      });
    }

    const doc = await repo.knowledge.create({
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
    const repo = await getRepository();
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

    const doc = await repo.knowledge.update(id, updates);

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    emitSseEvent({
      type: 'knowledge_updated',
      projectId: (doc as any).projectId,
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
    const repo = await getRepository();
    const { id } = req.params;
    const archive = req.query.archive !== 'false'; // default true

    // Get doc info before deleting for the event
    const docBeforeDelete = await repo.knowledge.get(id);

    const success = await repo.knowledge.delete(id, archive);

    if (!success) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (docBeforeDelete) {
      emitSseEvent({
        type: 'knowledge_deleted',
        projectId: (docBeforeDelete as any).projectId,
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
    const repo = await getRepository();
    const stats = await repo.knowledge.getStats(projectId);

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
