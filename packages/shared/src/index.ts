// SidStack Shared Types and Utilities

export * from './types';
export * from './constants';
export * from './errors';
export * from './spec-graph';

// Impact Analysis System
export * from './impact';

// Governance System (Phase 1)
export * from './governance';
export * from './task-validation';

// External Session Launcher
export * from './external-session';

// Claude Session Manager
export * from './session-manager';

// Session Context Builder
export * from './session-context-builder';

// Entity Context Builder (Project Intelligence Hub)
export {
  buildEntityContext,
  type ContextFormat,
  type ContextSection,
  type EntityContextOptions,
  type EntityContextResult,
  type EntitySummary,
} from './context-builder';

// Capability Registry (Project Intelligence Hub)
export * from './capability-types';
export {
  getCapabilitiesPath,
  capabilitiesExist,
  ensureCapabilitiesDir,
  loadAllCapabilities,
  loadCapability,
  resolveHierarchy,
  queryCapabilities,
  getCapabilityStats,
  writeCapability,
  deleteCapability,
} from './capability-registry';

// Knowledge System (new unified system)
// Re-export types (functions are exported from ./knowledge subpath to avoid naming conflicts)
export type {
  DocumentType,
  DocumentStatus,
  DocumentSource,
  KnowledgeDocument,
  DocumentFrontmatter,
  ListDocumentsQuery,
  ListDocumentsResponse,
  BuildContextOptions,
  KnowledgeContext,
  KnowledgeStats,
  KnowledgeTreeNode,
  KnowledgeFilters,
} from './knowledge';

// Re-export service factory and config constants
export { createKnowledgeService, DOCUMENT_TYPE_CONFIG, DOCUMENT_STATUS_CONFIG } from './knowledge';

// Project Settings
export * from './project-settings';

// Database exports (renamed to avoid conflicts with ./types)
export {
  SidStackDB,
  getDB,
  closeDB,
  type Project as DBProject,
  type Task as DBTask,
  type WorkSession,
  type WorkEntry,
  type TaskProgressLog,
  type GovernanceViolation as DBGovernanceViolation,
  // Unified Context types
  type TaskSpecLink,
  type TaskKnowledgeLink,
  type DismissedSuggestion,
  type SpecType,
  type LinkType,
  // Claude Session types (re-exported from session-manager)
  type ClaudeSession,
  type SessionEvent,
  type SessionFilters,
  type SessionStats,
  type CreateClaudeSessionInput,
  type UpdateClaudeSessionInput,
  type ResumeContext,
  // Ticket types (Ticket to Release)
  type Ticket,
  type TicketStatus,
  type TicketType,
  type TicketPriority,
  type TicketSource,
  type TicketAttachment,
  type TicketLinkedIssue,
  // Training Room types (Lessons-Learned System)
  type TrainingSession,
  type TrainingSessionStatus,
  type Incident,
  type IncidentContext,
  type IncidentType,
  type IncidentSeverity,
  type IncidentStatus,
  type Lesson,
  type LessonStatus,
  type Skill,
  type SkillType,
  type SkillStatus,
  type Rule,
  type RuleLevel,
  type RuleEnforcement,
  type RuleStatus,
  type TrainingFeedback,
  type FeedbackOutcome,
  type Applicability,
  type TriggerConfig,
  type TrainingContext,
  type CreateIncidentInput,
  type UpdateIncidentInput,
  type CreateLessonInput,
  type UpdateLessonInput,
  type CreateSkillInput,
  type UpdateSkillInput,
  type CreateRuleInput,
  type UpdateRuleInput,
  type CreateFeedbackInput,
  type IncidentFilters,
  type LessonFilters,
  type SkillFilters,
  type RuleFilters,
  // Entity Reference types (Project Intelligence Hub)
  type EntityReference,
  type EntityReferenceRelationship,
  type EntityType,
  type CreateEntityReferenceInput,
  type EntityReferenceQuery,
} from './database';
