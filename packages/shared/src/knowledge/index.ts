/**
 * SidStack Knowledge System
 *
 * Unified knowledge management for SidStack projects.
 */

// Types
export * from './types';

// Parser utilities
export {
  parseFrontmatter,
  serializeFrontmatter,
  generateDocumentFrontmatter,
  extractTitle,
  extractSummary,
  countWords,
  estimateReadingTime,
  isValidDocumentType,
  isValidDocumentStatus,
  generateSlug,
  generateIdFromPath,
} from './parser';

// Chunker
export { chunkDocument, type KnowledgeChunk } from './chunker';

// Indexer
export { KnowledgeIndexer, type IndexResult, type BatchIndexResult } from './indexer';

// Hybrid Search + RAG Context
export {
  hybridSearch,
  buildRAGContext,
  type HybridSearchOptions,
  type HybridSearchResult,
  type RAGContextOptions,
  type RAGContextResult,
} from './hybrid-search';
