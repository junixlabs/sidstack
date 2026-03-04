/**
 * PostgreSQL Repository Implementation
 *
 * Implements IRepository using pg Pool for PostgreSQL backend.
 * All methods return Promises for async database access.
 */

import { Pool, type PoolConfig, type PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

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
  GovernanceViolationFilters,
  SessionListResult,
  WorkHistoryFilters,
} from './types';

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

import type {
  KnowledgeDocument,
  KnowledgeStats,
  ScoredDocument,
} from '../knowledge';

import type { Mem0Memory } from '../memory/index.js';

import type {
  TestResult,
  CreateTestResultInput,
  ListTestResultsFilters,
} from '../test-results';


// =============================================================================
// Helpers
// =============================================================================

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Safely parse JSON or return default value */
function safeJsonParse<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val as T; // pg returns JSONB as objects
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return fallback; }
  }
  return fallback;
}

/** Convert JSONB field to string for API compatibility (SQLite stored TEXT) */
function jsonToString(val: unknown): string {
  if (val === null || val === undefined) return '{}';
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}

/** Convert JSONB array field to string */
function jsonArrayToString(val: unknown): string {
  if (val === null || val === undefined) return '[]';
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}

// =============================================================================
// PostgresProjectRepository
// =============================================================================

class PostgresProjectRepository implements IProjectRepository {
  constructor(private pool: Pool) {}

  async list(): Promise<Project[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM projects ORDER BY "updatedAt" DESC'
    );
    return rows;
  }

  async get(id: string): Promise<Project | null> {
    const { rows } = await this.pool.query('SELECT * FROM projects WHERE id = $1', [id]);
    return rows[0] ?? null;
  }

  async getByPath(projectPath: string): Promise<Project | null> {
    const { rows } = await this.pool.query('SELECT * FROM projects WHERE path = $1', [projectPath]);
    return rows[0] ?? null;
  }

  async create(project: Omit<Project, 'createdAt' | 'updatedAt'>): Promise<Project> {
    const now = Date.now();
    const { rows } = await this.pool.query(
      `INSERT INTO projects (id, name, path, status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [project.id, project.name, project.path, project.status || 'active', now, now]
    );
    return rows[0];
  }

  async update(id: string, updates: Partial<Pick<Project, 'name' | 'status'>>): Promise<Project | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (updates.name !== undefined) { sets.push(`name = $${idx++}`); values.push(updates.name); }
    if (updates.status !== undefined) { sets.push(`status = $${idx++}`); values.push(updates.status); }

    if (sets.length === 0) return this.get(id);

    sets.push(`"updatedAt" = $${idx++}`);
    values.push(Date.now());
    values.push(id);

    await this.pool.query(
      `UPDATE projects SET ${sets.join(', ')} WHERE id = $${idx}`,
      values
    );
    return this.get(id);
  }
}

// =============================================================================
// PostgresTaskRepository
// =============================================================================

class PostgresTaskRepository implements ITaskRepository {
  constructor(private pool: Pool) {}

  private normalizeTask(row: Record<string, unknown>): Task {
    return {
      ...row,
      governance: jsonToString(row.governance),
      acceptanceCriteria: jsonToString(row.acceptanceCriteria),
      validation: jsonToString(row.validation),
      context: jsonToString(row.context),
    } as Task;
  }

  async list(projectId: string, filters?: TaskFilters): Promise<TaskListResult> {
    const preset = filters?.preset || 'actionable';
    const conditions: string[] = ['"projectId" = $1'];
    const values: unknown[] = [projectId];
    let idx = 2;

    // Apply preset filters
    if (preset === 'actionable') {
      conditions.push(`status IN ('pending', 'in_progress')`);
    } else if (preset === 'blocked') {
      conditions.push(`status = 'blocked'`);
    } else if (preset === 'recent') {
      conditions.push(`"updatedAt" > $${idx++}`);
      values.push(Date.now() - 24 * 60 * 60 * 1000);
    } else if (preset === 'epics') {
      conditions.push(`"parentTaskId" IS NULL`);
    }

    // Override with explicit filters
    if (filters?.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      conditions.push(`status = ANY($${idx++})`);
      values.push(statuses);
    }
    if (filters?.taskType && filters.taskType.length > 0) {
      conditions.push(`"taskType" = ANY($${idx++})`);
      values.push(filters.taskType);
    }
    if (filters?.priority) {
      conditions.push(`priority = $${idx++}`);
      values.push(filters.priority);
    }
    if (filters?.parentOnly) {
      conditions.push(`"parentTaskId" IS NULL`);
    }
    if (filters?.assignedAgent) {
      conditions.push(`"assignedAgent" = $${idx++}`);
      values.push(filters.assignedAgent);
    }
    if (filters?.search) {
      conditions.push(`(title ILIKE $${idx} OR description ILIKE $${idx})`);
      values.push(`%${filters.search}%`);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM tasks ${where}`, values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Determine fields based on field level
    let selectFields: string;
    const fieldLevel = filters?.fields || 'minimal';
    if (fieldLevel === 'minimal') {
      selectFields = 'id, title, status, "taskType", priority, "assignedAgent"';
    } else if (fieldLevel === 'standard') {
      selectFields = 'id, title, status, "taskType", priority, "assignedAgent", description, notes, progress, branch, "moduleId", "createdAt", "updatedAt"';
    } else {
      selectFields = '*';
    }

    const queryValues = [...values, limit, offset];
    const { rows } = await this.pool.query(
      `SELECT ${selectFields} FROM tasks ${where} ORDER BY "updatedAt" DESC LIMIT $${idx++} OFFSET $${idx}`,
      queryValues
    );

    const tasks = fieldLevel === 'full' ? rows.map(r => this.normalizeTask(r)) : rows;

    return { tasks, total, hasMore: offset + rows.length < total };
  }

  async get(id: string): Promise<Task | null> {
    const { rows } = await this.pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (!rows[0]) return null;
    return this.normalizeTask(rows[0]);
  }

  async create(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'progress'> & { id?: string }): Promise<Task> {
    const now = Date.now();
    const id = task.id || generateId('task');

    const { rows } = await this.pool.query(
      `INSERT INTO tasks (id, "projectId", "parentTaskId", title, description, status, priority, "assignedAgent", "createdBy", "createdAt", "updatedAt", progress, "taskType", "moduleId", governance, "acceptanceCriteria", validation, context, branch)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [
        id, task.projectId, task.parentTaskId || null, task.title, task.description || '',
        task.status || 'pending', task.priority || 'medium', task.assignedAgent || null,
        task.createdBy || 'user', now, now,
        task.taskType || 'feature', task.moduleId || null,
        task.governance || '{}', task.acceptanceCriteria || '[]',
        task.validation || '{}', task.context || '{}', task.branch || null,
      ]
    );
    return this.normalizeTask(rows[0]);
  }

  async update(id: string, updates: Partial<Task>): Promise<Task | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const fields: Array<[string, string, unknown]> = [
      ['title', 'title', updates.title],
      ['description', 'description', updates.description],
      ['status', 'status', updates.status],
      ['priority', 'priority', updates.priority],
      ['assignedAgent', '"assignedAgent"', updates.assignedAgent],
      ['progress', 'progress', updates.progress],
      ['notes', 'notes', updates.notes],
      ['taskType', '"taskType"', updates.taskType],
      ['moduleId', '"moduleId"', updates.moduleId],
      ['governance', 'governance', updates.governance],
      ['acceptanceCriteria', '"acceptanceCriteria"', updates.acceptanceCriteria],
      ['validation', 'validation', updates.validation],
      ['context', 'context', updates.context],
      ['branch', 'branch', updates.branch],
      ['solutionPlan', '"solutionPlan"', updates.solutionPlan],
      ['planStatus', '"planStatus"', updates.planStatus],
      ['planReviewNotes', '"planReviewNotes"', updates.planReviewNotes],
      ['implementSummary', '"implementSummary"', updates.implementSummary],
      ['parentTaskId', '"parentTaskId"', updates.parentTaskId],
    ];

    for (const [, col, val] of fields) {
      if (val !== undefined) {
        sets.push(`${col} = $${idx++}`);
        values.push(val);
      }
    }

    if (sets.length === 0) return this.get(id);

    sets.push(`"updatedAt" = $${idx++}`);
    values.push(Date.now());
    values.push(id);

    await this.pool.query(
      `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${idx}`,
      values
    );
    return this.get(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getSubtasks(parentTaskId: string): Promise<Task[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM tasks WHERE "parentTaskId" = $1 ORDER BY "createdAt" ASC',
      [parentTaskId]
    );
    return rows.map(r => this.normalizeTask(r));
  }

  // Progress tracking
  async logProgress(progress: Omit<TaskProgressLog, 'id' | 'createdAt'>): Promise<TaskProgressLog> {
    const id = generateId('prog');
    const now = Date.now();
    const { rows } = await this.pool.query(
      `INSERT INTO task_progress_log (id, "taskId", "sessionId", progress, status, "currentStep", notes, artifacts, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [id, progress.taskId, progress.sessionId || null, progress.progress, progress.status,
       progress.currentStep || null, progress.notes || null, progress.artifacts || '[]', now]
    );
    return { ...rows[0], artifacts: jsonArrayToString(rows[0].artifacts) };
  }

  async getProgressHistory(taskId: string): Promise<TaskProgressLog[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM task_progress_log WHERE "taskId" = $1 ORDER BY "createdAt" ASC',
      [taskId]
    );
    return rows.map(r => ({ ...r, artifacts: jsonArrayToString(r.artifacts) }));
  }

  async getLatestProgress(taskId: string): Promise<TaskProgressLog | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM task_progress_log WHERE "taskId" = $1 ORDER BY "createdAt" DESC LIMIT 1',
      [taskId]
    );
    if (!rows[0]) return null;
    return { ...rows[0], artifacts: jsonArrayToString(rows[0].artifacts) };
  }

  // Governance violations
  async logViolation(violation: Omit<GovernanceViolation, 'id' | 'resolved'>): Promise<GovernanceViolation> {
    const id = generateId('viol');
    const { rows } = await this.pool.query(
      `INSERT INTO governance_violations (id, "taskId", "violationType", blockers, reason, "agentId", "timestamp", resolved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false) RETURNING *`,
      [id, violation.taskId, violation.violationType, violation.blockers,
       violation.reason || null, violation.agentId || null, violation.timestamp]
    );
    return { ...rows[0], blockers: jsonToString(rows[0].blockers), resolved: rows[0].resolved };
  }

  async getViolation(id: string): Promise<GovernanceViolation | null> {
    const { rows } = await this.pool.query('SELECT * FROM governance_violations WHERE id = $1', [id]);
    if (!rows[0]) return null;
    return { ...rows[0], blockers: jsonToString(rows[0].blockers) };
  }

  async getTaskViolations(taskId: string): Promise<GovernanceViolation[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM governance_violations WHERE "taskId" = $1 ORDER BY "timestamp" DESC',
      [taskId]
    );
    return rows.map(r => ({ ...r, blockers: jsonToString(r.blockers) }));
  }

  async listViolations(filters?: GovernanceViolationFilters): Promise<GovernanceViolation[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filters?.resolved !== undefined) {
      conditions.push(`resolved = $${idx++}`);
      values.push(filters.resolved);
    }
    if (filters?.violationType) {
      conditions.push(`"violationType" = $${idx++}`);
      values.push(filters.violationType);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.pool.query(
      `SELECT * FROM governance_violations ${where} ORDER BY "timestamp" DESC`,
      values
    );
    return rows.map(r => ({ ...r, blockers: jsonToString(r.blockers) }));
  }

  async resolveViolation(id: string, resolvedBy: string): Promise<GovernanceViolation | null> {
    await this.pool.query(
      `UPDATE governance_violations SET resolved = true, "resolvedBy" = $1, "resolvedAt" = $2 WHERE id = $3`,
      [resolvedBy, Date.now(), id]
    );
    return this.getViolation(id);
  }

  // Task-spec links
  async createSpecLink(link: Omit<TaskSpecLink, 'id' | 'createdAt'>): Promise<TaskSpecLink> {
    const id = generateId('tsl');
    const now = Date.now();
    const { rows } = await this.pool.query(
      `INSERT INTO task_spec_links (id, "taskId", "specPath", "specType", "linkType", "linkReason", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, link.taskId, link.specPath, link.specType, link.linkType, link.linkReason || null, now]
    );
    return rows[0];
  }

  async getSpecLinks(taskId: string): Promise<TaskSpecLink[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM task_spec_links WHERE "taskId" = $1', [taskId]
    );
    return rows;
  }

  async deleteSpecLink(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM task_spec_links WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Task-knowledge links
  async createKnowledgeLink(link: Omit<TaskKnowledgeLink, 'id' | 'createdAt'>): Promise<TaskKnowledgeLink> {
    const id = generateId('tkl');
    const now = Date.now();
    const { rows } = await this.pool.query(
      `INSERT INTO task_knowledge_links (id, "taskId", "knowledgePath", "linkType", "linkReason", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, link.taskId, link.knowledgePath, link.linkType, link.linkReason || null, now]
    );
    return rows[0];
  }

  async getKnowledgeLinks(taskId: string): Promise<TaskKnowledgeLink[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM task_knowledge_links WHERE "taskId" = $1', [taskId]
    );
    return rows;
  }

  async deleteKnowledgeLink(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM task_knowledge_links WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Dismissed suggestions
  async dismissSuggestion(taskId: string, suggestedPath: string, suggestionType: 'spec' | 'knowledge'): Promise<DismissedSuggestion> {
    const id = generateId('ds');
    const now = Date.now();
    const { rows } = await this.pool.query(
      `INSERT INTO dismissed_suggestions (id, "taskId", "suggestedPath", "suggestionType", "dismissedAt")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("taskId", "suggestedPath") DO UPDATE SET "dismissedAt" = $5
       RETURNING *`,
      [id, taskId, suggestedPath, suggestionType, now]
    );
    return rows[0];
  }

  async isDismissed(taskId: string, suggestedPath: string): Promise<boolean> {
    const { rows } = await this.pool.query(
      'SELECT 1 FROM dismissed_suggestions WHERE "taskId" = $1 AND "suggestedPath" = $2 LIMIT 1',
      [taskId, suggestedPath]
    );
    return rows.length > 0;
  }

  async getDismissedSuggestions(taskId: string): Promise<DismissedSuggestion[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM dismissed_suggestions WHERE "taskId" = $1', [taskId]
    );
    return rows;
  }

  // Reverse lookups
  async getTaskIdsBySpec(specPath: string): Promise<string[]> {
    const { rows } = await this.pool.query(
      'SELECT DISTINCT "taskId" FROM task_spec_links WHERE "specPath" = $1',
      [specPath]
    );
    return rows.map(r => r.taskId);
  }

  async getTaskIdsByKnowledge(knowledgePath: string): Promise<string[]> {
    const { rows } = await this.pool.query(
      'SELECT DISTINCT "taskId" FROM task_knowledge_links WHERE "knowledgePath" = $1',
      [knowledgePath]
    );
    return rows.map(r => r.taskId);
  }

  async getUnifiedContext(taskId: string): Promise<{
    specLinks: TaskSpecLink[];
    knowledgeLinks: TaskKnowledgeLink[];
    dismissedPaths: string[];
  }> {
    const specLinks = await this.getSpecLinks(taskId);
    const knowledgeLinks = await this.getKnowledgeLinks(taskId);
    const dismissed = await this.getDismissedSuggestions(taskId);
    return {
      specLinks,
      knowledgeLinks,
      dismissedPaths: dismissed.map(d => d.suggestedPath),
    };
  }
}

