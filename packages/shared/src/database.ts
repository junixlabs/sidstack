/**
 * SQLite Database Service for SidStack
 *
 * Simplified storage for core features:
 * - Projects (workspace management)
 * - Tasks (task delegation)
 * - Work History (progress tracking)
 *
 * Uses better-sqlite3 (native SQLite binding) for performance and WAL support.
 */

import Database from 'better-sqlite3';
import type { Database as BetterSqlite3Database } from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';


import type { TaskType } from './governance';
import type {
  ClaudeSession,
  SessionEvent,
  SessionFilters,
  SessionStats,
  CreateClaudeSessionInput,
  UpdateClaudeSessionInput,
  LogSessionEventInput,
  ResumeContext,
} from './session-manager';

// Re-export session manager types
export type {
  ClaudeSession,
  SessionEvent,
  SessionFilters,
  SessionStats,
  CreateClaudeSessionInput,
  UpdateClaudeSessionInput,
  ResumeContext,
} from './session-manager';

// ============================================================================
// Types
// ============================================================================

export interface Project {
  id: string;
  name: string;
  path: string;
  status: 'active' | 'archived';
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: string;
  projectId: string;
  parentTaskId?: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  assignedAgent?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  progress: number;
  notes?: string;
  branch?: string;
  // Governance fields (Phase 1)
  taskType?: TaskType;
  moduleId?: string;
  governance?: string;            // JSON: TaskGovernance
  acceptanceCriteria?: string;    // JSON: AcceptanceCriterion[]
  validation?: string;            // JSON: TaskValidation
  context?: string;               // JSON: TaskContext
}

// Re-export governance types for convenience
export type { TaskType, TaskGovernance, QualityGate, AcceptanceCriterion, TaskContext, TaskValidation } from './governance';

// Governance Violation tracking
export interface GovernanceViolation {
  id: string;
  taskId: string;
  violationType: 'forced_completion' | 'skipped_gate' | 'missing_criteria';
  blockers: string;               // JSON: ValidationBlocker[]
  reason?: string;
  agentId?: string;
  timestamp: number;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: number;
}

export interface WorkSession {
  id: string;
  workspacePath: string;
  claudeSessionId?: string;
  startTime: number;
  endTime?: number;
  status: 'active' | 'completed' | 'interrupted';
  summary?: string;
  createdAt: number;
}

export interface WorkEntry {
  id: string;
  sessionId: string;
  taskId?: string;
  workspacePath: string;
  actionType: 'tool_call' | 'file_change' | 'decision' | 'status_update' | 'error';
  actionName: string;
  details?: string; // JSON
  resultSummary?: string;
  durationMs?: number;
  timestamp: number;
}

export interface TaskProgressLog {
  id: string;
  taskId: string;
  sessionId: string;
  progress: number; // 0-100
  status: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'failed';
  currentStep?: string;
  notes?: string;
  artifacts: string; // JSON array
  createdAt: number;
}

// ============================================================================
// Ticket Types (Ticket to Release)
// ============================================================================

export type TicketStatus = 'new' | 'reviewing' | 'approved' | 'in_progress' | 'completed' | 'rejected';
export type TicketType = 'bug' | 'feature' | 'improvement' | 'task' | 'epic';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type TicketSource = 'api' | 'jira' | 'github' | 'linear' | 'manual';

export interface TicketAttachment {
  name: string;
  url?: string;
  path?: string;
  mimeType?: string;
  size?: number;
}

export interface TicketLinkedIssue {
  id: string;
  type: 'blocks' | 'blocked_by' | 'relates_to' | 'duplicates';
  title?: string;
  url?: string;
}

export interface Ticket {
  id: string;
  projectId: string;
  externalId?: string;         // ID from source system (Jira key, GH issue #)
  source: TicketSource;
  title: string;
  description: string;
  type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  labels: string;              // JSON array of strings
  attachments: string;         // JSON array of TicketAttachment
  linkedIssues: string;        // JSON array of TicketLinkedIssue
  externalUrls: string;        // JSON array of strings (external URLs)
  // Linking to SidStack entities
  taskId?: string;             // Created task from this ticket
  sessionId?: string;          // Claude session working on this ticket
  // Metadata
  reporter?: string;
  assignee?: string;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Entity Reference Types (Project Intelligence Hub)
// ============================================================================

export type EntityReferenceRelationship =
  | 'converts_to'      // Ticket → Task
  | 'implemented_by'   // Task → Session
  | 'analyzed_by'      // Task → Impact Analysis
  | 'requires_context' // Task → Knowledge/Capability
  | 'governed_by'      // Task → Rule
  | 'creates'          // Session → Knowledge
  | 'discovers'        // Session → Incident
  | 'describes'        // Knowledge → Capability
  | 'codified_from'    // Knowledge → Lesson
  | 'originates_from'  // Lesson → Incident
  | 'generates'        // Lesson → Rule
  | 'enables'          // Capability → Capability
  | 'depends_on'       // Capability → Capability
  | 'feeds_into'       // Capability → Capability
  | 'blocks'           // Task → Task
  | 'related_to'       // Any → Any
  | 'mentions';        // Any → Any (inline [[type:id]])

export type EntityType =
  | 'task'
  | 'session'
  | 'knowledge'
  | 'capability'
  | 'impact'
  | 'ticket'
  | 'incident'
  | 'lesson'
  | 'rule'
  | 'skill';

export interface EntityReference {
  id: string;
  sourceType: EntityType;
  sourceId: string;
  targetType: EntityType;
  targetId: string;
  relationship: EntityReferenceRelationship;
  metadata?: string;     // JSON
  createdAt: number;
  createdBy?: string;    // 'user', 'agent:session-id', 'system'
}

export interface CreateEntityReferenceInput {
  sourceType: EntityType;
  sourceId: string;
  targetType: EntityType;
  targetId: string;
  relationship: EntityReferenceRelationship;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export interface EntityReferenceQuery {
  sourceType?: EntityType;
  sourceId?: string;
  targetType?: EntityType;
  targetId?: string;
  entityType?: EntityType;   // query both directions
  entityId?: string;         // query both directions
  relationship?: EntityReferenceRelationship | EntityReferenceRelationship[];
  direction?: 'forward' | 'reverse' | 'both';
  limit?: number;
  offset?: number;
}

// ============================================================================
// Test Room Types
// ============================================================================

export type TestItemStatus = 'pending' | 'in_progress' | 'passed' | 'failed' | 'skipped';
export type TestRoomStatus = 'active' | 'completed' | 'archived';
export type TestMessageSender = 'agent' | 'human' | 'system';
export type TestMessageType = 'text' | 'request' | 'response' | 'result';

export interface TestRoom {
  id: string;
  moduleId: string;
  specId?: string;
  name: string;
  description?: string;
  status: TestRoomStatus;
  createdAt: number;
  updatedAt: number;
}

export interface TestItem {
  id: string;
  roomId: string;
  title: string;
  description?: string;
  status: TestItemStatus;
  orderIndex: number;
  resultNotes?: string;
  testedAt?: number;
  createdAt: number;
}

export interface TestMessage {
  id: string;
  roomId: string;
  sender: TestMessageSender;
  messageType: TestMessageType;
  content: string;
  metadata?: string; // JSON
  createdAt: number;
}

export interface TestArtifact {
  id: string;
  roomId: string;
  messageId?: string;
  name: string;
  type: 'file' | 'screenshot' | 'log' | 'response';
  path?: string;
  content?: string;
  createdAt: number;
}

// ============================================================================
// Training Room Types (Lessons-Learned System)
// ============================================================================

export type TrainingSessionStatus = 'active' | 'archived';
export type IncidentType = 'mistake' | 'failure' | 'confusion' | 'slow' | 'other';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'analyzed' | 'lesson_created' | 'closed';
export type LessonStatus = 'draft' | 'reviewed' | 'approved' | 'archived';
export type SkillType = 'procedure' | 'checklist' | 'template' | 'rule';
export type SkillStatus = 'draft' | 'active' | 'deprecated';
export type RuleLevel = 'must' | 'should' | 'may';
export type RuleEnforcement = 'manual' | 'hook' | 'gate';
export type RuleStatus = 'active' | 'deprecated';
export type FeedbackOutcome = 'helped' | 'ignored' | 'hindered';

export interface TrainingSession {
  id: string;
  projectPath: string;
  moduleId: string;
  status: TrainingSessionStatus;
  totalIncidents: number;
  totalLessons: number;
  totalSkills: number;
  createdAt: number;
  updatedAt: number;
}

export interface Incident {
  id: string;
  sessionId: string;
  type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description?: string;
  context?: string; // JSON
  resolution?: string;
  status: IncidentStatus;
  createdAt: number;
}

export interface IncidentContext {
  taskId?: string;
  agentRole?: string;
  files?: string[];
  commands?: string[];
  errorMessage?: string;
}

export interface Lesson {
  id: string;
  sessionId: string;
  incidentIds?: string; // JSON array
  title: string;
  problem: string;
  rootCause: string;
  solution: string;
  applicability?: string; // JSON
  status: LessonStatus;
  approvedBy?: string;
  createdAt: number;
}

export interface Skill {
  id: string;
  projectPath: string;
  name: string;
  description?: string;
  lessonIds?: string; // JSON array
  type: SkillType;
  content: string;
  triggerConfig?: string; // JSON
  applicability?: string; // JSON
  status: SkillStatus;
  usageCount: number;
  successRate: number;
  lastUsed?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Rule {
  id: string;
  projectPath: string;
  name: string;
  description?: string;
  skillIds?: string; // JSON array
  level: RuleLevel;
  enforcement: RuleEnforcement;
  content: string;
  applicability?: string; // JSON
  status: RuleStatus;
  violationCount: number;
  lastViolation?: number;
  createdAt: number;
}

export interface TrainingFeedback {
  id: string;
  entityType: 'skill' | 'rule';
  entityId: string;
  taskId?: string;
  outcome: FeedbackOutcome;
  notes?: string;
  createdAt: number;
}

export interface Applicability {
  modules?: string[];
  roles?: string[];
  taskTypes?: string[];
}

export interface TriggerConfig {
  when: 'always' | 'task_start' | 'task_end' | 'before_commit' | 'on_error';
  conditions?: string[];
}

export interface TrainingContext {
  moduleId: string;
  projectPath: string;
  skills: Skill[];
  rules: Rule[];
  recentLessons: Lesson[];
  recentIncidents: Incident[];
}

// Training Room Input Types
export interface CreateIncidentInput {
  sessionId: string;
  type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description?: string;
  context?: IncidentContext;
}

export interface UpdateIncidentInput {
  id: string;
  type?: IncidentType;
  severity?: IncidentSeverity;
  title?: string;
  description?: string;
  context?: IncidentContext;
  resolution?: string;
  status?: IncidentStatus;
}

export interface CreateLessonInput {
  sessionId: string;
  incidentIds?: string[];
  title: string;
  problem: string;
  rootCause: string;
  solution: string;
  applicability?: Applicability;
}

export interface UpdateLessonInput {
  id: string;
  title?: string;
  problem?: string;
  rootCause?: string;
  solution?: string;
  applicability?: Applicability;
  status?: LessonStatus;
  approvedBy?: string;
}

export interface CreateSkillInput {
  projectPath?: string;
  name: string;
  description?: string;
  lessonIds?: string[];
  type: SkillType;
  content: string;
  trigger?: TriggerConfig;
  applicability?: Applicability;
}

export interface UpdateSkillInput {
  id: string;
  name?: string;
  description?: string;
  lessonIds?: string[];
  type?: SkillType;
  content?: string;
  trigger?: TriggerConfig;
  applicability?: Applicability;
  status?: SkillStatus;
  successRate?: number;
}

export interface CreateRuleInput {
  projectPath?: string;
  name: string;
  description?: string;
  skillIds?: string[];
  level: RuleLevel;
  enforcement: RuleEnforcement;
  content: string;
  applicability?: Applicability;
}

export interface UpdateRuleInput {
  id: string;
  name?: string;
  description?: string;
  skillIds?: string[];
  level?: RuleLevel;
  enforcement?: RuleEnforcement;
  content?: string;
  applicability?: Applicability;
  status?: RuleStatus;
}

export interface CreateFeedbackInput {
  entityType: 'skill' | 'rule';
  entityId: string;
  taskId?: string;
  sessionId?: string;
  outcome: FeedbackOutcome;
  rating?: number;
  comment?: string;
  notes?: string;
}

export interface IncidentFilters {
  sessionId?: string;
  type?: IncidentType;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
}

export interface LessonFilters {
  sessionId?: string;
  status?: LessonStatus;
}

export interface SkillFilters {
  projectPath?: string;
  module?: string;
  role?: string;
  taskType?: string;
  status?: SkillStatus;
  type?: SkillType;
}

export interface RuleFilters {
  projectPath?: string;
  module?: string;
  role?: string;
  taskType?: string;
  status?: RuleStatus;
  level?: RuleLevel;
  enforcement?: RuleEnforcement;
}

// ============================================================================
// Unified Context Types
// ============================================================================

export type SpecType = 'change' | 'spec' | 'module';
export type LinkType = 'manual' | 'auto' | 'suggested' | 'referenced';

export interface TaskSpecLink {
  id: string;
  taskId: string;
  specPath: string;
  specType: SpecType;
  linkType: LinkType;
  linkReason?: string;
  createdAt: number;
}

export interface TaskKnowledgeLink {
  id: string;
  taskId: string;
  knowledgePath: string;
  linkType: LinkType;
  linkReason?: string;
  createdAt: number;
}

export interface DismissedSuggestion {
  id: string;
  taskId: string;
  suggestedPath: string;
  suggestionType: 'spec' | 'knowledge';
  dismissedAt: number;
}

// ============================================================================
// Database Class
// ============================================================================

export class SidStackDB {
  private db: BetterSqlite3Database | null = null;
  private dbPath: string;
  private initialized: boolean = false;

  constructor(projectPath?: string) {
    // Use home directory for global database (shared between MCP and Tauri)
    // This matches the Rust Tauri commands which use ~/.sidstack/sidstack.db
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const sidstackDir = projectPath
      ? path.join(projectPath, '.sidstack')
      : path.join(homeDir, '.sidstack');

    if (!fs.existsSync(sidstackDir)) {
      fs.mkdirSync(sidstackDir, { recursive: true });
    }

    this.dbPath = path.join(sidstackDir, 'sidstack.db');
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    console.log('[SidStackDB] Initializing database at:', this.dbPath);

    // Handle 0-byte / corrupt database files
    if (fs.existsSync(this.dbPath)) {
      const stats = fs.statSync(this.dbPath);
      if (stats.size === 0) {
        console.log('[SidStackDB] Database file is 0 bytes, recreating...');
        fs.unlinkSync(this.dbPath);
      }
    }

    const isExisting = fs.existsSync(this.dbPath);
    this.db = new Database(this.dbPath);

    // Set WAL mode and pragmas for concurrent access
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('foreign_keys = ON');

    if (isExisting) {
      console.log('[SidStackDB] Opened existing database');
      try {
        const row = this.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as any;
        console.log('[SidStackDB] Tasks in database:', row?.count || 0);
      } catch {
        console.log('[SidStackDB] Tasks table not found in existing db, will create via initSchema');
      }
    } else {
      console.log('[SidStackDB] Creating new database');
    }

    if (isExisting) {
      this.runMigrations();
    }
    this.initSchema();
    if (!isExisting) {
      this.runMigrations();
    }
    this.initialized = true;
  }

