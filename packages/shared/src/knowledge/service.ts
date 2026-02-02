/**
 * SidStack Knowledge System - Knowledge Service
 *
 * Main service for managing knowledge documents.
 * Provides CRUD operations, search, and context building.
 */

import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';

import type {
  KnowledgeDocument,
  ScoredDocument,
  DocumentType,
  DocumentStatus,
  DocumentSource,
  ListDocumentsQuery,
  ListDocumentsResponse,
  BuildContextOptions,
  KnowledgeContext,
  KnowledgeStats,
  KnowledgeTreeNode,
  CreateDocumentInput,
  UpdateDocumentInput,
  HealthCheckResult,
  HealthIssue,
} from './types';
import { DOCUMENT_TYPE_CONFIG } from './types';
import { AdapterRegistry, defaultAdapterRegistry } from './adapters';
import {
  serializeFrontmatter,
  generateDocumentFrontmatter,
  generateSlug,
  isValidDocumentType,
  parseFrontmatter,
} from './parser';

// =============================================================================
// Knowledge Service
// =============================================================================

export class KnowledgeService {
  private basePath: string;
  private adapterRegistry: AdapterRegistry;
  private cache: Map<string, KnowledgeDocument[]> = new Map();
  private cacheTimestamp: number = 0;
  private cacheTTL: number = 60000; // 60 seconds

  constructor(basePath: string, adapterRegistry?: AdapterRegistry) {
    this.basePath = basePath;
    this.adapterRegistry = adapterRegistry || defaultAdapterRegistry;
  }

  // ===========================================================================
  // Document Loading
  // ===========================================================================

  /**
   * Load all documents from all available sources
   */
  async loadDocuments(forceRefresh = false): Promise<KnowledgeDocument[]> {
    const cacheKey = this.basePath;
    const now = Date.now();

    // Check cache
    if (!forceRefresh && this.cache.has(cacheKey) && (now - this.cacheTimestamp) < this.cacheTTL) {
      return this.cache.get(cacheKey)!;
    }

    // Load from adapters
    const documents = await this.adapterRegistry.loadAllDocuments(this.basePath);

    // Sort by updatedAt desc
    documents.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    // Update cache
    this.cache.set(cacheKey, documents);
    this.cacheTimestamp = now;

    return documents;
  }

  /**
   * Get a single document by ID
   */
  async getDocument(id: string): Promise<KnowledgeDocument | null> {
    const documents = await this.loadDocuments();
    return documents.find(d => d.id === id) || null;
  }

  /**
   * Get a single document by slug
   */
  async getDocumentBySlug(slug: string): Promise<KnowledgeDocument | null> {
    const documents = await this.loadDocuments();
    return documents.find(d => d.slug === slug) || null;
  }

  // ===========================================================================
  // Querying
  // ===========================================================================

  /**
   * List documents with filtering and pagination
   */
  async listDocuments(query: ListDocumentsQuery = {}): Promise<ListDocumentsResponse> {
    let documents = await this.loadDocuments();

    // Apply filters
    documents = this.applyFilters(documents, query);

    // Apply sorting
    documents = this.applySorting(documents, query);

    // Get total before pagination
    const total = documents.length;

    // Apply pagination
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    documents = documents.slice(offset, offset + limit);

    return {
      documents,
      total,
      limit,
      offset,
    };
  }

