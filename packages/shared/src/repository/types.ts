/**
 * Repository Pattern Interfaces
 *
 * Async interfaces for all data access operations.
 * All methods return Promise to support both sync (SQLite) and async (PostgreSQL) backends.
 *
 * Types are imported from existing modules — not redefined here.
 */

import type {
  // Core entities
  Project,
  Task,
  Ticket,
  TicketStatus,
  TicketType,
  TicketPriority,
  GovernanceViolation,
  // Work history
  WorkSession,
  WorkEntry,
  TaskProgressLog,
  // Entity references
  EntityReference,
  EntityType,
  EntityReferenceRelationship,
  CreateEntityReferenceInput,
  EntityReferenceQuery,
  // Training room
  TrainingSession,
  Incident,
  Lesson,
  Skill,
  Rule,
  TrainingFeedback,
  TrainingContext,
  CreateIncidentInput,
  UpdateIncidentInput,
  CreateLessonInput,
  UpdateLessonInput,
  CreateSkillInput,
  UpdateSkillInput,
  CreateRuleInput,
  UpdateRuleInput,
  CreateFeedbackInput,
  IncidentFilters,
  LessonFilters,
  SkillFilters,
  RuleFilters,
  // Claude sessions
  ClaudeSession,
  SessionEvent,
  SessionFilters,
  SessionStats,
  CreateClaudeSessionInput,
  UpdateClaudeSessionInput,
  ResumeContext,
  // Unified context
  TaskSpecLink,
  TaskKnowledgeLink,
  DismissedSuggestion,
} from '../database';

import type {
  KnowledgeDocument,
  KnowledgeStats,
  ScoredDocument,
} from '../knowledge';

import type {
  Mem0Memory,
} from '../memory/index.js';

import type {
  TestResult,
  CreateTestResultInput,
  ListTestResultsFilters,
} from '../test-results';

// =============================================================================
// Filter Types
// =============================================================================

export interface TaskFilters {
  preset?: 'actionable' | 'blocked' | 'recent' | 'epics' | 'all';
  status?: string[] | string;
  taskType?: string[];
  priority?: string;
  parentOnly?: boolean;
  search?: string;
  assignedAgent?: string;
  limit?: number;
  offset?: number;
  fields?: 'minimal' | 'standard' | 'full';
}

export interface TaskListResult {
  tasks: Partial<Task>[];
  total: number;
  hasMore: boolean;
}

export interface TicketFilters {
  status?: TicketStatus | TicketStatus[];
  type?: TicketType | TicketType[];
  priority?: TicketPriority | TicketPriority[];
  limit?: number;
  offset?: number;
}

export interface ImpactAnalysis {
  id: string;
  projectId: string;
  taskId?: string;
  specId?: string;
  changeType: string;
  status: string;
  inputJson: string;
  parsedJson?: string;
  scopeJson?: string;
  dataFlowsJson?: string;
  risksJson?: string;
  gateJson?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ImpactAnalysisFilters {
  status?: string;
  limit?: number;
}

export interface ImpactValidation {
  id: string;
  analysisId: string;
  title: string;
  description?: string;
  category: string;
  isBlocking: boolean;
  status: string;
  validatedBy?: string;
  validatedAt?: number;
  notes?: string;
  autoVerifiable?: boolean;
  verifyCommand?: string;
  expectedPattern?: string;
  resultJson?: string;
  riskId?: string;
  dataFlowId?: string;
  moduleId?: string;
  createdAt: number;
}

export interface GateApproval {
  id: string;
  analysisId: string;
  gate: string;
  approvedBy: string;
  reason?: string;
  createdAt: number;
}

export interface AnalysisHistory {
  id: string;
  analysisId: string;
  action: string;
  details?: string;
  performedBy?: string;
  createdAt: number;
}

export interface KnowledgeDocumentFilters {
  type?: string | string[];
  status?: string | string[];
  module?: string;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: string;
}

export interface KnowledgeDocListResult {
  documents: KnowledgeDocument[];
  total: number;
  limit: number;
  offset: number;
}

export interface WorkHistoryFilters {
  taskId?: string;
  sessionId?: string;
  actionTypes?: string[];
  limit?: number;
  offset?: number;
}

export interface GovernanceViolationFilters {
  resolved?: boolean;
  violationType?: string;
}

export interface SessionListResult {
  sessions: ClaudeSession[];
  total: number;
}

// =============================================================================
// Sub-Repository Interfaces
// =============================================================================

export interface IProjectRepository {
  list(): Promise<Project[]>;
  get(id: string): Promise<Project | null>;
  getByPath(projectPath: string): Promise<Project | null>;
  create(project: Omit<Project, 'createdAt' | 'updatedAt'>): Promise<Project>;
  update(id: string, updates: Partial<Pick<Project, 'name' | 'status'>>): Promise<Project | null>;
}

export interface ITaskRepository {
  list(projectId: string, filters?: TaskFilters): Promise<TaskListResult>;
  get(id: string): Promise<Task | null>;
  create(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'progress'> & { id?: string }): Promise<Task>;
  update(id: string, updates: Partial<Task>): Promise<Task | null>;
  delete(id: string): Promise<boolean>;
  getSubtasks(parentTaskId: string): Promise<Task[]>;