  /**
   * Run database migrations for schema updates
   */
  private runMigrations(): void {
    this.ensureInit();

    // Migration: Add claudeSessionId column to claude_sessions if not exists
    try {
      const cols = this.db!.pragma('table_info(claude_sessions)') as any[];
      if (cols.length > 0) {
        const columnNames = cols.map((col: any) => col.name);

        if (!columnNames.includes('claudeSessionId')) {
          this.db!.exec("ALTER TABLE claude_sessions ADD COLUMN claudeSessionId TEXT");
          console.log('[SidStackDB] Migration: Added claudeSessionId column to claude_sessions');
        }

        if (!columnNames.includes('specId')) {
          this.db!.exec("ALTER TABLE claude_sessions ADD COLUMN specId TEXT");
          console.log('[SidStackDB] Migration: Added specId column to claude_sessions');
        }

        if (!columnNames.includes('ticketId')) {
          this.db!.exec("ALTER TABLE claude_sessions ADD COLUMN ticketId TEXT");
          console.log('[SidStackDB] Migration: Added ticketId column to claude_sessions');
        }
      }
    } catch (e) {
      // Table might not exist yet, that's ok
    }

    // Migration: Add specId column to test_rooms
    try {
      const cols = this.db!.pragma('table_info(test_rooms)') as any[];
      if (cols.length > 0) {
        const columnNames = cols.map((col: any) => col.name);

        if (!columnNames.includes('specId')) {
          this.db!.exec("ALTER TABLE test_rooms ADD COLUMN specId TEXT");
          console.log('[SidStackDB] Migration: Added specId column to test_rooms');
        }
      }
    } catch (e) {
      // Table might not exist yet, that's ok
    }

    // Migration: Add projectPath to training_sessions table
    try {
      const cols = this.db!.pragma('table_info(training_sessions)') as any[];
      if (cols.length > 0) {
        const columnNames = cols.map((col: any) => col.name);

        if (!columnNames.includes('projectPath')) {
          this.db!.exec("ALTER TABLE training_sessions ADD COLUMN projectPath TEXT NOT NULL DEFAULT ''");
          this.db!.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_training_sessions_project_module ON training_sessions(projectPath, moduleId)");
          console.log('[SidStackDB] Migration: Added projectPath to training_sessions');
        }
      }
    } catch (e) {
      // Table might not exist yet, that's ok
    }

    // Migration: Add projectPath to skills table
    try {
      const cols = this.db!.pragma('table_info(skills)') as any[];
      if (cols.length > 0) {
        const columnNames = cols.map((col: any) => col.name);

        if (!columnNames.includes('projectPath')) {
          this.db!.exec("ALTER TABLE skills ADD COLUMN projectPath TEXT NOT NULL DEFAULT ''");
          this.db!.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_project_name ON skills(projectPath, name)");
          console.log('[SidStackDB] Migration: Added projectPath to skills');
        }
      }
    } catch (e) {
      // Table might not exist yet, that's ok
    }

    // Migration: Add governance columns to tasks table
    try {
      const cols = this.db!.pragma('table_info(tasks)') as any[];
      if (cols.length > 0) {
        const columnNames = cols.map((col: any) => col.name);

        if (!columnNames.includes('taskType')) {
          this.db!.exec("ALTER TABLE tasks ADD COLUMN taskType TEXT DEFAULT 'feature'");
          console.log('[SidStackDB] Migration: Added taskType column to tasks');
        }
        if (!columnNames.includes('moduleId')) {
          this.db!.exec("ALTER TABLE tasks ADD COLUMN moduleId TEXT");
          console.log('[SidStackDB] Migration: Added moduleId column to tasks');
        }
        if (!columnNames.includes('governance')) {
          this.db!.exec("ALTER TABLE tasks ADD COLUMN governance TEXT");
          console.log('[SidStackDB] Migration: Added governance column to tasks');
        }
        if (!columnNames.includes('acceptanceCriteria')) {
          this.db!.exec("ALTER TABLE tasks ADD COLUMN acceptanceCriteria TEXT");
          console.log('[SidStackDB] Migration: Added acceptanceCriteria column to tasks');
        }
        if (!columnNames.includes('validation')) {
          this.db!.exec("ALTER TABLE tasks ADD COLUMN validation TEXT");
          console.log('[SidStackDB] Migration: Added validation column to tasks');
        }
        if (!columnNames.includes('context')) {
          this.db!.exec("ALTER TABLE tasks ADD COLUMN context TEXT");
          console.log('[SidStackDB] Migration: Added context column to tasks');
        }
        if (!columnNames.includes('branch')) {
          this.db!.exec("ALTER TABLE tasks ADD COLUMN branch TEXT");
          this.db!.exec("CREATE INDEX IF NOT EXISTS idx_tasks_branch ON tasks(branch)");
          console.log('[SidStackDB] Migration: Added branch column to tasks');
        }
      }
    } catch (e) {
      // Table might not exist yet, that's ok
    }

    // Migration: Add projectPath to rules table
    try {
      const cols = this.db!.pragma('table_info(rules)') as any[];
      if (cols.length > 0) {
        const columnNames = cols.map((col: any) => col.name);

        if (!columnNames.includes('projectPath')) {
          this.db!.exec("ALTER TABLE rules ADD COLUMN projectPath TEXT NOT NULL DEFAULT ''");
          this.db!.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_rules_project_name ON rules(projectPath, name)");
          console.log('[SidStackDB] Migration: Added projectPath to rules');
        }
      }
    } catch (e) {
      // Table might not exist yet, that's ok
    }
  }

  private ensureInit(): void {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
  }

