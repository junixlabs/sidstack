/**
 * SQLite Repository Implementation
 *
 * Wraps existing SidStackDB (better-sqlite3) methods with async IRepository interface.
 * All methods delegate to the existing database module — no queries are rewritten.
 * Sync operations are wrapped implicitly by async method signatures.
 */

import { getDB, type SidStackDB } from '../database';
import type {
  Project,
  Task,
  Ticket,
  TicketStatus,
  GovernanceViolation,
  WorkSession,
  WorkEntry,
  TaskProgressLog,
  EntityReference,
  EntityType,
  EntityReferenceRelationship,
  CreateEntityReferenceInput,
  EntityReferenceQuery,
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
  ClaudeSession,
  SessionEvent,
  SessionFilters,
  SessionStats,
  CreateClaudeSessionInput,
  UpdateClaudeSessionInput,
  ResumeContext,
  TaskSpecLink,
  TaskKnowledgeLink,
  DismissedSuggestion,
} from '../database';

import {
  createTestResult as fsCreateTestResult,
  getTestResult as fsGetTestResult,
  listTestResults as fsListTestResults,
} from '../test-results';
import type { TestResult, CreateTestResultInput, ListTestResultsFilters } from '../test-results';

import { Mem0Client } from '../memory/client';
import type { Mem0Memory } from '../memory/types';

import type { KnowledgeDocument, KnowledgeStats, ScoredDocument } from '../knowledge/types';

import type {
  IRepository,
  IProjectRepository,
  ITaskRepository,
  ITicketRepository,
  IKnowledgeRepository,
  IImpactRepository,
  ITestResultRepository,
  IMemoryRepository,
  IEntityLinkRepository,
  ITrainingRepository,
  ISessionRepository,
  IWorkHistoryRepository,
  TaskFilters,
  TaskListResult,
  TicketFilters,
  ImpactAnalysis,
  ImpactAnalysisFilters,
  ImpactValidation,
  GateApproval,
  AnalysisHistory,
  KnowledgeDocumentFilters,
  KnowledgeDocListResult,
  WorkHistoryFilters,
  GovernanceViolationFilters,
  SessionListResult,
} from './types';

// =============================================================================
// Sub-Repository: Projects
// =============================================================================

class SQLiteProjectRepository implements IProjectRepository {
  constructor(private db: SidStackDB) {}

  async list(): Promise<Project[]> {
    return this.db.listProjects();
  }

  async get(id: string): Promise<Project | null> {
    return this.db.getProject(id);
  }

  async getByPath(projectPath: string): Promise<Project | null> {
    return this.db.getProjectByPath(projectPath);
  }

  async create(project: Omit<Project, 'createdAt' | 'updatedAt'>): Promise<Project> {
    return this.db.createProject(project);
  }

  async update(id: string, updates: Partial<Pick<Project, 'name' | 'status'>>): Promise<Project | null> {
    return this.db.updateProject(id, updates);
  }
}

// =============================================================================
// Sub-Repository: Tasks
// =============================================================================

class SQLiteTaskRepository implements ITaskRepository {
  constructor(private db: SidStackDB) {}

  async list(projectId: string, filters?: TaskFilters): Promise<TaskListResult> {
    return this.db.listTasks(projectId, filters);
  }

  async get(id: string): Promise<Task | null> {
    return this.db.getTask(id);
  }

  async create(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'progress'> & { id?: string }): Promise<Task> {
    return this.db.createTask(task);
  }

  async update(id: string, updates: Partial<Task>): Promise<Task | null> {
    return this.db.updateTask(id, updates);
  }

  async delete(id: string): Promise<boolean> {
    return this.db.deleteTask(id);
  }

  async getSubtasks(parentTaskId: string): Promise<Task[]> {
    return this.db.getSubtasks(parentTaskId);
  }

  // Progress tracking
  async logProgress(progress: Omit<TaskProgressLog, 'id' | 'createdAt'>): Promise<TaskProgressLog> {
    return this.db.logTaskProgress(progress);
  }

  async getProgressHistory(taskId: string): Promise<TaskProgressLog[]> {
    return this.db.getTaskProgressHistory(taskId);
  }

