/**
 * Task Governance Module
 *
 * Provides governance resolution for tasks based on task type and module.
 * Auto-links principles, skills, and quality gates to tasks.
 */

// ============================================================================
// Task Type Definitions
// ============================================================================

export type TaskType =
  | 'feature'    // New functionality
  | 'bugfix'     // Fix existing issue
  | 'refactor'   // Code improvement without behavior change
  | 'test'       // Testing work
  | 'docs'       // Documentation
  | 'infra'      // Build, deploy, CI/CD
  | 'security'   // Security-related
  | 'perf'       // Performance optimization
  | 'debt'       // Technical debt cleanup
  | 'spike';     // Research/investigation

export const TASK_TYPES: TaskType[] = [
  'feature', 'bugfix', 'refactor', 'test', 'docs',
  'infra', 'security', 'perf', 'debt', 'spike'
];

export function isValidTaskType(type: string): type is TaskType {
  return TASK_TYPES.includes(type as TaskType);
}

// ============================================================================
// Governance Types
// ============================================================================

export interface QualityGate {
  id: string;           // 'typecheck' | 'lint' | 'test' | 'custom'
  command: string;      // 'pnpm typecheck'
  required: boolean;    // Must pass to complete
  passedAt?: number;    // Timestamp when passed
}

export interface TaskGovernance {
  principles: string[];      // Principle IDs to follow
  skills: string[];          // Skill paths (e.g., 'dev/implement-feature')
  patterns: string[];        // Pattern docs to reference
  qualityGates: QualityGate[]; // Required gates before completion
  moduleRules?: string[];    // Module-specific rules
  requiredCriteria: boolean; // Whether acceptance criteria is required
}

export interface AcceptanceCriterion {
  id: string;
  description: string;
  completed: boolean;
  completedAt?: number;
  verifiedBy?: string;  // Agent who verified
}

export interface TaskContext {
  specLinks?: string[];       // Related spec paths
  knowledgeLinks?: string[];  // Related knowledge docs
  priorArt?: string[];        // Reference implementations
  relatedTasks?: string[];    // Related task IDs
}

export interface TaskValidation {
  progressHistoryCount: number;
  titleFormatValid: boolean;
  qualityGatesPassed: boolean;
  acceptanceCriteriaValid: boolean;
  lastValidatedAt?: number;
  legacy?: boolean;           // Legacy tasks skip validation
  migratedAt?: number;        // Migration timestamp
}

// ============================================================================
// Governance Configuration
// ============================================================================

interface GovernanceConfig {
  principles: string[];
  skills: string[];
  qualityGates: string[];
  requiredCriteria: boolean;
}

export const GATE_COMMANDS: Record<string, string> = {
  typecheck: 'pnpm typecheck',
  lint: 'pnpm lint',
  test: 'pnpm test',
};

/**
 * Task Type → Governance Mapping
 */
