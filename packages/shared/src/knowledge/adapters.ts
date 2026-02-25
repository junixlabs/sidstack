/**
 * SidStack Knowledge System - Source Adapters
 *
 * Adapter pattern for loading documents from different sources.
 * Each adapter normalizes its source format to KnowledgeDocument.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  KnowledgeDocument,
  DocumentType,
  DocumentSource,
  DocumentFrontmatter,
} from './types';
import { DOCUMENT_TYPE_CONFIG } from './types';
import {
  parseFrontmatter,
  extractTitle,
  extractSummary,
  countWords,
  estimateReadingTime,
  generateIdFromPath,
  generateSlug,
  isValidDocumentType,
} from './parser';

// =============================================================================
// Adapter Interface
// =============================================================================

/**
 * Interface for knowledge source adapters
 */
export interface KnowledgeAdapter {
  /** Adapter source type */
  source: DocumentSource;

  /** Check if adapter can handle a path */
  canHandle(basePath: string): boolean;

  /** Load all documents from the source */
  loadDocuments(basePath: string): Promise<KnowledgeDocument[]>;

  /** Load a single document by path */
  loadDocument(filePath: string, basePath: string): Promise<KnowledgeDocument | null>;
}

// =============================================================================
// SidStack Adapter
// =============================================================================

/**
 * Adapter for .sidstack/knowledge/ folder
 * This is the primary/recommended format
 */
export class SidStackAdapter implements KnowledgeAdapter {
  source: DocumentSource = 'sidstack';

  canHandle(basePath: string): boolean {
    const knowledgePath = path.join(basePath, '.sidstack', 'knowledge');
    return fs.existsSync(knowledgePath);
  }

  async loadDocuments(basePath: string): Promise<KnowledgeDocument[]> {
    const knowledgePath = path.join(basePath, '.sidstack', 'knowledge');
    if (!fs.existsSync(knowledgePath)) {
      return [];
    }

    const documents: KnowledgeDocument[] = [];
    await this.scanDirectory(knowledgePath, basePath, documents);
    return documents;
  }

  async loadDocument(filePath: string, basePath: string): Promise<KnowledgeDocument | null> {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parseDocument(filePath, content, basePath);
  }

  private async scanDirectory(
    dirPath: string,
    basePath: string,
    documents: KnowledgeDocument[]
  ): Promise<void> {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories
        if (!entry.name.startsWith('.')) {
          await this.scanDirectory(fullPath, basePath, documents);
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        // Skip index files for now (they're special)
        if (entry.name === '_index.md') continue;

        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const doc = this.parseDocument(fullPath, content, basePath);
          if (doc) {
            documents.push(doc);
          }
        } catch (error) {
          console.error(`Error parsing ${fullPath}:`, error);
        }
      }
    }
  }

  private parseDocument(
    filePath: string,
    content: string,
    basePath: string
  ): KnowledgeDocument | null {
    const { frontmatter, body } = parseFrontmatter(content);

    // Get relative path from knowledge folder
    const knowledgePath = path.join(basePath, '.sidstack', 'knowledge');
    const relativePath = path.relative(knowledgePath, filePath);

    // Infer type from folder structure if not specified
    const type = this.inferType(frontmatter, relativePath);

    // Extract or use frontmatter values
    const title = frontmatter.title || extractTitle(body) || path.basename(filePath, '.md');
    const id = frontmatter.id || generateIdFromPath(filePath);
    const slug = generateSlug(id);

    // Get file stats
    const stats = fs.statSync(filePath);

    // Calculate content metrics
    const wordCount = countWords(body);
    const readingTime = estimateReadingTime(wordCount);

    return {
      id,
      slug,
      title,
      type,
      status: frontmatter.status || 'active',
      content: body,
      summary: frontmatter.summary || extractSummary(body),
      module: frontmatter.module,
      tags: frontmatter.tags || [],
      category: path.dirname(relativePath),
      owner: frontmatter.owner,
      reviewDate: frontmatter.reviewDate,
      related: frontmatter.related,
      dependsOn: frontmatter.dependsOn,
      covers: frontmatter.covers,
      source: 'sidstack',
      sourcePath: relativePath,
      absolutePath: filePath,
      createdAt: frontmatter.createdAt || stats.birthtime.toISOString(),
      updatedAt: frontmatter.updatedAt || stats.mtime.toISOString(),
      wordCount,
      readingTime,
    };
  }

  private inferType(frontmatter: DocumentFrontmatter, relativePath: string): DocumentType {
    // Use explicit type if valid
    if (frontmatter.type && isValidDocumentType(frontmatter.type)) {
      return frontmatter.type;
    }

    // Infer from folder name
    const folder = relativePath.split(path.sep)[0]?.toLowerCase();

    // Map folder to type
    for (const [type, config] of Object.entries(DOCUMENT_TYPE_CONFIG)) {
      if (config.folder === folder) {
        return type as DocumentType;
      }
    }

    // Default to 'guide' for unknown folders
    return 'guide';
  }
}

// =============================================================================
// Adapter Registry
// =============================================================================

/**
 * Registry for managing knowledge adapters
 */
export class AdapterRegistry {
  private adapters: KnowledgeAdapter[] = [];

  constructor() {
    // Register default adapters in priority order
    // Only SidStack's own knowledge format is supported
    this.register(new SidStackAdapter());
  }

  register(adapter: KnowledgeAdapter): void {
    this.adapters.push(adapter);
  }

  getAvailableAdapters(basePath: string): KnowledgeAdapter[] {
    return this.adapters.filter(a => a.canHandle(basePath));
  }

  async loadAllDocuments(basePath: string): Promise<KnowledgeDocument[]> {
    const documents: KnowledgeDocument[] = [];
    const availableAdapters = this.getAvailableAdapters(basePath);

    for (const adapter of availableAdapters) {
      try {
        const docs = await adapter.loadDocuments(basePath);
        documents.push(...docs);
      } catch (error) {
        console.error(`Error loading documents from ${adapter.source}:`, error);
      }
    }

    // Deduplicate by ID (prefer sidstack over others)
    const seen = new Map<string, KnowledgeDocument>();
    for (const doc of documents) {
      const existing = seen.get(doc.id);
      if (!existing || doc.source === 'sidstack') {
        seen.set(doc.id, doc);
      }
    }

    return Array.from(seen.values());
  }
}

// =============================================================================
// Default Registry Instance
// =============================================================================

export const defaultAdapterRegistry = new AdapterRegistry();