  async getLatestProgress(taskId: string): Promise<TaskProgressLog | null> {
    return this.db.getLatestTaskProgress(taskId);
  }

  // Governance violations
  async logViolation(violation: Omit<GovernanceViolation, 'id' | 'resolved'>): Promise<GovernanceViolation> {
    return this.db.logGovernanceViolation(violation);
  }

  async getViolation(id: string): Promise<GovernanceViolation | null> {
    return this.db.getGovernanceViolation(id);
  }

  async getTaskViolations(taskId: string): Promise<GovernanceViolation[]> {
    return this.db.getTaskViolations(taskId);
  }

  async listViolations(filters?: GovernanceViolationFilters): Promise<GovernanceViolation[]> {
    return this.db.listGovernanceViolations(filters);
  }

  async resolveViolation(id: string, resolvedBy: string): Promise<GovernanceViolation | null> {
    return this.db.resolveGovernanceViolation(id, resolvedBy);
  }

  // Task-spec links
  async createSpecLink(link: Omit<TaskSpecLink, 'id' | 'createdAt'>): Promise<TaskSpecLink> {
    return this.db.createTaskSpecLink(link);
  }

  async getSpecLinks(taskId: string): Promise<TaskSpecLink[]> {
    return this.db.getTaskSpecLinks(taskId);
  }

  async deleteSpecLink(id: string): Promise<boolean> {
    return this.db.deleteTaskSpecLink(id);
  }

  // Task-knowledge links
  async createKnowledgeLink(link: Omit<TaskKnowledgeLink, 'id' | 'createdAt'>): Promise<TaskKnowledgeLink> {
    return this.db.createTaskKnowledgeLink(link);
  }

  async getKnowledgeLinks(taskId: string): Promise<TaskKnowledgeLink[]> {
    return this.db.getTaskKnowledgeLinks(taskId);
  }

  async deleteKnowledgeLink(id: string): Promise<boolean> {
    return this.db.deleteTaskKnowledgeLink(id);
  }

  // Dismissed suggestions
  async dismissSuggestion(taskId: string, suggestedPath: string, suggestionType: 'spec' | 'knowledge'): Promise<DismissedSuggestion> {
    return this.db.dismissSuggestion(taskId, suggestedPath, suggestionType);
  }

  async isDismissed(taskId: string, suggestedPath: string): Promise<boolean> {
    return this.db.isDismissed(taskId, suggestedPath);
  }

  async getDismissedSuggestions(taskId: string): Promise<DismissedSuggestion[]> {
    return this.db.getDismissedSuggestions(taskId);
  }

  // Reverse lookups
  async getTaskIdsBySpec(specPath: string): Promise<string[]> {
    return this.db.getSpecTaskIds(specPath);
  }

  async getTaskIdsByKnowledge(knowledgePath: string): Promise<string[]> {
    return this.db.getKnowledgeTaskIds(knowledgePath);
  }

  async getUnifiedContext(taskId: string): Promise<{
    specLinks: TaskSpecLink[];
    knowledgeLinks: TaskKnowledgeLink[];
    dismissedPaths: string[];
  }> {
    return this.db.getUnifiedContext(taskId);
  }
}

// =============================================================================
// Sub-Repository: Tickets
// =============================================================================

class SQLiteTicketRepository implements ITicketRepository {
  constructor(private db: SidStackDB) {}

  async list(projectId: string, filters?: TicketFilters): Promise<Ticket[]> {
    return this.db.listTickets(projectId, filters);
  }

  async get(id: string): Promise<Ticket | null> {
    return this.db.getTicket(id);
  }

  async getByTaskId(taskId: string): Promise<Ticket | null> {
    return this.db.getTicketByTaskId(taskId);
  }

  async getByExternalId(externalId: string, projectId?: string): Promise<Ticket | null> {
    return this.db.getTicketByExternalId(externalId, projectId);
  }

