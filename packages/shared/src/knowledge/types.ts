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
  covers?: string[];             // Source files this doc covers (for stale detection)

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
  covers?: string[];
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
  covers?: string[];
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
  covers?: string[];
}

/**
 * Health check result for knowledge base
 */
export interface HealthIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'stale' | 'missing-metadata' | 'broken-link' | 'orphaned' | 'overdue-review' | 'duplicate' | 'stale-by-change';
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
  emoji: string;
}> = {
  // Specs (project-scoped)
  spec: {
    label: 'Spec',
    icon: 'FileText',
    color: '#8b5cf6',
    folder: '07-projects',
    description: 'Technical specification',
    emoji: '📝',
  },
  decision: {
    label: 'Decision',
    icon: 'GitBranch',
    color: '#10b981',
    folder: '02-decisions',
    description: 'Architecture decision record',
    emoji: '⚖️',
  },
  proposal: {
    label: 'Proposal',
    icon: 'FileEdit',
    color: '#a855f7',
    folder: '07-projects',
    description: 'Change proposal',
    emoji: '💡',
  },

  // Docs (reference material)
  guide: {
    label: 'Guide',
    icon: 'BookOpen',
    color: '#3b82f6',
    folder: '00-context',
    description: 'How-to guide, tutorial, or concept explanation',
    emoji: '📖',
  },
  reference: {
    label: 'Reference',
    icon: 'FileCode',
    color: '#6366f1',
    folder: '01-architecture',
    description: 'API or technical reference',
    emoji: '🔖',
  },

  // Resources (reusable)
  template: {
    label: 'Template',
    icon: 'Copy',
    color: '#64748b',
    folder: '03-standards',
    description: 'Document template',
    emoji: '📄',
  },
  checklist: {
    label: 'Checklist',
    icon: 'CheckSquare',
    color: '#22c55e',
    folder: '03-standards',
    description: 'Validation checklist',
    emoji: '✅',
  },
  pattern: {
    label: 'Pattern',
    icon: 'Puzzle',
    color: '#ec4899',
    folder: '01-architecture',
    description: 'Design pattern',
    emoji: '🧩',
  },

  // Standards & rules
  skill: {
    label: 'Skill',
    icon: 'Sparkles',
    color: '#f472b6',
    folder: '03-standards',
    description: 'Agent workflow procedure',
    emoji: '⚡',
  },
  principle: {
    label: 'Principle',
    icon: 'Star',
    color: '#f97316',
    folder: '03-standards',
    description: 'MUST follow rule',
    emoji: '🛡️',
  },
  rule: {
    label: 'Rule',
    icon: 'Shield',
    color: '#ef4444',
    folder: '03-standards',
    description: 'Auto-enforced constraint',
    emoji: '⚠️',
  },

  // Meta
  module: {
    label: 'Module',
    icon: 'Box',
    color: '#8b5cf6',
    folder: '01-architecture',
    description: 'Module definition',
    emoji: '📦',
  },
  index: {
    label: 'Index',
    icon: 'LayoutList',
    color: '#94a3b8',
    folder: '',
    description: 'Navigation overview',
    emoji: '📋',
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
 * Standard knowledge folder structure (9 categories)
 * See .claude/specs/knowledge-template-standard.md for full specification.
 *
 * Living docs (00-06): Updated continuously, no date prefix
 * Event docs (02, 07, 08): Immutable records, date-prefixed filenames
 */
export const DEFAULT_FOLDERS = [
  '00-context',
  '01-architecture',
  '02-decisions',
  '03-standards',
  '04-data',
  '05-api',
  '06-operations',
  '07-projects',
  '08-incidents',
] as const;

// =============================================================================
// Folder Configuration (Source of Truth)
// =============================================================================

/**
 * Configuration for a knowledge folder
 */
export interface FolderConfig {
  /** Folder name, e.g. '00-context' */
  name: string;
  /** Human-readable title */
  title: string;
  /** One-line description */
  description: string;
  /** Document lifecycle type */
  docType: 'living' | 'event';
  /** Naming convention for files in this folder */
  namingConvention: 'descriptive' | 'YYYY-MM-DD-slug';
  /** Default document type for files in this folder */
  defaultDocType: DocumentType;
  /** Full _README.md content for init */
  readmeContent: string;
}

/**
 * Complete folder configuration for the 9-folder knowledge structure.
 * Single source of truth for CLI init, validation inferType, and template generation.
 */
export const FOLDER_CONFIG: FolderConfig[] = [
  {
    name: '00-context',
    title: 'Context',
    description: 'System purpose, business model, domain concepts, constraints, non-goals.',
    docType: 'living',
    namingConvention: 'descriptive',
    defaultDocType: 'guide',
    readmeContent: `# Context

System purpose, business model, domain concepts, constraints, non-goals.

**Entry point for agents.** Read this first before any work.

## What Belongs Here

- Business model and value proposition
- Domain glossary and concepts
- System constraints and non-goals
- Stakeholder map

## Naming Convention

Descriptive names, no date prefix (living docs).

\`\`\`
business-model.md
domain-glossary.md
constraints.md
\`\`\`
`,
  },
  {
    name: '01-architecture',
    title: 'Architecture',
    description: 'System overview, module boundaries, data flow, integration map.',
    docType: 'living',
    namingConvention: 'descriptive',
    defaultDocType: 'reference',
    readmeContent: `# Architecture

System overview, module boundaries, data flow, integration map.

Must always reflect the real system. If the system changes, this changes.

## What Belongs Here

- System overview and high-level design
- Module boundaries and ownership
- Data flow descriptions
- Integration map (external services)
- Design patterns used in the project

## Naming Convention

Descriptive names, no date prefix (living docs).

\`\`\`
system-overview.md
module-boundaries.md
data-flow.md
\`\`\`
`,
  },
  {
    name: '02-decisions',
    title: 'Decisions',
    description: 'Architecture Decision Records (ADR). Immutable history of why.',
    docType: 'event',
    namingConvention: 'YYYY-MM-DD-slug',
    defaultDocType: 'decision',
    readmeContent: `# Decisions

Architecture Decision Records (ADR). Immutable history of why.

**Do not edit historical decisions. Supersede with new ones.**

## What Belongs Here

Each decision must include:
- Context (what prompted the decision)
- Decision (what was decided)
- Alternatives (what was considered)
- Consequences (trade-offs accepted)
- Agent Impact (how this affects agent behavior)

## Naming Convention

Date-prefixed (event docs): \`YYYY-MM-DD-slug.md\`

\`\`\`
2026-01-15-use-sqlite-over-postgres.md
2026-02-08-adopt-knowledge-template.md
\`\`\`
`,
  },
  {
    name: '03-standards',
    title: 'Standards',
    description: 'Explicit engineering rules. Written as enforceable statements.',
    docType: 'living',
    namingConvention: 'descriptive',
    defaultDocType: 'rule',
    readmeContent: `# Standards

Explicit engineering rules. Written as enforceable statements.

Every statement should be verifiable as pass/fail.

## What Belongs Here

- Coding conventions
- Error handling rules
- Logging standards
- HTTP client policy
- Testing requirements
- Security rules
- Definition of Done

## Writing Rule

Use imperative MUST/SHOULD/MAY statements:

\`\`\`markdown
- All outbound HTTP requests MUST use the shared HTTP factory.
- Connection timeout MUST be set to 30 seconds.
- Retry logic MUST NOT exceed 3 attempts.
\`\`\`

## Naming Convention

Descriptive names, no date prefix (living docs).

\`\`\`
coding-conventions.md
error-handling.md
security-rules.md
\`\`\`
`,
  },
  {
    name: '04-data',
    title: 'Data',
    description: 'Database overview, schema reference, ownership rules, retention policy.',
    docType: 'living',
    namingConvention: 'descriptive',
    defaultDocType: 'reference',
    readmeContent: `# Data

Database overview, schema reference, ownership rules, retention policy.

## What Belongs Here

- Database overview and technology
- Schema reference (tables, relationships)
- Data ownership rules
- Retention policy
- Migration strategy
- Deprecated fields (clearly marked with date)

## Naming Convention

Descriptive names, no date prefix (living docs).

\`\`\`
schema-overview.md
data-ownership.md
retention-policy.md
\`\`\`
`,
  },
  {
    name: '05-api',
    title: 'API',
    description: 'API contracts, input/output schemas, error formats, versioning policy.',
    docType: 'living',
    namingConvention: 'descriptive',
    defaultDocType: 'reference',
    readmeContent: `# API

API contracts, input/output schemas, error formats, versioning policy.

Must be structured and precise. Agents use this to generate correct API calls.

## What Belongs Here

- API overview and base URL
- Authentication and authorization
- Endpoint reference (grouped by domain)
- Error format and codes
- Versioning policy

## Naming Convention

Descriptive names, no date prefix (living docs).

\`\`\`
overview.md
authentication.md
endpoints-users.md
error-codes.md
\`\`\`
`,
  },
  {
    name: '06-operations',
    title: 'Operations',
    description: 'Deployment flow, rollback strategy, monitoring rules, alert thresholds.',
    docType: 'living',
    namingConvention: 'descriptive',
    defaultDocType: 'guide',
    readmeContent: `# Operations

Deployment flow, rollback strategy, monitoring rules, alert thresholds.

Agents generating migrations or infrastructure changes must respect this section.

## What Belongs Here

- Deployment flow and environments
- Rollback strategy and procedures
- Monitoring and observability
- Alert thresholds and escalation
- Environment configuration

## Naming Convention

Descriptive names, no date prefix (living docs).

\`\`\`
deployment-flow.md
rollback-strategy.md
monitoring.md
\`\`\`
`,
  },
  {
    name: '07-projects',
    title: 'Projects',
    description: 'Project-specific documentation. Each project is a subdirectory.',
    docType: 'event',
    namingConvention: 'YYYY-MM-DD-slug',
    defaultDocType: 'spec',
    readmeContent: `# Projects

Project-specific documentation. Each project is a subdirectory.

After completion, reusable insights must be moved to system-level docs.

## What Belongs Here

Each project subdirectory contains:
- \`brief.md\` — What and why (scope, goals, success criteria)
- \`design.md\` — How (technical approach)
- \`release.md\` — What shipped
- \`post-mortem.md\` — What we learned

## Naming Convention

Month-prefixed directories (event docs): \`YYYY-MM-slug/\`

\`\`\`
2026-01-feature-auth/
  brief.md
  design.md
2026-02-migration-v2/
  brief.md
  post-mortem.md
\`\`\`

## Lifecycle

active → completed → archived
`,
  },
  {
    name: '08-incidents',
    title: 'Incidents',
    description: 'Incident reports, root cause analysis, prevention rules.',
    docType: 'event',
    namingConvention: 'YYYY-MM-DD-slug',
    defaultDocType: 'guide',
    readmeContent: `# Incidents

Incident reports, root cause analysis, prevention rules.

Created via MCP tool \`incident_create\` or manually.

## What Belongs Here

Each incident includes:
- What happened (symptoms, impact, timeline)
- Root cause (why it happened)
- Prevention (enforceable rules to avoid recurrence)
- Agent impact (behavioral rules for agents)

## Naming Convention

Date-prefixed (event docs): \`YYYY-MM-DD-slug.md\`

\`\`\`
2026-02-05-agent-deleted-production-data.md
2026-02-08-login-timeout-slow-connections.md
\`\`\`

## Escalation

When the same root cause appears twice, promote prevention rules to \`03-standards/\`.
`,
  },
];

// =============================================================================
// Derived Constants (from DOCUMENT_TYPE_CONFIG and FOLDER_CONFIG)
// =============================================================================

/** All valid document types, derived from DOCUMENT_TYPE_CONFIG */
export const ALL_DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_CONFIG) as DocumentType[];

/** All folder names from FOLDER_CONFIG */
export const ALL_FOLDER_NAMES = FOLDER_CONFIG.map(f => f.name);

/** Map folder name → default document type */
export const FOLDER_TO_DEFAULT_TYPE: Record<string, DocumentType> = Object.fromEntries(
  FOLDER_CONFIG.map(f => [f.name, f.defaultDocType])
) as Record<string, DocumentType>;

/** Map document type → folder name (from DOCUMENT_TYPE_CONFIG.folder) */
export const TYPE_TO_FOLDER: Record<DocumentType, string> = Object.fromEntries(
  ALL_DOCUMENT_TYPES.map(t => [t, DOCUMENT_TYPE_CONFIG[t].folder])
) as Record<DocumentType, string>;
