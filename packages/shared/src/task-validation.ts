/**
 * Task Validation Module
 *
 * Provides validation for task completion based on governance requirements.
 * Blocks non-compliant completions and provides hints for resolution.
 */

import type { TaskType, TaskGovernance, AcceptanceCriterion, TaskValidation } from './governance';
import { getMinProgressUpdates, validateTitle, isValidTaskType } from './governance';

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationBlocker {
  rule: 'progress-history' | 'title-format' | 'quality-gate' | 'acceptance-criteria' | 'task-type' | 'incomplete-subtasks' | 'cancelled-without-reason';
  message: string;
  details?: unknown;
}

export interface ValidationWarning {
  rule: string;
  message: string;
}

export interface TaskValidationResult {
  canComplete: boolean;
  blockers: ValidationBlocker[];
  warnings: ValidationWarning[];
  hints: string[];
  validation: TaskValidationStatus;
}

export interface TaskValidationStatus {
  progressHistory: {
    required: number;
    actual: number;
    passed: boolean;
  };
  titleFormat: {
    valid: boolean;
    passed: boolean;
    error?: string;
  };
  qualityGates: {
    passed: number;
    failed: number;
    total: number;
    passed_overall: boolean;
  };
  acceptanceCriteria: {
    completed: number;
    total: number;
    passed: boolean;
  };
}

// ============================================================================
// Governance Violation Types
// ============================================================================

export type ViolationType = 'forced_completion' | 'skipped_gate' | 'missing_criteria';

export interface GovernanceViolation {
  id: string;
  taskId: string;
  violationType: ViolationType;
  blockers: ValidationBlocker[];
  reason?: string;
  agentId?: string;
  timestamp: number;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: number;
}

// ============================================================================
// Task Data Interface (what we expect from database)
// ============================================================================

export interface TaskForValidation {
  id: string;
  title: string;
  taskType?: TaskType;
  governance?: TaskGovernance;
  acceptanceCriteria?: AcceptanceCriterion[];
  validation?: TaskValidation;
}

export interface ProgressLogEntry {
  id: string;
  taskId: string;
  progress: number;
  createdAt: number;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate task completion requirements
 *
 * @param task - Task data
 * @param progressHistory - Array of progress log entries
 * @returns Validation result with blockers and hints
 */
export function validateTaskCompletion(
  task: TaskForValidation,
  progressHistory: ProgressLogEntry[]
): TaskValidationResult {
  const blockers: ValidationBlocker[] = [];
  const warnings: ValidationWarning[] = [];
  const hints: string[] = [];

  // Check for legacy tasks (skip validation)
  if (task.validation?.legacy) {
    return {
      canComplete: true,
      blockers: [],
      warnings: [{ rule: 'legacy', message: 'Legacy task - validation skipped' }],
      hints: [],
      validation: {
        progressHistory: { required: 0, actual: progressHistory.length, passed: true },
        titleFormat: { valid: true, passed: true },
        qualityGates: { passed: 0, failed: 0, total: 0, passed_overall: true },
        acceptanceCriteria: { completed: 0, total: 0, passed: true },
      },
    };
  }

  const taskType = task.taskType || 'feature';

  // Rule 1: Progress History Check
  const minUpdates = getMinProgressUpdates(taskType);
  const progressHistoryPassed = progressHistory.length >= minUpdates;

  if (!progressHistoryPassed) {
    blockers.push({
      rule: 'progress-history',
      message: `Insufficient progress updates: ${progressHistory.length}/${minUpdates} required for ${taskType}`,
      details: { current: progressHistory.length, required: minUpdates },
    });
    hints.push(`Use task_progress_log to record progress at each major step`);
  }

  // Rule 2: Title Format Check
  const titleValidation = validateTitle(task.title);
  const titlePassed = titleValidation.valid;

  if (!titlePassed) {
    blockers.push({
      rule: 'title-format',
      message: titleValidation.error || 'Invalid title format',
    });
    hints.push(`Correct format: [TYPE] description (max 100 chars)`);
  }

  // Rule 3: Quality Gates Check
  let gatesPassed = 0;
  let gatesFailed = 0;
  const totalGates = task.governance?.qualityGates?.length || 0;

  if (task.governance?.qualityGates && task.governance.qualityGates.length > 0) {
    for (const gate of task.governance.qualityGates) {
      if (gate.passedAt) {
        gatesPassed++;
      } else {
        gatesFailed++;
        blockers.push({
          rule: 'quality-gate',
          message: `Quality gate "${gate.id}" not passed`,
          details: { gate: gate.id, command: gate.command },
        });
      }
    }
    if (gatesFailed > 0) {
      hints.push(`Run quality gates: pnpm typecheck && pnpm lint && pnpm test`);
    }
  }

  const qualityGatesPassed = gatesFailed === 0;

  // Rule 4: Acceptance Criteria Check (for feature/bugfix)
  let criteriaCompleted = 0;
  const totalCriteria = task.acceptanceCriteria?.length || 0;
  let criteriaPassed = true;

  if (task.governance?.requiredCriteria && task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
    const incomplete = task.acceptanceCriteria.filter(ac => !ac.completed);
    criteriaCompleted = task.acceptanceCriteria.length - incomplete.length;

    if (incomplete.length > 0) {
      criteriaPassed = false;
      blockers.push({
        rule: 'acceptance-criteria',
        message: `${incomplete.length} acceptance criteria not completed`,
        details: { incomplete: incomplete.map(ac => ac.description) },
      });
      hints.push(`Mark criteria complete or update acceptance criteria status`);
    }
  }

  const validation: TaskValidationStatus = {
    progressHistory: {
      required: minUpdates,
      actual: progressHistory.length,
      passed: progressHistoryPassed,
    },
    titleFormat: {
      valid: titleValidation.valid,
      passed: titlePassed,
      error: titleValidation.error,
    },
    qualityGates: {
      passed: gatesPassed,
      failed: gatesFailed,
      total: totalGates,
      passed_overall: qualityGatesPassed,
    },
    acceptanceCriteria: {
      completed: criteriaCompleted,
      total: totalCriteria,
      passed: criteriaPassed,
    },
  };

  return {
    canComplete: blockers.length === 0,
    blockers,
    warnings,
    hints,
    validation,
  };
}

/**
 * Quick check if task has required governance fields
 */
export function validateTaskGovernance(task: TaskForValidation): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check task type
  if (!task.taskType) {
    errors.push('Task type is required');
  } else if (!isValidTaskType(task.taskType)) {
    errors.push(`Invalid task type: ${task.taskType}`);
  }