  /**
   * Search documents by text query.
   * Supports multi-word queries (each term scored independently).
   * Scoring: title (10+5) > module (6) > id/slug (5) > type (4) > tags (3) > summary (2) > content (1)
   */
  async searchDocuments(searchQuery: string, limit = 20): Promise<ScoredDocument[]> {
    const documents = await this.loadDocuments();
    const terms = searchQuery.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    if (terms.length === 0) return [];

    const fullQuery = searchQuery.toLowerCase();

    const scored = documents.map(doc => {
      let score = 0;
      const titleLower = doc.title.toLowerCase();
      const idLower = doc.id.toLowerCase();
      const slugLower = doc.slug.toLowerCase();
      const moduleLower = (doc.module || '').toLowerCase();
      const typeLower = doc.type.toLowerCase();
      const summaryLower = (doc.summary || '').toLowerCase();
      const tagsLower = doc.tags.map(t => t.toLowerCase());

      // Full query match bonuses (exact phrase)
      if (titleLower.includes(fullQuery)) {
        score += 10;
        if (titleLower.startsWith(fullQuery)) score += 5;
      }
      if (idLower.includes(fullQuery) || slugLower.includes(fullQuery)) score += 5;
      if (moduleLower === fullQuery) score += 6;
      if (typeLower === fullQuery) score += 4;

      // Per-term scoring (for multi-word queries)
      for (const term of terms) {
        if (titleLower.includes(term)) score += 3;
        if (moduleLower.includes(term)) score += 2;
        if (tagsLower.some(t => t.includes(term))) score += 2;
        if (typeLower.includes(term)) score += 1;
        if (summaryLower.includes(term)) score += 1;
        if (doc.content.toLowerCase().includes(term)) score += 0.5;
      }

      return { ...doc, _score: score } as ScoredDocument;
    });

    return scored
      .filter(s => s._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, limit);
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  /**
   * Get knowledge base statistics
   */
  async getStats(): Promise<KnowledgeStats> {
    const documents = await this.loadDocuments();

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const byModule: Record<string, number> = {};

    for (const doc of documents) {
      byType[doc.type] = (byType[doc.type] || 0) + 1;
      byStatus[doc.status] = (byStatus[doc.status] || 0) + 1;
      bySource[doc.source] = (bySource[doc.source] || 0) + 1;
      if (doc.module) {
        byModule[doc.module] = (byModule[doc.module] || 0) + 1;
      }
    }

    // Recently updated (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const recentlyUpdated = documents
      .filter(d => new Date(d.updatedAt) > oneWeekAgo)
      .slice(0, 10);

    // Needs review (has reviewDate in the past)
    const now = new Date();
    const needsReview = documents
      .filter(d => d.reviewDate && new Date(d.reviewDate) < now)
      .slice(0, 10);

    return {
      totalDocuments: documents.length,
      byType: byType as Record<DocumentType, number>,
      byStatus: byStatus as Record<DocumentStatus, number>,
      bySource: bySource as Record<DocumentSource, number>,
      byModule,
      recentlyUpdated,
      needsReview,
    };
  }

  // ===========================================================================
  // Tree Structure
  // ===========================================================================

  /**
   * Build tree structure for sidebar navigation
   */
  async buildTree(): Promise<KnowledgeTreeNode[]> {
    const documents = await this.loadDocuments();
    const tree: KnowledgeTreeNode[] = [];

    // Group by category/folder
    const byCategory = new Map<string, KnowledgeDocument[]>();
    for (const doc of documents) {
      const category = doc.category || 'uncategorized';
      const existing = byCategory.get(category) || [];
      byCategory.set(category, [...existing, doc]);
    }

    // Build tree nodes
    for (const [category, docs] of byCategory) {
      const parts = category.split('/').filter(Boolean);
      let currentLevel = tree;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const currentPath = parts.slice(0, i + 1).join('/');

        let node = currentLevel.find(n => n.path === currentPath);
        if (!node) {
          node = {
            id: currentPath,
            name: this.formatFolderName(part),
            type: 'folder',
            path: currentPath,
            children: [],
            documentCount: 0,
          };
          currentLevel.push(node);
        }

        // If this is the last part, add documents
        if (i === parts.length - 1) {
          node.documentCount = docs.length;
          for (const doc of docs) {
            node.children!.push({
              id: doc.id,
              name: doc.title,
              type: 'document',
              path: doc.sourcePath,
              documentType: doc.type,
              status: doc.status,
            });
          }
        }

        currentLevel = node.children!;
      }
    }

    // Sort tree
    this.sortTree(tree);

    return tree;
  }

  // ===========================================================================
  // Context Building
  // ===========================================================================