// =============================================================================
// PostgresTicketRepository
// =============================================================================

class PostgresTicketRepository implements ITicketRepository {
  constructor(private pool: Pool) {}

  private normalizeTicket(row: Record<string, unknown>): Ticket {
    return {
      ...row,
      labels: jsonArrayToString(row.labels),
      attachments: jsonArrayToString(row.attachments),
      linkedIssues: jsonArrayToString(row.linkedIssues),
      externalUrls: jsonArrayToString(row.externalUrls),
    } as Ticket;
  }

  async list(projectId: string, filters?: TicketFilters): Promise<Ticket[]> {
    const conditions: string[] = ['"projectId" = $1'];
    const values: unknown[] = [projectId];
    let idx = 2;

    if (filters?.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      conditions.push(`status = ANY($${idx++})`);
      values.push(statuses);
    }
    if (filters?.type) {
      const types = Array.isArray(filters.type) ? filters.type : [filters.type];
      conditions.push(`type = ANY($${idx++})`);
      values.push(types);
    }
    if (filters?.priority) {
      const priorities = Array.isArray(filters.priority) ? filters.priority : [filters.priority];
      conditions.push(`priority = ANY($${idx++})`);
      values.push(priorities);
    }

    const limit = filters?.limit || 20;
    const offset = filters?.offset || 0;
    const where = `WHERE ${conditions.join(' AND ')}`;

    const { rows } = await this.pool.query(
      `SELECT * FROM tickets ${where} ORDER BY "createdAt" DESC LIMIT $${idx++} OFFSET $${idx}`,
      [...values, limit, offset]
    );
    return rows.map(r => this.normalizeTicket(r));
  }

  async get(id: string): Promise<Ticket | null> {
    const { rows } = await this.pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (!rows[0]) return null;
    return this.normalizeTicket(rows[0]);
  }

  async getByTaskId(taskId: string): Promise<Ticket | null> {
    const { rows } = await this.pool.query('SELECT * FROM tickets WHERE "taskId" = $1 LIMIT 1', [taskId]);
    if (!rows[0]) return null;
    return this.normalizeTicket(rows[0]);
  }

  async getByExternalId(externalId: string, projectId?: string): Promise<Ticket | null> {
    let query = 'SELECT * FROM tickets WHERE "externalId" = $1';
    const values: unknown[] = [externalId];
    if (projectId) {
      query += ' AND "projectId" = $2';
      values.push(projectId);
    }
    query += ' LIMIT 1';
    const { rows } = await this.pool.query(query, values);
    if (!rows[0]) return null;
    return this.normalizeTicket(rows[0]);
  }