  async create(ticket: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Ticket> {
    return this.db.createTicket(ticket);
  }

  async update(id: string, updates: Partial<Omit<Ticket, 'id' | 'projectId' | 'createdAt'>>): Promise<Ticket | null> {
    return this.db.updateTicket(id, updates);
  }

  async delete(id: string): Promise<boolean> {
    return this.db.deleteTicket(id);
  }

  async count(projectId: string, status?: TicketStatus): Promise<number> {
    return this.db.countTickets(projectId, status);
  }
}

// =============================================================================
// Sub-Repository: Knowledge
// =============================================================================

class SQLiteKnowledgeRepository implements IKnowledgeRepository {
  constructor(private db: SidStackDB) {}

  async list(projectId: string, options?: KnowledgeDocumentFilters): Promise<KnowledgeDocListResult> {
    return this.db.listKnowledgeDocuments(projectId, options);
  }

  async get(id: string): Promise<KnowledgeDocument | null> {
    return this.db.getKnowledgeDocument(id);
  }

  async getBySlug(projectId: string, slug: string): Promise<KnowledgeDocument | null> {
    return this.db.getKnowledgeDocumentBySlug(projectId, slug);
  }

  async create(doc: {
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
  }): Promise<KnowledgeDocument> {
    return this.db.createKnowledgeDocument(doc);
  }

  async update(id: string, updates: {
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
  }): Promise<KnowledgeDocument | null> {
    return this.db.updateKnowledgeDocument(id, updates);
  }

  async delete(id: string, archive?: boolean): Promise<boolean> {
    return this.db.deleteKnowledgeDocument(id, archive);
  }

  async search(projectId: string, query: string, limit?: number): Promise<ScoredDocument[]> {
    return this.db.searchKnowledgeDocuments(projectId, query, limit);
  }

  async getStats(projectId: string): Promise<KnowledgeStats> {
    return this.db.getKnowledgeStats(projectId);
  }

  async getModulesWithDetails(projectId: string): Promise<unknown[]> {
    return this.db.getModulesWithDetails(projectId);
  }

  async getModuleOverview(projectId: string, moduleId: string): Promise<unknown | null> {
    return this.db.getModuleOverview(projectId, moduleId);
  }
}

// =============================================================================
// Sub-Repository: Impact Analysis
// =============================================================================

/** Map DB impact validation row to ImpactValidation interface */
function mapImpactValidation(row: any): ImpactValidation {
  return {
    id: row.id,
    analysisId: row.analysisId,
    title: row.title,
    description: row.description || undefined,
    category: row.category,
    isBlocking: row.isBlocking === 1 || row.isBlocking === true,
    status: row.status,
    validatedBy: row.resultJson ? tryParseField(row.resultJson, 'validatedBy') : undefined,
    validatedAt: row.resultJson ? tryParseField(row.resultJson, 'validatedAt') : undefined,
    notes: row.resultJson ? tryParseField(row.resultJson, 'notes') : undefined,
    autoVerifiable: row.autoVerifiable === 1 || row.autoVerifiable === true || undefined,
    verifyCommand: row.verifyCommand || undefined,
    expectedPattern: row.expectedPattern || undefined,
    resultJson: row.resultJson || undefined,
    riskId: row.riskId || undefined,
    dataFlowId: row.dataFlowId || undefined,
    moduleId: row.moduleId || undefined,
    createdAt: row.createdAt,
  };
}

function tryParseField(json: string, field: string): any {
  try {
    const parsed = JSON.parse(json);
    return parsed[field];
  } catch {
    return undefined;
  }
}

class SQLiteImpactRepository implements IImpactRepository {
  constructor(private db: SidStackDB) {}

  async create(analysis: {
    id?: string;
    projectId?: string;
    taskId?: string;
    specId?: string;
    changeType?: string;
    inputJson: string;
  }): Promise<{ id: string; createdAt: number; updatedAt: number }> {
    return this.db.createImpactAnalysis(analysis);
  }

  async get(id: string): Promise<ImpactAnalysis | null> {
    return this.db.getImpactAnalysis(id) as ImpactAnalysis | null;
  }

  async getByTask(taskId: string): Promise<ImpactAnalysis | null> {
    return this.db.getImpactAnalysisByTask(taskId) as ImpactAnalysis | null;
  }

  async getBySpec(specId: string): Promise<ImpactAnalysis | null> {
    return this.db.getImpactAnalysisBySpec(specId) as ImpactAnalysis | null;
  }

