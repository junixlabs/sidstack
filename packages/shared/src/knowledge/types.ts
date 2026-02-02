/**
 * SidStack Knowledge System - Type Definitions
 *
 * Unified type system for all knowledge documents regardless of source.
 * Following P.A.R.A. inspired categorization.
 */

// =============================================================================
// Document Types
// =============================================================================

/**
 * Document type categorization
 * - Specs: Actionable, project-specific proposals and decisions
 * - Docs: Reference material, guides, concepts
 * - Resources: Reusable templates, patterns, checklists
 * - Governance: Rules, principles, standards
 */
export type DocumentType =
  // Specs (actionable, project-specific)
  | "spec"           // Change proposal, feature spec
  | "decision"       // ADR, technical decision
  | "proposal"       // Change proposal

  // Docs (reference, area-specific)
  // Removed: concept, explanation, tutorial → merged into 'guide'
  | "guide"          // How-to guide, task-oriented (also covers tutorials, concepts, explanations)
  | "reference"      // API reference, schema docs

  // Resources (reusable)
  | "template"       // Document template
  | "checklist"      // Validation checklist
  | "pattern"        // Design pattern

  // Agent-specific
  | "skill"          // Agent workflow procedures
  | "principle"      // MUST follow rules
  | "rule"           // Auto-enforced constraints

  // Meta
  | "module"         // Module definitions
  | "index";         // Navigation/overview

/**
 * Document lifecycle status
 */
export type DocumentStatus =
  | "draft"          // Work in progress
  | "active"         // Current, maintained
  | "review"         // Needs review/update
  | "archived";      // No longer relevant

/**
 * Source of the document (which adapter loaded it)
 */
export type DocumentSource =
  | "sidstack"       // .sidstack/knowledge/
  | "skills"         // .sidstack/skills/
  | "principles"     // .sidstack/principles/
  | "modules"        // .sidstack/modules/
  | "markdown"       // Generic markdown files (docs/)
  | "manual";        // Created via UI/API

// =============================================================================
// Core Document Interface
// =============================================================================

/**
 * SidStack Knowledge Document
 * Unified interface for all knowledge documents
 */
export interface KnowledgeDocument {
  // Identity
  id: string;                    // Unique identifier
  slug: string;                  // URL-friendly identifier

  // Core content
  title: string;
  type: DocumentType;
  status: DocumentStatus;
  content: string;               // Markdown body
  summary?: string;              // Short description (first paragraph or explicit)

  // Organization
  module?: string;               // Linked module ID
  tags: string[];                // Free-form tags
  category?: string;             // Folder/category path

  // Governance
  owner?: string;                // Responsible person
  reviewDate?: string;           // Next review date (ISO 8601)

  // Relationships
  related?: string[];            // Related document IDs
  dependsOn?: string[];          // Dependency document IDs

  // Source tracking
  source: DocumentSource;
  sourcePath: string;            // Original file path (relative)
  absolutePath: string;          // Full file path

  // Metadata
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
  wordCount?: number;
  readingTime?: number;          // Estimated minutes
}

/**
 * Knowledge document with relevance score from search
 */
export interface ScoredDocument extends KnowledgeDocument {
  _score: number;
}

// =============================================================================
// Frontmatter Interface
// =============================================================================

/**
 * Standard frontmatter fields for SidStack documents
 */
export interface DocumentFrontmatter {
  // Required
  id?: string;                   // Auto-generated from filename if not provided
  type?: DocumentType;           // Inferred from folder if not provided
  title?: string;                // Extracted from first H1 if not provided