  // Progress tracking
  logProgress(progress: Omit<TaskProgressLog, 'id' | 'createdAt'>): Promise<TaskProgressLog>;
  getProgressHistory(taskId: string): Promise<TaskProgressLog[]>;
  getLatestProgress(taskId: string): Promise<TaskProgressLog | null>;

  // Governance violations
  logViolation(violation: Omit<GovernanceViolation, 'id' | 'resolved'>): Promise<GovernanceViolation>;
  getViolation(id: string): Promise<GovernanceViolation | null>;
  getTaskViolations(taskId: string): Promise<GovernanceViolation[]>;
  listViolations(filters?: GovernanceViolationFilters): Promise<GovernanceViolation[]>;
  resolveViolation(id: string, resolvedBy: string): Promise<GovernanceViolation | null>;

  // Task-spec and task-knowledge links
  createSpecLink(link: Omit<TaskSpecLink, 'id' | 'createdAt'>): Promise<TaskSpecLink>;
  getSpecLinks(taskId: string): Promise<TaskSpecLink[]>;
  deleteSpecLink(id: string): Promise<boolean>;
  createKnowledgeLink(link: Omit<TaskKnowledgeLink, 'id' | 'createdAt'>): Promise<TaskKnowledgeLink>;
  getKnowledgeLinks(taskId: string): Promise<TaskKnowledgeLink[]>;
  deleteKnowledgeLink(id: string): Promise<boolean>;

  // Dismissed suggestions
  dismissSuggestion(taskId: string, suggestedPath: string, suggestionType: 'spec' | 'knowledge'): Promise<DismissedSuggestion>;
  isDismissed(taskId: string, suggestedPath: string): Promise<boolean>;
  getDismissedSuggestions(taskId: string): Promise<DismissedSuggestion[]>;

  // Reverse lookups
  getTaskIdsBySpec(specPath: string): Promise<string[]>;
  getTaskIdsByKnowledge(knowledgePath: string): Promise<string[]>;
  getUnifiedContext(taskId: string): Promise<{
    specLinks: TaskSpecLink[];
    knowledgeLinks: TaskKnowledgeLink[];
    dismissedPaths: string[];
  }>;
}

export interface ITicketRepository {
  list(projectId: string, filters?: TicketFilters): Promise<Ticket[]>;
  get(id: string): Promise<Ticket | null>;
  getByTaskId(taskId: string): Promise<Ticket | null>;
  getByExternalId(externalId: string, projectId?: string): Promise<Ticket | null>;
  create(ticket: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Ticket>;
  update(id: string, updates: Partial<Omit<Ticket, 'id' | 'projectId' | 'createdAt'>>): Promise<Ticket | null>;
  delete(id: string): Promise<boolean>;
  count(projectId: string, status?: TicketStatus): Promise<number>;
}

export interface IKnowledgeRepository {
  list(projectId: string, options?: KnowledgeDocumentFilters): Promise<KnowledgeDocListResult>;
  get(id: string): Promise<KnowledgeDocument | null>;
  getBySlug(projectId: string, slug: string): Promise<KnowledgeDocument | null>;
  create(doc: {
    projectId: string;
    slug: string;
    title: string;
    type: string;
    content: string;
    status?: string;
    summary?: string;
    module?: string;
    tags?: string[];
    category?: string;
    owner?: string;
    reviewDate?: string;
    related?: string[];
    dependsOn?: string[];
    covers?: string[];
    source?: string;
    sourcePath?: string;
  }): Promise<KnowledgeDocument>;
  update(id: string, updates: {
    title?: string;
    content?: string;
    status?: string;
    summary?: string;
    module?: string;
    tags?: string[];
    category?: string;
    owner?: string;
    reviewDate?: string;
    related?: string[];
    dependsOn?: string[];
    covers?: string[];
  }): Promise<KnowledgeDocument | null>;
  delete(id: string, archive?: boolean): Promise<boolean>;
  search(projectId: string, query: string, limit?: number): Promise<ScoredDocument[]>;
  getStats(projectId: string): Promise<KnowledgeStats>;
  getModulesWithDetails(projectId: string): Promise<unknown[]>;
  getModuleOverview(projectId: string, moduleId: string): Promise<unknown | null>;
}

export interface IImpactRepository {
  create(analysis: {
    id?: string;
    projectId?: string;
    taskId?: string;
    specId?: string;
    changeType?: string;
    inputJson: string;
  }): Promise<{ id: string; createdAt: number; updatedAt: number }>;
  get(id: string): Promise<ImpactAnalysis | null>;
  getByTask(taskId: string): Promise<ImpactAnalysis | null>;
  getBySpec(specId: string): Promise<ImpactAnalysis | null>;
  list(projectId: string, filters?: ImpactAnalysisFilters): Promise<ImpactAnalysis[]>;
  update(id: string, updates: {
    status?: string;
    parsedJson?: string;
    scopeJson?: string;
    dataFlowsJson?: string;
    risksJson?: string;
    gateJson?: string;
    error?: string;
  }): Promise<boolean>;
  delete(id: string): Promise<boolean>;