  async list(projectId: string, filters?: ImpactAnalysisFilters): Promise<ImpactAnalysis[]> {
    return this.db.listImpactAnalyses(projectId, filters) as ImpactAnalysis[];
  }

  async update(id: string, updates: {
    status?: string;
    parsedJson?: string;
    scopeJson?: string;
    dataFlowsJson?: string;
    risksJson?: string;
    gateJson?: string;
    error?: string;
  }): Promise<boolean> {
    return this.db.updateImpactAnalysis(id, updates);
  }

  async delete(id: string): Promise<boolean> {
    return this.db.deleteImpactAnalysis(id);
  }

  // Validation items
  async createValidation(validation: {
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
  }): Promise<ImpactValidation> {
    const result = this.db.createImpactValidation({
      ...validation,
      autoVerifiable: validation.autoVerifiable ?? false,
    });
    // Fetch the created record to return full ImpactValidation
    const row = this.db.getImpactValidation(result.id);
    return mapImpactValidation(row || { ...validation, id: result.id, status: 'pending', createdAt: result.createdAt });
  }

  async getValidation(id: string): Promise<ImpactValidation | null> {
    const row = this.db.getImpactValidation(id);
    return row ? mapImpactValidation(row) : null;
  }

  async getValidations(analysisId: string): Promise<ImpactValidation[]> {
    const rows = this.db.getImpactValidations(analysisId);
    return rows.map(r => mapImpactValidation(r));
  }

  async updateValidation(id: string, updates: {
    status?: string;
    validatedBy?: string;
    notes?: string;
    resultJson?: string;
  }): Promise<boolean> {
    const dbUpdates: { status?: string; resultJson?: string } = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    // If resultJson is provided directly, use it
    if (updates.resultJson !== undefined) {
      dbUpdates.resultJson = updates.resultJson;
    } else if (updates.validatedBy !== undefined || updates.notes !== undefined) {
      // Pack validatedBy/notes into resultJson for DB storage
      const existing = this.db.getImpactValidation(id);
      const existingResult = existing?.resultJson ? JSON.parse(existing.resultJson) : {};
      if (updates.validatedBy !== undefined) existingResult.validatedBy = updates.validatedBy;
      if (updates.notes !== undefined) existingResult.notes = updates.notes;
      existingResult.validatedAt = Date.now();
      dbUpdates.resultJson = JSON.stringify(existingResult);
    }
    return this.db.updateImpactValidation(id, dbUpdates);
  }

  // Gate approvals
  async createGateApproval(approval: {
    analysisId: string;
    gate: string;
    approvedBy: string;
    reason?: string;
  }): Promise<GateApproval> {
    const result = this.db.createGateApproval({
      analysisId: approval.analysisId,
      approver: approval.approvedBy,
      reason: approval.reason || '',
      approvedBlockersJson: approval.gate,
    });
    return {
      id: result.id,
      analysisId: approval.analysisId,
      gate: approval.gate,
      approvedBy: approval.approvedBy,
      reason: approval.reason,
      createdAt: result.createdAt,
    };
  }

  async getGateApprovals(analysisId: string): Promise<GateApproval[]> {
    const rows = this.db.getGateApprovals(analysisId);
    return rows.map(r => ({
      id: r.id,
      analysisId: r.analysisId,
      gate: r.approvedBlockersJson,
      approvedBy: r.approver,
      reason: r.reason || undefined,
      createdAt: r.createdAt,
    }));
  }

  // Analysis history
  async createHistory(history: {
    analysisId: string;
    action: string;
    details?: string;
    performedBy?: string;
  }): Promise<AnalysisHistory> {
    const result = this.db.createAnalysisHistory({
      analysisId: history.analysisId,
      actualIssuesJson: history.details || '{}',
      accuracyScore: 0,
      notes: history.action,
    });
    return {
      id: result.id,
      analysisId: history.analysisId,
      action: history.action,
      details: history.details,
      performedBy: history.performedBy,
      createdAt: result.createdAt,
    };
  }