  // Optional
  status?: DocumentStatus;
  summary?: string;
  description?: string;          // Alias for summary (used in skills)
  module?: string;
  tags?: string[];
  owner?: string;
  author?: string;               // Alias for owner (used in skills)
  reviewDate?: string;
  related?: string[];
  dependsOn?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// =============================================================================
// API Types
// =============================================================================

/**
 * Query parameters for listing documents
 */
export interface ListDocumentsQuery {
  type?: DocumentType | DocumentType[];
  status?: DocumentStatus | DocumentStatus[];
  module?: string;
  tags?: string[];
  source?: DocumentSource;
  search?: string;               // Full-text search query
  limit?: number;
  offset?: number;
  sortBy?: 'title' | 'updatedAt' | 'createdAt' | 'type';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Response for document listing
 */
export interface ListDocumentsResponse {
  documents: KnowledgeDocument[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Context building options for Claude sessions
 */
export interface BuildContextOptions {
  taskId?: string;
  moduleId?: string;
  documentIds?: string[];
  types?: DocumentType[];
  maxLength?: number;            // Max characters
  format?: 'full' | 'summary' | 'titles';
}

/**
 * Built context for Claude session
 */
export interface KnowledgeContext {
  documents: Array<{
    id: string;
    title: string;
    type: DocumentType;
    summary?: string;
    content?: string;            // Only if format is 'full'
  }>;
  totalDocuments: number;
  includedDocuments: number;
  totalCharacters: number;
  prompt: string;                // Formatted prompt for Claude
}

// =============================================================================
// CRUD Input Types
// =============================================================================

/**
 * Input for creating a new knowledge document
 */
export interface CreateDocumentInput {
  title: string;
  type: DocumentType;
  content: string;
  module?: string;
  tags?: string[];
  status?: DocumentStatus;
  owner?: string;
  related?: string[];
  dependsOn?: string[];
  category?: string; // subfolder under knowledge/
}

/**
 * Input for updating an existing knowledge document
 */
export interface UpdateDocumentInput {
  title?: string;
  content?: string;
  status?: DocumentStatus;
  tags?: string[];
  module?: string;
  owner?: string;
  related?: string[];
  dependsOn?: string[];
}

/**
 * Health check result for knowledge base
 */
export interface HealthIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'stale' | 'missing-metadata' | 'broken-link' | 'orphaned' | 'overdue-review' | 'duplicate';
  docId: string;
  docTitle: string;
  message: string;
}

export interface HealthCheckResult {
  totalDocuments: number;
  issues: HealthIssue[];
  summary: { errors: number; warnings: number; info: number };
}

// =============================================================================
// Statistics
// =============================================================================

/**
 * Knowledge base statistics
 */
export interface KnowledgeStats {
  totalDocuments: number;
  byType: Record<DocumentType, number>;
  byStatus: Record<DocumentStatus, number>;
  bySource: Record<DocumentSource, number>;
  byModule: Record<string, number>;
  recentlyUpdated: KnowledgeDocument[];
  needsReview: KnowledgeDocument[];
}

// =============================================================================
// UI Types
// =============================================================================

/**
 * Tree node for sidebar navigation
 */
export interface KnowledgeTreeNode {
  id: string;
  name: string;
  type: 'folder' | 'document';
  path: string;
  documentType?: DocumentType;
  status?: DocumentStatus;
  children?: KnowledgeTreeNode[];
  documentCount?: number;
}

/**
 * Filter state for UI
 */
export interface KnowledgeFilters {
  types: DocumentType[];
  statuses: DocumentStatus[];
  modules: string[];
  tags: string[];
  search: string;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Document type display configuration
 */
export const DOCUMENT_TYPE_CONFIG: Record<DocumentType, {
  label: string;
  icon: string;
  color: string;
  folder: string;
  description: string;
}> = {
  // Specs
  spec: {
    label: 'Spec',
    icon: 'FileText',
    color: '#8b5cf6',
    folder: 'specs',
    description: 'Technical specification',
  },
  decision: {
    label: 'Decision',
    icon: 'GitBranch',
    color: '#10b981',
    folder: 'decisions',
    description: 'Architecture decision record',
  },
  proposal: {
    label: 'Proposal',
    icon: 'FileEdit',
    color: '#a855f7',
    folder: 'proposals',
    description: 'Change proposal',
  },

  // Docs
  // Removed: tutorial, explanation, concept → merged into 'guide'
  guide: {
    label: 'Guide',
    icon: 'BookOpen',
    color: '#3b82f6',
    folder: 'guides',
    description: 'How-to guide, tutorial, or concept explanation',
  },
  reference: {
    label: 'Reference',
    icon: 'FileCode',
    color: '#6366f1',
    folder: 'references',
    description: 'API or technical reference',
  },

  // Resources
  template: {
    label: 'Template',
    icon: 'Copy',
    color: '#64748b',
    folder: 'templates',
    description: 'Document template',
  },
  checklist: {
    label: 'Checklist',
    icon: 'CheckSquare',
    color: '#22c55e',
    folder: 'checklists',
    description: 'Validation checklist',
  },
  pattern: {
    label: 'Pattern',
    icon: 'Puzzle',
    color: '#ec4899',
    folder: 'patterns',
    description: 'Design pattern',
  },

  // Agent-specific
  skill: {
    label: 'Skill',
    icon: 'Sparkles',
    color: '#f472b6',
    folder: 'skills',
    description: 'Agent workflow procedure',
  },
  principle: {
    label: 'Principle',
    icon: 'Star',
    color: '#f97316',
    folder: 'principles',
    description: 'MUST follow rule',
  },
  rule: {
    label: 'Rule',
    icon: 'Shield',
    color: '#ef4444',
    folder: 'rules',
    description: 'Auto-enforced constraint',
  },

  // Meta
  module: {
    label: 'Module',
    icon: 'Box',
    color: '#8b5cf6',
    folder: 'modules',
    description: 'Module definition',
  },
  index: {
    label: 'Index',
    icon: 'LayoutList',
    color: '#94a3b8',
    folder: '',
    description: 'Navigation overview',
  },
};

/**
 * Document status display configuration
 */
export const DOCUMENT_STATUS_CONFIG: Record<DocumentStatus, {
  label: string;
  color: string;
}> = {
  draft: {
    label: 'Draft',
    color: '#64748b',
  },
  active: {
    label: 'Active',
    color: '#22c55e',
  },
  review: {
    label: 'Needs Review',
    color: '#f59e0b',
  },
  archived: {
    label: 'Archived',
    color: '#94a3b8',
  },
};

/**
 * Default folder structure for SidStack knowledge
 */
export const DEFAULT_FOLDERS = [
  'specs',
  'decisions',
  'proposals',
  'guides',
  'references',
  'templates',
  'checklists',
  'patterns',
  'skills',
  'principles',
  'rules',
  'modules',
] as const;