  async create(ticket: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Ticket> {
    const id = ticket.id || generateId('ticket');
    const now = Date.now();
    const { rows } = await this.pool.query(
      `INSERT INTO tickets (id, "projectId", "externalId", source, title, description, type, priority, status,
        labels, attachments, "linkedIssues", "externalUrls", "taskId", "sessionId", reporter, assignee, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [
        id, ticket.projectId, ticket.externalId || null, ticket.source || 'api',
        ticket.title, ticket.description || null, ticket.type || 'task',
        ticket.priority || 'medium', ticket.status || 'new',
        ticket.labels || '[]', ticket.attachments || '[]',
        ticket.linkedIssues || '[]', ticket.externalUrls || '[]',
        ticket.taskId || null, ticket.sessionId || null,
        ticket.reporter || null, ticket.assignee || null, now, now,
      ]
    );
    return this.normalizeTicket(rows[0]);
  }

  async update(id: string, updates: Partial<Omit<Ticket, 'id' | 'projectId' | 'createdAt'>>): Promise<Ticket | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const fields: Array<[string, unknown]> = [
      ['title', updates.title],
      ['description', updates.description],
      ['status', updates.status],
      ['priority', updates.priority],
      ['type', updates.type],
      ['"externalId"', updates.externalId],
      ['source', updates.source],
      ['labels', updates.labels],
      ['attachments', updates.attachments],
      ['"linkedIssues"', updates.linkedIssues],
      ['"externalUrls"', updates.externalUrls],
      ['"taskId"', updates.taskId],
      ['"sessionId"', updates.sessionId],
      ['reporter', updates.reporter],
      ['assignee', updates.assignee],
    ];

    for (const [col, val] of fields) {
      if (val !== undefined) {
        sets.push(`${col} = $${idx++}`);
        values.push(val);
      }
    }

    if (sets.length === 0) return this.get(id);

    sets.push(`"updatedAt" = $${idx++}`);
    values.push(Date.now());
    values.push(id);

    await this.pool.query(
      `UPDATE tickets SET ${sets.join(', ')} WHERE id = $${idx}`,
      values
    );
    return this.get(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM tickets WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async count(projectId: string, status?: TicketStatus): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM tickets WHERE "projectId" = $1';
    const values: unknown[] = [projectId];
    if (status) {
      query += ' AND status = $2';
      values.push(status);
    }
    const { rows } = await this.pool.query(query, values);
    return parseInt(rows[0].count, 10);
  }
}

// =============================================================================
// PostgresKnowledgeRepository
// =============================================================================

class PostgresKnowledgeRepository implements IKnowledgeRepository {
  constructor(private pool: Pool) {}

  private normalizeDoc(row: Record<string, unknown>): KnowledgeDocument {
    const doc = row as unknown as KnowledgeDocument;
    return {
      ...doc,
      tags: safeJsonParse(row.tags, [] as string[]),
      related: safeJsonParse(row.related, [] as string[]),
      dependsOn: safeJsonParse(row.dependsOn, [] as string[]),
      covers: safeJsonParse(row.covers, [] as string[]),
      absolutePath: (row.sourcePath as string) || '',
    };
  }

  async list(projectId: string, options?: KnowledgeDocumentFilters): Promise<KnowledgeDocListResult> {
    const conditions: string[] = ['"projectId" = $1'];
    const values: unknown[] = [projectId];
    let idx = 2;

    if (options?.type) {
      const types = Array.isArray(options.type) ? options.type : [options.type];
      conditions.push(`type = ANY($${idx++})`);
      values.push(types);
    }
    if (options?.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      conditions.push(`status = ANY($${idx++})`);
      values.push(statuses);
    }
    if (options?.module) {
      conditions.push(`module = $${idx++}`);
      values.push(options.module);
    }
    if (options?.search) {
      conditions.push(`(title ILIKE $${idx} OR content ILIKE $${idx} OR summary ILIKE $${idx})`);
      values.push(`%${options.search}%`);
      idx++;
    }
    if (options?.tags && options.tags.length > 0) {
      conditions.push(`tags ?| $${idx++}`);
      values.push(options.tags);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    const sortBy = options?.sortBy || 'updatedAt';
    const sortOrder = options?.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const sortCol = sortBy === 'title' ? 'title' : sortBy === 'type' ? 'type' : sortBy === 'createdAt' ? '"createdAt"' : '"updatedAt"';

    const countResult = await this.pool.query(`SELECT COUNT(*) as count FROM knowledge_documents ${where}`, values);
    const total = parseInt(countResult.rows[0].count, 10);

    const { rows } = await this.pool.query(
      `SELECT * FROM knowledge_documents ${where} ORDER BY ${sortCol} ${sortOrder} LIMIT $${idx++} OFFSET $${idx}`,
      [...values, limit, offset]
    );

    return {
      documents: rows.map(r => this.normalizeDoc(r)),
      total,
      limit,
      offset,
    };
  }

  async get(id: string): Promise<KnowledgeDocument | null> {
    const { rows } = await this.pool.query('SELECT * FROM knowledge_documents WHERE id = $1', [id]);
    if (!rows[0]) return null;
    return this.normalizeDoc(rows[0]);
  }

  async getBySlug(projectId: string, slug: string): Promise<KnowledgeDocument | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM knowledge_documents WHERE "projectId" = $1 AND slug = $2',
      [projectId, slug]
    );
    if (!rows[0]) return null;
    return this.normalizeDoc(rows[0]);
  }

  async create(doc: {
    projectId: string; slug: string; title: string; type: string; content: string;
    status?: string; summary?: string; module?: string; tags?: string[];
    category?: string; owner?: string; reviewDate?: string; related?: string[];
    dependsOn?: string[]; covers?: string[]; source?: string; sourcePath?: string;
  }): Promise<KnowledgeDocument> {
    const id = generateId('kdoc');
    const now = new Date().toISOString();
    const wordCount = doc.content.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);

    const { rows } = await this.pool.query(
      `INSERT INTO knowledge_documents (id, "projectId", slug, title, type, status, content, summary, module, tags,
        category, owner, "reviewDate", related, "dependsOn", covers, source, "sourcePath", "wordCount", "readingTime", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`,
      [
        id, doc.projectId, doc.slug, doc.title, doc.type, doc.status || 'active',
        doc.content, doc.summary || null, doc.module || null,
        JSON.stringify(doc.tags || []), doc.category || null,
        doc.owner || null, doc.reviewDate || null,
        JSON.stringify(doc.related || []), JSON.stringify(doc.dependsOn || []),
        JSON.stringify(doc.covers || []), doc.source || 'manual',
        doc.sourcePath || null, wordCount, readingTime, now, now,
      ]
    );
    return this.normalizeDoc(rows[0]);
  }

  async update(id: string, updates: {
    title?: string; content?: string; status?: string; summary?: string;
    module?: string; tags?: string[]; category?: string; owner?: string;
    reviewDate?: string; related?: string[]; dependsOn?: string[]; covers?: string[];
  }): Promise<KnowledgeDocument | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (updates.title !== undefined) { sets.push(`title = $${idx++}`); values.push(updates.title); }
    if (updates.content !== undefined) {
      sets.push(`content = $${idx++}`); values.push(updates.content);
      const wordCount = updates.content.split(/\s+/).length;
      sets.push(`"wordCount" = $${idx++}`); values.push(wordCount);
      sets.push(`"readingTime" = $${idx++}`); values.push(Math.ceil(wordCount / 200));
    }
    if (updates.status !== undefined) { sets.push(`status = $${idx++}`); values.push(updates.status); }
    if (updates.summary !== undefined) { sets.push(`summary = $${idx++}`); values.push(updates.summary); }
    if (updates.module !== undefined) { sets.push(`module = $${idx++}`); values.push(updates.module); }
    if (updates.tags !== undefined) { sets.push(`tags = $${idx++}`); values.push(JSON.stringify(updates.tags)); }
    if (updates.category !== undefined) { sets.push(`category = $${idx++}`); values.push(updates.category); }
    if (updates.owner !== undefined) { sets.push(`owner = $${idx++}`); values.push(updates.owner); }
    if (updates.reviewDate !== undefined) { sets.push(`"reviewDate" = $${idx++}`); values.push(updates.reviewDate); }
    if (updates.related !== undefined) { sets.push(`related = $${idx++}`); values.push(JSON.stringify(updates.related)); }
    if (updates.dependsOn !== undefined) { sets.push(`"dependsOn" = $${idx++}`); values.push(JSON.stringify(updates.dependsOn)); }
    if (updates.covers !== undefined) { sets.push(`covers = $${idx++}`); values.push(JSON.stringify(updates.covers)); }

    if (sets.length === 0) return this.get(id);

    sets.push(`"updatedAt" = $${idx++}`);
    values.push(new Date().toISOString());
    values.push(id);

    await this.pool.query(
      `UPDATE knowledge_documents SET ${sets.join(', ')} WHERE id = $${idx}`,
      values
    );
    return this.get(id);
  }

  async delete(id: string, _archive?: boolean): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM knowledge_documents WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async search(projectId: string, query: string, limit?: number): Promise<ScoredDocument[]> {
    const maxResults = limit || 20;
    const { rows } = await this.pool.query(
      `SELECT *, 1.0 as "_score" FROM knowledge_documents
       WHERE "projectId" = $1 AND (title ILIKE $2 OR content ILIKE $2 OR summary ILIKE $2)
       ORDER BY "updatedAt" DESC LIMIT $3`,
      [projectId, `%${query}%`, maxResults]
    );
    return rows.map(r => ({ ...this.normalizeDoc(r), _score: r._score ?? 1.0 }));
  }

  async getStats(projectId: string): Promise<KnowledgeStats> {
    const { rows: typeRows } = await this.pool.query(
      'SELECT type, COUNT(*) as count FROM knowledge_documents WHERE "projectId" = $1 GROUP BY type',
      [projectId]
    );
    const { rows: statusRows } = await this.pool.query(
      'SELECT status, COUNT(*) as count FROM knowledge_documents WHERE "projectId" = $1 GROUP BY status',
      [projectId]
    );
    const { rows: sourceRows } = await this.pool.query(
      'SELECT source, COUNT(*) as count FROM knowledge_documents WHERE "projectId" = $1 GROUP BY source',
      [projectId]
    );
    const { rows: moduleRows } = await this.pool.query(
      'SELECT module, COUNT(*) as count FROM knowledge_documents WHERE "projectId" = $1 AND module IS NOT NULL GROUP BY module',
      [projectId]
    );
    const { rows: recentRows } = await this.pool.query(
      'SELECT * FROM knowledge_documents WHERE "projectId" = $1 ORDER BY "updatedAt" DESC LIMIT 10',
      [projectId]
    );
    const { rows: reviewRows } = await this.pool.query(
      `SELECT * FROM knowledge_documents WHERE "projectId" = $1 AND status = 'review' ORDER BY "updatedAt" DESC LIMIT 10`,
      [projectId]
    );
    const { rows: totalRows } = await this.pool.query(
      'SELECT COUNT(*) as count FROM knowledge_documents WHERE "projectId" = $1',
      [projectId]
    );

    const byType: Record<string, number> = {};
    for (const r of typeRows) byType[r.type] = parseInt(r.count, 10);
    const byStatus: Record<string, number> = {};
    for (const r of statusRows) byStatus[r.status] = parseInt(r.count, 10);
    const bySource: Record<string, number> = {};
    for (const r of sourceRows) bySource[r.source] = parseInt(r.count, 10);
    const byModule: Record<string, number> = {};
    for (const r of moduleRows) byModule[r.module] = parseInt(r.count, 10);

    return {
      totalDocuments: parseInt(totalRows[0].count, 10),
      byType: byType as KnowledgeStats['byType'],
      byStatus: byStatus as KnowledgeStats['byStatus'],
      bySource: bySource as KnowledgeStats['bySource'],
      byModule,
      recentlyUpdated: recentRows.map(r => this.normalizeDoc(r)),
      needsReview: reviewRows.map(r => this.normalizeDoc(r)),
    };
  }

  async getModulesWithDetails(projectId: string): Promise<unknown[]> {
    const { rows } = await this.pool.query(
      `SELECT module, COUNT(*) as doc_count,
        json_agg(DISTINCT type) as types
       FROM knowledge_documents
       WHERE "projectId" = $1 AND module IS NOT NULL
       GROUP BY module ORDER BY module`,
      [projectId]
    );
    return rows;
  }

  async getModuleOverview(projectId: string, moduleId: string): Promise<unknown | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM knowledge_documents WHERE "projectId" = $1 AND module = $2 ORDER BY type, title`,
      [projectId, moduleId]
    );
    if (rows.length === 0) return null;
    return {
      moduleId,
      documents: rows.map(r => this.normalizeDoc(r)),
      documentCount: rows.length,
    };
  }
}

// =============================================================================
// PostgresImpactRepository
// =============================================================================

class PostgresImpactRepository implements IImpactRepository {
  constructor(private pool: Pool) {}

  private normalizeAnalysis(row: Record<string, unknown>): ImpactAnalysis {
    return {
      ...row,
      inputJson: jsonToString(row.inputJson),
      parsedJson: row.parsedJson ? jsonToString(row.parsedJson) : undefined,
      scopeJson: row.scopeJson ? jsonToString(row.scopeJson) : undefined,
      dataFlowsJson: row.dataFlowsJson ? jsonToString(row.dataFlowsJson) : undefined,
      risksJson: row.risksJson ? jsonToString(row.risksJson) : undefined,
      gateJson: row.gateJson ? jsonToString(row.gateJson) : undefined,
    } as ImpactAnalysis;
  }

  async create(analysis: {
    id?: string; projectId?: string; taskId?: string; specId?: string;
    changeType?: string; inputJson: string;
  }): Promise<{ id: string; createdAt: number; updatedAt: number }> {
    const id = analysis.id || generateId('impact');
    const now = Date.now();
    const { rows } = await this.pool.query(
      `INSERT INTO impact_analyses (id, "projectId", "taskId", "specId", "changeType", status, "inputJson", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8) RETURNING id, "createdAt", "updatedAt"`,
      [id, analysis.projectId || '', analysis.taskId || null, analysis.specId || null,
       analysis.changeType || 'feature', analysis.inputJson, now, now]
    );
    return rows[0];
  }

  async get(id: string): Promise<ImpactAnalysis | null> {
    const { rows } = await this.pool.query('SELECT * FROM impact_analyses WHERE id = $1', [id]);
    if (!rows[0]) return null;
    return this.normalizeAnalysis(rows[0]);
  }

  async getByTask(taskId: string): Promise<ImpactAnalysis | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM impact_analyses WHERE "taskId" = $1 ORDER BY "createdAt" DESC LIMIT 1',
      [taskId]
    );
    if (!rows[0]) return null;
    return this.normalizeAnalysis(rows[0]);
  }