  async getHistory(analysisId: string): Promise<AnalysisHistory[]> {
    const rows = this.db.getAnalysisHistory(analysisId);
    return rows.map(r => ({
      id: r.id,
      analysisId: r.analysisId,
      action: r.notes || '',
      details: r.actualIssuesJson,
      performedBy: undefined,
      createdAt: r.createdAt,
    }));
  }
}

// =============================================================================
// Sub-Repository: Test Results (file-based)
// =============================================================================

class SQLiteTestResultRepository implements ITestResultRepository {
  async list(projectPath: string, filters?: ListTestResultsFilters): Promise<TestResult[]> {
    return fsListTestResults(projectPath, filters);
  }

  async get(projectPath: string, id: string): Promise<TestResult | null> {
    return fsGetTestResult(projectPath, id);
  }

  async create(projectPath: string, input: CreateTestResultInput): Promise<TestResult> {
    return fsCreateTestResult(projectPath, input);
  }
}

// =============================================================================
// Sub-Repository: Memory (mem0 REST API)
// =============================================================================

class SQLiteMemoryRepository implements IMemoryRepository {
  constructor(private client: Mem0Client) {}

  async list(projectId?: string): Promise<Mem0Memory[]> {
    const response = await this.client.list(projectId);
    return response.items.map(m => ({
      id: m.id,
      memory: m.content,
      metadata: m.metadata_ as Record<string, unknown> | undefined,
      score: m.score,
      created_at: m.created_at,
      updated_at: m.updated_at,
    }));
  }

  async search(query: string, projectId: string, limit?: number): Promise<Mem0Memory[]> {
    const results = await this.client.search(query, projectId, limit);
    return results.map(m => ({
      id: m.id,
      memory: m.content,
      metadata: m.metadata_ as Record<string, unknown> | undefined,
      score: m.score,
    }));
  }

  async add(content: string, projectId: string, metadata?: Record<string, unknown>): Promise<Mem0Memory> {
    const { result } = await this.client.addSmart(content, projectId, metadata);
    return {
      id: result.id || `mem-${Date.now()}`,
      memory: result.content || content,
      metadata,
      created_at: result.created_at || new Date().toISOString(),
    };
  }

  async delete(memoryId: string, _projectId?: string): Promise<boolean> {
    try {
      await this.client.delete(memoryId);
      return true;
    } catch {
      return false;
    }
  }
}

// =============================================================================
// Sub-Repository: Entity Links
// =============================================================================

class SQLiteEntityLinkRepository implements IEntityLinkRepository {
  constructor(private db: SidStackDB) {}

  async create(input: CreateEntityReferenceInput): Promise<EntityReference> {
    return this.db.createEntityReference(input);
  }

  async createBatch(inputs: CreateEntityReferenceInput[]): Promise<EntityReference[]> {
    return this.db.createEntityReferences(inputs);
  }

  async get(id: string): Promise<EntityReference | null> {
    return this.db.getEntityReference(id);
  }

  async query(query: EntityReferenceQuery): Promise<EntityReference[]> {
    return this.db.queryEntityReferences(query);
  }

  async count(query: Omit<EntityReferenceQuery, 'limit' | 'offset'>): Promise<number> {
    return this.db.countEntityReferences(query);
  }

  async delete(id: string): Promise<boolean> {
    return this.db.deleteEntityReference(id);
  }

  async deleteByLink(
    sourceType: EntityType,
    sourceId: string,
    targetType: EntityType,
    targetId: string,
    relationship: EntityReferenceRelationship,
  ): Promise<boolean> {
    return this.db.deleteEntityReferenceByLink(sourceType, sourceId, targetType, targetId, relationship);
  }

  async getRelatedEntities(entityType: EntityType, entityId: string, maxDepth?: number): Promise<EntityReference[]> {
    return this.db.getRelatedEntities(entityType, entityId, maxDepth);
  }
}

// =============================================================================
// Sub-Repository: Training
// =============================================================================

class SQLiteTrainingRepository implements ITrainingRepository {
  constructor(private db: SidStackDB) {}

  // Training sessions
  async getOrCreateSession(moduleId: string, projectPath?: string): Promise<TrainingSession> {
    return this.db.getOrCreateTrainingSession(moduleId, projectPath);
  }

