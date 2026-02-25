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

// Adapters
export {
  type KnowledgeAdapter,
  SidStackAdapter,
  AdapterRegistry,
  defaultAdapterRegistry,
} from './adapters';

// Service
export {
  KnowledgeService,
  createKnowledgeService,
} from './service';