  // Validation items
  createValidation(validation: {
    id?: string;
    analysisId: string;
    title: string;
    description?: string;
    category: string;
    isBlocking: boolean;
    autoVerifiable?: boolean;
    verifyCommand?: string;
    expectedPattern?: string;
    riskId?: string;
    dataFlowId?: string;
    moduleId?: string;
  }): Promise<ImpactValidation>;
  getValidation(id: string): Promise<ImpactValidation | null>;
  getValidations(analysisId: string): Promise<ImpactValidation[]>;
  updateValidation(id: string, updates: {
    status?: string;
    validatedBy?: string;
    notes?: string;
    resultJson?: string;
  }): Promise<boolean>;

  // Gate approvals
  createGateApproval(approval: {
    analysisId: string;
    gate: string;
    approvedBy: string;
    reason?: string;
  }): Promise<GateApproval>;
  getGateApprovals(analysisId: string): Promise<GateApproval[]>;

  // Analysis history
  createHistory(history: {
    analysisId: string;
    action: string;
    details?: string;
    performedBy?: string;
  }): Promise<AnalysisHistory>;
  getHistory(analysisId: string): Promise<AnalysisHistory[]>;
}

export interface ITestResultRepository {
  list(projectPath: string, filters?: ListTestResultsFilters): Promise<TestResult[]>;
  get(projectPath: string, id: string): Promise<TestResult | null>;
  create(projectPath: string, input: CreateTestResultInput): Promise<TestResult>;
}

export interface IMemoryRepository {
  list(projectId?: string): Promise<Mem0Memory[]>;
  search(query: string, projectId: string, limit?: number): Promise<Mem0Memory[]>;
  add(content: string, projectId: string, metadata?: Record<string, unknown>): Promise<Mem0Memory>;
  delete(memoryId: string, projectId?: string): Promise<boolean>;
}

export interface IEntityLinkRepository {
  create(input: CreateEntityReferenceInput): Promise<EntityReference>;
  createBatch(inputs: CreateEntityReferenceInput[]): Promise<EntityReference[]>;
  get(id: string): Promise<EntityReference | null>;
  query(query: EntityReferenceQuery): Promise<EntityReference[]>;
  count(query: Omit<EntityReferenceQuery, 'limit' | 'offset'>): Promise<number>;
  delete(id: string): Promise<boolean>;
  deleteByLink(
    sourceType: EntityType,
    sourceId: string,
    targetType: EntityType,
    targetId: string,
    relationship: EntityReferenceRelationship,
  ): Promise<boolean>;
  getRelatedEntities(entityType: EntityType, entityId: string, maxDepth?: number): Promise<EntityReference[]>;
}

export interface ITrainingRepository {
  // Training sessions
  getOrCreateSession(moduleId: string, projectPath?: string): Promise<TrainingSession>;
  getSession(id: string): Promise<TrainingSession | null>;
  getSessionByModule(moduleId: string, projectPath?: string): Promise<TrainingSession | null>;
  listSessions(projectPath?: string, status?: 'active' | 'archived'): Promise<TrainingSession[]>;
  archiveSession(id: string): Promise<TrainingSession | null>;

  // Incidents
  createIncident(input: CreateIncidentInput): Promise<Incident>;
  getIncident(id: string): Promise<Incident | null>;
  listIncidents(filters?: IncidentFilters): Promise<Incident[]>;
  updateIncident(input: UpdateIncidentInput): Promise<Incident | null>;
  deleteIncident(id: string): Promise<boolean>;

  // Lessons
  createLesson(input: CreateLessonInput): Promise<Lesson>;
  getLesson(id: string): Promise<Lesson | null>;
  listLessons(filters?: LessonFilters): Promise<Lesson[]>;
  updateLesson(input: UpdateLessonInput): Promise<Lesson | null>;
  approveLesson(id: string, approver: string): Promise<Lesson | null>;