  async getSession(id: string): Promise<TrainingSession | null> {
    return this.db.getTrainingSession(id);
  }

  async getSessionByModule(moduleId: string, projectPath?: string): Promise<TrainingSession | null> {
    return this.db.getTrainingSessionByModule(moduleId, projectPath);
  }

  async listSessions(projectPath?: string, status?: 'active' | 'archived'): Promise<TrainingSession[]> {
    return this.db.listTrainingSessions(projectPath, status);
  }

  async archiveSession(id: string): Promise<TrainingSession | null> {
    return this.db.archiveTrainingSession(id);
  }

  // Incidents
  async createIncident(input: CreateIncidentInput): Promise<Incident> {
    return this.db.createIncident(input);
  }

  async getIncident(id: string): Promise<Incident | null> {
    return this.db.getIncident(id);
  }

  async listIncidents(filters?: IncidentFilters): Promise<Incident[]> {
    return this.db.listIncidents(filters);
  }

  async updateIncident(input: UpdateIncidentInput): Promise<Incident | null> {
    return this.db.updateIncident(input);
  }

  async deleteIncident(id: string): Promise<boolean> {
    return this.db.deleteIncident(id);
  }

  // Lessons
  async createLesson(input: CreateLessonInput): Promise<Lesson> {
    return this.db.createLesson(input);
  }

  async getLesson(id: string): Promise<Lesson | null> {
    return this.db.getLesson(id);
  }

  async listLessons(filters?: LessonFilters): Promise<Lesson[]> {
    return this.db.listLessons(filters);
  }

  async updateLesson(input: UpdateLessonInput): Promise<Lesson | null> {
    return this.db.updateLesson(input);
  }

  async approveLesson(id: string, approver: string): Promise<Lesson | null> {
    return this.db.approveLesson(id, approver);
  }

  // Skills
  async createSkill(input: CreateSkillInput): Promise<Skill> {
    return this.db.createSkill(input);
  }

  async getSkill(id: string): Promise<Skill | null> {
    return this.db.getSkill(id);
  }

  async getSkillByName(name: string, projectPath?: string): Promise<Skill | null> {
    return this.db.getSkillByName(name, projectPath);
  }

  async listSkills(filters?: SkillFilters): Promise<Skill[]> {
    return this.db.listSkills(filters);
  }

  async updateSkill(input: UpdateSkillInput): Promise<Skill | null> {
    return this.db.updateSkill(input);
  }

  async activateSkill(id: string): Promise<Skill | null> {
    return this.db.activateSkill(id);
  }

  async deprecateSkill(id: string): Promise<Skill | null> {
    return this.db.deprecateSkill(id);
  }

  async incrementSkillUsage(id: string): Promise<Skill | null> {
    return this.db.incrementSkillUsage(id);
  }

  // Rules
  async createRule(input: CreateRuleInput): Promise<Rule> {
    return this.db.createRule(input);
  }

  async getRule(id: string): Promise<Rule | null> {
    return this.db.getRule(id);
  }

  async getRuleByName(name: string, projectPath?: string): Promise<Rule | null> {
    return this.db.getRuleByName(name, projectPath);
  }

  async listRules(filters?: RuleFilters): Promise<Rule[]> {
    return this.db.listRules(filters);
  }

  async updateRule(input: UpdateRuleInput): Promise<Rule | null> {
    return this.db.updateRule(input);
  }

  async deprecateRule(id: string): Promise<Rule | null> {
    return this.db.deprecateRule(id);
  }

  async recordRuleViolation(id: string): Promise<Rule | null> {
    return this.db.recordRuleViolation(id);
  }

  // Feedback
  async createFeedback(input: CreateFeedbackInput): Promise<TrainingFeedback> {
    return this.db.createTrainingFeedback(input);
  }

  async listFeedback(entityType: 'skill' | 'rule', entityId: string): Promise<TrainingFeedback[]> {
    return this.db.listTrainingFeedback(entityType, entityId);
  }

  // Context
  async getTrainingContext(moduleId: string, projectPath?: string, role?: string, taskType?: string): Promise<TrainingContext> {
    return this.db.getTrainingContext(moduleId, projectPath, role, taskType);
  }
}

// =============================================================================
// Sub-Repository: Sessions
// =============================================================================

class SQLiteSessionRepository implements ISessionRepository {
  constructor(private db: SidStackDB) {}

