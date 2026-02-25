// SidStack Shared Types and Utilities

export * from './types';
export * from './constants';
export * from './errors';

// API Client (for MCP server and other consumers to call API server via HTTP)
export { SidStackApiClient, createApiClient, ApiClientError } from './api-client';
export type { ApiClientOptions } from './api-client';
export * from './spec-graph';

// Impact Analysis System
export * from './impact';

// Governance System (Phase 1)
export * from './governance';
export * from './task-validation';

// Quality Gate Runner
export * from './quality-gate-runner';


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

// Capability Types (used by Project Hub frontend)
export * from './capability-types';

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
  CreateDocumentInput,
  UpdateDocumentInput,
  HealthCheckResult,
  HealthIssue,
} from './knowledge';

// Re-export service factory and config constants
export {
  createKnowledgeService,
  DOCUMENT_TYPE_CONFIG,
  DOCUMENT_STATUS_CONFIG,
  FOLDER_CONFIG,
  ALL_DOCUMENT_TYPES,
  ALL_FOLDER_NAMES,
  FOLDER_TO_DEFAULT_TYPE,
  TYPE_TO_FOLDER,
  DEFAULT_FOLDERS,
  type FolderConfig,
} from './knowledge';

// Project Settings
export * from './project-settings';

// Workspace Detection
export {
  detectWorkspace,
  isInsideWorkspace,
  getWorkspaceRoot,
  getProjectId,
  getProjectIdSafe,
  loadWorkspaceConfig,
  saveWorkspaceConfig,
  getSidstackPath,
  getSidstackLocalPath,
  ensureSidstackLocal,
  getConfigPath,
  listWorktrees,
  isWorktree,
  getWorktreeStatus,
  updateWorktreeStatus,
  // Agent Desk aliases
  listAgentDesks,
  getAgentDeskStatus,
  updateAgentDeskStatus,
  // Desk path helpers
  DESKS_DIR_NAME,
  getDesksPath,
  getDeskPath,
  type WorkspaceInfo,
  type WorkspaceConfig,
  type DetectWorkspaceOptions,
  type WorktreeStatus,
  type AgentDeskInfo,
} from './workspace-detector';

// Test Results (file-based E2E result storage)
export {
  createTestResult,
  getTestResult,
  listTestResults,
  type TestResult,
  type CreateTestResultInput,
  type ListTestResultsFilters,
} from './test-results';

// Traceability Matrix (spec → task → test coverage)
export {
  buildTraceabilityMatrix,
  type TraceabilityMatrix,
  type TraceabilityMatrixEntry,
  type TraceabilityTaskEntry,
  type TraceabilityCoverage,
  type TraceabilitySummary,
} from './traceability';

// Memory System (mem0 semantic search)
export { Mem0Client, createMem0Client, MEMORY_TTL_MS, computeExpiresAt, isMemoryExpired } from './memory/index.js';
export type {
  Mem0Config,
  Mem0Memory,
  Mem0AddRequest,
  Mem0SearchRequest,
  MemorySourceType,
} from './memory/index.js';

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