  /**
   * Build context for Claude sessions
   */
  async buildContext(options: BuildContextOptions = {}): Promise<KnowledgeContext> {
    let documents = await this.loadDocuments();
    const maxLength = options.maxLength || 50000;

    // Filter by criteria
    if (options.documentIds?.length) {
      documents = documents.filter(d => options.documentIds!.includes(d.id));
    }
    if (options.types?.length) {
      documents = documents.filter(d => options.types!.includes(d.type));
    }
    if (options.moduleId) {
      documents = documents.filter(d => d.module === options.moduleId);
    }

    // If task context, get related documents
    if (options.taskId) {
      // TODO: Integrate with task system to get related docs
    }

    // Prioritize by relevance
    // Active > Draft > Review > Archived
    // Spec > Decision > Guide > Reference > Others
    documents.sort((a, b) => {
      const statusOrder = { active: 0, draft: 1, review: 2, archived: 3 };
      const typeOrder = { spec: 0, decision: 1, guide: 2, reference: 3 };

      const statusDiff = (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
      if (statusDiff !== 0) return statusDiff;

      return (typeOrder[a.type as keyof typeof typeOrder] || 5) -
             (typeOrder[b.type as keyof typeof typeOrder] || 5);
    });

    // Build context within max length
    const included: KnowledgeContext['documents'] = [];
    let totalChars = 0;

    for (const doc of documents) {
      const docContent = options.format === 'full'
        ? doc.content
        : options.format === 'summary'
          ? doc.summary || ''
          : '';

      const docChars = doc.title.length + (doc.summary?.length || 0) + docContent.length;

      if (totalChars + docChars > maxLength) {
        break;
      }

      included.push({
        id: doc.id,
        title: doc.title,
        type: doc.type,
        summary: doc.summary,
        content: options.format === 'full' ? doc.content : undefined,
      });

      totalChars += docChars;
    }

    // Build prompt
    const prompt = this.buildPrompt(included, options);

    return {
      documents: included,
      totalDocuments: documents.length,
      includedDocuments: included.length,
      totalCharacters: totalChars,
      prompt,
    };
  }

  // ===========================================================================
  // Document CRUD
  // ===========================================================================

  /**
   * Create a new knowledge document
   */
  async createDocument(input: CreateDocumentInput): Promise<KnowledgeDocument> {
    // Validate type
    if (!isValidDocumentType(input.type)) {
      throw new Error(`Invalid document type: ${input.type}`);
    }

    // Generate slug from title
    const slug = generateSlug(input.title);

    // Determine target folder
    const typeConfig = DOCUMENT_TYPE_CONFIG[input.type];
    const folder = input.category || typeConfig?.folder || input.type;
    const targetDir = path.join(this.basePath, '.sidstack', 'knowledge', folder);

    // Create directory if not exists
    await fsp.mkdir(targetDir, { recursive: true });

    // Generate filename
    const filePath = path.join(targetDir, `${slug}.md`);

    // Check if file already exists
    if (fs.existsSync(filePath)) {
      throw new Error(`Document already exists: ${slug}`);
    }

    // Generate frontmatter
    const frontmatter = generateDocumentFrontmatter({
      title: input.title,
      type: input.type,
      status: input.status,
      module: input.module,
      tags: input.tags,
      owner: input.owner,
      related: input.related,
      dependsOn: input.dependsOn,
    });

    // Serialize and write
    const fileContent = serializeFrontmatter(frontmatter, input.content);
    await fsp.writeFile(filePath, fileContent, 'utf-8');

    // Invalidate cache and reload
    this.invalidateCache();

    // Return the document by loading it fresh
    const doc = await this.getDocument(frontmatter.id!);
    if (!doc) {
      throw new Error('Failed to load created document');
    }
    return doc;
  }

  /**
   * Update an existing knowledge document
   */
  async updateDocument(docId: string, updates: UpdateDocumentInput): Promise<KnowledgeDocument> {
    const doc = await this.getDocument(docId);
    if (!doc) {
      throw new Error(`Document not found: ${docId}`);
    }

    // Read the raw file
    const rawContent = await fsp.readFile(doc.absolutePath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(rawContent);

    // Merge updates into frontmatter
    if (updates.title !== undefined) frontmatter.title = updates.title;
    if (updates.status !== undefined) frontmatter.status = updates.status;
    if (updates.tags !== undefined) frontmatter.tags = updates.tags;
    if (updates.module !== undefined) frontmatter.module = updates.module;
    if (updates.owner !== undefined) frontmatter.owner = updates.owner;
    if (updates.related !== undefined) frontmatter.related = updates.related;
    if (updates.dependsOn !== undefined) frontmatter.dependsOn = updates.dependsOn;

    // Update timestamp
    frontmatter.updatedAt = new Date().toISOString();

    // Use updated content or keep existing body
    const newBody = updates.content !== undefined ? updates.content : body;

    // Serialize and write back
    const fileContent = serializeFrontmatter(frontmatter, newBody);
    await fsp.writeFile(doc.absolutePath, fileContent, 'utf-8');

    // Invalidate cache and reload
    this.invalidateCache();

    const updated = await this.getDocument(docId);
    if (!updated) {
      throw new Error('Failed to load updated document');
    }
    return updated;
  }

  /**
   * Delete or archive a knowledge document
   */
  async deleteDocument(docId: string, archive = true): Promise<void> {
    const doc = await this.getDocument(docId);
    if (!doc) {
      throw new Error(`Document not found: ${docId}`);
    }

    if (archive) {
      // Move to archive folder
      const archiveDir = path.join(this.basePath, '.sidstack', '.archive');
      await fsp.mkdir(archiveDir, { recursive: true });

      const filename = path.basename(doc.absolutePath);
      const archivePath = path.join(archiveDir, filename);
      await fsp.rename(doc.absolutePath, archivePath);
    } else {
      // Delete file
      await fsp.unlink(doc.absolutePath);
    }

    this.invalidateCache();
  }

  // ===========================================================================
  // Health Check
  // ===========================================================================

  /**
   * Run health checks on the knowledge base
   */
  async healthCheck(checks?: string[]): Promise<HealthCheckResult> {
    const documents = await this.loadDocuments();
    const issues: HealthIssue[] = [];

    const shouldRun = (check: string) => !checks || checks.length === 0 || checks.includes(check);

    // Stale check: docs not updated in 90+ days
    if (shouldRun('stale')) {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      for (const doc of documents) {
        if (new Date(doc.updatedAt) < ninetyDaysAgo) {
          issues.push({
            severity: 'warning',
            category: 'stale',
            docId: doc.id,
            docTitle: doc.title,
            message: `Not updated since ${doc.updatedAt.split('T')[0]}`,
          });
        }
      }
    }

    // Missing metadata check
    if (shouldRun('missing-metadata')) {
      for (const doc of documents) {
        if (!doc.title) {
          issues.push({ severity: 'error', category: 'missing-metadata', docId: doc.id, docTitle: doc.id, message: 'Missing title' });
        }
        if (!doc.type) {
          issues.push({ severity: 'error', category: 'missing-metadata', docId: doc.id, docTitle: doc.title, message: 'Missing type' });
        }
        if (!doc.status) {
          issues.push({ severity: 'error', category: 'missing-metadata', docId: doc.id, docTitle: doc.title, message: 'Missing status' });
        }
      }
    }

    // Broken links check
    if (shouldRun('broken-link')) {
      const docIds = new Set(documents.map(d => d.id));

      for (const doc of documents) {
        for (const ref of doc.related || []) {
          if (!docIds.has(ref)) {
            issues.push({ severity: 'error', category: 'broken-link', docId: doc.id, docTitle: doc.title, message: `Related doc not found: ${ref}` });
          }
        }
        for (const ref of doc.dependsOn || []) {
          if (!docIds.has(ref)) {
            issues.push({ severity: 'error', category: 'broken-link', docId: doc.id, docTitle: doc.title, message: `Dependency not found: ${ref}` });
          }
        }
      }
    }

    // Orphaned check: docs with no module and not referenced
    if (shouldRun('orphaned')) {
      const referencedIds = new Set<string>();
      for (const doc of documents) {
        for (const ref of doc.related || []) referencedIds.add(ref);
        for (const ref of doc.dependsOn || []) referencedIds.add(ref);
      }

      for (const doc of documents) {
        if (!doc.module && !referencedIds.has(doc.id) && doc.type !== 'index' && doc.type !== 'module') {
          issues.push({ severity: 'info', category: 'orphaned', docId: doc.id, docTitle: doc.title, message: 'No module and not referenced by any other doc' });
        }
      }
    }

    // Overdue review check
    if (shouldRun('overdue-review')) {
      const now = new Date();
      for (const doc of documents) {
        if (doc.reviewDate && new Date(doc.reviewDate) < now) {
          issues.push({ severity: 'warning', category: 'overdue-review', docId: doc.id, docTitle: doc.title, message: `Review overdue since ${doc.reviewDate}` });
        }
      }
    }

    // Summary
    const summary = {
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
      info: issues.filter(i => i.severity === 'info').length,
    };

    return { totalDocuments: documents.length, issues, summary };
  }

  // ===========================================================================
  // Cache Management
  // ===========================================================================

  /**
   * Invalidate cache
   */
  invalidateCache(): void {
    this.cache.clear();
    this.cacheTimestamp = 0;
  }

  /**
   * Set cache TTL
   */
  setCacheTTL(ttlMs: number): void {
    this.cacheTTL = ttlMs;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private applyFilters(
    documents: KnowledgeDocument[],
    query: ListDocumentsQuery
  ): KnowledgeDocument[] {
    let result = documents;

    // Type filter
    if (query.type) {
      const types = Array.isArray(query.type) ? query.type : [query.type];
      result = result.filter(d => types.includes(d.type));
    }

    // Status filter
    if (query.status) {
      const statuses = Array.isArray(query.status) ? query.status : [query.status];
      result = result.filter(d => statuses.includes(d.status));
    }

    // Module filter
    if (query.module) {
      result = result.filter(d => d.module === query.module);
    }

    // Tags filter
    if (query.tags?.length) {
      result = result.filter(d =>
        query.tags!.some(tag => d.tags.includes(tag))
      );
    }

    // Source filter
    if (query.source) {
      result = result.filter(d => d.source === query.source);
    }

    // Search filter
    if (query.search) {
      const search = query.search.toLowerCase();
      result = result.filter(d =>
        d.title.toLowerCase().includes(search) ||
        d.id.toLowerCase().includes(search) ||
        d.summary?.toLowerCase().includes(search) ||
        d.tags.some(t => t.toLowerCase().includes(search))
      );
    }

    return result;
  }

  private applySorting(
    documents: KnowledgeDocument[],
    query: ListDocumentsQuery
  ): KnowledgeDocument[] {
    const sortBy = query.sortBy || 'updatedAt';
    const sortOrder = query.sortOrder || 'desc';
    const multiplier = sortOrder === 'asc' ? 1 : -1;

    return [...documents].sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return multiplier * a.title.localeCompare(b.title);
        case 'createdAt':
          return multiplier * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        case 'type':
          return multiplier * a.type.localeCompare(b.type);
        case 'updatedAt':
        default:
          return multiplier * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
      }
    });
  }