  async create(input: CreateClaudeSessionInput): Promise<ClaudeSession> {
    return this.db.createClaudeSession(input);
  }

  async get(id: string): Promise<ClaudeSession | null> {
    return this.db.getClaudeSession(id);
  }

  async update(id: string, updates: UpdateClaudeSessionInput): Promise<ClaudeSession | null> {
    return this.db.updateClaudeSession(id, updates);
  }

  async delete(id: string): Promise<boolean> {
    return this.db.deleteClaudeSession(id);
  }

  async list(filters?: SessionFilters): Promise<SessionListResult> {
    return this.db.listClaudeSessions(filters);
  }

  async getActive(workspacePath?: string): Promise<ClaudeSession[]> {
    return this.db.getActiveClaudeSessions(workspacePath);
  }

  async getByTask(taskId: string): Promise<ClaudeSession[]> {
    return this.db.getClaudeSessionsByTask(taskId);
  }

  async getByModule(moduleId: string): Promise<ClaudeSession[]> {
    return this.db.getClaudeSessionsByModule(moduleId);
  }

  async getBySpec(specId: string): Promise<ClaudeSession[]> {
    return this.db.getClaudeSessionsBySpec(specId);
  }

  async getByTicket(ticketId: string): Promise<ClaudeSession[]> {
    return this.db.getClaudeSessionsByTicket(ticketId);
  }

  async markActive(id: string): Promise<ClaudeSession | null> {
    return this.db.markClaudeSessionActive(id);
  }

  async markCompleted(id: string, exitCode?: number): Promise<ClaudeSession | null> {
    return this.db.markClaudeSessionCompleted(id, exitCode);
  }

  async markError(id: string, errorMessage: string): Promise<ClaudeSession | null> {
    return this.db.markClaudeSessionError(id, errorMessage);
  }

  async markTerminated(id: string): Promise<ClaudeSession | null> {
    return this.db.markClaudeSessionTerminated(id);
  }

  async recordResume(id: string): Promise<ClaudeSession | null> {
    return this.db.recordClaudeSessionResume(id);
  }

  async getStats(filters?: SessionFilters): Promise<SessionStats> {
    return this.db.getClaudeSessionStats(filters);
  }

  async cleanup(retentionDays?: number): Promise<{ sessions: number; events: number }> {
    return this.db.cleanupClaudeSessions(retentionDays);
  }

  // Events
  async logEvent(input: { claudeSessionId: string; eventType: string; details?: string }): Promise<SessionEvent> {
    // DB's logSessionEvent expects details as Record<string, unknown>
    // Parse the string details if provided
    const dbInput = {
      claudeSessionId: input.claudeSessionId,
      eventType: input.eventType,
      details: input.details ? (() => { try { return JSON.parse(input.details!); } catch { return { raw: input.details }; } })() : undefined,
    };
    return this.db.logSessionEvent(dbInput as any);
  }

  async getEvents(claudeSessionId: string): Promise<SessionEvent[]> {
    return this.db.getSessionEvents(claudeSessionId);
  }

  async buildResumeContext(claudeSessionId: string): Promise<ResumeContext> {
    return this.db.buildResumeContext(claudeSessionId);
  }
}

// =============================================================================
// Sub-Repository: Work History
// =============================================================================

class SQLiteWorkHistoryRepository implements IWorkHistoryRepository {
  constructor(private db: SidStackDB) {}

  async startSession(workspacePath: string, claudeSessionId?: string): Promise<WorkSession> {
    return this.db.startWorkSession(workspacePath, claudeSessionId);
  }

  async endSession(sessionId: string, summary?: string): Promise<void> {
    this.db.endWorkSession(sessionId, summary);
  }

  async getSession(sessionId: string): Promise<WorkSession | null> {
    return this.db.getWorkSession(sessionId);
  }

  async getSessions(workspacePath: string, timeframeHours?: number): Promise<WorkSession[]> {
    return this.db.getWorkSessions(workspacePath, timeframeHours);
  }