export const TASK_TYPE_GOVERNANCE: Record<TaskType, GovernanceConfig> = {
  feature: {
    principles: ['task-management', 'code-quality', 'testing', 'patterns', 'security'],
    skills: ['dev/implement-feature'],
    qualityGates: ['typecheck', 'lint', 'test'],
    requiredCriteria: true,
  },
  bugfix: {
    principles: ['task-management', 'code-quality', 'testing'],
    skills: ['dev/fix-bug'],
    qualityGates: ['typecheck', 'lint', 'test'],
    requiredCriteria: true,
  },
  refactor: {
    principles: ['task-management', 'code-quality', 'patterns'],
    skills: ['dev/refactoring'],
    qualityGates: ['typecheck', 'lint', 'test'],
    requiredCriteria: false,
  },
  test: {
    principles: ['task-management', 'testing'],
    skills: ['qa/test-feature', 'dev/tdd-workflow'],
    qualityGates: ['typecheck', 'test'],
    requiredCriteria: false,
  },
  docs: {
    principles: ['task-management'],
    skills: [],
    qualityGates: [],
    requiredCriteria: false,
  },
  infra: {
    principles: ['task-management', 'hooks', 'git-workflow'],
    skills: [],
    qualityGates: ['typecheck'],
    requiredCriteria: false,
  },
  security: {
    principles: ['task-management', 'security', 'code-quality'],
    skills: ['dev/security-review'],
    qualityGates: ['typecheck', 'lint', 'test'],
    requiredCriteria: true,
  },
  perf: {
    principles: ['task-management', 'performance', 'code-quality'],
    skills: [],
    qualityGates: ['typecheck', 'lint', 'test'],
    requiredCriteria: false,
  },
  debt: {
    principles: ['task-management', 'code-quality', 'patterns'],
    skills: ['dev/refactoring'],
    qualityGates: ['typecheck', 'lint', 'test'],
    requiredCriteria: false,
  },
  spike: {
    principles: ['task-management'],
    skills: [],
    qualityGates: [],
    requiredCriteria: false,
  },
};

/**
 * Minimum progress updates required by task type
 */
export const MIN_PROGRESS_UPDATES: Record<TaskType, number> = {
  feature: 3,    // Start, middle, complete
  bugfix: 3,     // Reproduce, fix, verify
  refactor: 2,   // Start, complete
  test: 2,       // Write, verify
  docs: 1,       // Complete
  infra: 2,      // Implement, verify
  security: 3,   // Assess, fix, verify
  perf: 3,       // Profile, optimize, verify
  debt: 2,       // Start, complete
  spike: 1,      // Complete with findings
};

// ============================================================================
// Governance Resolution
// ============================================================================

export interface ModuleGovernance {
  principles?: {
    extend?: string[];
  };
  skills?: string[];
  patterns?: string[];
  gates?: QualityGate[];
  rules?: {
    critical?: string[];
  };
}

/**
 * Resolve governance for a task based on task type and optional module
 */
export function resolveGovernance(
  taskType: TaskType,
  moduleGovernance?: ModuleGovernance | null
): TaskGovernance {
  const config = TASK_TYPE_GOVERNANCE[taskType];

  // Build quality gates with commands
  const qualityGates: QualityGate[] = config.qualityGates.map(gateId => ({
    id: gateId,
    command: GATE_COMMANDS[gateId] || gateId,
    required: true,
  }));

  // Base governance from task type
  const baseGovernance: TaskGovernance = {
    principles: [...config.principles],
    skills: [...config.skills],
    patterns: [],
    qualityGates,
    requiredCriteria: config.requiredCriteria,
  };

  // If no module governance, return base
  if (!moduleGovernance) {
    return baseGovernance;
  }

  // Merge with module governance
  return mergeGovernance(baseGovernance, moduleGovernance);
}

/**
 * Merge base governance with module-specific governance
 */
export function mergeGovernance(
  base: TaskGovernance,
  module: ModuleGovernance
): TaskGovernance {
  return {
    // Principles: base + module.extend
    principles: [
      ...base.principles,
      ...(module.principles?.extend || [])
    ],
    // Skills: base + module-specific
    skills: [
      ...base.skills,
      ...(module.skills || [])
    ],
    // Patterns: from module
    patterns: module.patterns || [],
    // Quality gates: base + module-specific
    qualityGates: [
      ...base.qualityGates,
      ...(module.gates || []).map(g => ({ ...g, required: true }))
    ],
    // Module rules
    moduleRules: module.rules?.critical || [],
    // Required criteria from base
    requiredCriteria: base.requiredCriteria,
  };
}

/**
 * Get minimum progress updates for a task type
 */
export function getMinProgressUpdates(taskType: TaskType): number {
  return MIN_PROGRESS_UPDATES[taskType] || 2;
}

// ============================================================================
// Title Validation
// ============================================================================

const TITLE_PATTERN = /^\[(\w+)\]\s+(.{1,100})$/;