  // Check title format
  const titleValidation = validateTitle(task.title);
  if (!titleValidation.valid) {
    errors.push(titleValidation.error || 'Invalid title format');
  }

  // Check acceptance criteria for feature/bugfix
  if (task.taskType && ['feature', 'bugfix', 'security'].includes(task.taskType)) {
    if (!task.acceptanceCriteria || task.acceptanceCriteria.length === 0) {
      errors.push(`Acceptance criteria required for ${task.taskType} tasks`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate a governance violation ID
 */
export function generateViolationId(): string {
  return `violation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a governance violation record
 */
export function createViolation(
  taskId: string,
  violationType: ViolationType,
  blockers: ValidationBlocker[],
  reason?: string,
  agentId?: string
): GovernanceViolation {
  return {
    id: generateViolationId(),
    taskId,
    violationType,
    blockers,
    reason,
    agentId,
    timestamp: Date.now(),
    resolved: false,
  };
}

// ============================================================================
// Subtask Validation
// ============================================================================

/**
 * Subtask info needed for validation
 */
export interface SubtaskForValidation {
  id: string;
  title: string;
  status: string;
  notes?: string | null;
}

/**
 * Result of subtask validation
 */
export interface SubtaskValidationResult {
  canComplete: boolean;
  blockers: ValidationBlocker[];
  incompleteSubtasks: SubtaskForValidation[];
  cancelledWithoutReason: SubtaskForValidation[];
}

/**
 * Terminal statuses - tasks in these states don't block parent completion
 */
const TERMINAL_STATUSES = ['completed', 'cancelled'];

/**
 * Validate that all subtasks are in terminal state before completing parent
 *
 * Rules:
 * 1. All subtasks must be completed or cancelled
 * 2. Cancelled subtasks must have notes explaining the reason
 *
 * @param subtasks - Array of subtasks for the parent task
 * @returns Validation result with blockers and details
 */
export function validateSubtasksForCompletion(
  subtasks: SubtaskForValidation[]
): SubtaskValidationResult {
  const blockers: ValidationBlocker[] = [];
  const incompleteSubtasks: SubtaskForValidation[] = [];
  const cancelledWithoutReason: SubtaskForValidation[] = [];

  for (const subtask of subtasks) {
    // Check if subtask is in terminal state
    if (!TERMINAL_STATUSES.includes(subtask.status)) {
      incompleteSubtasks.push(subtask);
    }

    // Check if cancelled subtask has reason
    if (subtask.status === 'cancelled' && (!subtask.notes || subtask.notes.trim() === '')) {
      cancelledWithoutReason.push(subtask);
    }
  }

  // Add blocker for incomplete subtasks
  if (incompleteSubtasks.length > 0) {
    blockers.push({
      rule: 'incomplete-subtasks',
      message: `${incompleteSubtasks.length} subtask(s) not completed or cancelled`,
      details: {
        subtasks: incompleteSubtasks.map(s => ({
          id: s.id,
          title: s.title,
          status: s.status,
        })),
      },
    });
  }

  // Add blocker for cancelled without reason
  if (cancelledWithoutReason.length > 0) {
    blockers.push({
      rule: 'cancelled-without-reason',
      message: `${cancelledWithoutReason.length} cancelled subtask(s) missing cancellation reason`,
      details: {
        subtasks: cancelledWithoutReason.map(s => ({
          id: s.id,
          title: s.title,
        })),
      },
    });
  }

  return {
    canComplete: blockers.length === 0,
    blockers,
    incompleteSubtasks,
    cancelledWithoutReason,
  };
}