  async getBySpec(specId: string): Promise<ImpactAnalysis | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM impact_analyses WHERE "specId" = $1 ORDER BY "createdAt" DESC LIMIT 1',
      [specId]
    );
    if (!rows[0]) return null;
    return this.normalizeAnalysis(rows[0]);
  }

  async list(projectId: string, filters?: ImpactAnalysisFilters): Promise<ImpactAnalysis[]> {
    const conditions: string[] = ['"projectId" = $1'];
    const values: unknown[] = [projectId];
    let idx = 2;

    if (filters?.status) {
      conditions.push(`status = $${idx++}`);
      values.push(filters.status);
    }

    const limit = filters?.limit || 10;
    const where = `WHERE ${conditions.join(' AND ')}`;

    const { rows } = await this.pool.query(
      `SELECT * FROM impact_analyses ${where} ORDER BY "createdAt" DESC LIMIT $${idx}`,
      [...values, limit]
    );
    return rows.map(r => this.normalizeAnalysis(r));
  }

  async update(id: string, updates: {
    status?: string; parsedJson?: string; scopeJson?: string;
    dataFlowsJson?: string; risksJson?: string; gateJson?: string; error?: string;
  }): Promise<boolean> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (updates.status !== undefined) { sets.push(`status = $${idx++}`); values.push(updates.status); }
    if (updates.parsedJson !== undefined) { sets.push(`"parsedJson" = $${idx++}`); values.push(updates.parsedJson); }
    if (updates.scopeJson !== undefined) { sets.push(`"scopeJson" = $${idx++}`); values.push(updates.scopeJson); }
    if (updates.dataFlowsJson !== undefined) { sets.push(`"dataFlowsJson" = $${idx++}`); values.push(updates.dataFlowsJson); }
    if (updates.risksJson !== undefined) { sets.push(`"risksJson" = $${idx++}`); values.push(updates.risksJson); }
    if (updates.gateJson !== undefined) { sets.push(`"gateJson" = $${idx++}`); values.push(updates.gateJson); }
    if (updates.error !== undefined) { sets.push(`error = $${idx++}`); values.push(updates.error); }

    if (sets.length === 0) return false;

    sets.push(`"updatedAt" = $${idx++}`);
    values.push(Date.now());
    values.push(id);

    const result = await this.pool.query(
      `UPDATE impact_analyses SET ${sets.join(', ')} WHERE id = $${idx}`,
      values
    );
    return (result.rowCount ?? 0) > 0;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM impact_analyses WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Validation items
  async createValidation(validation: {
    id?: string; analysisId: string; title: string; description?: string;
    category: string; isBlocking: boolean;
    autoVerifiable?: boolean; verifyCommand?: string; expectedPattern?: string;
    riskId?: string; dataFlowId?: string; moduleId?: string;
  }): Promise<ImpactValidation> {
    const id = validation.id || generateId('ival');
    const now = Date.now();
    const { rows } = await this.pool.query(
      `INSERT INTO impact_validations (id, "analysisId", title, description, category, status, "isBlocking", "autoVerifiable", "verifyCommand", "expectedPattern", "riskId", "dataFlowId", "moduleId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [id, validation.analysisId, validation.title, validation.description || null,
       validation.category, validation.isBlocking,
       validation.autoVerifiable ?? false, validation.verifyCommand || null,
       validation.expectedPattern || null, validation.riskId || null,
       validation.dataFlowId || null, validation.moduleId || null, now, now]
    );
    return rows[0];
  }

  async getValidation(id: string): Promise<ImpactValidation | null> {
    const { rows } = await this.pool.query('SELECT * FROM impact_validations WHERE id = $1', [id]);
    return rows[0] ?? null;
  }

  async getValidations(analysisId: string): Promise<ImpactValidation[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM impact_validations WHERE "analysisId" = $1 ORDER BY "createdAt" ASC',
      [analysisId]
    );
    return rows;
  }

  async updateValidation(id: string, updates: {
    status?: string; validatedBy?: string; notes?: string; resultJson?: string;
  }): Promise<boolean> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (updates.status !== undefined) { sets.push(`status = $${idx++}`); values.push(updates.status); }
    if (updates.validatedBy !== undefined) { sets.push(`"validatedBy" = $${idx++}`); values.push(updates.validatedBy); }
    if (updates.notes !== undefined) { sets.push(`notes = $${idx++}`); values.push(updates.notes); }
    if (updates.resultJson !== undefined) { sets.push(`"resultJson" = $${idx++}`); values.push(updates.resultJson); }

    if (sets.length === 0) return false;

    sets.push(`"updatedAt" = $${idx++}`);
    values.push(Date.now());
    values.push(id);

    const result = await this.pool.query(
      `UPDATE impact_validations SET ${sets.join(', ')} WHERE id = $${idx}`,
      values
    );
    return (result.rowCount ?? 0) > 0;
  }

  // Gate approvals
  async createGateApproval(approval: {
    analysisId: string; gate: string; approvedBy: string; reason?: string;
  }): Promise<GateApproval> {
    const id = generateId('gappr');
    const now = Date.now();
    const { rows } = await this.pool.query(
      `INSERT INTO gate_approvals (id, "analysisId", approver, reason, "approvedBlockersJson", "createdAt")
       VALUES ($1, $2, $3, $4, '{}', $5) RETURNING *`,
      [id, approval.analysisId, approval.approvedBy, approval.reason || '', now]
    );
    return rows[0];
  }

  async getGateApprovals(analysisId: string): Promise<GateApproval[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM gate_approvals WHERE "analysisId" = $1 ORDER BY "createdAt" ASC',
      [analysisId]
    );
    return rows;
  }

  // Analysis history
  async createHistory(history: {
    analysisId: string; action: string; details?: string; performedBy?: string;
  }): Promise<AnalysisHistory> {
    const id = generateId('ahist');
    const now = Date.now();
    const { rows } = await this.pool.query(
      `INSERT INTO analysis_history (id, "analysisId", "actualIssuesJson", "accuracyScore", notes, "createdAt")
       VALUES ($1, $2, $3, 0, $4, $5) RETURNING *`,
      [id, history.analysisId, history.details || '{}', history.performedBy || null, now]
    );
    return rows[0];
  }

  async getHistory(analysisId: string): Promise<AnalysisHistory[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM analysis_history WHERE "analysisId" = $1 ORDER BY "createdAt" ASC',
      [analysisId]
    );
    return rows;
  }
}

// =============================================================================
// PostgresEntityLinkRepository
// =============================================================================

class PostgresEntityLinkRepository implements IEntityLinkRepository {
  constructor(private pool: Pool) {}

  private normalizeRef(row: Record<string, unknown>): EntityReference {
    return {
      id: row.id as string,
      sourceType: row.source_type as EntityType,
      sourceId: row.source_id as string,
      targetType: row.target_type as EntityType,
      targetId: row.target_id as string,
      relationship: row.relationship as EntityReferenceRelationship,
      metadata: row.metadata ? jsonToString(row.metadata) : undefined,
      createdAt: row.created_at as number,
      createdBy: row.created_by as string | undefined,
    };
  }

  async create(input: CreateEntityReferenceInput): Promise<EntityReference> {
    const id = generateId('ref');
    const now = Date.now();
    const metadata = input.metadata ? JSON.stringify(input.metadata) : null;

    const { rows } = await this.pool.query(
      `INSERT INTO entity_references (id, source_type, source_id, target_type, target_id, relationship, metadata, created_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (source_type, source_id, target_type, target_id, relationship) DO UPDATE SET metadata = EXCLUDED.metadata, created_at = EXCLUDED.created_at
       RETURNING *`,
      [id, input.sourceType, input.sourceId, input.targetType, input.targetId,
       input.relationship, metadata, now, input.createdBy || null]
    );
    return this.normalizeRef(rows[0]);
  }

  async createBatch(inputs: CreateEntityReferenceInput[]): Promise<EntityReference[]> {
    const results: EntityReference[] = [];
    for (const input of inputs) {
      results.push(await this.create(input));
    }
    return results;
  }

  async get(id: string): Promise<EntityReference | null> {
    const { rows } = await this.pool.query('SELECT * FROM entity_references WHERE id = $1', [id]);
    if (!rows[0]) return null;
    return this.normalizeRef(rows[0]);
  }

  async query(query: EntityReferenceQuery): Promise<EntityReference[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const direction = query.direction || 'both';

    if (query.entityType && query.entityId) {
      if (direction === 'forward') {
        conditions.push(`source_type = $${idx++} AND source_id = $${idx++}`);
        values.push(query.entityType, query.entityId);
      } else if (direction === 'reverse') {
        conditions.push(`target_type = $${idx++} AND target_id = $${idx++}`);
        values.push(query.entityType, query.entityId);
      } else {
        conditions.push(`((source_type = $${idx} AND source_id = $${idx + 1}) OR (target_type = $${idx} AND target_id = $${idx + 1}))`);
        values.push(query.entityType, query.entityId);
        idx += 2;
      }
    } else {
      if (query.sourceType) { conditions.push(`source_type = $${idx++}`); values.push(query.sourceType); }
      if (query.sourceId) { conditions.push(`source_id = $${idx++}`); values.push(query.sourceId); }
      if (query.targetType) { conditions.push(`target_type = $${idx++}`); values.push(query.targetType); }
      if (query.targetId) { conditions.push(`target_id = $${idx++}`); values.push(query.targetId); }
    }

    if (query.relationship) {
      const rels = Array.isArray(query.relationship) ? query.relationship : [query.relationship];
      conditions.push(`relationship = ANY($${idx++})`);
      values.push(rels);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = query.limit || 100;
    const offset = query.offset || 0;

    const { rows } = await this.pool.query(
      `SELECT * FROM entity_references ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      [...values, limit, offset]
    );
    return rows.map(r => this.normalizeRef(r));
  }

  async count(query: Omit<EntityReferenceQuery, 'limit' | 'offset'>): Promise<number> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const direction = query.direction || 'both';

    if (query.entityType && query.entityId) {
      if (direction === 'forward') {
        conditions.push(`source_type = $${idx++} AND source_id = $${idx++}`);
        values.push(query.entityType, query.entityId);
      } else if (direction === 'reverse') {
        conditions.push(`target_type = $${idx++} AND target_id = $${idx++}`);
        values.push(query.entityType, query.entityId);
      } else {
        conditions.push(`((source_type = $${idx} AND source_id = $${idx + 1}) OR (target_type = $${idx} AND target_id = $${idx + 1}))`);
        values.push(query.entityType, query.entityId);
        idx += 2;
      }
    } else {
      if (query.sourceType) { conditions.push(`source_type = $${idx++}`); values.push(query.sourceType); }
      if (query.sourceId) { conditions.push(`source_id = $${idx++}`); values.push(query.sourceId); }
      if (query.targetType) { conditions.push(`target_type = $${idx++}`); values.push(query.targetType); }
      if (query.targetId) { conditions.push(`target_id = $${idx++}`); values.push(query.targetId); }
    }

    if (query.relationship) {
      const rels = Array.isArray(query.relationship) ? query.relationship : [query.relationship];
      conditions.push(`relationship = ANY($${idx++})`);
      values.push(rels);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.pool.query(
      `SELECT COUNT(*) as count FROM entity_references ${where}`,
      values
    );
    return parseInt(rows[0].count, 10);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM entity_references WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async deleteByLink(
    sourceType: EntityType, sourceId: string,
    targetType: EntityType, targetId: string,
    relationship: EntityReferenceRelationship,
  ): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM entity_references
       WHERE source_type = $1 AND source_id = $2 AND target_type = $3 AND target_id = $4 AND relationship = $5`,
      [sourceType, sourceId, targetType, targetId, relationship]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getRelatedEntities(entityType: EntityType, entityId: string, maxDepth?: number): Promise<EntityReference[]> {
    // For depth 1, simple query
    if (!maxDepth || maxDepth <= 1) {
      return this.query({ entityType, entityId, direction: 'both' });
    }

    // BFS traversal for deeper connections
    const visited = new Set<string>();
    const allRefs: EntityReference[] = [];
    let frontier: Array<{ type: EntityType; id: string }> = [{ type: entityType, id: entityId }];

    for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
      const nextFrontier: Array<{ type: EntityType; id: string }> = [];
      for (const node of frontier) {
        const key = `${node.type}:${node.id}`;
        if (visited.has(key)) continue;
        visited.add(key);

        const refs = await this.query({ entityType: node.type, entityId: node.id, direction: 'both' });
        for (const ref of refs) {
          allRefs.push(ref);
          nextFrontier.push({ type: ref.sourceType, id: ref.sourceId });
          nextFrontier.push({ type: ref.targetType, id: ref.targetId });
        }
      }
      frontier = nextFrontier;
    }

    return allRefs;
  }
}

// =============================================================================
// PostgresTestResultRepository (file-based, delegates to existing functions)
// =============================================================================

class PostgresTestResultRepository implements ITestResultRepository {
  async list(projectPath: string, filters?: ListTestResultsFilters): Promise<TestResult[]> {
    // Test results are file-based, delegate to existing implementation
    const { listTestResults } = await import('../test-results.js');
    return listTestResults(projectPath, filters);
  }

  async get(projectPath: string, id: string): Promise<TestResult | null> {
    const { getTestResult } = await import('../test-results.js');
    return getTestResult(projectPath, id);
  }

  async create(projectPath: string, input: CreateTestResultInput): Promise<TestResult> {
    const { createTestResult } = await import('../test-results.js');
    return createTestResult(projectPath, input);
  }
}

// =============================================================================
// PostgresMemoryRepository (delegates to mem0 REST API, same as SQLite)
// =============================================================================

class PostgresMemoryRepository implements IMemoryRepository {
  async list(_projectId?: string): Promise<Mem0Memory[]> {
    throw new Error('Memory repository delegates to mem0 REST API. Not implemented in PostgreSQL repository.');
  }

  async search(_query: string, _projectId: string, _limit?: number): Promise<Mem0Memory[]> {
    throw new Error('Memory repository delegates to mem0 REST API. Not implemented in PostgreSQL repository.');
  }

  async add(_content: string, _projectId: string, _metadata?: Record<string, unknown>): Promise<Mem0Memory> {
    throw new Error('Memory repository delegates to mem0 REST API. Not implemented in PostgreSQL repository.');
  }

  async delete(_memoryId: string, _projectId?: string): Promise<boolean> {
    throw new Error('Memory repository delegates to mem0 REST API. Not implemented in PostgreSQL repository.');
  }
}

// =============================================================================
// PostgresTrainingRepository
// =============================================================================

class PostgresTrainingRepository implements ITrainingRepository {
  constructor(private pool: Pool) {}

  async getOrCreateSession(moduleId: string, projectPath?: string): Promise<TrainingSession> {
    const pp = projectPath || '';
    const existing = await this.getSessionByModule(moduleId, pp);
    if (existing) return existing;

    const id = generateId('tsess');
    const now = Date.now();
    const { rows } = await this.pool.query(
      `INSERT INTO training_sessions (id, "projectPath", "moduleId", status, "totalIncidents", "totalLessons", "totalSkills", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'active', 0, 0, 0, $4, $5) RETURNING *`,
      [id, pp, moduleId, now, now]
    );
    return rows[0];
  }

  async getSession(id: string): Promise<TrainingSession | null> {
    const { rows } = await this.pool.query('SELECT * FROM training_sessions WHERE id = $1', [id]);
    return rows[0] ?? null;
  }

  async getSessionByModule(moduleId: string, projectPath?: string): Promise<TrainingSession | null> {
    const pp = projectPath || '';
    const { rows } = await this.pool.query(
      'SELECT * FROM training_sessions WHERE "moduleId" = $1 AND "projectPath" = $2 LIMIT 1',
      [moduleId, pp]
    );
    return rows[0] ?? null;
  }

  async listSessions(projectPath?: string, status?: 'active' | 'archived'): Promise<TrainingSession[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (projectPath) { conditions.push(`"projectPath" = $${idx++}`); values.push(projectPath); }
    if (status) { conditions.push(`status = $${idx++}`); values.push(status); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.pool.query(
      `SELECT * FROM training_sessions ${where} ORDER BY "updatedAt" DESC`,
      values
    );
    return rows;
  }

  async archiveSession(id: string): Promise<TrainingSession | null> {
    await this.pool.query(
      `UPDATE training_sessions SET status = 'archived', "updatedAt" = $1 WHERE id = $2`,
      [Date.now(), id]
    );
    return this.getSession(id);
  }

  // Incidents
  async createIncident(input: CreateIncidentInput): Promise<Incident> {
    const id = generateId('inc');
    const now = Date.now();
    const { rows } = await this.pool.query(
      `INSERT INTO incidents (id, "sessionId", type, severity, title, description, context, status, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8) RETURNING *`,
      [id, input.sessionId, input.type, input.severity, input.title,
       input.description || null, input.context ? JSON.stringify(input.context) : null, now]
    );
    // Update session totals
    await this.pool.query(
      `UPDATE training_sessions SET "totalIncidents" = "totalIncidents" + 1, "updatedAt" = $1 WHERE id = $2`,
      [now, input.sessionId]
    );
    return { ...rows[0], context: rows[0].context ? jsonToString(rows[0].context) : undefined };
  }

  async getIncident(id: string): Promise<Incident | null> {
    const { rows } = await this.pool.query('SELECT * FROM incidents WHERE id = $1', [id]);
    if (!rows[0]) return null;
    return { ...rows[0], context: rows[0].context ? jsonToString(rows[0].context) : undefined };
  }

  async listIncidents(filters?: IncidentFilters): Promise<Incident[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filters?.sessionId) { conditions.push(`"sessionId" = $${idx++}`); values.push(filters.sessionId); }
    if (filters?.type) { conditions.push(`type = $${idx++}`); values.push(filters.type); }
    if (filters?.severity) { conditions.push(`severity = $${idx++}`); values.push(filters.severity); }
    if (filters?.status) { conditions.push(`status = $${idx++}`); values.push(filters.status); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.pool.query(
      `SELECT * FROM incidents ${where} ORDER BY "createdAt" DESC`,
      values
    );
    return rows.map(r => ({ ...r, context: r.context ? jsonToString(r.context) : undefined }));
  }

  async updateIncident(input: UpdateIncidentInput): Promise<Incident | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.type !== undefined) { sets.push(`type = $${idx++}`); values.push(input.type); }
    if (input.severity !== undefined) { sets.push(`severity = $${idx++}`); values.push(input.severity); }
    if (input.title !== undefined) { sets.push(`title = $${idx++}`); values.push(input.title); }
    if (input.description !== undefined) { sets.push(`description = $${idx++}`); values.push(input.description); }
    if (input.context !== undefined) { sets.push(`context = $${idx++}`); values.push(JSON.stringify(input.context)); }
    if (input.resolution !== undefined) { sets.push(`resolution = $${idx++}`); values.push(input.resolution); }
    if (input.status !== undefined) { sets.push(`status = $${idx++}`); values.push(input.status); }

    if (sets.length === 0) return this.getIncident(input.id);

    values.push(input.id);
    await this.pool.query(
      `UPDATE incidents SET ${sets.join(', ')} WHERE id = $${idx}`,
      values
    );
    return this.getIncident(input.id);
  }

  async deleteIncident(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM incidents WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Lessons
  async createLesson(input: CreateLessonInput): Promise<Lesson> {
    const id = generateId('les');
    const now = Date.now();
    const { rows } = await this.pool.query(
      `INSERT INTO lessons (id, "sessionId", "incidentIds", title, problem, "rootCause", solution, applicability, status, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9) RETURNING *`,
      [id, input.sessionId, input.incidentIds ? JSON.stringify(input.incidentIds) : null,
       input.title, input.problem, input.rootCause, input.solution,
       input.applicability ? JSON.stringify(input.applicability) : null, now]
    );
    await this.pool.query(
      `UPDATE training_sessions SET "totalLessons" = "totalLessons" + 1, "updatedAt" = $1 WHERE id = $2`,
      [now, input.sessionId]
    );
    return {
      ...rows[0],
      incidentIds: rows[0].incidentIds ? jsonArrayToString(rows[0].incidentIds) : undefined,
      applicability: rows[0].applicability ? jsonToString(rows[0].applicability) : undefined,
    };
  }

  async getLesson(id: string): Promise<Lesson | null> {
    const { rows } = await this.pool.query('SELECT * FROM lessons WHERE id = $1', [id]);
    if (!rows[0]) return null;
    return {
      ...rows[0],
      incidentIds: rows[0].incidentIds ? jsonArrayToString(rows[0].incidentIds) : undefined,
      applicability: rows[0].applicability ? jsonToString(rows[0].applicability) : undefined,
    };
  }

  async listLessons(filters?: LessonFilters): Promise<Lesson[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filters?.sessionId) { conditions.push(`"sessionId" = $${idx++}`); values.push(filters.sessionId); }
    if (filters?.status) { conditions.push(`status = $${idx++}`); values.push(filters.status); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.pool.query(
      `SELECT * FROM lessons ${where} ORDER BY "createdAt" DESC`,
      values
    );
    return rows.map(r => ({
      ...r,
      incidentIds: r.incidentIds ? jsonArrayToString(r.incidentIds) : undefined,
      applicability: r.applicability ? jsonToString(r.applicability) : undefined,
    }));
  }

  async updateLesson(input: UpdateLessonInput): Promise<Lesson | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.title !== undefined) { sets.push(`title = $${idx++}`); values.push(input.title); }
    if (input.problem !== undefined) { sets.push(`problem = $${idx++}`); values.push(input.problem); }
    if (input.rootCause !== undefined) { sets.push(`"rootCause" = $${idx++}`); values.push(input.rootCause); }
    if (input.solution !== undefined) { sets.push(`solution = $${idx++}`); values.push(input.solution); }
    if (input.applicability !== undefined) { sets.push(`applicability = $${idx++}`); values.push(JSON.stringify(input.applicability)); }
    if (input.status !== undefined) { sets.push(`status = $${idx++}`); values.push(input.status); }
    if (input.approvedBy !== undefined) { sets.push(`"approvedBy" = $${idx++}`); values.push(input.approvedBy); }

    if (sets.length === 0) return this.getLesson(input.id);

    values.push(input.id);
    await this.pool.query(
      `UPDATE lessons SET ${sets.join(', ')} WHERE id = $${idx}`,
      values
    );
    return this.getLesson(input.id);
  }

  async approveLesson(id: string, approver: string): Promise<Lesson | null> {
    return this.updateLesson({ id, status: 'approved', approvedBy: approver });
  }

  // Skills
  async createSkill(input: CreateSkillInput): Promise<Skill> {
    const id = generateId('skill');
    const now = Date.now();
    const { rows } = await this.pool.query(
      `INSERT INTO skills (id, "projectPath", name, description, "lessonIds", type, content, "triggerConfig", applicability, status, "usageCount", "successRate", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', 0, 0, $10, $11) RETURNING *`,
      [id, input.projectPath || '', input.name, input.description || null,
       input.lessonIds ? JSON.stringify(input.lessonIds) : null,
       input.type, input.content,
       input.trigger ? JSON.stringify(input.trigger) : null,
       input.applicability ? JSON.stringify(input.applicability) : null, now, now]
    );
    return this.normalizeSkill(rows[0]);
  }

  private normalizeSkill(row: Record<string, unknown>): Skill {
    return {
      ...row,
      lessonIds: row.lessonIds ? jsonArrayToString(row.lessonIds) : undefined,
      triggerConfig: row.triggerConfig ? jsonToString(row.triggerConfig) : undefined,
      applicability: row.applicability ? jsonToString(row.applicability) : undefined,
    } as Skill;
  }

  async getSkill(id: string): Promise<Skill | null> {
    const { rows } = await this.pool.query('SELECT * FROM skills WHERE id = $1', [id]);
    if (!rows[0]) return null;
    return this.normalizeSkill(rows[0]);
  }

  async getSkillByName(name: string, projectPath?: string): Promise<Skill | null> {
    const pp = projectPath || '';
    const { rows } = await this.pool.query(
      'SELECT * FROM skills WHERE name = $1 AND "projectPath" = $2 LIMIT 1',
      [name, pp]
    );
    if (!rows[0]) return null;
    return this.normalizeSkill(rows[0]);
  }

  async listSkills(filters?: SkillFilters): Promise<Skill[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filters?.projectPath) { conditions.push(`"projectPath" = $${idx++}`); values.push(filters.projectPath); }
    if (filters?.status) { conditions.push(`status = $${idx++}`); values.push(filters.status); }
    if (filters?.type) { conditions.push(`type = $${idx++}`); values.push(filters.type); }
    if (filters?.module) {
      conditions.push(`applicability ->'modules' ? $${idx++}`);
      values.push(filters.module);
    }
    if (filters?.role) {
      conditions.push(`applicability ->'roles' ? $${idx++}`);
      values.push(filters.role);
    }
    if (filters?.taskType) {
      conditions.push(`applicability ->'taskTypes' ? $${idx++}`);
      values.push(filters.taskType);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.pool.query(
      `SELECT * FROM skills ${where} ORDER BY "updatedAt" DESC`,
      values
    );
    return rows.map(r => this.normalizeSkill(r));
  }

  async updateSkill(input: UpdateSkillInput): Promise<Skill | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { sets.push(`name = $${idx++}`); values.push(input.name); }
    if (input.description !== undefined) { sets.push(`description = $${idx++}`); values.push(input.description); }
    if (input.lessonIds !== undefined) { sets.push(`"lessonIds" = $${idx++}`); values.push(JSON.stringify(input.lessonIds)); }
    if (input.type !== undefined) { sets.push(`type = $${idx++}`); values.push(input.type); }
    if (input.content !== undefined) { sets.push(`content = $${idx++}`); values.push(input.content); }
    if (input.trigger !== undefined) { sets.push(`"triggerConfig" = $${idx++}`); values.push(JSON.stringify(input.trigger)); }
    if (input.applicability !== undefined) { sets.push(`applicability = $${idx++}`); values.push(JSON.stringify(input.applicability)); }
    if (input.status !== undefined) { sets.push(`status = $${idx++}`); values.push(input.status); }
    if (input.successRate !== undefined) { sets.push(`"successRate" = $${idx++}`); values.push(input.successRate); }

    if (sets.length === 0) return this.getSkill(input.id);

    sets.push(`"updatedAt" = $${idx++}`);
    values.push(Date.now());
    values.push(input.id);

    await this.pool.query(
      `UPDATE skills SET ${sets.join(', ')} WHERE id = $${idx}`,
      values
    );
    return this.getSkill(input.id);
  }

  async activateSkill(id: string): Promise<Skill | null> {
    return this.updateSkill({ id, status: 'active' });
  }

  async deprecateSkill(id: string): Promise<Skill | null> {
    return this.updateSkill({ id, status: 'deprecated' });
  }

  async incrementSkillUsage(id: string): Promise<Skill | null> {
    const now = Date.now();
    await this.pool.query(
      `UPDATE skills SET "usageCount" = "usageCount" + 1, "lastUsed" = $1, "updatedAt" = $2 WHERE id = $3`,
      [now, now, id]
    );
    return this.getSkill(id);
  }

  // Rules
  private normalizeRule(row: Record<string, unknown>): Rule {
    return {
      ...row,
      skillIds: row.skillIds ? jsonArrayToString(row.skillIds) : undefined,
      applicability: row.applicability ? jsonToString(row.applicability) : undefined,
    } as Rule;
  }

  async createRule(input: CreateRuleInput): Promise<Rule> {
    const id = generateId('rule');
    const now = Date.now();
    const { rows } = await this.pool.query(
      `INSERT INTO rules (id, "projectPath", name, description, "skillIds", level, enforcement, content, applicability, status, "violationCount", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', 0, $10) RETURNING *`,
      [id, input.projectPath || '', input.name, input.description || null,
       input.skillIds ? JSON.stringify(input.skillIds) : null,
       input.level, input.enforcement, input.content,
       input.applicability ? JSON.stringify(input.applicability) : null, now]
    );
    return this.normalizeRule(rows[0]);
  }

  async getRule(id: string): Promise<Rule | null> {
    const { rows } = await this.pool.query('SELECT * FROM rules WHERE id = $1', [id]);
    if (!rows[0]) return null;
    return this.normalizeRule(rows[0]);
  }

  async getRuleByName(name: string, projectPath?: string): Promise<Rule | null> {
    const pp = projectPath || '';
    const { rows } = await this.pool.query(
      'SELECT * FROM rules WHERE name = $1 AND "projectPath" = $2 LIMIT 1',
      [name, pp]
    );
    if (!rows[0]) return null;
    return this.normalizeRule(rows[0]);
  }

  async listRules(filters?: RuleFilters): Promise<Rule[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filters?.projectPath) { conditions.push(`"projectPath" = $${idx++}`); values.push(filters.projectPath); }
    if (filters?.status) { conditions.push(`status = $${idx++}`); values.push(filters.status); }
    if (filters?.level) { conditions.push(`level = $${idx++}`); values.push(filters.level); }
    if (filters?.enforcement) { conditions.push(`enforcement = $${idx++}`); values.push(filters.enforcement); }
    if (filters?.module) {
      conditions.push(`applicability ->'modules' ? $${idx++}`);
      values.push(filters.module);
    }
    if (filters?.role) {
      conditions.push(`applicability ->'roles' ? $${idx++}`);
      values.push(filters.role);
    }
    if (filters?.taskType) {
      conditions.push(`applicability ->'taskTypes' ? $${idx++}`);
      values.push(filters.taskType);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.pool.query(
      `SELECT * FROM rules ${where} ORDER BY "createdAt" DESC`,
      values
    );
    return rows.map(r => this.normalizeRule(r));
  }

  async updateRule(input: UpdateRuleInput): Promise<Rule | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { sets.push(`name = $${idx++}`); values.push(input.name); }
    if (input.description !== undefined) { sets.push(`description = $${idx++}`); values.push(input.description); }
    if (input.skillIds !== undefined) { sets.push(`"skillIds" = $${idx++}`); values.push(JSON.stringify(input.skillIds)); }
    if (input.level !== undefined) { sets.push(`level = $${idx++}`); values.push(input.level); }
    if (input.enforcement !== undefined) { sets.push(`enforcement = $${idx++}`); values.push(input.enforcement); }
    if (input.content !== undefined) { sets.push(`content = $${idx++}`); values.push(input.content); }
    if (input.applicability !== undefined) { sets.push(`applicability = $${idx++}`); values.push(JSON.stringify(input.applicability)); }
    if (input.status !== undefined) { sets.push(`status = $${idx++}`); values.push(input.status); }

    if (sets.length === 0) return this.getRule(input.id);

    values.push(input.id);
    await this.pool.query(
      `UPDATE rules SET ${sets.join(', ')} WHERE id = $${idx}`,
      values
    );
    return this.getRule(input.id);
  }

  async deprecateRule(id: string): Promise<Rule | null> {
    return this.updateRule({ id, status: 'deprecated' });
  }

  async recordRuleViolation(id: string): Promise<Rule | null> {
    const now = Date.now();
    await this.pool.query(
      `UPDATE rules SET "violationCount" = "violationCount" + 1, "lastViolation" = $1 WHERE id = $2`,
      [now, id]
    );
    return this.getRule(id);
  }

  // Feedback
  async createFeedback(input: CreateFeedbackInput): Promise<TrainingFeedback> {
    const id = generateId('fb');
    const now = Date.now();
    const { rows } = await this.pool.query(
      `INSERT INTO training_feedback (id, "entityType", "entityId", "taskId", outcome, notes, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, input.entityType, input.entityId, input.taskId || null,
       input.outcome, input.notes || null, now]
    );
    return rows[0];
  }

  async listFeedback(entityType: 'skill' | 'rule', entityId: string): Promise<TrainingFeedback[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM training_feedback WHERE "entityType" = $1 AND "entityId" = $2 ORDER BY "createdAt" DESC',
      [entityType, entityId]
    );
    return rows;
  }

  // Context
  async getTrainingContext(moduleId: string, projectPath?: string, role?: string, taskType?: string): Promise<TrainingContext> {
    const pp = projectPath || '';
    const session = await this.getOrCreateSession(moduleId, pp);

    const skills = await this.listSkills({
      projectPath: pp,
      status: 'active',
      module: moduleId,
      role,
      taskType,
    });

    const rules = await this.listRules({
      projectPath: pp,
      status: 'active',
      module: moduleId,
      role,
      taskType,
    });

    const recentLessons = await this.listLessons({ sessionId: session.id });
    const recentIncidents = await this.listIncidents({ sessionId: session.id });

    return {
      moduleId,
      projectPath: pp,
      skills,
      rules,
      recentLessons: recentLessons.slice(0, 10),
      recentIncidents: recentIncidents.slice(0, 10),
    };
  }
}

// =============================================================================
// PostgresSessionRepository
// =============================================================================

class PostgresSessionRepository implements ISessionRepository {
  constructor(private pool: Pool) {}

  private normalizeSession(row: Record<string, unknown>): ClaudeSession {
    return {
      ...row,
      resumeContext: row.resumeContext ? jsonToString(row.resumeContext) : undefined,
      canResume: row.canResume as boolean | number,
    } as ClaudeSession;
  }

  async create(input: CreateClaudeSessionInput): Promise<ClaudeSession> {
    const id = generateId('csess');
    const now = Date.now();
    const { rows } = await this.pool.query(
      `INSERT INTO claude_sessions (id, "workspacePath", "taskId", "moduleId", "specId", "ticketId",
        terminal, "launchMode", "initialPrompt", pid, "terminalWindowId", "claudeSessionId",
        status, "startedAt", "canResume", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'launching',$13,true,$14,$15) RETURNING *`,
      [
        id, input.workspacePath, input.taskId || null, input.moduleId || null,
        input.specId || null, input.ticketId || null,
        input.terminal || 'unknown', input.launchMode || 'normal',
        input.initialPrompt || null, input.pid || null,
        input.terminalWindowId || null, input.claudeSessionId || null,
        now, now, now,
      ]
    );
    return this.normalizeSession(rows[0]);
  }

  async get(id: string): Promise<ClaudeSession | null> {
    const { rows } = await this.pool.query('SELECT * FROM claude_sessions WHERE id = $1', [id]);
    if (!rows[0]) return null;
    return this.normalizeSession(rows[0]);
  }

  async update(id: string, updates: UpdateClaudeSessionInput): Promise<ClaudeSession | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const fields: Array<[string, unknown]> = [
      ['status', updates.status],
      ['"taskId"', updates.taskId],
      ['"moduleId"', updates.moduleId],
      ['"endedAt"', updates.endedAt],
      ['"exitCode"', updates.exitCode],
      ['"errorMessage"', updates.errorMessage],
      ['"resumeContext"', updates.resumeContext ? JSON.stringify(updates.resumeContext) : undefined],
    ];

    for (const [col, val] of fields) {
      if (val !== undefined) {
        sets.push(`${col} = $${idx++}`);
        values.push(val);
      }
    }

    if (sets.length === 0) return this.get(id);

    sets.push(`"updatedAt" = $${idx++}`);
    values.push(Date.now());
    values.push(id);

    await this.pool.query(
      `UPDATE claude_sessions SET ${sets.join(', ')} WHERE id = $${idx}`,
      values
    );
    return this.get(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM claude_sessions WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async list(filters?: SessionFilters): Promise<SessionListResult> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filters?.workspacePath) { conditions.push(`"workspacePath" = $${idx++}`); values.push(filters.workspacePath); }
    if (filters?.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      conditions.push(`status = ANY($${idx++})`);
      values.push(statuses);
    }
    if (filters?.taskId) { conditions.push(`"taskId" = $${idx++}`); values.push(filters.taskId); }
    if (filters?.moduleId) { conditions.push(`"moduleId" = $${idx++}`); values.push(filters.moduleId); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const countResult = await this.pool.query(`SELECT COUNT(*) as count FROM claude_sessions ${where}`, values);
    const total = parseInt(countResult.rows[0].count, 10);

    const { rows } = await this.pool.query(
      `SELECT * FROM claude_sessions ${where} ORDER BY "startedAt" DESC LIMIT $${idx++} OFFSET $${idx}`,
      [...values, limit, offset]
    );
    return { sessions: rows.map(r => this.normalizeSession(r)), total };
  }

  async getActive(workspacePath?: string): Promise<ClaudeSession[]> {
    let query = `SELECT * FROM claude_sessions WHERE status IN ('launching', 'active')`;
    const values: unknown[] = [];
    if (workspacePath) {
      query += ' AND "workspacePath" = $1';
      values.push(workspacePath);
    }
    query += ' ORDER BY "startedAt" DESC';
    const { rows } = await this.pool.query(query, values);
    return rows.map(r => this.normalizeSession(r));
  }

  async getByTask(taskId: string): Promise<ClaudeSession[]> {
    const { rows } = await this.pool.query('SELECT * FROM claude_sessions WHERE "taskId" = $1 ORDER BY "startedAt" DESC', [taskId]);
    return rows.map(r => this.normalizeSession(r));
  }

  async getByModule(moduleId: string): Promise<ClaudeSession[]> {
    const { rows } = await this.pool.query('SELECT * FROM claude_sessions WHERE "moduleId" = $1 ORDER BY "startedAt" DESC', [moduleId]);
    return rows.map(r => this.normalizeSession(r));
  }

  async getBySpec(specId: string): Promise<ClaudeSession[]> {
    const { rows } = await this.pool.query('SELECT * FROM claude_sessions WHERE "specId" = $1 ORDER BY "startedAt" DESC', [specId]);
    return rows.map(r => this.normalizeSession(r));
  }

  async getByTicket(ticketId: string): Promise<ClaudeSession[]> {
    const { rows } = await this.pool.query('SELECT * FROM claude_sessions WHERE "ticketId" = $1 ORDER BY "startedAt" DESC', [ticketId]);
    return rows.map(r => this.normalizeSession(r));
  }

  async markActive(id: string): Promise<ClaudeSession | null> {
    return this.update(id, { status: 'active' } as UpdateClaudeSessionInput);
  }

  async markCompleted(id: string, exitCode?: number): Promise<ClaudeSession | null> {
    return this.update(id, { status: 'completed', endedAt: Date.now(), exitCode } as UpdateClaudeSessionInput);
  }

  async markError(id: string, errorMessage: string): Promise<ClaudeSession | null> {
    return this.update(id, { status: 'error', endedAt: Date.now(), errorMessage } as UpdateClaudeSessionInput);
  }

  async markTerminated(id: string): Promise<ClaudeSession | null> {
    return this.update(id, { status: 'terminated', endedAt: Date.now() } as UpdateClaudeSessionInput);
  }

  async recordResume(id: string): Promise<ClaudeSession | null> {
    const now = Date.now();
    await this.pool.query(
      `UPDATE claude_sessions SET "resumeCount" = "resumeCount" + 1, "lastResumeAt" = $1, "updatedAt" = $2, status = 'active' WHERE id = $3`,
      [now, now, id]
    );
    return this.get(id);
  }

  async getStats(filters?: SessionFilters): Promise<SessionStats> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filters?.workspacePath) { conditions.push(`"workspacePath" = $${idx++}`); values.push(filters.workspacePath); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status IN ('launching', 'active')) as active,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'error') as errored,
        COUNT(*) FILTER (WHERE status = 'terminated') as terminated
       FROM claude_sessions ${where}`,
      values
    );

    return {
      total: parseInt(rows[0].total, 10),
      active: parseInt(rows[0].active, 10),
      completed: parseInt(rows[0].completed, 10),
      error: parseInt(rows[0].errored, 10),
      terminated: parseInt(rows[0].terminated, 10),
      totalDuration: 0,
      avgDuration: 0,
      byTerminal: {},
      byModule: {},
      byStatus: {} as Record<string, number>,
    } as SessionStats;
  }

  async cleanup(retentionDays?: number): Promise<{ sessions: number; events: number }> {
    const cutoff = Date.now() - (retentionDays || 30) * 24 * 60 * 60 * 1000;
    const eventsResult = await this.pool.query(
      `DELETE FROM session_events WHERE "claudeSessionId" IN
       (SELECT id FROM claude_sessions WHERE "endedAt" IS NOT NULL AND "endedAt" < $1)`,
      [cutoff]
    );
    const sessionsResult = await this.pool.query(
      `DELETE FROM claude_sessions WHERE "endedAt" IS NOT NULL AND "endedAt" < $1`,
      [cutoff]
    );
    return {
      sessions: sessionsResult.rowCount ?? 0,
      events: eventsResult.rowCount ?? 0,
    };
  }

  // Events
  async logEvent(input: { claudeSessionId: string; eventType: string; details?: string }): Promise<SessionEvent> {
    const id = generateId('sevt');
    const now = Date.now();
    const { rows } = await this.pool.query(
      `INSERT INTO session_events (id, "claudeSessionId", "eventType", "timestamp", details)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, input.claudeSessionId, input.eventType, now, input.details || null]
    );
    return rows[0];
  }

  async getEvents(claudeSessionId: string): Promise<SessionEvent[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM session_events WHERE "claudeSessionId" = $1 ORDER BY "timestamp" ASC',
      [claudeSessionId]
    );
    return rows;
  }

  async buildResumeContext(claudeSessionId: string): Promise<ResumeContext> {
    const session = await this.get(claudeSessionId);
    const events = await this.getEvents(claudeSessionId);
    return {
      filesTouched: [],
      lastActions: events.map(e => `${e.eventType}: ${e.details || ''}`).slice(-10),
      taskProgress: undefined,
      notes: session ? `Session ${session.status}` : undefined,
    } as ResumeContext;
  }
}

// =============================================================================
// PostgresWorkHistoryRepository
// =============================================================================

class PostgresWorkHistoryRepository implements IWorkHistoryRepository {
  constructor(private pool: Pool) {}

  async startSession(workspacePath: string, claudeSessionId?: string): Promise<WorkSession> {
    const id = generateId('wsess');
    const now = Date.now();
    const { rows } = await this.pool.query(
      `INSERT INTO work_sessions (id, "workspacePath", "claudeSessionId", "startTime", status, "createdAt")
       VALUES ($1, $2, $3, $4, 'active', $5) RETURNING *`,
      [id, workspacePath, claudeSessionId || null, now, now]
    );
    return rows[0];
  }

  async endSession(sessionId: string, summary?: string): Promise<void> {
    const now = Date.now();
    await this.pool.query(
      `UPDATE work_sessions SET "endTime" = $1, status = 'completed', summary = $2 WHERE id = $3`,
      [now, summary || null, sessionId]
    );
  }

  async getSession(sessionId: string): Promise<WorkSession | null> {
    const { rows } = await this.pool.query('SELECT * FROM work_sessions WHERE id = $1', [sessionId]);
    return rows[0] ?? null;
  }

  async getSessions(workspacePath: string, timeframeHours?: number): Promise<WorkSession[]> {
    let query = 'SELECT * FROM work_sessions WHERE "workspacePath" = $1';
    const values: unknown[] = [workspacePath];
    if (timeframeHours) {
      query += ' AND "startTime" > $2';
      values.push(Date.now() - timeframeHours * 60 * 60 * 1000);
    }
    query += ' ORDER BY "startTime" DESC';
    const { rows } = await this.pool.query(query, values);
    return rows;
  }

  async getActiveSession(workspacePath: string): Promise<WorkSession | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM work_sessions WHERE "workspacePath" = $1 AND status = 'active' ORDER BY "startTime" DESC LIMIT 1`,
      [workspacePath]
    );
    return rows[0] ?? null;
  }

  async logEntry(entry: Omit<WorkEntry, 'id' | 'timestamp'>): Promise<WorkEntry> {
    const id = generateId('wentry');
    const now = Date.now();
    const { rows } = await this.pool.query(
      `INSERT INTO work_entries (id, "sessionId", "taskId", "workspacePath", "actionType", "actionName", details, "resultSummary", "durationMs", "timestamp")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [id, entry.sessionId, entry.taskId || null, entry.workspacePath,
       entry.actionType, entry.actionName, entry.details || null,
       entry.resultSummary || null, entry.durationMs || null, now]
    );
    return { ...rows[0], details: rows[0].details ? jsonToString(rows[0].details) : undefined };
  }

  async getHistory(filters: WorkHistoryFilters): Promise<WorkEntry[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filters.taskId) { conditions.push(`"taskId" = $${idx++}`); values.push(filters.taskId); }
    if (filters.sessionId) { conditions.push(`"sessionId" = $${idx++}`); values.push(filters.sessionId); }
    if (filters.actionTypes && filters.actionTypes.length > 0) {
      conditions.push(`"actionType" = ANY($${idx++})`);
      values.push(filters.actionTypes);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const { rows } = await this.pool.query(
      `SELECT * FROM work_entries ${where} ORDER BY "timestamp" DESC LIMIT $${idx++} OFFSET $${idx}`,
      [...values, limit, offset]
    );
    return rows.map(r => ({ ...r, details: r.details ? jsonToString(r.details) : undefined }));
  }

  async cleanup(retentionDays?: number): Promise<{ sessions: number; entries: number; progressLogs: number }> {
    const cutoff = Date.now() - (retentionDays || 30) * 24 * 60 * 60 * 1000;

    const entriesResult = await this.pool.query(
      `DELETE FROM work_entries WHERE "sessionId" IN
       (SELECT id FROM work_sessions WHERE "endTime" IS NOT NULL AND "endTime" < $1)`,
      [cutoff]
    );
    const sessionsResult = await this.pool.query(
      `DELETE FROM work_sessions WHERE "endTime" IS NOT NULL AND "endTime" < $1`,
      [cutoff]
    );
    const progressResult = await this.pool.query(
      `DELETE FROM task_progress_log WHERE "createdAt" < $1`,
      [cutoff]
    );

    return {
      sessions: sessionsResult.rowCount ?? 0,
      entries: entriesResult.rowCount ?? 0,
      progressLogs: progressResult.rowCount ?? 0,
    };
  }

  async getWorkHistory(
    workspacePath: string,
    timeframeHours: number,
    filters?: { sessionId?: string; taskId?: string; actionTypes?: string[] },
    page?: number,
    pageSize?: number,
  ): Promise<{ entries: WorkEntry[]; total: number }> {
    const cutoff = Date.now() - timeframeHours * 60 * 60 * 1000;
    const conditions: string[] = ['"workspacePath" = $1', '"timestamp" > $2'];
    const values: unknown[] = [workspacePath, cutoff];
    let idx = 3;

    if (filters?.sessionId) { conditions.push(`"sessionId" = $${idx++}`); values.push(filters.sessionId); }
    if (filters?.taskId) { conditions.push(`"taskId" = $${idx++}`); values.push(filters.taskId); }
    if (filters?.actionTypes && filters.actionTypes.length > 0) {
      conditions.push(`"actionType" = ANY($${idx++})`);
      values.push(filters.actionTypes);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const p = page || 1;
    const ps = pageSize || 50;
    const offset = (p - 1) * ps;

    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM work_entries ${where}`, values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const { rows } = await this.pool.query(
      `SELECT * FROM work_entries ${where} ORDER BY "timestamp" DESC LIMIT $${idx++} OFFSET $${idx}`,
      [...values, ps, offset]
    );

    return {
      entries: rows.map(r => ({ ...r, details: r.details ? jsonToString(r.details) : undefined })),
      total,
    };
  }

  async getRecentEntries(taskId: string, limit?: number): Promise<WorkEntry[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM work_entries WHERE "taskId" = $1 ORDER BY "timestamp" DESC LIMIT $2',
      [taskId, limit || 10]
    );
    return rows.map(r => ({ ...r, details: r.details ? jsonToString(r.details) : undefined }));
  }
}