  // Skills
  createSkill(input: CreateSkillInput): Promise<Skill>;
  getSkill(id: string): Promise<Skill | null>;
  getSkillByName(name: string, projectPath?: string): Promise<Skill | null>;
  listSkills(filters?: SkillFilters): Promise<Skill[]>;
  updateSkill(input: UpdateSkillInput): Promise<Skill | null>;
  activateSkill(id: string): Promise<Skill | null>;
  deprecateSkill(id: string): Promise<Skill | null>;
  incrementSkillUsage(id: string): Promise<Skill | null>;

  // Rules
  createRule(input: CreateRuleInput): Promise<Rule>;
  getRule(id: string): Promise<Rule | null>;
  getRuleByName(name: string, projectPath?: string): Promise<Rule | null>;
  listRules(filters?: RuleFilters): Promise<Rule[]>;
  updateRule(input: UpdateRuleInput): Promise<Rule | null>;
  deprecateRule(id: string): Promise<Rule | null>;
  recordRuleViolation(id: string): Promise<Rule | null>;

  // Feedback
  createFeedback(input: CreateFeedbackInput): Promise<TrainingFeedback>;
  listFeedback(entityType: 'skill' | 'rule', entityId: string): Promise<TrainingFeedback[]>;

  // Context
  getTrainingContext(moduleId: string, projectPath?: string, role?: string, taskType?: string): Promise<TrainingContext>;
}

export interface ISessionRepository {
  create(input: CreateClaudeSessionInput): Promise<ClaudeSession>;
  get(id: string): Promise<ClaudeSession | null>;
  update(id: string, updates: UpdateClaudeSessionInput): Promise<ClaudeSession | null>;
  delete(id: string): Promise<boolean>;
  list(filters?: SessionFilters): Promise<SessionListResult>;
  getActive(workspacePath?: string): Promise<ClaudeSession[]>;
  getByTask(taskId: string): Promise<ClaudeSession[]>;
  getByModule(moduleId: string): Promise<ClaudeSession[]>;
  getBySpec(specId: string): Promise<ClaudeSession[]>;
  getByTicket(ticketId: string): Promise<ClaudeSession[]>;
  markActive(id: string): Promise<ClaudeSession | null>;
  markCompleted(id: string, exitCode?: number): Promise<ClaudeSession | null>;
  markError(id: string, errorMessage: string): Promise<ClaudeSession | null>;
  markTerminated(id: string): Promise<ClaudeSession | null>;
  recordResume(id: string): Promise<ClaudeSession | null>;
  getStats(filters?: SessionFilters): Promise<SessionStats>;
  cleanup(retentionDays?: number): Promise<{ sessions: number; events: number }>;

  // Events
  logEvent(input: { claudeSessionId: string; eventType: string; details?: string }): Promise<SessionEvent>;
  getEvents(claudeSessionId: string): Promise<SessionEvent[]>;
  buildResumeContext(claudeSessionId: string): Promise<ResumeContext>;
}

export interface IWorkHistoryRepository {
  startSession(workspacePath: string, claudeSessionId?: string): Promise<WorkSession>;
  endSession(sessionId: string, summary?: string): Promise<void>;
  getSession(sessionId: string): Promise<WorkSession | null>;
  getSessions(workspacePath: string, timeframeHours?: number): Promise<WorkSession[]>;
  getActiveSession(workspacePath: string): Promise<WorkSession | null>;
  logEntry(entry: Omit<WorkEntry, 'id' | 'timestamp'>): Promise<WorkEntry>;
  getHistory(filters: WorkHistoryFilters): Promise<WorkEntry[]>;
  cleanup(retentionDays?: number): Promise<{ sessions: number; entries: number; progressLogs: number }>;

  // Paginated work history
  getWorkHistory(
    workspacePath: string,
    timeframeHours: number,
    filters?: { sessionId?: string; taskId?: string; actionTypes?: string[] },
    page?: number,
    pageSize?: number,
  ): Promise<{ entries: WorkEntry[]; total: number }>;

  // Recent entries by task
  getRecentEntries(taskId: string, limit?: number): Promise<WorkEntry[]>;
}

// =============================================================================
// Composite Repository Interface
// =============================================================================

export interface IRepository {
  tasks: ITaskRepository;
  tickets: ITicketRepository;
  knowledge: IKnowledgeRepository;
  impact: IImpactRepository;
  testResults: ITestResultRepository;
  memories: IMemoryRepository;
  entityLinks: IEntityLinkRepository;
  projects: IProjectRepository;
  training: ITrainingRepository;
  sessions: ISessionRepository;
  workHistory: IWorkHistoryRepository;

  initialize(): Promise<void>;
  close(): Promise<void>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}