  private sortTree(nodes: KnowledgeTreeNode[]): void {
    // Sort folders first, then documents
    nodes.sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });

    // Recursively sort children
    for (const node of nodes) {
      if (node.children?.length) {
        this.sortTree(node.children);
      }
    }
  }

  private formatFolderName(name: string): string {
    // Check if it's a known type folder
    for (const [, config] of Object.entries(DOCUMENT_TYPE_CONFIG)) {
      if (config.folder === name) {
        return config.label + 's'; // Pluralize
      }
    }

    // Default formatting
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private buildPrompt(
    documents: KnowledgeContext['documents'],
    options: BuildContextOptions
  ): string {
    if (documents.length === 0) {
      return 'No relevant knowledge documents found.';
    }

    const lines: string[] = [
      '# Project Knowledge Context',
      '',
    ];

    if (options.moduleId) {
      lines.push(`Module: ${options.moduleId}`);
      lines.push('');
    }

    lines.push(`${documents.length} relevant documents:`);
    lines.push('');

    for (const doc of documents) {
      lines.push(`## ${doc.title}`);
      lines.push(`Type: ${doc.type}`);
      if (doc.summary) {
        lines.push(`Summary: ${doc.summary}`);
      }
      if (doc.content) {
        lines.push('');
        lines.push(doc.content);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a knowledge service instance
 */
export function createKnowledgeService(basePath: string): KnowledgeService {
  return new KnowledgeService(basePath);
}
