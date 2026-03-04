/**
 * Knowledge Indexer
 *
 * Orchestrates chunking → SidMemo indexing for knowledge documents.
 * Handles index, reindex, remove, and bulk index operations.
 */

import type { SidMemoClient } from '../memory/client.js';
import type { KnowledgeDocument } from './types.js';
import { chunkDocument } from './chunker.js';

// =============================================================================
// Types
// =============================================================================

export interface IndexResult {
  docId: string;
  chunksCreated: number;
  durationMs: number;
}

export interface BatchIndexResult {
  total: number;
  indexed: number;
  failed: number;
  errors: Array<{ docId: string; error: string }>;
}

// =============================================================================
// Indexer
// =============================================================================

export class KnowledgeIndexer {
  constructor(private client: SidMemoClient) {}

  /**
   * Index a single document: chunk → add each chunk to SidMemo.
   * SidMemo auto-extracts facts → vector store + Knowledge Graph.
   */
  async indexDocument(doc: KnowledgeDocument, userId: string): Promise<IndexResult> {
    const start = Date.now();
    const chunks = chunkDocument(doc);

    for (const chunk of chunks) {
      await this.client.add(chunk.content, userId, chunk.metadata);
    }

    return {
      docId: doc.id,
      chunksCreated: chunks.length,
      durationMs: Date.now() - start,
    };
  }

  /**
   * Reindex a document: remove old chunks, then index fresh.
   */
  async reindexDocument(doc: KnowledgeDocument, userId: string): Promise<IndexResult> {
    await this.removeDocument(doc.id, userId);
    return this.indexDocument(doc, userId);
  }

  /**
   * Remove all chunks for a document from SidMemo.
   * Searches by docId metadata filter, then bulk-deletes.
   */
  async removeDocument(docId: string, userId: string): Promise<void> {
    try {
      const existing = await this.client.search(
        docId,
        userId,
        100,
        { sourceType: 'knowledge_chunk', docId },
      );
      if (existing.length > 0) {
        const ids = existing.map(m => m.id);
        await this.client.bulkDelete(ids);
      }
    } catch {
      // Non-blocking: if search/delete fails, old chunks may remain but won't cause errors
    }
  }

  /**
   * Bulk index all documents.
   * Provides progress callback for UI/logging.
   */
  async indexAll(
    docs: KnowledgeDocument[],
    userId: string,
    onProgress?: (current: number, total: number, docId: string) => void,
  ): Promise<BatchIndexResult> {
    const result: BatchIndexResult = {
      total: docs.length,
      indexed: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      onProgress?.(i + 1, docs.length, doc.id);

      try {
        await this.indexDocument(doc, userId);
        result.indexed++;
      } catch (err) {
        result.failed++;
        result.errors.push({
          docId: doc.id,
          error: err instanceof Error ? err.message : 'unknown error',
        });
      }
    }

    return result;
  }
}