/**
 * Parse task title to extract type and description
 */
export function parseTaskTitle(title: string): { type: string; description: string } | null {
  const match = title.match(TITLE_PATTERN);
  if (!match) return null;

  const [, type, description] = match;
  return { type: type.toLowerCase(), description };
}

/**
 * Validate task title format
 */
export function validateTitle(title: string): { valid: boolean; error?: string } {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: 'Title cannot be empty' };
  }

  if (!title.startsWith('[')) {
    return { valid: false, error: 'Title must start with [TYPE]' };
  }

  const parsed = parseTaskTitle(title);
  if (!parsed) {
    return { valid: false, error: 'Invalid format. Use: [TYPE] description (max 100 chars)' };
  }

  if (!isValidTaskType(parsed.type)) {
    return { valid: false, error: `Invalid task type: ${parsed.type}. Valid types: ${TASK_TYPES.join(', ')}` };
  }

  return { valid: true };
}

/**
 * Normalize title to include type prefix if missing
 */
export function normalizeTitle(title: string, taskType: TaskType): string {
  // If already has type prefix, validate it matches
  const parsed = parseTaskTitle(title);
  if (parsed) {
    if (parsed.type !== taskType) {
      // Type mismatch - use provided taskType
      return `[${taskType}] ${parsed.description}`;
    }
    return title;
  }

  // Add type prefix
  const description = title.slice(0, 100);
  return `[${taskType}] ${description}`;
}

/**
 * Infer task type from title and description
 *
 * Priority:
 * 1. Explicit [TYPE] prefix in title
 * 2. Special prefixes (Epic:, Foundation:)
 * 3. Keyword matching
 * 4. Default to 'feature'
 */
export function inferTaskType(title: string, description?: string): TaskType {
  // First check if title has a type prefix like [FEATURE], [BUGFIX]
  const parsed = parseTaskTitle(title);
  if (parsed && isValidTaskType(parsed.type)) {
    return parsed.type;
  }

  const titleLower = title.toLowerCase();
  const text = `${title} ${description || ''}`.toLowerCase();

  // Check special prefixes
  if (titleLower.startsWith('epic:')) return 'feature';
  if (titleLower.startsWith('foundation:')) return 'debt';

  // Keyword categories with priority order
  const keywordRules: Array<{ keywords: string[]; type: TaskType }> = [
    // Security (high priority - check first)
    { keywords: ['security', 'vulnerability', 'auth', 'permission', 'xss', 'injection', 'csrf'], type: 'security' },
    // Bugfix
    { keywords: ['fix', 'bug', 'error', 'issue', 'broken', 'crash', 'fail'], type: 'bugfix' },
    // Test
    { keywords: ['test', 'spec', 'coverage', 'e2e', 'unit test', 'integration test'], type: 'test' },
    // Docs
    { keywords: ['doc', 'readme', 'guide', 'documentation', 'comment'], type: 'docs' },
    // Performance
    { keywords: ['performance', 'perf', 'optimize', 'speed', 'slow', 'fast', 'memory', 'cache'], type: 'perf' },
    // Refactor
    { keywords: ['refactor', 'cleanup', 'reorganize', 'restructure', 'simplify'], type: 'refactor' },
    // Debt
    { keywords: ['debt', 'deprecated', 'legacy', 'migrate', 'remove', 'clean'], type: 'debt' },
    // Spike
    { keywords: ['spike', 'research', 'explore', 'poc', 'prototype', 'investigate', 'experiment'], type: 'spike' },
    // Infra
    { keywords: ['infra', 'ci', 'cd', 'deploy', 'build', 'pipeline', 'docker', 'devops'], type: 'infra' },
  ];

  for (const rule of keywordRules) {
    for (const keyword of rule.keywords) {
      if (text.includes(keyword)) {
        return rule.type;
      }
    }
  }

  return 'feature';
}
