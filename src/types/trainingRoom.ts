// Training Room Types for SidStack
// Lessons-learned system to transform agents into project experts

// ============================================================================
// Enums & Type Aliases
// ============================================================================

export type SessionStatus = 'active' | 'archived';
export type IncidentType = 'mistake' | 'failure' | 'confusion' | 'slow' | 'other';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'analyzed' | 'lesson_created' | 'closed';
export type LessonStatus = 'draft' | 'reviewed' | 'approved' | 'archived';
export type SkillType = 'procedure' | 'checklist' | 'template' | 'rule';
export type SkillStatus = 'draft' | 'active' | 'deprecated';
export type SkillTrigger = 'always' | 'task_start' | 'task_end' | 'before_commit' | 'on_error';
export type RuleLevel = 'must' | 'should' | 'may';
export type RuleEnforcement = 'manual' | 'hook' | 'gate';
export type RuleStatus = 'active' | 'deprecated';
export type FeedbackOutcome = 'helped' | 'ignored' | 'hindered';

// ============================================================================
// Core Entities
// ============================================================================

/**
 * Training Session - one per module
 * Replaces TestRoom
 */
export interface TrainingSession {
  id: string;
  moduleId: string;
  status: SessionStatus;
  totalIncidents: number;
  totalLessons: number;
  totalSkills: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Incident - captures agent mistakes, failures, confusion
 */
export interface Incident {
  id: string;
  sessionId: string;
  type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description?: string;
  context?: string; // JSON: IncidentContext
  resolution?: string;
  status: IncidentStatus;
  createdAt: number;
}

/**
 * Context data for an incident
 */
export interface IncidentContext {
  taskId?: string;
  agentRole?: string;
  files?: string[];
  commands?: string[];
  errorMessage?: string;
}

/**
 * Lesson - structured knowledge extracted from incidents
 */
export interface Lesson {
  id: string;
  sessionId: string;
  incidentIds?: string; // JSON array of incident IDs
  title: string;
  problem: string;
  rootCause: string;
  solution: string;
  applicability?: string; // JSON: Applicability
  status: LessonStatus;
  approvedBy?: string;
  createdAt: number;
}

/**
 * Skill - reusable procedure derived from lessons
 */
export interface Skill {
  id: string;
  name: string;
  description?: string;
  lessonIds?: string; // JSON array
  type: SkillType;
  content: string; // Markdown content
  triggerConfig?: string; // JSON: TriggerConfig
  applicability?: string; // JSON: Applicability
  status: SkillStatus;
  usageCount: number;
  successRate: number; // 0-100
  lastUsed?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Rule - mandatory guideline derived from skills
 */
export interface Rule {
  id: string;
  name: string;
  description?: string;
  skillIds?: string; // JSON array
  level: RuleLevel;
  enforcement: RuleEnforcement;
  content: string;
  applicability?: string; // JSON: Applicability
  status: RuleStatus;
  violationCount: number;
  lastViolation?: number;
  createdAt: number;
}

/**
 * Feedback - tracks effectiveness of skills/rules
 */
export interface TrainingFeedback {
  id: string;
  entityType: 'skill' | 'rule';
  entityId: string;
  taskId?: string;
  outcome: FeedbackOutcome;
  notes?: string;
  createdAt: number;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Defines which modules, roles, and task types a skill/rule/lesson applies to
 */
export interface Applicability {
  modules?: string[]; // ['*'] means all modules
  roles?: string[]; // ['dev', 'qa', '*']
  taskTypes?: string[]; // ['feature', 'bugfix', 'refactor', '*']
}

/**
 * Defines when a skill should be triggered
 */
export interface TriggerConfig {
  when: SkillTrigger;
  conditions?: string[]; // e.g., ['taskType:refactor', 'module:api-server']
}

// ============================================================================
// Input Types
// ============================================================================

export interface CreateTrainingSessionInput {
  moduleId: string;
}

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
}

export interface CreateRuleInput {
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
  outcome: FeedbackOutcome;
  notes?: string;
}

// ============================================================================
// Query & Filter Types
// ============================================================================

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
  module?: string;
  role?: string;
  taskType?: string;
  status?: SkillStatus;
  type?: SkillType;
}

export interface RuleFilters {
  module?: string;
  role?: string;
  taskType?: string;
  status?: RuleStatus;
  level?: RuleLevel;
  enforcement?: RuleEnforcement;
}

// ============================================================================
// Context Building Types
// ============================================================================

export interface TrainingContextRequest {
  moduleId: string;
  role: string;
  taskType: string;
}

export interface TrainingContext {
  skills: Skill[];
  rules: Rule[];
  recentLessons: Lesson[];
}

// ============================================================================
// Aggregated Types
// ============================================================================

export interface TrainingSessionWithStats extends TrainingSession {
  openIncidents: number;
  approvedLessons: number;
  activeSkills: number;
  activeRules: number;
}

export interface SkillWithEffectiveness extends Skill {
  feedbackCount: number;
  helpedCount: number;
  hinderedCount: number;
}

export interface RuleWithViolations extends Rule {
  recentViolations: number; // Last 7 days
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface TrainingAnalytics {
  incidentsByType: Record<IncidentType, number>;
  incidentsBySeverity: Record<IncidentSeverity, number>;
  lessonsCreatedRatio: number; // lessons / incidents
  averageSkillEffectiveness: number;
  ruleViolationsTrend: number[]; // Last 7 days
}

// ============================================================================
// UI Constants
// ============================================================================

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  mistake: 'Mistake',
  failure: 'Build/Test Failure',
  confusion: 'Confusion',
  slow: 'Slow Performance',
  other: 'Other',
};

export const INCIDENT_SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  low: 'text-green-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  critical: 'text-red-400',
};

export const INCIDENT_SEVERITY_ICONS: Record<IncidentSeverity, string> = {
  low: '🟢',
  medium: '🟡',
  high: '🟠',
  critical: '🔴',
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  open: 'Open',
  analyzed: 'Analyzed',
  lesson_created: 'Lesson Created',
  closed: 'Closed',
};

export const LESSON_STATUS_LABELS: Record<LessonStatus, string> = {
  draft: 'Draft',
  reviewed: 'Under Review',
  approved: 'Approved',
  archived: 'Archived',
};

export const SKILL_TYPE_LABELS: Record<SkillType, string> = {
  procedure: 'Procedure',
  checklist: 'Checklist',
  template: 'Template',
  rule: 'Simple Rule',
};

export const SKILL_TRIGGER_LABELS: Record<SkillTrigger, string> = {
  always: 'Always',
  task_start: 'Task Start',
  task_end: 'Task End',
  before_commit: 'Before Commit',
  on_error: 'On Error',
};

export const RULE_LEVEL_LABELS: Record<RuleLevel, string> = {
  must: 'MUST',
  should: 'SHOULD',
  may: 'MAY',
};

export const RULE_ENFORCEMENT_LABELS: Record<RuleEnforcement, string> = {
  manual: 'Manual Review',
  hook: 'Hook Warning',
  gate: 'Gate Block',
};