// =============================================================================
// PostgresRepository (Composite)
// =============================================================================

export class PostgresRepository implements IRepository {
  private pool: Pool;

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

  constructor(connectionString?: string) {
    const poolConfig: PoolConfig = {
      connectionString: connectionString || process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
    };

    this.pool = new Pool(poolConfig);

    this.projects = new PostgresProjectRepository(this.pool);
    this.tasks = new PostgresTaskRepository(this.pool);
    this.tickets = new PostgresTicketRepository(this.pool);
    this.knowledge = new PostgresKnowledgeRepository(this.pool);
    this.impact = new PostgresImpactRepository(this.pool);
    this.testResults = new PostgresTestResultRepository();
    this.memories = new PostgresMemoryRepository();
    this.entityLinks = new PostgresEntityLinkRepository(this.pool);
    this.training = new PostgresTrainingRepository(this.pool);
    this.sessions = new PostgresSessionRepository(this.pool);
    this.workHistory = new PostgresWorkHistoryRepository(this.pool);
  }

  async initialize(): Promise<void> {
    // Resolve schema.sql relative to this file. At runtime __dirname may point
    // to dist/repository/ (compiled) where .sql is not copied by tsc. Fall back
    // to the src/ location next to the original .ts file.
    let schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      // Fallback: resolve from src/repository/ (parent of dist/)
      schemaPath = path.resolve(__dirname, '..', '..', 'src', 'repository', 'schema.sql');
    }
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await this.pool.query(schema);
    console.log('[PostgresRepository] Schema initialized');
  }

  async close(): Promise<void> {
    await this.pool.end();
    console.log('[PostgresRepository] Pool closed');
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn();
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