  async getActiveSession(workspacePath: string): Promise<WorkSession | null> {
    return this.db.getActiveWorkSession(workspacePath);
  }

  async logEntry(entry: Omit<WorkEntry, 'id' | 'timestamp'>): Promise<WorkEntry> {
    return this.db.logWorkEntry(entry);
  }

  async getHistory(filters: WorkHistoryFilters): Promise<WorkEntry[]> {
    // DB's getWorkHistory requires workspacePath which the interface doesn't provide.
    // Derive workspace from sessionId if available, otherwise use taskId-based lookup.
    if (filters.sessionId) {
      const session = this.db.getWorkSession(filters.sessionId);
      if (session) {
        const result = this.db.getWorkHistory(
          session.workspacePath,
          365 * 100, // large timeframe to get all entries
          { sessionId: filters.sessionId, taskId: filters.taskId, actionTypes: filters.actionTypes },
          1,
          filters.limit || 50,
        );
        return result.entries;
      }
    }

    // Fallback for taskId-only queries: use getRecentWorkEntries
    if (filters.taskId) {
      return this.db.getRecentWorkEntries(filters.taskId, filters.limit || 50);
    }

    return [];
  }

  async cleanup(retentionDays?: number): Promise<{ sessions: number; entries: number; progressLogs: number }> {
    return this.db.cleanupWorkHistory(retentionDays);
  }

  async getWorkHistory(
    workspacePath: string,
    timeframeHours: number,
    filters?: { sessionId?: string; taskId?: string; actionTypes?: string[] },
    page?: number,
    pageSize?: number,
  ): Promise<{ entries: WorkEntry[]; total: number }> {
    return this.db.getWorkHistory(workspacePath, timeframeHours, filters, page || 1, pageSize || 50);
  }

  async getRecentEntries(taskId: string, limit?: number): Promise<WorkEntry[]> {
    return this.db.getRecentWorkEntries(taskId, limit || 10);
  }
}

// =============================================================================
// Composite Repository
// =============================================================================

export class SQLiteRepository implements IRepository {
  private db!: SidStackDB;
  private mem0Client: Mem0Client;

  tasks!: SQLiteTaskRepository;
  tickets!: SQLiteTicketRepository;
  knowledge!: SQLiteKnowledgeRepository;
  impact!: SQLiteImpactRepository;
  testResults!: SQLiteTestResultRepository;
  memories!: SQLiteMemoryRepository;
  entityLinks!: SQLiteEntityLinkRepository;
  projects!: SQLiteProjectRepository;
  training!: SQLiteTrainingRepository;
  sessions!: SQLiteSessionRepository;
  workHistory!: SQLiteWorkHistoryRepository;

  constructor(private dbPath?: string) {
    this.mem0Client = new Mem0Client();
  }

  async initialize(): Promise<void> {
    this.db = await getDB(this.dbPath);

    this.projects = new SQLiteProjectRepository(this.db);
    this.tasks = new SQLiteTaskRepository(this.db);
    this.tickets = new SQLiteTicketRepository(this.db);
    this.knowledge = new SQLiteKnowledgeRepository(this.db);
    this.impact = new SQLiteImpactRepository(this.db);
    this.testResults = new SQLiteTestResultRepository();
    this.memories = new SQLiteMemoryRepository(this.mem0Client);
    this.entityLinks = new SQLiteEntityLinkRepository(this.db);
    this.training = new SQLiteTrainingRepository(this.db);
    this.sessions = new SQLiteSessionRepository(this.db);
    this.workHistory = new SQLiteWorkHistoryRepository(this.db);
  }

  async close(): Promise<void> {
    this.db.close();
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    // better-sqlite3 operations are synchronous and serialized.
    // True async transaction support requires PostgreSQL backend.
    // For SQLite, all operations within fn() complete atomically
    // in the same event loop tick since they're sync under the hood.
    return fn();
  }
}

/** Factory function to create and initialize a SQLite repository */
export async function createSQLiteRepository(dbPath?: string): Promise<SQLiteRepository> {
  const repo = new SQLiteRepository(dbPath);
  await repo.initialize();
  return repo;
}