  private initSchema(): void {
    this.ensureInit();

    this.db!.exec(`
      -- =======================================================================
      -- PROJECTS
      -- =======================================================================
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        status TEXT DEFAULT 'active',
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      -- =======================================================================
      -- TASKS
      -- =======================================================================
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        parentTaskId TEXT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        assignedAgent TEXT,
        createdBy TEXT DEFAULT 'user',
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        progress INTEGER DEFAULT 0,
        notes TEXT,
        -- Governance fields (Phase 1)
        taskType TEXT DEFAULT 'feature',
        moduleId TEXT,
        governance TEXT DEFAULT '{}',
        acceptanceCriteria TEXT DEFAULT '[]',
        validation TEXT DEFAULT '{}',
        context TEXT DEFAULT '{}',
        branch TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(projectId);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(taskType);
      CREATE INDEX IF NOT EXISTS idx_tasks_module ON tasks(moduleId);
      CREATE INDEX IF NOT EXISTS idx_tasks_branch ON tasks(branch);

      -- =======================================================================
      -- GOVERNANCE VIOLATIONS
      -- =======================================================================
      CREATE TABLE IF NOT EXISTS governance_violations (
        id TEXT PRIMARY KEY,
        taskId TEXT NOT NULL,
        violationType TEXT NOT NULL,
        blockers TEXT NOT NULL,
        reason TEXT,
        agentId TEXT,
        timestamp INTEGER NOT NULL,
        resolved INTEGER DEFAULT 0,
        resolvedBy TEXT,
        resolvedAt INTEGER,
        FOREIGN KEY (taskId) REFERENCES tasks(id)
      );
      CREATE INDEX IF NOT EXISTS idx_violations_task ON governance_violations(taskId);
      CREATE INDEX IF NOT EXISTS idx_violations_type ON governance_violations(violationType);
      CREATE INDEX IF NOT EXISTS idx_violations_resolved ON governance_violations(resolved);

      -- =======================================================================
      -- WORK HISTORY
      -- =======================================================================

      -- Work Sessions (Claude Code sessions per workspace)
      CREATE TABLE IF NOT EXISTS work_sessions (
        id TEXT PRIMARY KEY,
        workspacePath TEXT NOT NULL,
        claudeSessionId TEXT,
        startTime INTEGER NOT NULL,
        endTime INTEGER,
        status TEXT DEFAULT 'active',
        summary TEXT,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_work_sessions_workspace ON work_sessions(workspacePath);
      CREATE INDEX IF NOT EXISTS idx_work_sessions_time ON work_sessions(startTime);

      -- Work Entries (granular actions: tool calls, file changes, decisions)
      CREATE TABLE IF NOT EXISTS work_entries (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        taskId TEXT,
        workspacePath TEXT NOT NULL,
        actionType TEXT NOT NULL,
        actionName TEXT NOT NULL,
        details TEXT,
        resultSummary TEXT,
        durationMs INTEGER,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (sessionId) REFERENCES work_sessions(id)
      );
      CREATE INDEX IF NOT EXISTS idx_work_entries_session ON work_entries(sessionId);
      CREATE INDEX IF NOT EXISTS idx_work_entries_workspace ON work_entries(workspacePath, timestamp);
      CREATE INDEX IF NOT EXISTS idx_work_entries_task ON work_entries(taskId);

      -- Task Progress Log (progress snapshots for tasks)
      CREATE TABLE IF NOT EXISTS task_progress_log (
        id TEXT PRIMARY KEY,
        taskId TEXT NOT NULL,
        sessionId TEXT NOT NULL,
        progress INTEGER NOT NULL,
        status TEXT NOT NULL,
        currentStep TEXT,
        notes TEXT,
        artifacts TEXT DEFAULT '[]',
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (taskId) REFERENCES tasks(id),
        FOREIGN KEY (sessionId) REFERENCES work_sessions(id)
      );
      CREATE INDEX IF NOT EXISTS idx_task_progress_task ON task_progress_log(taskId, createdAt);

      -- =======================================================================
      -- TEST ROOMS
      -- =======================================================================

      -- Test rooms (one per module/spec)
      CREATE TABLE IF NOT EXISTS test_rooms (
        id TEXT PRIMARY KEY,
        moduleId TEXT NOT NULL,
        specId TEXT,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        UNIQUE(moduleId)
      );
      CREATE INDEX IF NOT EXISTS idx_test_rooms_module ON test_rooms(moduleId);

      -- Test items (checklist items)
      CREATE TABLE IF NOT EXISTS test_items (
        id TEXT PRIMARY KEY,
        roomId TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        orderIndex INTEGER DEFAULT 0,
        resultNotes TEXT,
        testedAt INTEGER,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (roomId) REFERENCES test_rooms(id)
      );
      CREATE INDEX IF NOT EXISTS idx_test_items_room ON test_items(roomId);

      -- Test messages (conversation)
      CREATE TABLE IF NOT EXISTS test_messages (
        id TEXT PRIMARY KEY,
        roomId TEXT NOT NULL,
        sender TEXT NOT NULL,
        messageType TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (roomId) REFERENCES test_rooms(id)
      );
      CREATE INDEX IF NOT EXISTS idx_test_messages_room ON test_messages(roomId);

      -- Test artifacts (files, screenshots, logs)
      CREATE TABLE IF NOT EXISTS test_artifacts (
        id TEXT PRIMARY KEY,
        roomId TEXT NOT NULL,
        messageId TEXT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        path TEXT,
        content TEXT,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (roomId) REFERENCES test_rooms(id),
        FOREIGN KEY (messageId) REFERENCES test_messages(id)
      );
      CREATE INDEX IF NOT EXISTS idx_test_artifacts_room ON test_artifacts(roomId);

      -- =======================================================================
      -- UNIFIED CONTEXT (Task-Spec-Knowledge Links)
      -- =======================================================================

      -- Task-Spec Links
      CREATE TABLE IF NOT EXISTS task_spec_links (
        id TEXT PRIMARY KEY,
        taskId TEXT NOT NULL,
        specPath TEXT NOT NULL,
        specType TEXT NOT NULL CHECK(specType IN ('change', 'spec', 'module')),
        linkType TEXT NOT NULL DEFAULT 'manual' CHECK(linkType IN ('manual', 'auto', 'suggested', 'referenced')),
        linkReason TEXT,
        createdAt INTEGER NOT NULL,
        UNIQUE(taskId, specPath)
      );
      CREATE INDEX IF NOT EXISTS idx_task_spec_links_task ON task_spec_links(taskId);
      CREATE INDEX IF NOT EXISTS idx_task_spec_links_spec ON task_spec_links(specPath);

      -- Task-Knowledge Links
      CREATE TABLE IF NOT EXISTS task_knowledge_links (
        id TEXT PRIMARY KEY,
        taskId TEXT NOT NULL,
        knowledgePath TEXT NOT NULL,
        linkType TEXT NOT NULL DEFAULT 'manual' CHECK(linkType IN ('manual', 'auto', 'suggested', 'referenced')),
        linkReason TEXT,
        createdAt INTEGER NOT NULL,
        UNIQUE(taskId, knowledgePath)
      );
      CREATE INDEX IF NOT EXISTS idx_task_knowledge_links_task ON task_knowledge_links(taskId);
      CREATE INDEX IF NOT EXISTS idx_task_knowledge_links_knowledge ON task_knowledge_links(knowledgePath);

      -- Dismissed Suggestions (to avoid re-suggesting)
      CREATE TABLE IF NOT EXISTS dismissed_suggestions (
        id TEXT PRIMARY KEY,
        taskId TEXT NOT NULL,
        suggestedPath TEXT NOT NULL,
        suggestionType TEXT NOT NULL CHECK(suggestionType IN ('spec', 'knowledge')),
        dismissedAt INTEGER NOT NULL,
        UNIQUE(taskId, suggestedPath)
      );
      CREATE INDEX IF NOT EXISTS idx_dismissed_suggestions_task ON dismissed_suggestions(taskId);

      -- =======================================================================
      -- MODULE KNOWLEDGE SYSTEM
      -- =======================================================================

      -- Modules (core module definition with path patterns)
      CREATE TABLE IF NOT EXISTS modules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        paths TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_modules_name ON modules(name);

      -- Module Architectures (one per module)
      CREATE TABLE IF NOT EXISTS module_architectures (
        id TEXT PRIMARY KEY,
        moduleId TEXT NOT NULL UNIQUE REFERENCES modules(id) ON DELETE CASCADE,
        summary TEXT NOT NULL,
        stack TEXT NOT NULL,
        entryPoints TEXT,
        diagrams TEXT,
        version INTEGER DEFAULT 1,
        updatedAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_module_arch_module ON module_architectures(moduleId);

      -- Module Decisions
      CREATE TABLE IF NOT EXISTS module_decisions (
        id TEXT PRIMARY KEY,
        moduleId TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        question TEXT,
        decision TEXT NOT NULL,
        reasoning TEXT,
        alternatives TEXT,
        date INTEGER NOT NULL,
        sessionId TEXT,
        relatedFiles TEXT,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'superseded', 'deprecated')),
        supersededBy TEXT,
        tags TEXT,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_module_decisions_module ON module_decisions(moduleId);
      CREATE INDEX IF NOT EXISTS idx_module_decisions_status ON module_decisions(status);
      CREATE INDEX IF NOT EXISTS idx_module_decisions_date ON module_decisions(date);

      -- Module Tech Debt
      CREATE TABLE IF NOT EXISTS module_tech_debt (
        id TEXT PRIMARY KEY,
        moduleId TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        impact TEXT CHECK(impact IN ('low', 'medium', 'high')),
        effort TEXT CHECK(effort IN ('low', 'medium', 'high')),
        createdAt INTEGER NOT NULL,
        createdBy TEXT,
        sessionId TEXT,
        relatedFiles TEXT,
        relatedDecisions TEXT,
        status TEXT DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved')),
        resolvedAt INTEGER,
        resolution TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_module_tech_debt_module ON module_tech_debt(moduleId);
      CREATE INDEX IF NOT EXISTS idx_module_tech_debt_status ON module_tech_debt(status);
      CREATE INDEX IF NOT EXISTS idx_module_tech_debt_impact ON module_tech_debt(impact);

      -- Module Links (module-to-module dependencies)
      CREATE TABLE IF NOT EXISTS module_links (
        id TEXT PRIMARY KEY,
        sourceModuleId TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
        targetModuleId TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
        linkType TEXT NOT NULL CHECK(linkType IN ('depends_on', 'used_by', 'related')),
        description TEXT,
        createdAt INTEGER NOT NULL,
        UNIQUE(sourceModuleId, targetModuleId, linkType)
      );
      CREATE INDEX IF NOT EXISTS idx_module_links_source ON module_links(sourceModuleId);
      CREATE INDEX IF NOT EXISTS idx_module_links_target ON module_links(targetModuleId);

      -- Module-Spec Links
      CREATE TABLE IF NOT EXISTS module_spec_links (
        id TEXT PRIMARY KEY,
        moduleId TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
        specPath TEXT NOT NULL,
        linkType TEXT NOT NULL DEFAULT 'references' CHECK(linkType IN ('implements', 'references', 'related')),
        description TEXT,
        createdAt INTEGER NOT NULL,
        UNIQUE(moduleId, specPath)
      );
      CREATE INDEX IF NOT EXISTS idx_module_spec_links_module ON module_spec_links(moduleId);
      CREATE INDEX IF NOT EXISTS idx_module_spec_links_spec ON module_spec_links(specPath);

      -- Module-Knowledge Links
      CREATE TABLE IF NOT EXISTS module_knowledge_links (
        id TEXT PRIMARY KEY,
        moduleId TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
        knowledgePath TEXT NOT NULL,
        linkType TEXT NOT NULL DEFAULT 'references' CHECK(linkType IN ('references', 'documents', 'related')),
        description TEXT,
        createdAt INTEGER NOT NULL,
        UNIQUE(moduleId, knowledgePath)
      );
      CREATE INDEX IF NOT EXISTS idx_module_knowledge_links_module ON module_knowledge_links(moduleId);
      CREATE INDEX IF NOT EXISTS idx_module_knowledge_links_knowledge ON module_knowledge_links(knowledgePath);

      -- =======================================================================
      -- IMPACT ANALYSIS SYSTEM
      -- =======================================================================

      -- Impact Analyses (main analysis records)
      CREATE TABLE IF NOT EXISTS impact_analyses (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        taskId TEXT,
        specId TEXT,
        changeType TEXT NOT NULL CHECK(changeType IN ('feature', 'refactor', 'bugfix', 'migration', 'deletion')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'analyzing', 'completed', 'failed')),
        inputJson TEXT NOT NULL,
        parsedJson TEXT,
        scopeJson TEXT,
        dataFlowsJson TEXT,
        risksJson TEXT,
        gateJson TEXT,
        error TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_impact_analyses_project ON impact_analyses(projectId);
      CREATE INDEX IF NOT EXISTS idx_impact_analyses_task ON impact_analyses(taskId);
      CREATE INDEX IF NOT EXISTS idx_impact_analyses_spec ON impact_analyses(specId);
      CREATE INDEX IF NOT EXISTS idx_impact_analyses_status ON impact_analyses(status);

      -- Impact Validations (validation checklist items)
      CREATE TABLE IF NOT EXISTS impact_validations (
        id TEXT PRIMARY KEY,
        analysisId TEXT NOT NULL REFERENCES impact_analyses(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL CHECK(category IN ('test', 'data-flow', 'api', 'migration', 'manual', 'review')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'passed', 'failed', 'skipped')),
        isBlocking INTEGER NOT NULL DEFAULT 1,
        autoVerifiable INTEGER NOT NULL DEFAULT 0,
        verifyCommand TEXT,
        expectedPattern TEXT,
        resultJson TEXT,
        riskId TEXT,
        dataFlowId TEXT,
        moduleId TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_impact_validations_analysis ON impact_validations(analysisId);
      CREATE INDEX IF NOT EXISTS idx_impact_validations_status ON impact_validations(status);

      -- Gate Approvals (audit trail for gate overrides)
      CREATE TABLE IF NOT EXISTS gate_approvals (
        id TEXT PRIMARY KEY,
        analysisId TEXT NOT NULL REFERENCES impact_analyses(id) ON DELETE CASCADE,
        approver TEXT NOT NULL,
        reason TEXT NOT NULL,
        approvedBlockersJson TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_gate_approvals_analysis ON gate_approvals(analysisId);

      -- Analysis History (for learning and accuracy tracking)
      CREATE TABLE IF NOT EXISTS analysis_history (
        id TEXT PRIMARY KEY,
        analysisId TEXT NOT NULL REFERENCES impact_analyses(id) ON DELETE CASCADE,
        actualIssuesJson TEXT NOT NULL,
        accuracyScore REAL NOT NULL DEFAULT 0,
        notes TEXT,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_analysis_history_analysis ON analysis_history(analysisId);

      -- =======================================================================
      -- CLAUDE SESSION MANAGER
      -- =======================================================================

      -- Claude Sessions (track all Claude Code sessions)
      CREATE TABLE IF NOT EXISTS claude_sessions (
        id TEXT PRIMARY KEY,
        workspacePath TEXT NOT NULL,

        -- Linking
        taskId TEXT,
        moduleId TEXT,
        specId TEXT,
        ticketId TEXT,
        workSessionId TEXT,

        -- Launch info
        terminal TEXT NOT NULL,
        launchMode TEXT DEFAULT 'normal',
        initialPrompt TEXT,

        -- Process info
        pid INTEGER,
        terminalWindowId TEXT,
        claudeSessionId TEXT,

        -- Status
        status TEXT DEFAULT 'launching',
        startedAt INTEGER NOT NULL,
        endedAt INTEGER,

        -- Metadata
        claudeModel TEXT,
        exitCode INTEGER,
        errorMessage TEXT,

        -- Resume
        canResume INTEGER DEFAULT 1,
        resumeCount INTEGER DEFAULT 0,
        lastResumeAt INTEGER,
        resumeContext TEXT,

        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,

        FOREIGN KEY (taskId) REFERENCES tasks(id),
        FOREIGN KEY (workSessionId) REFERENCES work_sessions(id)
      );
      CREATE INDEX IF NOT EXISTS idx_claude_sessions_workspace ON claude_sessions(workspacePath);
      CREATE INDEX IF NOT EXISTS idx_claude_sessions_task ON claude_sessions(taskId);
      CREATE INDEX IF NOT EXISTS idx_claude_sessions_module ON claude_sessions(moduleId);
      CREATE INDEX IF NOT EXISTS idx_claude_sessions_spec ON claude_sessions(specId);
      CREATE INDEX IF NOT EXISTS idx_claude_sessions_ticket ON claude_sessions(ticketId);
      CREATE INDEX IF NOT EXISTS idx_claude_sessions_status ON claude_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_claude_sessions_started ON claude_sessions(startedAt);

      -- Session Events (lifecycle events for Claude sessions)
      CREATE TABLE IF NOT EXISTS session_events (
        id TEXT PRIMARY KEY,
        claudeSessionId TEXT NOT NULL,
        eventType TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        details TEXT,
        FOREIGN KEY (claudeSessionId) REFERENCES claude_sessions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_session_events_session ON session_events(claudeSessionId);
      CREATE INDEX IF NOT EXISTS idx_session_events_type ON session_events(eventType);
      CREATE INDEX IF NOT EXISTS idx_session_events_time ON session_events(timestamp);

      -- =======================================================================
      -- TICKETS (Ticket to Release)
      -- =======================================================================

      CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        externalId TEXT,
        source TEXT NOT NULL DEFAULT 'api' CHECK(source IN ('api', 'jira', 'github', 'linear', 'manual')),
        title TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL DEFAULT 'task' CHECK(type IN ('bug', 'feature', 'improvement', 'task', 'epic')),
        priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
        status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'reviewing', 'approved', 'in_progress', 'completed', 'rejected')),
        labels TEXT DEFAULT '[]',
        attachments TEXT DEFAULT '[]',
        linkedIssues TEXT DEFAULT '[]',
        externalUrls TEXT DEFAULT '[]',
        taskId TEXT,
        sessionId TEXT,
        reporter TEXT,
        assignee TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY (projectId) REFERENCES projects(id),
        FOREIGN KEY (taskId) REFERENCES tasks(id),
        FOREIGN KEY (sessionId) REFERENCES claude_sessions(id)
      );
      CREATE INDEX IF NOT EXISTS idx_tickets_project ON tickets(projectId);
      CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
      CREATE INDEX IF NOT EXISTS idx_tickets_type ON tickets(type);
      CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
      CREATE INDEX IF NOT EXISTS idx_tickets_external ON tickets(externalId);
      CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(createdAt);
    `);

    // Training Room tables (lessons-learned system)
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS training_sessions (
        id TEXT PRIMARY KEY,
        projectPath TEXT NOT NULL DEFAULT '',
        moduleId TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
        totalIncidents INTEGER DEFAULT 0,
        totalLessons INTEGER DEFAULT 0,
        totalSkills INTEGER DEFAULT 0,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_training_sessions_module ON training_sessions(moduleId);
      CREATE INDEX IF NOT EXISTS idx_training_sessions_status ON training_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_training_sessions_project ON training_sessions(projectPath);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_training_sessions_project_module ON training_sessions(projectPath, moduleId);

      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('mistake', 'failure', 'confusion', 'slow', 'other')),
        severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'critical')),
        title TEXT NOT NULL,
        description TEXT,
        context TEXT,
        resolution TEXT,
        status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'analyzed', 'lesson_created', 'closed')),
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (sessionId) REFERENCES training_sessions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_incidents_session ON incidents(sessionId);
      CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
      CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(type);
      CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);

      CREATE TABLE IF NOT EXISTS lessons (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        incidentIds TEXT,
        title TEXT NOT NULL,
        problem TEXT NOT NULL,
        rootCause TEXT NOT NULL,
        solution TEXT NOT NULL,
        applicability TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'reviewed', 'approved', 'archived')),
        approvedBy TEXT,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (sessionId) REFERENCES training_sessions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_lessons_session ON lessons(sessionId);
      CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons(status);

      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        projectPath TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        description TEXT,
        lessonIds TEXT,
        type TEXT NOT NULL CHECK(type IN ('procedure', 'checklist', 'template', 'rule')),
        content TEXT NOT NULL,
        triggerConfig TEXT,
        applicability TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'deprecated')),
        usageCount INTEGER DEFAULT 0,
        successRate REAL DEFAULT 0,
        lastUsed INTEGER,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_skills_status ON skills(status);
      CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
      CREATE INDEX IF NOT EXISTS idx_skills_type ON skills(type);
      CREATE INDEX IF NOT EXISTS idx_skills_project ON skills(projectPath);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_project_name ON skills(projectPath, name);

      CREATE TABLE IF NOT EXISTS rules (
        id TEXT PRIMARY KEY,
        projectPath TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        description TEXT,
        skillIds TEXT,
        level TEXT NOT NULL CHECK(level IN ('must', 'should', 'may')),
        enforcement TEXT NOT NULL CHECK(enforcement IN ('manual', 'hook', 'gate')),
        content TEXT NOT NULL,
        applicability TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'deprecated')),
        violationCount INTEGER DEFAULT 0,
        lastViolation INTEGER,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rules_status ON rules(status);
      CREATE INDEX IF NOT EXISTS idx_rules_level ON rules(level);
      CREATE INDEX IF NOT EXISTS idx_rules_enforcement ON rules(enforcement);
      CREATE INDEX IF NOT EXISTS idx_rules_project ON rules(projectPath);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_rules_project_name ON rules(projectPath, name);

      CREATE TABLE IF NOT EXISTS training_feedback (
        id TEXT PRIMARY KEY,
        entityType TEXT NOT NULL CHECK(entityType IN ('skill', 'rule')),
        entityId TEXT NOT NULL,
        taskId TEXT,
        outcome TEXT NOT NULL CHECK(outcome IN ('helped', 'ignored', 'hindered')),
        notes TEXT,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_training_feedback_entity ON training_feedback(entityType, entityId);
      CREATE INDEX IF NOT EXISTS idx_training_feedback_task ON training_feedback(taskId);
    `);

    // Entity Reference Graph (Project Intelligence Hub)
    this.db!.exec(`
      -- =======================================================================
      -- ENTITY REFERENCES (Project Intelligence Hub)
      -- =======================================================================
      CREATE TABLE IF NOT EXISTS entity_references (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        relationship TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        created_by TEXT,
        UNIQUE(source_type, source_id, target_type, target_id, relationship)
      );
      CREATE INDEX IF NOT EXISTS idx_entity_ref_source ON entity_references(source_type, source_id);
      CREATE INDEX IF NOT EXISTS idx_entity_ref_target ON entity_references(target_type, target_id);
      CREATE INDEX IF NOT EXISTS idx_entity_ref_relationship ON entity_references(relationship);
      CREATE INDEX IF NOT EXISTS idx_entity_ref_source_rel ON entity_references(source_type, source_id, relationship);
      CREATE INDEX IF NOT EXISTS idx_entity_ref_target_rel ON entity_references(target_type, target_id, relationship);
    `);
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ==========================================================================
  // Project Methods
  // ==========================================================================

  createProject(project: Omit<Project, 'createdAt' | 'updatedAt'>): Project {
    this.ensureInit();
    const now = Date.now();

    this.db!.prepare(`INSERT INTO projects (id, name, path, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`).run(project.id, project.name, project.path, project.status || 'active', now, now);

    return { ...project, status: project.status || 'active', createdAt: now, updatedAt: now };
  }

  getProject(id: string): Project | null {
    this.ensureInit();
    const row = this.db!.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
    return row ?? null;
  }

  getProjectByPath(projectPath: string): Project | null {
    this.ensureInit();
    const row = this.db!.prepare('SELECT * FROM projects WHERE path = ?').get(projectPath) as Project | undefined;
    return row ?? null;
  }

  listProjects(): Project[] {
    this.ensureInit();
    return this.db!.prepare(`SELECT * FROM projects ORDER BY updatedAt DESC`).all() as Project[];
  }

  updateProject(id: string, updates: Partial<Pick<Project, 'name' | 'status'>>): Project | null {
    this.ensureInit();
    const project = this.getProject(id);
    if (!project) return null;

    const sets: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
    if (updates.status !== undefined) { sets.push('status = ?'); values.push(updates.status); }

    if (sets.length === 0) return project;

    sets.push('updatedAt = ?');
    values.push(Date.now());
    values.push(id);

    this.db!.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...values);

    return this.getProject(id);
  }

  // ==========================================================================
  // Task Methods
  // ==========================================================================

  createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'progress'> & { id?: string }): Task {
    this.ensureInit();
    const now = Date.now();
    const id = task.id || this.generateId('task');

    this.db!.prepare(`INSERT INTO tasks (id, projectId, parentTaskId, title, description, status, priority, assignedAgent, createdBy, createdAt, updatedAt, progress, taskType, moduleId, governance, acceptanceCriteria, validation, context, branch)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`).run(
        id,
        task.projectId,
        task.parentTaskId || null,
        task.title,
        task.description || '',
        task.status || 'pending',
        task.priority || 'medium',
        task.assignedAgent || null,
        task.createdBy || 'user',
        now,
        now,
        task.taskType || 'feature',
        task.moduleId || null,
        task.governance || '{}',
        task.acceptanceCriteria || '[]',
        task.validation || '{}',
        task.context || '{}',
        task.branch || null,
    );

    return { ...task, id, createdAt: now, updatedAt: now, progress: 0 };
  }

  getTask(id: string): Task | null {
    this.ensureInit();
    const row = this.db!.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id) as Task | undefined;
    return row ?? null;
  }

  updateTask(id: string, updates: Partial<Task>): Task | null {
    this.ensureInit();
    const task = this.getTask(id);
    if (!task) return null;

    const sets: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) { sets.push('title = ?'); values.push(updates.title); }
    if (updates.description !== undefined) { sets.push('description = ?'); values.push(updates.description); }
    if (updates.status !== undefined) { sets.push('status = ?'); values.push(updates.status); }
    if (updates.priority !== undefined) { sets.push('priority = ?'); values.push(updates.priority); }
    if (updates.progress !== undefined) { sets.push('progress = ?'); values.push(updates.progress); }
    if (updates.notes !== undefined) { sets.push('notes = ?'); values.push(updates.notes); }
    if (updates.assignedAgent !== undefined) { sets.push('assignedAgent = ?'); values.push(updates.assignedAgent); }
    // Governance fields
    if (updates.taskType !== undefined) { sets.push('taskType = ?'); values.push(updates.taskType); }
    if (updates.moduleId !== undefined) { sets.push('moduleId = ?'); values.push(updates.moduleId); }
    if (updates.governance !== undefined) { sets.push('governance = ?'); values.push(updates.governance); }
    if (updates.acceptanceCriteria !== undefined) { sets.push('acceptanceCriteria = ?'); values.push(updates.acceptanceCriteria); }
    if (updates.validation !== undefined) { sets.push('validation = ?'); values.push(updates.validation); }
    if (updates.context !== undefined) { sets.push('context = ?'); values.push(updates.context); }
    if (updates.branch !== undefined) { sets.push('branch = ?'); values.push(updates.branch); }

    if (sets.length === 0) return task;

    sets.push('updatedAt = ?');
    values.push(Date.now());
    values.push(id);

    this.db!.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...values);

    return this.getTask(id);
  }

  deleteTask(id: string): boolean {
    this.ensureInit();
    const info = this.db!.prepare(`DELETE FROM tasks WHERE id = ?`).run(id);
    return info.changes > 0;
  }

  listTasks(projectId: string, filters?: { status?: string; assignedAgent?: string }): Task[] {
    this.ensureInit();
    let query = 'SELECT * FROM tasks WHERE projectId = ?';
    const params: any[] = [projectId];

    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.assignedAgent) {
      query += ' AND assignedAgent = ?';
      params.push(filters.assignedAgent);
    }

    query += ' ORDER BY createdAt DESC';
    return this.db!.prepare(query).all(...params) as Task[];
  }

  /**
   * Smart task listing with presets, filters, search, and pagination.
   * Optimized to reduce response size for MCP tool usage.
   */
  listTasksSmart(projectId: string, filters: {
    preset?: 'actionable' | 'blocked' | 'recent' | 'epics' | 'all';
    status?: string[];
    taskType?: string[];
    priority?: string;
    parentOnly?: boolean;
    search?: string;
    assignedAgent?: string;
    limit?: number;
    offset?: number;
    compact?: boolean;
  }): { tasks: Partial<Task>[]; total: number; hasMore: boolean } {
    this.ensureInit();

    const conditions: string[] = ['projectId = ?'];
    const params: unknown[] = [projectId];

    // Apply preset defaults (if no explicit status filter)
    if (!filters.status) {
      switch (filters.preset) {
        case 'actionable':
          conditions.push("status IN ('pending', 'in_progress')");
          break;
        case 'blocked':
          conditions.push("status = 'blocked'");
          break;
        case 'recent':
          const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
          conditions.push('updatedAt > ?');
          params.push(oneDayAgo);
          break;
        case 'epics':
          conditions.push('parentTaskId IS NULL');
          break;
        case 'all':
          // No status filter
          break;
        default:
          // Default to actionable
          conditions.push("status IN ('pending', 'in_progress')");
      }
    }

    // Explicit status filter (array)
    if (filters.status && filters.status.length > 0) {
      const placeholders = filters.status.map(() => '?').join(', ');
      conditions.push(`status IN (${placeholders})`);
      params.push(...filters.status);
    }

    // Task type filter (array)
    if (filters.taskType && filters.taskType.length > 0) {
      const placeholders = filters.taskType.map(() => '?').join(', ');
      conditions.push(`taskType IN (${placeholders})`);
      params.push(...filters.taskType);
    }

    // Priority filter
    if (filters.priority) {
      conditions.push('priority = ?');
      params.push(filters.priority);
    }

    // Parent only filter
    if (filters.parentOnly) {
      conditions.push('parentTaskId IS NULL');
    }

    // Assigned agent filter
    if (filters.assignedAgent) {
      conditions.push('assignedAgent = ?');
      params.push(filters.assignedAgent);
    }

    // Search filter (title and description)
    if (filters.search) {
      conditions.push("(title LIKE ? OR description LIKE ?)");
      const searchPattern = `%${filters.search}%`;
      params.push(searchPattern, searchPattern);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countRow = this.db!.prepare(`SELECT COUNT(*) as count FROM tasks WHERE ${whereClause}`).get(...params) as any;
    const total = countRow?.count ?? 0;

    // Select fields based on compact mode
    // Compact: exclude large JSON blobs (governance, acceptanceCriteria, validation, context)
    // Keep: description, notes (useful for context)
    const compactFields = [
      'id', 'projectId', 'parentTaskId', 'title', 'description', 'status', 'priority',
      'taskType', 'moduleId', 'assignedAgent', 'progress', 'notes', 'createdBy', 'createdAt', 'updatedAt'
    ];
    const allFields = '*';
    const selectFields = filters.compact !== false ? compactFields.join(', ') : allFields;

    // Build query with pagination
    const limit = Math.min(filters.limit || 30, 100);
    const offset = filters.offset || 0;

    const query = `
      SELECT ${selectFields} FROM tasks
      WHERE ${whereClause}
      ORDER BY
        CASE status
          WHEN 'in_progress' THEN 1
          WHEN 'blocked' THEN 2
          WHEN 'pending' THEN 3
          WHEN 'failed' THEN 4
          WHEN 'completed' THEN 5
          WHEN 'cancelled' THEN 6
        END,
        CASE priority
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
        END,
        updatedAt DESC
      LIMIT ? OFFSET ?
    `;
    const tasks = this.db!.prepare(query).all(...params, limit, offset) as Partial<Task>[];

    return {
      tasks,
      total,
      hasMore: offset + tasks.length < total
    };
  }

  getSubtasks(parentTaskId: string): Task[] {
    this.ensureInit();
    return this.db!.prepare(`SELECT * FROM tasks WHERE parentTaskId = ? ORDER BY createdAt ASC`).all(parentTaskId) as Task[];
  }

  // ==========================================================================
  // Governance Violation Methods
  // ==========================================================================

  logGovernanceViolation(violation: Omit<GovernanceViolation, 'id' | 'resolved'>): GovernanceViolation {
    this.ensureInit();
    const id = this.generateId('violation');

    this.db!.prepare(`INSERT INTO governance_violations (id, taskId, violationType, blockers, reason, agentId, timestamp, resolved)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`).run(
        id,
        violation.taskId,
        violation.violationType,
        violation.blockers,
        violation.reason || null,
        violation.agentId || null,
        violation.timestamp,
      );

    return { ...violation, id, resolved: false };
  }

  getGovernanceViolation(id: string): GovernanceViolation | null {
    this.ensureInit();
    const row = this.db!.prepare(`SELECT * FROM governance_violations WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return {
      ...row,
      resolved: row.resolved === 1,
    };
  }

  getTaskViolations(taskId: string): GovernanceViolation[] {
    this.ensureInit();
    const rows = this.db!.prepare(`SELECT * FROM governance_violations WHERE taskId = ? ORDER BY timestamp DESC`).all(taskId) as any[];
    return rows.map((obj: any) => ({ ...obj, resolved: obj.resolved === 1 }));
  }

  listGovernanceViolations(filters?: { resolved?: boolean; violationType?: string }): GovernanceViolation[] {
    this.ensureInit();
    let query = 'SELECT * FROM governance_violations WHERE 1=1';
    const params: any[] = [];

    if (filters?.resolved !== undefined) {
      query += ' AND resolved = ?';
      params.push(filters.resolved ? 1 : 0);
    }
    if (filters?.violationType) {
      query += ' AND violationType = ?';
      params.push(filters.violationType);
    }

    query += ' ORDER BY timestamp DESC';
    const rows = this.db!.prepare(query).all(...params) as any[];
    return rows.map((obj: any) => ({ ...obj, resolved: obj.resolved === 1 }));
  }

  resolveGovernanceViolation(id: string, resolvedBy: string): GovernanceViolation | null {
    this.ensureInit();
    const violation = this.getGovernanceViolation(id);
    if (!violation) return null;

    const now = Date.now();
    this.db!.prepare(`UPDATE governance_violations SET resolved = 1, resolvedBy = ?, resolvedAt = ? WHERE id = ?`).run(resolvedBy, now, id);

    return this.getGovernanceViolation(id);
  }

  // ==========================================================================
  // Work Session Methods
  // ==========================================================================

  startWorkSession(workspacePath: string, claudeSessionId?: string): WorkSession {
    this.ensureInit();
    const now = Date.now();
    const id = this.generateId('wsession');

    this.db!.prepare(`INSERT INTO work_sessions (id, workspacePath, claudeSessionId, startTime, status, createdAt)
       VALUES (?, ?, ?, ?, 'active', ?)`).run(id, workspacePath, claudeSessionId || null, now, now);

    return {
      id,
      workspacePath,
      claudeSessionId,
      startTime: now,
      status: 'active',
      createdAt: now,
    };
  }

  endWorkSession(sessionId: string, summary?: string): void {
    this.ensureInit();
    const now = Date.now();

    this.db!.prepare(`UPDATE work_sessions SET endTime = ?, status = 'completed', summary = ? WHERE id = ?`).run(now, summary || null, sessionId);

  }

  getWorkSession(sessionId: string): WorkSession | null {
    this.ensureInit();
    const row = this.db!.prepare(`SELECT * FROM work_sessions WHERE id = ?`).get(sessionId) as WorkSession | undefined;
    return row ?? null;
  }

  getWorkSessions(workspacePath: string, timeframeHours: number = 24): WorkSession[] {
    this.ensureInit();
    const cutoff = Date.now() - timeframeHours * 60 * 60 * 1000;

    return this.db!.prepare(`SELECT * FROM work_sessions WHERE workspacePath = ? AND startTime > ? ORDER BY startTime DESC`).all(workspacePath, cutoff) as WorkSession[];
  }

  getActiveWorkSession(workspacePath: string): WorkSession | null {
    this.ensureInit();

    const row = this.db!.prepare(`SELECT * FROM work_sessions WHERE workspacePath = ? AND status = 'active' ORDER BY startTime DESC LIMIT 1`).get(workspacePath) as WorkSession | undefined;
    return row ?? null;
  }

  // ==========================================================================
  // Work Entry Methods
  // ==========================================================================

  logWorkEntry(entry: Omit<WorkEntry, 'id' | 'timestamp'>): WorkEntry {
    this.ensureInit();
    const now = Date.now();
    const id = this.generateId('wentry');

    const detailsJson = entry.details ? (typeof entry.details === 'string' ? entry.details : JSON.stringify(entry.details)) : null;

    this.db!.prepare(`INSERT INTO work_entries (id, sessionId, taskId, workspacePath, actionType, actionName, details, resultSummary, durationMs, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, entry.sessionId, entry.taskId || null, entry.workspacePath, entry.actionType, entry.actionName, detailsJson, entry.resultSummary || null, entry.durationMs || null, now);

    return { ...entry, id, details: detailsJson || undefined, timestamp: now };
  }

  getWorkHistory(
    workspacePath: string,
    timeframeHours: number = 24,
    filters?: { sessionId?: string; taskId?: string; actionTypes?: string[] },
    page: number = 1,
    pageSize: number = 50
  ): { entries: WorkEntry[]; total: number } {
    this.ensureInit();
    const cutoff = Date.now() - timeframeHours * 60 * 60 * 1000;

    let whereClause = 'workspacePath = ? AND timestamp > ?';
    const params: unknown[] = [workspacePath, cutoff];

    if (filters?.sessionId) {
      whereClause += ' AND sessionId = ?';
      params.push(filters.sessionId);
    }
    if (filters?.taskId) {
      whereClause += ' AND taskId = ?';
      params.push(filters.taskId);
    }
    if (filters?.actionTypes && filters.actionTypes.length > 0) {
      whereClause += ` AND actionType IN (${filters.actionTypes.map(() => '?').join(',')})`;
      params.push(...filters.actionTypes);
    }

    // Get total count
    const countRow = this.db!.prepare(`SELECT COUNT(*) as count FROM work_entries WHERE ${whereClause}`).get(...params) as any;
    const total = countRow?.count ?? 0;

    // Get paginated results
    const offset = (page - 1) * pageSize;
    const entries = this.db!.prepare(
      `SELECT * FROM work_entries WHERE ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset) as WorkEntry[];

    return { entries, total };
  }

  // ==========================================================================
  // Task Progress Methods
  // ==========================================================================

  logTaskProgress(progress: Omit<TaskProgressLog, 'id' | 'createdAt'>): TaskProgressLog {
    this.ensureInit();
    const now = Date.now();
    const id = this.generateId('tprog');

    const artifactsJson = typeof progress.artifacts === 'string' ? progress.artifacts : JSON.stringify(progress.artifacts || []);

    this.db!.prepare(`INSERT INTO task_progress_log (id, taskId, sessionId, progress, status, currentStep, notes, artifacts, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, progress.taskId, progress.sessionId, progress.progress, progress.status, progress.currentStep || null, progress.notes || null, artifactsJson, now);

    // Also update the task's progress in the tasks table
    this.updateTask(progress.taskId, { progress: progress.progress, status: progress.status, notes: progress.notes });

    return { ...progress, id, artifacts: artifactsJson, createdAt: now };
  }

  getTaskProgressHistory(taskId: string): TaskProgressLog[] {
    this.ensureInit();

    return this.db!.prepare(`SELECT * FROM task_progress_log WHERE taskId = ? ORDER BY createdAt ASC`).all(taskId) as TaskProgressLog[];
  }

  getLatestTaskProgress(taskId: string): TaskProgressLog | null {
    this.ensureInit();

    const row = this.db!.prepare(`SELECT * FROM task_progress_log WHERE taskId = ? ORDER BY createdAt DESC LIMIT 1`).get(taskId) as TaskProgressLog | undefined;
    return row ?? null;
  }

  // ==========================================================================
  // Ticket Methods (Ticket to Release)
  // ==========================================================================

  createTicket(ticket: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Ticket {
    this.ensureInit();
    const now = Date.now();
    const id = ticket.id || this.generateId('ticket');

    this.db!.prepare(`INSERT INTO tickets (id, projectId, externalId, source, title, description, type, priority, status, labels, attachments, linkedIssues, externalUrls, taskId, sessionId, reporter, assignee, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id,
        ticket.projectId,
        ticket.externalId || null,
        ticket.source || 'api',
        ticket.title,
        ticket.description || '',
        ticket.type || 'task',
        ticket.priority || 'medium',
        ticket.status || 'new',
        ticket.labels || '[]',
        ticket.attachments || '[]',
        ticket.linkedIssues || '[]',
        ticket.externalUrls || '[]',
        ticket.taskId || null,
        ticket.sessionId || null,
        ticket.reporter || null,
        ticket.assignee || null,
        now,
        now,
    );

    return {
      ...ticket,
      id,
      source: ticket.source || 'api',
      type: ticket.type || 'task',
      priority: ticket.priority || 'medium',
      status: ticket.status || 'new',
      labels: ticket.labels || '[]',
      attachments: ticket.attachments || '[]',
      linkedIssues: ticket.linkedIssues || '[]',
      externalUrls: ticket.externalUrls || '[]',
      createdAt: now,
      updatedAt: now,
    };
  }

  getTicket(id: string): Ticket | null {
    this.ensureInit();
    const row = this.db!.prepare(`SELECT * FROM tickets WHERE id = ?`).get(id) as Ticket | undefined;
    return row ?? null;
  }

  getTicketByTaskId(taskId: string): Ticket | null {
    this.ensureInit();
    const row = this.db!.prepare(`SELECT * FROM tickets WHERE taskId = ?`).get(taskId) as Ticket | undefined;
    return row ?? null;
  }

  getTicketByExternalId(externalId: string, projectId?: string): Ticket | null {
    this.ensureInit();
    let query = `SELECT * FROM tickets WHERE externalId = ?`;
    const params: (string | null)[] = [externalId];

    if (projectId) {
      query += ` AND projectId = ?`;
      params.push(projectId);
    }

    const row = this.db!.prepare(query).get(...params) as Ticket | undefined;
    return row ?? null;
  }

  listTickets(
    projectId: string,
    options: {
      status?: TicketStatus | TicketStatus[];
      type?: TicketType | TicketType[];
      priority?: TicketPriority | TicketPriority[];
      limit?: number;
      offset?: number;
    } = {}
  ): Ticket[] {
    this.ensureInit();

    let query = `SELECT * FROM tickets WHERE projectId = ?`;
    const params: (string | number)[] = [projectId];

    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      query += ` AND status IN (${statuses.map(() => '?').join(',')})`;
      params.push(...statuses);
    }

    if (options.type) {
      const types = Array.isArray(options.type) ? options.type : [options.type];
      query += ` AND type IN (${types.map(() => '?').join(',')})`;
      params.push(...types);
    }

    if (options.priority) {
      const priorities = Array.isArray(options.priority) ? options.priority : [options.priority];
      query += ` AND priority IN (${priorities.map(() => '?').join(',')})`;
      params.push(...priorities);
    }

    query += ` ORDER BY createdAt DESC`;

    if (options.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }
    if (options.offset) {
      query += ` OFFSET ?`;
      params.push(options.offset);
    }

    return this.db!.prepare(query).all(...params) as Ticket[];
  }

  updateTicket(
    id: string,
    updates: Partial<Omit<Ticket, 'id' | 'projectId' | 'createdAt'>>
  ): Ticket | null {
    this.ensureInit();
    const now = Date.now();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.type !== undefined) {
      fields.push('type = ?');
      values.push(updates.type);
    }
    if (updates.priority !== undefined) {
      fields.push('priority = ?');
      values.push(updates.priority);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.labels !== undefined) {
      fields.push('labels = ?');
      values.push(updates.labels);
    }
    if (updates.attachments !== undefined) {
      fields.push('attachments = ?');
      values.push(updates.attachments);
    }
    if (updates.linkedIssues !== undefined) {
      fields.push('linkedIssues = ?');
      values.push(updates.linkedIssues);
    }
    if (updates.externalUrls !== undefined) {
      fields.push('externalUrls = ?');
      values.push(updates.externalUrls);
    }
    if (updates.taskId !== undefined) {
      fields.push('taskId = ?');
      values.push(updates.taskId);
    }
    if (updates.sessionId !== undefined) {
      fields.push('sessionId = ?');
      values.push(updates.sessionId);
    }
    if (updates.assignee !== undefined) {
      fields.push('assignee = ?');
      values.push(updates.assignee);
    }

    if (fields.length === 0) {
      return this.getTicket(id);
    }

    fields.push('updatedAt = ?');
    values.push(now);
    values.push(id);

    this.db!.prepare(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    return this.getTicket(id);
  }

  deleteTicket(id: string): boolean {
    this.ensureInit();
    this.db!.prepare(`DELETE FROM tickets WHERE id = ?`).run(id);

    return true;
  }

  countTickets(projectId: string, status?: TicketStatus): number {
    this.ensureInit();

    let query = `SELECT COUNT(*) as count FROM tickets WHERE projectId = ?`;
    const params: string[] = [projectId];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    const countRow = this.db!.prepare(query).get(...params) as any;
    return Number(countRow?.count) || 0;
  }

  // ==========================================================================
  // Test Room Methods
  // ==========================================================================

  createTestRoom(room: Omit<TestRoom, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): TestRoom {
    this.ensureInit();
    const now = Date.now();
    const id = room.id || this.generateId('troom');

    this.db!.prepare(`INSERT INTO test_rooms (id, moduleId, specId, name, description, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, room.moduleId, room.specId || null, room.name, room.description || null, room.status || 'active', now, now);

    return { ...room, id, status: room.status || 'active', createdAt: now, updatedAt: now };
  }

  getTestRoom(id: string): TestRoom | null {
    this.ensureInit();
    const row = this.db!.prepare(`SELECT * FROM test_rooms WHERE id = ?`).get(id) as TestRoom | undefined;
    return row ?? null;
  }

  getTestRoomByModule(moduleId: string): TestRoom | null {
    this.ensureInit();
    const row = this.db!.prepare(`SELECT * FROM test_rooms WHERE moduleId = ?`).get(moduleId) as TestRoom | undefined;
    return row ?? null;
  }

  listTestRooms(status?: TestRoomStatus): TestRoom[] {
    this.ensureInit();
    let query = 'SELECT * FROM test_rooms';
    const params: unknown[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY updatedAt DESC';

    return this.db!.prepare(query).all(...params) as TestRoom[];
  }

  updateTestRoom(id: string, updates: Partial<Pick<TestRoom, 'name' | 'description' | 'status' | 'specId'>>): TestRoom | null {
    this.ensureInit();
    const room = this.getTestRoom(id);
    if (!room) return null;

    const sets: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
    if (updates.description !== undefined) { sets.push('description = ?'); values.push(updates.description); }
    if (updates.status !== undefined) { sets.push('status = ?'); values.push(updates.status); }
    if (updates.specId !== undefined) { sets.push('specId = ?'); values.push(updates.specId); }

    if (sets.length === 0) return room;

    sets.push('updatedAt = ?');
    values.push(Date.now());
    values.push(id);

    this.db!.prepare(`UPDATE test_rooms SET ${sets.join(', ')} WHERE id = ?`).run(...values);

    return this.getTestRoom(id);
  }

  // ==========================================================================
  // Test Item Methods
  // ==========================================================================

  createTestItem(item: Omit<TestItem, 'id' | 'createdAt'>): TestItem {
    this.ensureInit();
    const now = Date.now();
    const id = this.generateId('titem');

    this.db!.prepare(`INSERT INTO test_items (id, roomId, title, description, status, orderIndex, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, item.roomId, item.title, item.description || null, item.status || 'pending', item.orderIndex || 0, now);

    return { ...item, id, status: item.status || 'pending', orderIndex: item.orderIndex || 0, createdAt: now };
  }

  getTestItem(id: string): TestItem | null {
    this.ensureInit();
    const row = this.db!.prepare(`SELECT * FROM test_items WHERE id = ?`).get(id) as TestItem | undefined;
    return row ?? null;
  }

  getTestItems(roomId: string): TestItem[] {
    this.ensureInit();
    return this.db!.prepare(`SELECT * FROM test_items WHERE roomId = ? ORDER BY orderIndex ASC`).all(roomId) as TestItem[];
  }

  updateTestItem(id: string, updates: Partial<Pick<TestItem, 'title' | 'description' | 'status' | 'resultNotes' | 'orderIndex'>>): TestItem | null {
    this.ensureInit();
    const item = this.getTestItem(id);
    if (!item) return null;

    const sets: string[] = [];
    const values: unknown[] = [];

    if (updates.title !== undefined) { sets.push('title = ?'); values.push(updates.title); }
    if (updates.description !== undefined) { sets.push('description = ?'); values.push(updates.description); }
    if (updates.status !== undefined) {
      sets.push('status = ?');
      values.push(updates.status);
      if (['passed', 'failed', 'skipped'].includes(updates.status)) {
        sets.push('testedAt = ?');
        values.push(Date.now());
      }
    }
    if (updates.resultNotes !== undefined) { sets.push('resultNotes = ?'); values.push(updates.resultNotes); }
    if (updates.orderIndex !== undefined) { sets.push('orderIndex = ?'); values.push(updates.orderIndex); }

    if (sets.length === 0) return item;
    values.push(id);

    this.db!.prepare(`UPDATE test_items SET ${sets.join(', ')} WHERE id = ?`).run(...values);

    return this.getTestItem(id);
  }

  deleteTestItem(id: string): boolean {
    this.ensureInit();
    const info = this.db!.prepare(`DELETE FROM test_items WHERE id = ?`).run(id);
    return info.changes > 0;
  }

  // ==========================================================================
  // Test Message Methods
  // ==========================================================================

  createTestMessage(message: Omit<TestMessage, 'id' | 'createdAt'>): TestMessage {
    this.ensureInit();
    const now = Date.now();
    const id = this.generateId('tmsg');

    const metadataJson = message.metadata
      ? (typeof message.metadata === 'string' ? message.metadata : JSON.stringify(message.metadata))
      : null;

    this.db!.prepare(`INSERT INTO test_messages (id, roomId, sender, messageType, content, metadata, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, message.roomId, message.sender, message.messageType, message.content, metadataJson, now);

    // Update room's updatedAt
    this.db!.prepare(`UPDATE test_rooms SET updatedAt = ? WHERE id = ?`).run(now, message.roomId);

    return { ...message, id, metadata: metadataJson || undefined, createdAt: now };
  }

  getTestMessages(roomId: string, limit: number = 100, offset: number = 0): TestMessage[] {
    this.ensureInit();
    return this.db!.prepare(`SELECT * FROM test_messages WHERE roomId = ? ORDER BY createdAt ASC LIMIT ? OFFSET ?`).all(roomId, limit, offset) as TestMessage[];
  }

  // ==========================================================================
  // Test Artifact Methods
  // ==========================================================================

  createTestArtifact(artifact: Omit<TestArtifact, 'id' | 'createdAt'>): TestArtifact {
    this.ensureInit();
    const now = Date.now();
    const id = this.generateId('tart');

    this.db!.prepare(`INSERT INTO test_artifacts (id, roomId, messageId, name, type, path, content, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, artifact.roomId, artifact.messageId || null, artifact.name, artifact.type, artifact.path || null, artifact.content || null, now);

    return { ...artifact, id, createdAt: now };
  }

  getTestArtifacts(roomId: string): TestArtifact[] {
    this.ensureInit();
    return this.db!.prepare(`SELECT * FROM test_artifacts WHERE roomId = ? ORDER BY createdAt ASC`).all(roomId) as TestArtifact[];
  }

  // ==========================================================================
  // Test Room Summary
  // ==========================================================================

  getTestRoomSummary(roomId: string): {
    totalItems: number;
    passedItems: number;
    failedItems: number;
    pendingItems: number;
    skippedItems: number;
    inProgressItems: number;
  } | null {
    this.ensureInit();
    const room = this.getTestRoom(roomId);
    if (!room) return null;

    const summaryRow = this.db!.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress
      FROM test_items WHERE roomId = ?
    `).get(roomId) as any;

    if (!summaryRow) {
      return { totalItems: 0, passedItems: 0, failedItems: 0, pendingItems: 0, skippedItems: 0, inProgressItems: 0 };
    }

    return {
      totalItems: Number(summaryRow.total) || 0,
      passedItems: Number(summaryRow.passed) || 0,
      failedItems: Number(summaryRow.failed) || 0,
      pendingItems: Number(summaryRow.pending) || 0,
      skippedItems: Number(summaryRow.skipped) || 0,
      inProgressItems: Number(summaryRow.in_progress) || 0,
    };
  }

  // ==========================================================================
  // Task-Spec Link Methods
  // ==========================================================================

  createTaskSpecLink(link: Omit<TaskSpecLink, 'id' | 'createdAt'>): TaskSpecLink {
    this.ensureInit();
    const now = Date.now();
    const id = this.generateId('tsl');

    this.db!.prepare(`INSERT INTO task_spec_links (id, taskId, specPath, specType, linkType, linkReason, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, link.taskId, link.specPath, link.specType, link.linkType || 'manual', link.linkReason || null, now);

    return { ...link, id, linkType: link.linkType || 'manual', createdAt: now };
  }

  getTaskSpecLink(id: string): TaskSpecLink | null {
    this.ensureInit();
    const row = this.db!.prepare(`SELECT * FROM task_spec_links WHERE id = ?`).get(id) as TaskSpecLink | undefined;
    return row ?? null;
  }

  getTaskSpecLinks(taskId: string): TaskSpecLink[] {
    this.ensureInit();
    return this.db!.prepare(`SELECT * FROM task_spec_links WHERE taskId = ? ORDER BY createdAt DESC`).all(taskId) as TaskSpecLink[];
  }

  getSpecTaskIds(specPath: string): string[] {
    this.ensureInit();
    const rows = this.db!.prepare(`SELECT DISTINCT taskId FROM task_spec_links WHERE specPath = ?`).all(specPath) as any[];
    return rows.map(row => String(row.taskId));
  }

  deleteTaskSpecLink(id: string): boolean {
    this.ensureInit();
    const info = this.db!.prepare(`DELETE FROM task_spec_links WHERE id = ?`).run(id);
    return info.changes > 0;
  }

  deleteTaskSpecLinkByPath(taskId: string, specPath: string): boolean {
    this.ensureInit();
    const info = this.db!.prepare(`DELETE FROM task_spec_links WHERE taskId = ? AND specPath = ?`).run(taskId, specPath);
    return info.changes > 0;
  }

  // ==========================================================================
  // Task-Knowledge Link Methods
  // ==========================================================================

  createTaskKnowledgeLink(link: Omit<TaskKnowledgeLink, 'id' | 'createdAt'>): TaskKnowledgeLink {
    this.ensureInit();
    const now = Date.now();
    const id = this.generateId('tkl');

    this.db!.prepare(`INSERT INTO task_knowledge_links (id, taskId, knowledgePath, linkType, linkReason, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`).run(id, link.taskId, link.knowledgePath, link.linkType || 'manual', link.linkReason || null, now);

    return { ...link, id, linkType: link.linkType || 'manual', createdAt: now };
  }

  getTaskKnowledgeLink(id: string): TaskKnowledgeLink | null {
    this.ensureInit();
    const row = this.db!.prepare(`SELECT * FROM task_knowledge_links WHERE id = ?`).get(id) as TaskKnowledgeLink | undefined;
    return row ?? null;
  }

  getTaskKnowledgeLinks(taskId: string): TaskKnowledgeLink[] {
    this.ensureInit();
    return this.db!.prepare(`SELECT * FROM task_knowledge_links WHERE taskId = ? ORDER BY createdAt DESC`).all(taskId) as TaskKnowledgeLink[];
  }

  getKnowledgeTaskIds(knowledgePath: string): string[] {
    this.ensureInit();
    const rows = this.db!.prepare(`SELECT DISTINCT taskId FROM task_knowledge_links WHERE knowledgePath = ?`).all(knowledgePath) as any[];
    return rows.map(row => String(row.taskId));
  }

  deleteTaskKnowledgeLink(id: string): boolean {
    this.ensureInit();
    const info = this.db!.prepare(`DELETE FROM task_knowledge_links WHERE id = ?`).run(id);
    return info.changes > 0;
  }

  deleteTaskKnowledgeLinkByPath(taskId: string, knowledgePath: string): boolean {
    this.ensureInit();
    const info = this.db!.prepare(`DELETE FROM task_knowledge_links WHERE taskId = ? AND knowledgePath = ?`).run(taskId, knowledgePath);
    return info.changes > 0;
  }

  // ==========================================================================
  // Dismissed Suggestion Methods
  // ==========================================================================

  dismissSuggestion(taskId: string, suggestedPath: string, suggestionType: 'spec' | 'knowledge'): DismissedSuggestion {
    this.ensureInit();
    const now = Date.now();
    const id = this.generateId('ds');

    this.db!.prepare(`INSERT OR REPLACE INTO dismissed_suggestions (id, taskId, suggestedPath, suggestionType, dismissedAt)
       VALUES (?, ?, ?, ?, ?)`).run(id, taskId, suggestedPath, suggestionType, now);

    return { id, taskId, suggestedPath, suggestionType, dismissedAt: now };
  }

  isDismissed(taskId: string, suggestedPath: string): boolean {
    this.ensureInit();
    const countRow = this.db!.prepare(`SELECT COUNT(*) as count FROM dismissed_suggestions WHERE taskId = ? AND suggestedPath = ?`).get(taskId, suggestedPath) as any;
    return (countRow?.count ?? 0) > 0;
  }

  getDismissedSuggestions(taskId: string): DismissedSuggestion[] {
    this.ensureInit();
    return this.db!.prepare(`SELECT * FROM dismissed_suggestions WHERE taskId = ? ORDER BY dismissedAt DESC`).all(taskId) as DismissedSuggestion[];
  }

  // ==========================================================================
  // Unified Context Query Methods
  // ==========================================================================

  getUnifiedContext(taskId: string): {
    specLinks: TaskSpecLink[];
    knowledgeLinks: TaskKnowledgeLink[];
    dismissedPaths: string[];
  } {
    return {
      specLinks: this.getTaskSpecLinks(taskId),
      knowledgeLinks: this.getTaskKnowledgeLinks(taskId),
      dismissedPaths: this.getDismissedSuggestions(taskId).map(d => d.suggestedPath),
    };
  }

  getRecentWorkEntries(taskId: string, limit: number = 10): WorkEntry[] {
    this.ensureInit();
    return this.db!.prepare(`SELECT * FROM work_entries WHERE taskId = ? ORDER BY timestamp DESC LIMIT ?`).all(taskId, limit) as WorkEntry[];
  }


  // ==========================================================================
  // Impact Analysis Methods
  // ==========================================================================

  createImpactAnalysis(analysis: {
    id?: string;
    projectId?: string;
    taskId?: string;
    specId?: string;
    changeType?: string;
    inputJson: string;
  }): { id: string; createdAt: number; updatedAt: number } {
    this.ensureInit();
    const now = Date.now();
    const id = analysis.id || this.generateId('impact');

    this.db!.prepare(`INSERT INTO impact_analyses (id, projectId, taskId, specId, changeType, status, inputJson, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`).run(id, analysis.projectId || null, analysis.taskId || null, analysis.specId || null, analysis.changeType || null, analysis.inputJson, now, now);

    return { id, createdAt: now, updatedAt: now };
  }

  getImpactAnalysis(id: string): {
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
  } | null {
    this.ensureInit();
    const row = this.db!.prepare(`SELECT * FROM impact_analyses WHERE id = ?`).get(id) as any;
    return row ?? null;
  }

  getImpactAnalysisByTask(taskId: string): ReturnType<typeof this.getImpactAnalysis> {
    this.ensureInit();
    const row = this.db!.prepare(`SELECT * FROM impact_analyses WHERE taskId = ? ORDER BY createdAt DESC LIMIT 1`).get(taskId) as any;
    return row ?? null;
  }

  getImpactAnalysisBySpec(specId: string): ReturnType<typeof this.getImpactAnalysis> {
    this.ensureInit();
    const row = this.db!.prepare(`SELECT * FROM impact_analyses WHERE specId = ? ORDER BY createdAt DESC LIMIT 1`).get(specId) as any;
    return row ?? null;
  }

  listImpactAnalyses(projectId: string, filters?: { status?: string; limit?: number }): Array<ReturnType<typeof this.getImpactAnalysis>> {
    this.ensureInit();
    let query = 'SELECT * FROM impact_analyses WHERE projectId = ?';
    const params: unknown[] = [projectId];

    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY createdAt DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    return this.db!.prepare(query).all(...params) as any[];
  }

  updateImpactAnalysis(id: string, updates: {
    status?: string;
    parsedJson?: string;
    scopeJson?: string;
    dataFlowsJson?: string;
    risksJson?: string;
    gateJson?: string;
    error?: string;
  }): boolean {
    this.ensureInit();
    const sets: string[] = [];
    const values: unknown[] = [];

    if (updates.status !== undefined) { sets.push('status = ?'); values.push(updates.status); }
    if (updates.parsedJson !== undefined) { sets.push('parsedJson = ?'); values.push(updates.parsedJson); }
    if (updates.scopeJson !== undefined) { sets.push('scopeJson = ?'); values.push(updates.scopeJson); }
    if (updates.dataFlowsJson !== undefined) { sets.push('dataFlowsJson = ?'); values.push(updates.dataFlowsJson); }
    if (updates.risksJson !== undefined) { sets.push('risksJson = ?'); values.push(updates.risksJson); }
    if (updates.gateJson !== undefined) { sets.push('gateJson = ?'); values.push(updates.gateJson); }
    if (updates.error !== undefined) { sets.push('error = ?'); values.push(updates.error); }

    if (sets.length === 0) return false;

    sets.push('updatedAt = ?');
    values.push(Date.now());
    values.push(id);

    const info = this.db!.prepare(`UPDATE impact_analyses SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return info.changes > 0;
  }

  deleteImpactAnalysis(id: string): boolean {
    this.ensureInit();
    const info = this.db!.prepare(`DELETE FROM impact_analyses WHERE id = ?`).run(id);
    return info.changes > 0;
  }

  // ==========================================================================
  // Impact Validation Methods
  // ==========================================================================

  createImpactValidation(validation: {
    id?: string;
    analysisId: string;
    title: string;
    description?: string;
    category: string;
    isBlocking: boolean;
    autoVerifiable: boolean;
    verifyCommand?: string;
    expectedPattern?: string;
    riskId?: string;
    dataFlowId?: string;
    moduleId?: string;
  }): { id: string; createdAt: number; updatedAt: number } {
    this.ensureInit();
    const now = Date.now();
    const id = validation.id || this.generateId('ival');

    this.db!.prepare(`INSERT INTO impact_validations (id, analysisId, title, description, category, status, isBlocking, autoVerifiable, verifyCommand, expectedPattern, riskId, dataFlowId, moduleId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id,
        validation.analysisId,
        validation.title,
        validation.description || null,
        validation.category,
        validation.isBlocking ? 1 : 0,
        validation.autoVerifiable ? 1 : 0,
        validation.verifyCommand || null,
        validation.expectedPattern || null,
        validation.riskId || null,
        validation.dataFlowId || null,
        validation.moduleId || null,
        now,
        now,
      );

    return { id, createdAt: now, updatedAt: now };
  }

  getImpactValidation(id: string): {
    id: string;
    analysisId: string;
    title: string;
    description?: string;
    category: string;
    status: string;
    isBlocking: number;
    autoVerifiable: number;
    verifyCommand?: string;
    expectedPattern?: string;
    resultJson?: string;
    riskId?: string;
    dataFlowId?: string;
    moduleId?: string;
    createdAt: number;
    updatedAt: number;
  } | null {
    this.ensureInit();
    const row = this.db!.prepare(`SELECT * FROM impact_validations WHERE id = ?`).get(id) as any;
    return row ?? null;
  }

  getImpactValidations(analysisId: string): Array<ReturnType<typeof this.getImpactValidation>> {
    this.ensureInit();
    return this.db!.prepare(`SELECT * FROM impact_validations WHERE analysisId = ? ORDER BY createdAt ASC`).all(analysisId) as any[];
  }

  updateImpactValidation(id: string, updates: {
    status?: string;
    resultJson?: string;
  }): boolean {
    this.ensureInit();
    const sets: string[] = [];
    const values: unknown[] = [];

    if (updates.status !== undefined) { sets.push('status = ?'); values.push(updates.status); }
    if (updates.resultJson !== undefined) { sets.push('resultJson = ?'); values.push(updates.resultJson); }

    if (sets.length === 0) return false;

    sets.push('updatedAt = ?');
    values.push(Date.now());
    values.push(id);

    const info = this.db!.prepare(`UPDATE impact_validations SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return info.changes > 0;
  }

  // ==========================================================================
  // Gate Approval Methods
  // ==========================================================================

  createGateApproval(approval: {
    analysisId: string;
    approver: string;
    reason: string;
    approvedBlockersJson: string;
  }): { id: string; createdAt: number } {
    this.ensureInit();
    const now = Date.now();
    const id = this.generateId('gappr');

    this.db!.prepare(`INSERT INTO gate_approvals (id, analysisId, approver, reason, approvedBlockersJson, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`).run(id, approval.analysisId, approval.approver, approval.reason, approval.approvedBlockersJson, now);

    return { id, createdAt: now };
  }

  getGateApprovals(analysisId: string): Array<{
    id: string;
    analysisId: string;
    approver: string;
    reason: string;
    approvedBlockersJson: string;
    createdAt: number;
  }> {
    this.ensureInit();
    return this.db!.prepare(`SELECT * FROM gate_approvals WHERE analysisId = ? ORDER BY createdAt DESC`).all(analysisId) as any[];
  }

  // ==========================================================================
  // Analysis History Methods
  // ==========================================================================

  createAnalysisHistory(history: {
    analysisId: string;
    actualIssuesJson: string;
    accuracyScore: number;
    notes?: string;
  }): { id: string; createdAt: number } {
    this.ensureInit();
    const now = Date.now();
    const id = this.generateId('ahist');

    this.db!.prepare(`INSERT INTO analysis_history (id, analysisId, actualIssuesJson, accuracyScore, notes, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`).run(id, history.analysisId, history.actualIssuesJson, history.accuracyScore, history.notes || null, now);

    return { id, createdAt: now };
  }

  getAnalysisHistory(analysisId: string): Array<{
    id: string;
    analysisId: string;
    actualIssuesJson: string;
    accuracyScore: number;
    notes?: string;
    createdAt: number;
  }> {
    this.ensureInit();
    return this.db!.prepare(`SELECT * FROM analysis_history WHERE analysisId = ? ORDER BY createdAt DESC`).all(analysisId) as any[];
  }

  // ==========================================================================
  // Cleanup Methods
  // ==========================================================================

  cleanupWorkHistory(retentionDays: number = 30): { sessions: number; entries: number; progressLogs: number } {
    this.ensureInit();
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    // Delete old progress logs
    const progressInfo = this.db!.prepare(`DELETE FROM task_progress_log WHERE createdAt < ?`).run(cutoff);
    const progressLogs = progressInfo.changes;

    // Delete old work entries
    const entriesInfo = this.db!.prepare(`DELETE FROM work_entries WHERE timestamp < ?`).run(cutoff);
    const entries = entriesInfo.changes;

    // Delete old sessions
    const sessionsInfo = this.db!.prepare(`DELETE FROM work_sessions WHERE createdAt < ?`).run(cutoff);
    const sessions = sessionsInfo.changes;

    return { sessions, entries, progressLogs };
  }

  // ==========================================================================
  // Claude Session Methods
  // ==========================================================================

  /**
   * Create a new Claude session
   */
  createClaudeSession(input: CreateClaudeSessionInput): ClaudeSession {
    this.ensureInit();
    const now = Date.now();
    const id = this.generateId('csession');

    this.db!.prepare(`INSERT INTO claude_sessions (
        id, workspacePath, taskId, moduleId, specId, ticketId, terminal, launchMode, initialPrompt,
        pid, terminalWindowId, claudeSessionId, status, startedAt, canResume, resumeCount, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'launching', ?, 1, 0, ?, ?)`).run(
        id,
        input.workspacePath,
        input.taskId || null,
        input.moduleId || null,
        input.specId || null,
        input.ticketId || null,
        input.terminal,
        input.launchMode || 'normal',
        input.initialPrompt || null,
        input.pid || null,
        input.terminalWindowId || null,
        input.claudeSessionId || null,
        now,
        now,
        now,
      );

    return {
      id,
      workspacePath: input.workspacePath,
      taskId: input.taskId,
      moduleId: input.moduleId,
      specId: input.specId,
      ticketId: input.ticketId,
      terminal: input.terminal,
      launchMode: input.launchMode || 'normal',
      initialPrompt: input.initialPrompt,
      pid: input.pid,
      terminalWindowId: input.terminalWindowId,
      claudeSessionId: input.claudeSessionId,
      status: 'launching',
      startedAt: now,
      canResume: true,
      resumeCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get a Claude session by ID
   */
  getClaudeSession(id: string): ClaudeSession | null {
    this.ensureInit();
    const session = this.db!.prepare(`SELECT * FROM claude_sessions WHERE id = ?`).get(id) as any;
    if (!session) return null;
    return {
      ...session,
      canResume: Boolean(session.canResume),
      resumeContext: session.resumeContext ? session.resumeContext : undefined,
    } as ClaudeSession;
  }

  /**
   * Update a Claude session
   */
  updateClaudeSession(id: string, updates: UpdateClaudeSessionInput): ClaudeSession | null {
    this.ensureInit();
    const session = this.getClaudeSession(id);
    if (!session) return null;

    const sets: string[] = [];
    const values: unknown[] = [];

    if (updates.status !== undefined) { sets.push('status = ?'); values.push(updates.status); }
    if (updates.endedAt !== undefined) { sets.push('endedAt = ?'); values.push(updates.endedAt); }
    if (updates.pid !== undefined) { sets.push('pid = ?'); values.push(updates.pid); }
    if (updates.terminalWindowId !== undefined) { sets.push('terminalWindowId = ?'); values.push(updates.terminalWindowId); }
    if (updates.claudeModel !== undefined) { sets.push('claudeModel = ?'); values.push(updates.claudeModel); }
    if (updates.exitCode !== undefined) { sets.push('exitCode = ?'); values.push(updates.exitCode); }
    if (updates.errorMessage !== undefined) { sets.push('errorMessage = ?'); values.push(updates.errorMessage); }
    if (updates.canResume !== undefined) { sets.push('canResume = ?'); values.push(updates.canResume ? 1 : 0); }
    if (updates.workSessionId !== undefined) { sets.push('workSessionId = ?'); values.push(updates.workSessionId); }
    if (updates.resumeContext !== undefined) {
      sets.push('resumeContext = ?');
      values.push(JSON.stringify(updates.resumeContext));
    }
    // Linking updates
    if (updates.taskId !== undefined) { sets.push('taskId = ?'); values.push(updates.taskId); }
    if (updates.moduleId !== undefined) { sets.push('moduleId = ?'); values.push(updates.moduleId); }
    if (updates.specId !== undefined) { sets.push('specId = ?'); values.push(updates.specId); }
    if (updates.ticketId !== undefined) { sets.push('ticketId = ?'); values.push(updates.ticketId); }

    if (sets.length === 0) return session;

    sets.push('updatedAt = ?');
    values.push(Date.now());
    values.push(id);

    this.db!.prepare(`UPDATE claude_sessions SET ${sets.join(', ')} WHERE id = ?`).run(...values);

    return this.getClaudeSession(id);
  }

  /**
   * Delete a Claude session
   */
  deleteClaudeSession(id: string): boolean {
    this.ensureInit();
    this.db!.prepare(`DELETE FROM claude_sessions WHERE id = ?`).run(id);

    return true;
  }

  /**
   * List Claude sessions with filters
   */
  listClaudeSessions(filters: SessionFilters = {}): { sessions: ClaudeSession[]; total: number } {
    this.ensureInit();

    let whereClause = '1=1';
    const params: unknown[] = [];

    if (filters.workspacePath) {
      whereClause += ' AND workspacePath = ?';
      params.push(filters.workspacePath);
    }
    if (filters.taskId) {
      whereClause += ' AND taskId = ?';
      params.push(filters.taskId);
    }
    if (filters.moduleId) {
      whereClause += ' AND moduleId = ?';
      params.push(filters.moduleId);
    }
    if (filters.specId) {
      whereClause += ' AND specId = ?';
      params.push(filters.specId);
    }
    if (filters.ticketId) {
      whereClause += ' AND ticketId = ?';
      params.push(filters.ticketId);
    }
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      whereClause += ` AND status IN (${statuses.map(() => '?').join(',')})`;
      params.push(...statuses);
    }
    if (filters.terminal) {
      whereClause += ' AND terminal = ?';
      params.push(filters.terminal);
    }
    if (filters.startedAfter) {
      whereClause += ' AND startedAt > ?';
      params.push(filters.startedAfter);
    }
    if (filters.startedBefore) {
      whereClause += ' AND startedAt < ?';
      params.push(filters.startedBefore);
    }

    // Get total count
    const countRow = this.db!.prepare(`SELECT COUNT(*) as count FROM claude_sessions WHERE ${whereClause}`).get(...params) as any;
    const total = countRow?.count ?? 0;

    // Get paginated results
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    const rows = this.db!.prepare(
      `SELECT * FROM claude_sessions WHERE ${whereClause} ORDER BY startedAt DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as any[];

    const sessions = rows.map((session: any) => ({
      ...session,
      canResume: Boolean(session.canResume),
      resumeContext: session.resumeContext ? session.resumeContext : undefined,
    } as ClaudeSession));

    return { sessions, total };
  }

  /**
   * Get active Claude sessions
   */
  getActiveClaudeSessions(workspacePath?: string): ClaudeSession[] {
    const filters: SessionFilters = {
      status: ['launching', 'active'],
    };
    if (workspacePath) {
      filters.workspacePath = workspacePath;
    }
    return this.listClaudeSessions(filters).sessions;
  }

  /**
   * Get Claude sessions by task
   */
  getClaudeSessionsByTask(taskId: string): ClaudeSession[] {
    return this.listClaudeSessions({ taskId }).sessions;
  }

  /**
   * Get Claude sessions by module
   */
  getClaudeSessionsByModule(moduleId: string): ClaudeSession[] {
    return this.listClaudeSessions({ moduleId }).sessions;
  }

  /**
   * Get Claude sessions by spec
   */
  getClaudeSessionsBySpec(specId: string): ClaudeSession[] {
    return this.listClaudeSessions({ specId }).sessions;
  }

  /**
   * Get Claude sessions by ticket
   */
  getClaudeSessionsByTicket(ticketId: string): ClaudeSession[] {
    return this.listClaudeSessions({ ticketId }).sessions;
  }

  /**
   * Update session status
   */
  markClaudeSessionActive(id: string): ClaudeSession | null {
    return this.updateClaudeSession(id, { status: 'active' });
  }

  markClaudeSessionCompleted(id: string, exitCode?: number): ClaudeSession | null {
    return this.updateClaudeSession(id, {
      status: 'completed',
      endedAt: Date.now(),
      exitCode,
    });
  }

  markClaudeSessionError(id: string, errorMessage: string): ClaudeSession | null {
    return this.updateClaudeSession(id, {
      status: 'error',
      endedAt: Date.now(),
      errorMessage,
    });
  }

  markClaudeSessionTerminated(id: string): ClaudeSession | null {
    return this.updateClaudeSession(id, {
      status: 'terminated',
      endedAt: Date.now(),
    });
  }

  /**
   * Record a session resume
   */
  recordClaudeSessionResume(id: string): ClaudeSession | null {
    this.ensureInit();
    const session = this.getClaudeSession(id);
    if (!session) return null;

    this.db!.prepare(`UPDATE claude_sessions SET resumeCount = resumeCount + 1, lastResumeAt = ?, updatedAt = ? WHERE id = ?`).run(Date.now(), Date.now(), id);

    return this.getClaudeSession(id);
  }

  /**
   * Link Claude session to work session
   */
  linkClaudeSessionToWorkSession(claudeSessionId: string, workSessionId: string): void {
    this.updateClaudeSession(claudeSessionId, { workSessionId });
  }

  /**
   * Get session statistics
   */
  getClaudeSessionStats(filters: SessionFilters = {}): SessionStats {
    this.ensureInit();

    let whereClause = '1=1';
    const params: unknown[] = [];

    if (filters.workspacePath) {
      whereClause += ' AND workspacePath = ?';
      params.push(filters.workspacePath);
    }
    if (filters.taskId) {
      whereClause += ' AND taskId = ?';
      params.push(filters.taskId);
    }
    if (filters.moduleId) {
      whereClause += ' AND moduleId = ?';
      params.push(filters.moduleId);
    }

    // Get basic counts
    const statsRow = this.db!.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' OR status = 'launching' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
        SUM(CASE WHEN status = 'terminated' THEN 1 ELSE 0 END) as terminated,
        SUM(CASE WHEN endedAt IS NOT NULL THEN endedAt - startedAt ELSE 0 END) as totalDuration
      FROM claude_sessions WHERE ${whereClause}
    `).get(...params) as any;

    const total = Number(statsRow?.total) || 0;
    const active = Number(statsRow?.active) || 0;
    const completed = Number(statsRow?.completed) || 0;
    const error = Number(statsRow?.error) || 0;
    const terminated = Number(statsRow?.terminated) || 0;
    const totalDuration = Number(statsRow?.totalDuration) || 0;

    // Get by terminal
    const terminalRows = this.db!.prepare(`
      SELECT terminal, COUNT(*) as count
      FROM claude_sessions WHERE ${whereClause}
      GROUP BY terminal
    `).all(...params) as any[];

    const byTerminal: Record<string, number> = {};
    for (const row of terminalRows) {
      byTerminal[row.terminal as string] = Number(row.count);
    }

    // Get by module
    const moduleRows = this.db!.prepare(`
      SELECT moduleId, COUNT(*) as count
      FROM claude_sessions WHERE ${whereClause} AND moduleId IS NOT NULL
      GROUP BY moduleId
    `).all(...params) as any[];

    const byModule: Record<string, number> = {};
    for (const row of moduleRows) {
      byModule[row.moduleId as string] = Number(row.count);
    }

    return {
      total,
      active,
      completed,
      error,
      terminated,
      totalDuration,
      avgDuration: total > 0 ? totalDuration / total : 0,
      byTerminal,
      byModule,
      byStatus: {
        launching: active, // Approximate
        active: 0,
        completed,
        error,
        terminated,
      },
    };
  }

  /**
   * Cleanup old Claude sessions
   */
  cleanupClaudeSessions(retentionDays: number = 30): { sessions: number; events: number } {
    this.ensureInit();
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    // Delete old events first (due to foreign key)
    const eventsInfo = this.db!.prepare(`DELETE FROM session_events WHERE claudeSessionId IN (SELECT id FROM claude_sessions WHERE createdAt < ?)`).run(cutoff);
    const events = eventsInfo.changes;

    // Delete old sessions
    const sessionsInfo = this.db!.prepare(`DELETE FROM claude_sessions WHERE createdAt < ?`).run(cutoff);
    const sessions = sessionsInfo.changes;

    return { sessions, events };
  }

  // ==========================================================================
  // Session Event Methods
  // ==========================================================================

  /**
   * Log a session event
   */
  logSessionEvent(input: LogSessionEventInput): SessionEvent {
    this.ensureInit();
    const now = Date.now();
    const id = this.generateId('sevent');

    const detailsJson = input.details ? JSON.stringify(input.details) : null;

    this.db!.prepare(`INSERT INTO session_events (id, claudeSessionId, eventType, timestamp, details)
       VALUES (?, ?, ?, ?, ?)`).run(id, input.claudeSessionId, input.eventType, now, detailsJson);

    return {
      id,
      claudeSessionId: input.claudeSessionId,
      eventType: input.eventType,
      timestamp: now,
      details: detailsJson || undefined,
    };
  }

  /**
   * Get events for a session
   */
  getSessionEvents(claudeSessionId: string): SessionEvent[] {
    this.ensureInit();
    return this.db!.prepare(`SELECT * FROM session_events WHERE claudeSessionId = ? ORDER BY timestamp ASC`).all(claudeSessionId) as SessionEvent[];
  }

  /**
   * Build resume context from work entries
   */
  buildResumeContext(claudeSessionId: string): ResumeContext {
    this.ensureInit();
    const session = this.getClaudeSession(claudeSessionId);
    if (!session) {
      return { filesTouched: [], lastActions: [] };
    }

    // Get work entries if linked to work session
    const filesTouched: string[] = [];
    const lastActions: string[] = [];

    if (session.workSessionId) {
      const entryRows = this.db!.prepare(
        `SELECT actionName, details FROM work_entries WHERE sessionId = ? ORDER BY timestamp DESC LIMIT 20`
      ).all(session.workSessionId) as any[];

      for (const row of entryRows) {
        lastActions.push(row.actionName as string);
        if (row.details) {
          try {
            const details = JSON.parse(row.details as string);
            if (details.filePath) {
              filesTouched.push(details.filePath);
            }
          } catch {}
        }
      }
    }

    // Get task progress if linked to task
    let taskProgress: number | undefined;
    if (session.taskId) {
      const progressRow = this.db!.prepare(
        `SELECT progress FROM tasks WHERE id = ?`
      ).get(session.taskId) as any;
      if (progressRow) {
        taskProgress = Number(progressRow.progress);
      }
    }

    return {
      filesTouched: [...new Set(filesTouched)].slice(0, 10),
      lastActions: lastActions.slice(0, 5),
      taskProgress,
      originalPrompt: session.initialPrompt,
    };
  }

  // ==========================================================================
  // Training Room Methods (Lessons-Learned System)
  // ==========================================================================

  // --- Training Session ---

  getOrCreateTrainingSession(moduleId: string, projectPath: string = ''): TrainingSession {
    this.ensureInit();

    // Try to get existing session
    const existing = this.getTrainingSessionByModule(moduleId, projectPath);
    if (existing) return existing;

    // Create new session
    const now = Date.now();
    const id = this.generateId('tsession');

    this.db!.prepare(`INSERT INTO training_sessions (id, projectPath, moduleId, status, totalIncidents, totalLessons, totalSkills, createdAt, updatedAt)
       VALUES (?, ?, ?, 'active', 0, 0, 0, ?, ?)`).run(id, projectPath, moduleId, now, now);

    return {
      id,
      projectPath,
      moduleId,
      status: 'active',
      totalIncidents: 0,
      totalLessons: 0,
      totalSkills: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  getTrainingSession(id: string): TrainingSession | null {
    this.ensureInit();
    const row = this.db!.prepare(`SELECT * FROM training_sessions WHERE id = ?`).get(id) as TrainingSession | undefined;
    return row ?? null;
  }

  getTrainingSessionByModule(moduleId: string, projectPath: string = ''): TrainingSession | null {
    this.ensureInit();
    const row = this.db!.prepare(`SELECT * FROM training_sessions WHERE moduleId = ? AND projectPath = ?`).get(moduleId, projectPath) as TrainingSession | undefined;
    return row ?? null;
  }

  listTrainingSessions(projectPath?: string, status?: 'active' | 'archived'): TrainingSession[] {
    this.ensureInit();
    let query = `SELECT * FROM training_sessions WHERE 1=1`;
    const params: any[] = [];

    if (projectPath !== undefined) {
      query += ` AND projectPath = ?`;
      params.push(projectPath);
    }
    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    query += ` ORDER BY updatedAt DESC`;

    return this.db!.prepare(query).all(...params) as TrainingSession[];
  }

  updateTrainingSessionStats(sessionId: string): void {
    this.ensureInit();
    const now = Date.now();

    // Get session to know projectPath
    const session = this.getTrainingSession(sessionId);
    const projectPath = session?.projectPath || '';

    // Count incidents
    const incidentRow = this.db!.prepare(`SELECT COUNT(*) as count FROM incidents WHERE sessionId = ?`).get(sessionId) as any;
    const totalIncidents = incidentRow?.count ?? 0;

    // Count lessons
    const lessonRow = this.db!.prepare(`SELECT COUNT(*) as count FROM lessons WHERE sessionId = ?`).get(sessionId) as any;
    const totalLessons = lessonRow?.count ?? 0;

    // Count skills (per project, not global)
    const skillRow = this.db!.prepare(`SELECT COUNT(*) as count FROM skills WHERE projectPath = ?`).get(projectPath) as any;
    const totalSkills = skillRow?.count ?? 0;

    this.db!.prepare(`UPDATE training_sessions SET totalIncidents = ?, totalLessons = ?, totalSkills = ?, updatedAt = ? WHERE id = ?`).run(totalIncidents, totalLessons, totalSkills, now, sessionId);

  }

  archiveTrainingSession(id: string): TrainingSession | null {
    this.ensureInit();
    const session = this.getTrainingSession(id);
    if (!session) return null;

    const now = Date.now();
    this.db!.prepare(`UPDATE training_sessions SET status = 'archived', updatedAt = ? WHERE id = ?`).run(now, id);

    return { ...session, status: 'archived', updatedAt: now };
  }

  // --- Incidents ---

  createIncident(input: CreateIncidentInput): Incident {
    this.ensureInit();
    const now = Date.now();
    const id = this.generateId('incident');
    const contextJson = input.context ? JSON.stringify(input.context) : null;

    this.db!.prepare(`INSERT INTO incidents (id, sessionId, type, severity, title, description, context, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`).run(id, input.sessionId, input.type, input.severity, input.title, input.description || null, contextJson, now);

    // Update session stats
    this.updateTrainingSessionStats(input.sessionId);

    return {
      id,
      sessionId: input.sessionId,
      type: input.type,
      severity: input.severity,
      title: input.title,
      description: input.description,
      context: contextJson || undefined,
      status: 'open',
      createdAt: now,
    };
  }

  getIncident(id: string): Incident | null {
    this.ensureInit();
    const row = this.db!.prepare(`SELECT * FROM incidents WHERE id = ?`).get(id) as Incident | undefined;
    return row ?? null;
  }

  listIncidents(filters: IncidentFilters = {}): Incident[] {
    this.ensureInit();
    let query = `SELECT * FROM incidents WHERE 1=1`;
    const params: any[] = [];

    if (filters.sessionId) {
      query += ` AND sessionId = ?`;
      params.push(filters.sessionId);
    }
    if (filters.type) {
      query += ` AND type = ?`;
      params.push(filters.type);
    }
    if (filters.severity) {
      query += ` AND severity = ?`;
      params.push(filters.severity);
    }
    if (filters.status) {
      query += ` AND status = ?`;
      params.push(filters.status);
    }
    query += ` ORDER BY createdAt DESC`;

    return this.db!.prepare(query).all(...params) as Incident[];
  }

  updateIncident(input: UpdateIncidentInput): Incident | null {
    this.ensureInit();
    const incident = this.getIncident(input.id);
    if (!incident) return null;

    const sets: string[] = [];
    const values: any[] = [];

    if (input.type !== undefined) { sets.push('type = ?'); values.push(input.type); }
    if (input.severity !== undefined) { sets.push('severity = ?'); values.push(input.severity); }
    if (input.title !== undefined) { sets.push('title = ?'); values.push(input.title); }
    if (input.description !== undefined) { sets.push('description = ?'); values.push(input.description); }
    if (input.context !== undefined) { sets.push('context = ?'); values.push(JSON.stringify(input.context)); }
    if (input.resolution !== undefined) { sets.push('resolution = ?'); values.push(input.resolution); }
    if (input.status !== undefined) { sets.push('status = ?'); values.push(input.status); }

    if (sets.length === 0) return incident;

    values.push(input.id);
    this.db!.prepare(`UPDATE incidents SET ${sets.join(', ')} WHERE id = ?`).run(...values);

    return this.getIncident(input.id);
  }

  deleteIncident(id: string): boolean {
    this.ensureInit();
    const incident = this.getIncident(id);
    if (!incident) return false;

    this.db!.prepare(`DELETE FROM incidents WHERE id = ?`).run(id);

    this.updateTrainingSessionStats(incident.sessionId);
    return true;
  }

  // --- Lessons ---

  createLesson(input: CreateLessonInput): Lesson {
    this.ensureInit();
    const now = Date.now();
    const id = this.generateId('lesson');
    const incidentIdsJson = input.incidentIds ? JSON.stringify(input.incidentIds) : null;
    const applicabilityJson = input.applicability ? JSON.stringify(input.applicability) : null;

    this.db!.prepare(`INSERT INTO lessons (id, sessionId, incidentIds, title, problem, rootCause, solution, applicability, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`).run(id, input.sessionId, incidentIdsJson, input.title, input.problem, input.rootCause, input.solution, applicabilityJson, now);

    // Update linked incidents status
    if (input.incidentIds) {
      for (const incidentId of input.incidentIds) {
        this.updateIncident({ id: incidentId, status: 'lesson_created' });
      }
    }

    this.updateTrainingSessionStats(input.sessionId);

    return {
      id,
      sessionId: input.sessionId,
      incidentIds: incidentIdsJson || undefined,
      title: input.title,
      problem: input.problem,
      rootCause: input.rootCause,
      solution: input.solution,
      applicability: applicabilityJson || undefined,
      status: 'draft',
      createdAt: now,
    };
  }

  getLesson(id: string): Lesson | null {
    this.ensureInit();
    const row = this.db!.prepare(`SELECT * FROM lessons WHERE id = ?`).get(id) as Lesson | undefined;
    return row ?? null;
  }

  listLessons(filters: LessonFilters = {}): Lesson[] {
    this.ensureInit();
    let query = `SELECT * FROM lessons WHERE 1=1`;
    const params: any[] = [];

    if (filters.sessionId) {
      query += ` AND sessionId = ?`;
      params.push(filters.sessionId);
    }
    if (filters.status) {
      query += ` AND status = ?`;
      params.push(filters.status);
    }
    query += ` ORDER BY createdAt DESC`;

    return this.db!.prepare(query).all(...params) as Lesson[];
  }

  updateLesson(input: UpdateLessonInput): Lesson | null {
    this.ensureInit();
    const lesson = this.getLesson(input.id);
    if (!lesson) return null;

    const sets: string[] = [];
    const values: any[] = [];

    if (input.title !== undefined) { sets.push('title = ?'); values.push(input.title); }
    if (input.problem !== undefined) { sets.push('problem = ?'); values.push(input.problem); }
    if (input.rootCause !== undefined) { sets.push('rootCause = ?'); values.push(input.rootCause); }
    if (input.solution !== undefined) { sets.push('solution = ?'); values.push(input.solution); }
    if (input.applicability !== undefined) { sets.push('applicability = ?'); values.push(JSON.stringify(input.applicability)); }
    if (input.status !== undefined) { sets.push('status = ?'); values.push(input.status); }
    if (input.approvedBy !== undefined) { sets.push('approvedBy = ?'); values.push(input.approvedBy); }

    if (sets.length === 0) return lesson;

    values.push(input.id);
    this.db!.prepare(`UPDATE lessons SET ${sets.join(', ')} WHERE id = ?`).run(...values);

    return this.getLesson(input.id);
  }

  approveLesson(id: string, approver: string): Lesson | null {
    return this.updateLesson({ id, status: 'approved', approvedBy: approver });
  }

  // --- Skills ---

  createSkill(input: CreateSkillInput): Skill {
    this.ensureInit();
    const now = Date.now();
    const id = this.generateId('skill');
    const projectPath = input.projectPath || '';
    const lessonIdsJson = input.lessonIds ? JSON.stringify(input.lessonIds) : null;
    const triggerConfigJson = input.trigger ? JSON.stringify(input.trigger) : null;
    const applicabilityJson = input.applicability ? JSON.stringify(input.applicability) : null;

    this.db!.prepare(`INSERT INTO skills (id, projectPath, name, description, lessonIds, type, content, triggerConfig, applicability, status, usageCount, successRate, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 0, 0, ?, ?)`).run(id, projectPath, input.name, input.description || null, lessonIdsJson, input.type, input.content, triggerConfigJson, applicabilityJson, now, now);

    return {
      id,
      projectPath,
      name: input.name,
      description: input.description,
      lessonIds: lessonIdsJson || undefined,
      type: input.type,
      content: input.content,
      triggerConfig: triggerConfigJson || undefined,
      applicability: applicabilityJson || undefined,
      status: 'draft',
      usageCount: 0,
      successRate: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  getSkill(id: string): Skill | null {
    this.ensureInit();
    const row = this.db!.prepare(`SELECT * FROM skills WHERE id = ?`).get(id) as Skill | undefined;
    return row ?? null;
  }

  getSkillByName(name: string, projectPath: string = ''): Skill | null {
    this.ensureInit();
    const row = this.db!.prepare(`SELECT * FROM skills WHERE name = ? AND projectPath = ?`).get(name, projectPath) as Skill | undefined;
    return row ?? null;
  }

  listSkills(filters: SkillFilters = {}): Skill[] {
    this.ensureInit();
    let query = `SELECT * FROM skills WHERE 1=1`;
    const params: any[] = [];

    if (filters.projectPath !== undefined) {
      query += ` AND projectPath = ?`;
      params.push(filters.projectPath);
    }
    if (filters.status) {
      query += ` AND status = ?`;
      params.push(filters.status);
    }
    if (filters.type) {
      query += ` AND type = ?`;
      params.push(filters.type);
    }
    // Module/role/taskType filtering happens in application layer (JSON parsing)
    query += ` ORDER BY usageCount DESC, successRate DESC, updatedAt DESC`;

    return this.db!.prepare(query).all(...params) as Skill[];
  }

  updateSkill(input: UpdateSkillInput): Skill | null {
    this.ensureInit();
    const skill = this.getSkill(input.id);
    if (!skill) return null;

    const now = Date.now();
    const sets: string[] = ['updatedAt = ?'];
    const values: any[] = [now];

    if (input.name !== undefined) { sets.push('name = ?'); values.push(input.name); }
    if (input.description !== undefined) { sets.push('description = ?'); values.push(input.description); }
    if (input.lessonIds !== undefined) { sets.push('lessonIds = ?'); values.push(JSON.stringify(input.lessonIds)); }
    if (input.type !== undefined) { sets.push('type = ?'); values.push(input.type); }
    if (input.content !== undefined) { sets.push('content = ?'); values.push(input.content); }
    if (input.trigger !== undefined) { sets.push('triggerConfig = ?'); values.push(JSON.stringify(input.trigger)); }
    if (input.applicability !== undefined) { sets.push('applicability = ?'); values.push(JSON.stringify(input.applicability)); }
    if (input.status !== undefined) { sets.push('status = ?'); values.push(input.status); }

    values.push(input.id);
    this.db!.prepare(`UPDATE skills SET ${sets.join(', ')} WHERE id = ?`).run(...values);

    return this.getSkill(input.id);
  }

  activateSkill(id: string): Skill | null {
    return this.updateSkill({ id, status: 'active' });
  }

  deprecateSkill(id: string): Skill | null {
    return this.updateSkill({ id, status: 'deprecated' });
  }

  incrementSkillUsage(id: string): Skill | null {
    this.ensureInit();
    const now = Date.now();
    this.db!.prepare(`UPDATE skills SET usageCount = usageCount + 1, lastUsed = ?, updatedAt = ? WHERE id = ?`).run(now, now, id);

    return this.getSkill(id);
  }

  // --- Rules ---

  createRule(input: CreateRuleInput): Rule {
    this.ensureInit();
    const now = Date.now();
    const id = this.generateId('rule');
    const projectPath = input.projectPath || '';
    const skillIdsJson = input.skillIds ? JSON.stringify(input.skillIds) : null;
    const applicabilityJson = input.applicability ? JSON.stringify(input.applicability) : null;

    this.db!.prepare(`INSERT INTO rules (id, projectPath, name, description, skillIds, level, enforcement, content, applicability, status, violationCount, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?)`).run(id, projectPath, input.name, input.description || null, skillIdsJson, input.level, input.enforcement, input.content, applicabilityJson, now);

    return {
      id,
      projectPath,
      name: input.name,
      description: input.description,
      skillIds: skillIdsJson || undefined,
      level: input.level,
      enforcement: input.enforcement,
      content: input.content,
      applicability: applicabilityJson || undefined,
      status: 'active',
      violationCount: 0,
      createdAt: now,
    };
  }

  getRule(id: string): Rule | null {
    this.ensureInit();
    const row = this.db!.prepare(`SELECT * FROM rules WHERE id = ?`).get(id) as Rule | undefined;
    return row ?? null;
  }

  getRuleByName(name: string, projectPath: string = ''): Rule | null {
    this.ensureInit();
    const row = this.db!.prepare(`SELECT * FROM rules WHERE name = ? AND projectPath = ?`).get(name, projectPath) as Rule | undefined;
    return row ?? null;
  }

  listRules(filters: RuleFilters = {}): Rule[] {
    this.ensureInit();
    let query = `SELECT * FROM rules WHERE 1=1`;
    const params: any[] = [];

    if (filters.projectPath !== undefined) {
      query += ` AND projectPath = ?`;
      params.push(filters.projectPath);
    }
    if (filters.status) {
      query += ` AND status = ?`;
      params.push(filters.status);
    }
    if (filters.level) {
      query += ` AND level = ?`;
      params.push(filters.level);
    }
    if (filters.enforcement) {
      query += ` AND enforcement = ?`;
      params.push(filters.enforcement);
    }
    query += ` ORDER BY level ASC, createdAt DESC`; // must before should before may

    return this.db!.prepare(query).all(...params) as Rule[];
  }

  updateRule(input: UpdateRuleInput): Rule | null {
    this.ensureInit();
    const rule = this.getRule(input.id);
    if (!rule) return null;

    const sets: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) { sets.push('name = ?'); values.push(input.name); }
    if (input.description !== undefined) { sets.push('description = ?'); values.push(input.description); }
    if (input.skillIds !== undefined) { sets.push('skillIds = ?'); values.push(JSON.stringify(input.skillIds)); }
    if (input.level !== undefined) { sets.push('level = ?'); values.push(input.level); }
    if (input.enforcement !== undefined) { sets.push('enforcement = ?'); values.push(input.enforcement); }
    if (input.content !== undefined) { sets.push('content = ?'); values.push(input.content); }
    if (input.applicability !== undefined) { sets.push('applicability = ?'); values.push(JSON.stringify(input.applicability)); }
    if (input.status !== undefined) { sets.push('status = ?'); values.push(input.status); }

    if (sets.length === 0) return rule;

    values.push(input.id);
    this.db!.prepare(`UPDATE rules SET ${sets.join(', ')} WHERE id = ?`).run(...values);

    return this.getRule(input.id);
  }

  deprecateRule(id: string): Rule | null {
    return this.updateRule({ id, status: 'deprecated' });
  }

  recordRuleViolation(id: string): Rule | null {
    this.ensureInit();
    const now = Date.now();
    this.db!.prepare(`UPDATE rules SET violationCount = violationCount + 1, lastViolation = ? WHERE id = ?`).run(now, id);

    return this.getRule(id);
  }

  // --- Training Feedback ---

  createTrainingFeedback(input: CreateFeedbackInput): TrainingFeedback {
    this.ensureInit();
    const now = Date.now();
    const id = this.generateId('tfeedback');

    this.db!.prepare(`INSERT INTO training_feedback (id, entityType, entityId, taskId, outcome, notes, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, input.entityType, input.entityId, input.taskId || null, input.outcome, input.notes || null, now);

    // Update skill/rule success rate if it's a skill
    if (input.entityType === 'skill') {
      this.updateSkillSuccessRate(input.entityId);
    }

    return {
      id,
      entityType: input.entityType,
      entityId: input.entityId,
      taskId: input.taskId,
      outcome: input.outcome,
      notes: input.notes,
      createdAt: now,
    };
  }

  listTrainingFeedback(entityType: 'skill' | 'rule', entityId: string): TrainingFeedback[] {
    this.ensureInit();
    return this.db!.prepare(`SELECT * FROM training_feedback WHERE entityType = ? AND entityId = ? ORDER BY createdAt DESC`).all(entityType, entityId) as TrainingFeedback[];
  }

  private updateSkillSuccessRate(skillId: string): void {
    this.ensureInit();

    const rows = this.db!.prepare(`SELECT outcome, COUNT(*) as count FROM training_feedback WHERE entityType = 'skill' AND entityId = ? GROUP BY outcome`).all(skillId) as any[];

    if (rows.length === 0) return;

    let total = 0;
    let helped = 0;

    for (const row of rows) {
      const outcome = row.outcome as string;
      const count = Number(row.count);
      total += count;
      if (outcome === 'helped') helped += count;
    }

    const successRate = total > 0 ? (helped / total) * 100 : 0;

    this.db!.prepare(`UPDATE skills SET successRate = ?, updatedAt = ? WHERE id = ?`).run(successRate, Date.now(), skillId);

  }

  // --- Training Context ---

  getTrainingContext(moduleId: string, projectPath: string = '', role?: string, taskType?: string): TrainingContext {
    this.ensureInit();

    // Get active skills for this project (filter by applicability in app layer)
    const allSkills = this.listSkills({ projectPath, status: 'active' });
    const applicableSkills = allSkills.filter(skill => {
      if (!skill.applicability) return true; // No filter = applies to all
      try {
        const app = JSON.parse(skill.applicability) as { modules?: string[]; roles?: string[]; taskTypes?: string[] };
        const moduleMatch = !app.modules || app.modules.includes('*') || app.modules.includes(moduleId);
        const roleMatch = !role || !app.roles || app.roles.includes('*') || app.roles.includes(role);
        const taskMatch = !taskType || !app.taskTypes || app.taskTypes.includes('*') || app.taskTypes.includes(taskType);
        return moduleMatch && roleMatch && taskMatch;
      } catch {
        return true;
      }
    }).slice(0, 5); // Max 5 skills

    // Get active rules for this project
    const allRules = this.listRules({ projectPath, status: 'active' });
    const applicableRules = allRules.filter(rule => {
      if (!rule.applicability) return true;
      try {
        const app = JSON.parse(rule.applicability) as { modules?: string[]; roles?: string[]; taskTypes?: string[] };
        const moduleMatch = !app.modules || app.modules.includes('*') || app.modules.includes(moduleId);
        const roleMatch = !role || !app.roles || app.roles.includes('*') || app.roles.includes(role);
        const taskMatch = !taskType || !app.taskTypes || app.taskTypes.includes('*') || app.taskTypes.includes(taskType);
        return moduleMatch && roleMatch && taskMatch;
      } catch {
        return true;
      }
    }).slice(0, 5); // Max 5 rules

    // Get recent approved lessons and incidents for this module's session
    const session = this.getTrainingSessionByModule(moduleId, projectPath);
    let recentLessons: Lesson[] = [];
    let recentIncidents: Incident[] = [];
    if (session) {
      recentLessons = this.listLessons({ sessionId: session.id, status: 'approved' }).slice(0, 3);
      recentIncidents = this.listIncidents({ sessionId: session.id, status: 'open' }).slice(0, 5);
    }

    return {
      moduleId,
      projectPath,
      skills: applicableSkills,
      rules: applicableRules,
      recentLessons,
      recentIncidents,
    };
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  // ==========================================================================
  // Task Governance Migration
  // ==========================================================================

  /**
   * Migrate existing tasks to include governance fields.
   * Legacy tasks are marked with validation.legacy = true to skip validation.
   *
   * @returns Migration result with counts
   */
  migrateTasksToGovernance(): { migrated: number; skipped: number; errors: string[] } {
    this.ensureInit();

    const errors: string[] = [];
    let migrated = 0;
    let skipped = 0;

    // Get all tasks that don't have taskType set
    const tasks = this.db!.prepare(
      `SELECT * FROM tasks WHERE taskType IS NULL OR taskType = ''`
    ).all() as Task[];

    if (tasks.length === 0) {
      return { migrated: 0, skipped: 0, errors: [] };
    }

    for (const task of tasks) {
      try {
        // Infer task type from title and description
        const taskType = this.inferTaskTypeFromContent(task.title, task.description || '');

        // Build legacy validation
        const legacyValidation = {
          progressHistoryCount: 0,
          titleFormatValid: true,
          qualityGatesPassed: true,
          acceptanceCriteriaValid: true,
          legacy: true,
          migratedAt: Date.now(),
        };

        // Update task with inferred governance
        this.db!.prepare(`UPDATE tasks SET
            taskType = ?,
            validation = ?
          WHERE id = ?`).run(
            taskType,
            JSON.stringify(legacyValidation),
            task.id,
          );

        migrated++;
      } catch (err) {
        errors.push(`Failed to migrate task ${task.id}: ${err}`);
        skipped++;
      }
    }

    return { migrated, skipped, errors };
  }

  /**
   * Infer task type from title and description keywords
   */
  private inferTaskTypeFromContent(title: string, description: string): TaskType {
    const text = `${title} ${description}`.toLowerCase();

    // Check for type prefix in title first
    const prefixMatch = title.match(/^\[(\w+)\]/);
    if (prefixMatch) {
      const prefix = prefixMatch[1].toLowerCase();
      const validTypes: TaskType[] = ['feature', 'bugfix', 'refactor', 'test', 'docs', 'infra', 'security', 'perf', 'debt', 'spike'];
      if (validTypes.includes(prefix as TaskType)) {
        return prefix as TaskType;
      }
    }

    // Keyword-based inference
    if (text.includes('fix') || text.includes('bug')) return 'bugfix';
    if (text.includes('test')) return 'test';
    if (text.includes('refactor')) return 'refactor';
    if (text.includes('docs') || text.includes('document')) return 'docs';
    if (text.includes('security') || text.includes('vulnerability')) return 'security';
    if (text.includes('perf') || text.includes('optim') || text.includes('slow')) return 'perf';
    if (text.includes('debt') || text.includes('cleanup')) return 'debt';
    if (text.includes('spike') || text.includes('research') || text.includes('investigate')) return 'spike';
    if (text.includes('infra') || text.includes('deploy') || text.includes('ci') || text.includes('build')) return 'infra';

    return 'feature';
  }

  // ==========================================================================
  // Entity Reference Methods (Project Intelligence Hub)
  // ==========================================================================

  createEntityReference(input: CreateEntityReferenceInput): EntityReference {
    this.ensureInit();
    const id = this.generateId('ref');
    const now = Date.now();
    const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;

    this.db!.prepare(`
      INSERT INTO entity_references (id, source_type, source_id, target_type, target_id, relationship, metadata, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.sourceType, input.sourceId, input.targetType, input.targetId, input.relationship, metadataJson, now, input.createdBy || 'system');

    return {
      id,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      targetType: input.targetType,
      targetId: input.targetId,
      relationship: input.relationship,
      metadata: metadataJson ?? undefined,
      createdAt: now,
      createdBy: input.createdBy || 'system',
    };
  }

  createEntityReferences(inputs: CreateEntityReferenceInput[]): EntityReference[] {
    this.ensureInit();
    const results: EntityReference[] = [];

    const insertStmt = this.db!.prepare(`
      INSERT OR IGNORE INTO entity_references (id, source_type, source_id, target_type, target_id, relationship, metadata, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db!.transaction(() => {
      for (const input of inputs) {
        const id = this.generateId('ref');
        const now = Date.now();
        const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;

        const result = insertStmt.run(id, input.sourceType, input.sourceId, input.targetType, input.targetId, input.relationship, metadataJson, now, input.createdBy || 'system');

        if (result.changes > 0) {
          results.push({
            id,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            targetType: input.targetType,
            targetId: input.targetId,
            relationship: input.relationship,
            metadata: metadataJson ?? undefined,
            createdAt: now,
            createdBy: input.createdBy || 'system',
          });
        }
      }
    });

    transaction();
    return results;
  }

  deleteEntityReference(id: string): boolean {
    this.ensureInit();
    const result = this.db!.prepare('DELETE FROM entity_references WHERE id = ?').run(id);
    return result.changes > 0;
  }

  deleteEntityReferenceByLink(sourceType: EntityType, sourceId: string, targetType: EntityType, targetId: string, relationship: EntityReferenceRelationship): boolean {
    this.ensureInit();
    const result = this.db!.prepare(
      'DELETE FROM entity_references WHERE source_type = ? AND source_id = ? AND target_type = ? AND target_id = ? AND relationship = ?'
    ).run(sourceType, sourceId, targetType, targetId, relationship);
    return result.changes > 0;
  }

  getEntityReference(id: string): EntityReference | null {
    this.ensureInit();
    const row = this.db!.prepare('SELECT * FROM entity_references WHERE id = ?').get(id) as any | undefined;
    return row ? this.mapEntityReferenceRow(row) : null;
  }

  queryEntityReferences(query: EntityReferenceQuery): EntityReference[] {
    this.ensureInit();
    const conditions: string[] = [];
    const params: any[] = [];

    // Bidirectional query (entityType + entityId)
    if (query.entityType && query.entityId) {
      const direction = query.direction || 'both';
      if (direction === 'forward') {
        conditions.push('(source_type = ? AND source_id = ?)');
        params.push(query.entityType, query.entityId);
      } else if (direction === 'reverse') {
        conditions.push('(target_type = ? AND target_id = ?)');
        params.push(query.entityType, query.entityId);
      } else {
        conditions.push('((source_type = ? AND source_id = ?) OR (target_type = ? AND target_id = ?))');
        params.push(query.entityType, query.entityId, query.entityType, query.entityId);
      }
    } else {
      // Directional queries
      if (query.sourceType) { conditions.push('source_type = ?'); params.push(query.sourceType); }
      if (query.sourceId) { conditions.push('source_id = ?'); params.push(query.sourceId); }
      if (query.targetType) { conditions.push('target_type = ?'); params.push(query.targetType); }
      if (query.targetId) { conditions.push('target_id = ?'); params.push(query.targetId); }
    }

    // Relationship filter
    if (query.relationship) {
      if (Array.isArray(query.relationship)) {
        conditions.push(`relationship IN (${query.relationship.map(() => '?').join(', ')})`);
        params.push(...query.relationship);
      } else {
        conditions.push('relationship = ?');
        params.push(query.relationship);
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(query.limit || 100, 500);
    const offset = query.offset || 0;

    const rows = this.db!.prepare(
      `SELECT * FROM entity_references ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as any[];

    return rows.map(row => this.mapEntityReferenceRow(row));
  }

  countEntityReferences(query: Omit<EntityReferenceQuery, 'limit' | 'offset'>): number {
    this.ensureInit();
    const conditions: string[] = [];
    const params: any[] = [];

    if (query.entityType && query.entityId) {
      const direction = query.direction || 'both';
      if (direction === 'forward') {
        conditions.push('(source_type = ? AND source_id = ?)');
        params.push(query.entityType, query.entityId);
      } else if (direction === 'reverse') {
        conditions.push('(target_type = ? AND target_id = ?)');
        params.push(query.entityType, query.entityId);
      } else {
        conditions.push('((source_type = ? AND source_id = ?) OR (target_type = ? AND target_id = ?))');
        params.push(query.entityType, query.entityId, query.entityType, query.entityId);
      }
    } else {
      if (query.sourceType) { conditions.push('source_type = ?'); params.push(query.sourceType); }
      if (query.sourceId) { conditions.push('source_id = ?'); params.push(query.sourceId); }
      if (query.targetType) { conditions.push('target_type = ?'); params.push(query.targetType); }
      if (query.targetId) { conditions.push('target_id = ?'); params.push(query.targetId); }
    }

    if (query.relationship) {
      if (Array.isArray(query.relationship)) {
        conditions.push(`relationship IN (${query.relationship.map(() => '?').join(', ')})`);
        params.push(...query.relationship);
      } else {
        conditions.push('relationship = ?');
        params.push(query.relationship);
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const row = this.db!.prepare(`SELECT COUNT(*) as count FROM entity_references ${where}`).get(...params) as any;
    return row?.count || 0;
  }

  getRelatedEntities(entityType: EntityType, entityId: string, maxDepth: number = 1): EntityReference[] {
    this.ensureInit();
    const visited = new Set<string>();
    const result: EntityReference[] = [];

    const queue: Array<{ type: EntityType; id: string; depth: number }> = [
      { type: entityType, id: entityId, depth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = `${current.type}:${current.id}`;
      if (visited.has(key)) continue;
      visited.add(key);

      if (current.depth >= maxDepth) continue;

      const refs = this.queryEntityReferences({
        entityType: current.type,
        entityId: current.id,
        direction: 'both',
        limit: 100,
      });

      for (const ref of refs) {
        const refKey = ref.id;
        if (!result.some(r => r.id === refKey)) {
          result.push(ref);
        }

        // Determine the "other" entity to traverse
        const isSource = ref.sourceType === current.type && ref.sourceId === current.id;
        const nextType = isSource ? ref.targetType : ref.sourceType;
        const nextId = isSource ? ref.targetId : ref.sourceId;
        const nextKey = `${nextType}:${nextId}`;

        if (!visited.has(nextKey)) {
          queue.push({ type: nextType, id: nextId, depth: current.depth + 1 });
        }
      }
    }

    return result;
  }

  private mapEntityReferenceRow(row: any): EntityReference {
    return {
      id: row.id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      targetType: row.target_type,
      targetId: row.target_id,
      relationship: row.relationship,
      metadata: row.metadata ?? undefined,
      createdAt: row.created_at,
      createdBy: row.created_by ?? undefined,
    };
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }

  getDbPath(): string {
    return this.dbPath;
  }
}

// Singleton instance
let dbInstance: SidStackDB | null = null;
let initPromise: Promise<void> | null = null;

export async function getDB(projectPath?: string): Promise<SidStackDB> {
  if (!dbInstance) {
    dbInstance = new SidStackDB(projectPath);
    initPromise = dbInstance.init().catch((err) => {
      // Reset singleton so next call retries instead of caching rejected promise
      dbInstance = null;
      initPromise = null;
      throw err;
    });
  } else if (projectPath) {
    const requestedPath = path.join(projectPath, '.sidstack', 'sidstack.db');
    if (dbInstance.getDbPath() !== requestedPath) {
      console.warn(`[SidStackDB] WARNING: getDB() called with projectPath="${projectPath}" but singleton already initialized at "${dbInstance.getDbPath()}". Ignoring projectPath.`);
    }
  }
  await initPromise;

  return dbInstance;
}

export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    initPromise = null;
  }
}

