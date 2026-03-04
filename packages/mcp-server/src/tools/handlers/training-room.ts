/**
 * Training Room MCP Tool Handlers
 *
 * Tools for the lessons-learned system:
 * - training_session_get/list: Manage training sessions
 * - incident_create/update/list: Capture and manage incidents
 * - lesson_create/approve/list: Extract and manage lessons
 * - skill_create/update/list: Generate and manage skills
 * - rule_create/update/list/check: Codify and manage rules
 * - training_context_get: Build session context
 * - training_feedback_submit: Track effectiveness
 */

import { createApiClient, detectWorkspace } from '@sidstack/shared';
import { validateProjectPath } from './validate-path';
import type {
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
  LessonStatus,
  SkillType,
  SkillStatus,
  RuleLevel,
  RuleEnforcement,
  RuleStatus,
  FeedbackOutcome,
  IncidentContext,
  Applicability,
  TriggerConfig,
} from '@sidstack/shared';

const apiClient = createApiClient();

/**
 * Resolve workspace path from projectPath (handles worktrees)
 * Returns the actual workspace root where .sidstack/ lives
 */
function resolveWorkspacePath(projectPath: string): string {
  const workspace = detectWorkspace(projectPath);
  if (workspace) {
    return workspace.workspaceRoot;
  }
  return projectPath; // Fallback to provided path
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Extract keywords from text (stop words removed, lowercase, 3+ chars)
 */
function extractKeywords(text: string): string[] {
  const STOP_WORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'must', 'ought',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
    'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
    'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than',
    'too', 'very', 'just', 'because', 'if', 'when', 'while', 'this',
    'that', 'these', 'those', 'it', 'its', 'we', 'they', 'them',
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Check if two texts share significant keywords (>= 2 overlap)
 */
function hasSimilarKeywords(textA: string, textB: string): boolean {
  const kwA = new Set(extractKeywords(textA));
  const kwB = extractKeywords(textB);
  let overlap = 0;
  for (const kw of kwB) {
    if (kwA.has(kw)) overlap++;
  }
  return overlap >= 2;
}

// =============================================================================
// Tool Definitions
// =============================================================================

export const trainingRoomTools = [
  // --- Training Session Tools ---
  {
    name: 'training_session_get',
    description: 'Get or create a training session for a module. Each module has exactly one session per project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Project path for scoping (REQUIRED)',
        },
        moduleId: {
          type: 'string',
          description: 'Module ID to get/create session for',
        },
      },
      required: ['projectPath', 'moduleId'],
    },
  },
  {
    name: 'training_session_list',
    description: 'List all training sessions for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Project path for scoping',
        },
        status: {
          type: 'string',
          enum: ['active', 'archived'],
          description: 'Filter by status',
        },
      },
    },
  },

  // --- Incident Tools ---
  {
    name: 'incident_create',
    description: 'Report an incident (mistake, failure, confusion). Use this when an agent makes a mistake or encounters an issue.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Project path for scoping (REQUIRED)',
        },
        moduleId: {
          type: 'string',
          description: 'Module ID where incident occurred',
        },
        type: {
          type: 'string',
          enum: ['mistake', 'failure', 'confusion', 'slow', 'other'],
          description: 'Type of incident',
        },
        severity: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Severity level',
        },
        title: {
          type: 'string',
          description: 'Short title describing the incident',
        },
        description: {
          type: 'string',
          description: 'Detailed description of what happened',
        },
        context: {
          type: 'object',
          description: 'Context data (taskId, agentRole, files, commands, errorMessage)',
          properties: {
            taskId: { type: 'string' },
            agentRole: { type: 'string' },
            files: { type: 'array', items: { type: 'string' } },
            commands: { type: 'array', items: { type: 'string' } },
            errorMessage: { type: 'string' },
          },
        },
        checkSimilar: {
          type: 'boolean',
          description: 'If true, check for similar open incidents and suggest lesson creation. Defaults to false.',
        },
      },
      required: ['projectPath', 'moduleId', 'type', 'severity', 'title'],
    },
  },
  {
    name: 'incident_update',
    description: 'Update an incident (status, resolution, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        incidentId: {
          type: 'string',
          description: 'Incident ID to update',
        },
        status: {
          type: 'string',
          enum: ['open', 'analyzed', 'lesson_created', 'closed'],
          description: 'New status',
        },
        resolution: {
          type: 'string',
          description: 'How the incident was resolved',
        },
        severity: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
        },
      },
      required: ['incidentId'],
    },
  },
  {
    name: 'incident_list',
    description: 'List incidents with optional filters.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Project path for scoping',
        },
        moduleId: {
          type: 'string',
          description: 'Filter by module',
        },
        status: {
          type: 'string',
          enum: ['open', 'analyzed', 'lesson_created', 'closed'],
          description: 'Filter by status',
        },
        type: {
          type: 'string',
          enum: ['mistake', 'failure', 'confusion', 'slow', 'other'],
          description: 'Filter by type',
        },
        severity: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Filter by severity',
        },
      },
    },
  },

  // --- Lesson Tools ---
  {
    name: 'lesson_create',
    description: 'Create a lesson from one or more incidents. Lessons capture what went wrong and how to prevent it.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Project path for scoping (REQUIRED)',
        },
        moduleId: {
          type: 'string',
          description: 'Module ID for the lesson',
        },
        incidentIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Incident IDs that led to this lesson',
        },
        title: {
          type: 'string',
          description: 'Lesson title',
        },
        problem: {
          type: 'string',
          description: 'What went wrong',
        },
        rootCause: {
          type: 'string',
          description: 'Why it happened',
        },
        solution: {
          type: 'string',
          description: 'How to prevent it',
        },
        applicability: {
          type: 'object',
          description: 'Where this lesson applies',
          properties: {
            modules: { type: 'array', items: { type: 'string' } },
            roles: { type: 'array', items: { type: 'string' } },
            taskTypes: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      required: ['projectPath', 'moduleId', 'title', 'problem', 'rootCause', 'solution'],
    },
  },
  {
    name: 'lesson_approve',
    description: 'Approve a lesson, making it available for skill generation.',
    inputSchema: {
      type: 'object',
      properties: {
        lessonId: {
          type: 'string',
          description: 'Lesson ID to approve',
        },
        approver: {
          type: 'string',
          description: 'Who approved the lesson',
        },
      },
      required: ['lessonId', 'approver'],
    },
  },
  {
    name: 'lesson_list',
    description: 'List lessons with optional filters.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Project path for scoping',
        },
        moduleId: {
          type: 'string',
          description: 'Filter by module',
        },
        status: {
          type: 'string',
          enum: ['draft', 'reviewed', 'approved', 'archived'],
          description: 'Filter by status',
        },
      },
    },
  },

  // --- Skill Tools ---
  {
    name: 'skill_create',
    description: 'Create a reusable skill from lessons. Skills are procedures, checklists, or templates that help agents avoid mistakes.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Project path for scoping (REQUIRED)',
        },
        name: {
          type: 'string',
          description: 'Unique skill name (kebab-case recommended)',
        },
        description: {
          type: 'string',
          description: 'Brief description of what the skill does',
        },
        lessonIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Lesson IDs this skill is derived from',
        },
        type: {
          type: 'string',
          enum: ['procedure', 'checklist', 'template', 'rule'],
          description: 'Type of skill',
        },
        content: {
          type: 'string',
          description: 'Skill content in markdown format',
        },
        trigger: {
          type: 'object',
          description: 'When to trigger this skill',
          properties: {
            when: {
              type: 'string',
              enum: ['always', 'task_start', 'task_end', 'before_commit', 'on_error'],
            },
            conditions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Conditions like "taskType:refactor"',
            },
          },
        },
        applicability: {
          type: 'object',
          properties: {
            modules: { type: 'array', items: { type: 'string' } },
            roles: { type: 'array', items: { type: 'string' } },
            taskTypes: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      required: ['projectPath', 'name', 'type', 'content'],
    },
  },
  {
    name: 'skill_update',
    description: 'Update a skill (content, status, applicability).',
    inputSchema: {
      type: 'object',
      properties: {
        skillId: {
          type: 'string',
          description: 'Skill ID to update',
        },
        name: { type: 'string' },
        description: { type: 'string' },
        content: { type: 'string' },
        status: {
          type: 'string',
          enum: ['draft', 'active', 'deprecated'],
        },
        trigger: {
          type: 'object',
          properties: {
            when: { type: 'string', enum: ['always', 'task_start', 'task_end', 'before_commit', 'on_error'] },
            conditions: { type: 'array', items: { type: 'string' } },
          },
        },
        applicability: {
          type: 'object',
          properties: {
            modules: { type: 'array', items: { type: 'string' } },
            roles: { type: 'array', items: { type: 'string' } },
            taskTypes: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      required: ['skillId'],
    },
  },
  {
    name: 'skill_list',
    description: 'List skills with optional filters.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Project path for scoping',
        },
        status: {
          type: 'string',
          enum: ['draft', 'active', 'deprecated'],
        },
        type: {
          type: 'string',
          enum: ['procedure', 'checklist', 'template', 'rule'],
        },
      },
    },
  },

  // --- Rule Tools ---
  {
    name: 'rule_create',
    description: 'Create a mandatory rule from skills. Rules are enforced via hooks or gates.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Project path for scoping (REQUIRED)',
        },
        name: {
          type: 'string',
          description: 'Unique rule name (kebab-case recommended)',
        },
        description: {
          type: 'string',
          description: 'Brief description of the rule',
        },
        skillIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Skill IDs this rule is derived from',
        },
        level: {
          type: 'string',
          enum: ['must', 'should', 'may'],
          description: 'Rule level (must = mandatory, should = recommended, may = optional)',
        },
        enforcement: {
          type: 'string',
          enum: ['manual', 'hook', 'gate'],
          description: 'How the rule is enforced',
        },
        content: {
          type: 'string',
          description: 'Rule content/description',
        },
        applicability: {
          type: 'object',
          properties: {
            modules: { type: 'array', items: { type: 'string' } },
            roles: { type: 'array', items: { type: 'string' } },
            taskTypes: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      required: ['projectPath', 'name', 'level', 'enforcement', 'content'],
    },
  },
  {
    name: 'rule_update',
    description: 'Update a rule.',
    inputSchema: {
      type: 'object',
      properties: {
        ruleId: {
          type: 'string',
          description: 'Rule ID to update',
        },
        name: { type: 'string' },
        description: { type: 'string' },
        content: { type: 'string' },
        level: { type: 'string', enum: ['must', 'should', 'may'] },
        enforcement: { type: 'string', enum: ['manual', 'hook', 'gate'] },
        status: { type: 'string', enum: ['active', 'deprecated'] },
        applicability: {
          type: 'object',
          properties: {
            modules: { type: 'array', items: { type: 'string' } },
            roles: { type: 'array', items: { type: 'string' } },
            taskTypes: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      required: ['ruleId'],
    },
  },
  {
    name: 'rule_list',
    description: 'List rules with optional filters.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Project path for scoping',
        },
        status: { type: 'string', enum: ['active', 'deprecated'] },
        level: { type: 'string', enum: ['must', 'should', 'may'] },
        enforcement: { type: 'string', enum: ['manual', 'hook', 'gate'] },
      },
    },
  },
  {
    name: 'rule_check',
    description: 'Get applicable rules for a given context. Use this before performing actions to check what rules apply.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Project path for scoping (REQUIRED)',
        },
        moduleId: {
          type: 'string',
          description: 'Module ID',
        },
        role: {
          type: 'string',
          description: 'Agent role (e.g., dev, qa)',
        },
        taskType: {
          type: 'string',
          description: 'Task type (e.g., feature, bugfix, refactor)',
        },
      },
      required: ['projectPath', 'moduleId', 'role', 'taskType'],
    },
  },

  // --- Context Tools ---
  {
    name: 'training_context_get',
    description: 'Build training context for a session. Returns applicable skills, rules, and recent lessons.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Project path for scoping (REQUIRED)',
        },
        moduleId: {
          type: 'string',
          description: 'Module ID',
        },
        role: {
          type: 'string',
          description: 'Agent role',
        },
        taskType: {
          type: 'string',
          description: 'Task type',
        },
      },
      required: ['projectPath', 'moduleId', 'role', 'taskType'],
    },
  },

  // --- Feedback Tools ---
  {
    name: 'training_feedback_submit',
    description: 'Submit feedback on whether a skill or rule helped. This helps track effectiveness.',
    inputSchema: {
      type: 'object',
      properties: {
        entityType: {
          type: 'string',
          enum: ['skill', 'rule'],
          description: 'Type of entity to provide feedback for',
        },
        entityId: {
          type: 'string',
          description: 'ID of the skill or rule',
        },
        taskId: {
          type: 'string',
          description: 'Task ID where the skill/rule was used',
        },
        outcome: {
          type: 'string',
          enum: ['helped', 'ignored', 'hindered'],
          description: 'Did it help, was it ignored, or did it hinder?',
        },
        notes: {
          type: 'string',
          description: 'Additional notes',
        },
      },
      required: ['entityType', 'entityId', 'outcome'],
    },
  },
];

// =============================================================================
// Tool Handlers
// =============================================================================

// --- Training Session Handlers ---

export async function handleTrainingSessionGet(args: { projectPath: string; moduleId: string }) {
  validateProjectPath(args.projectPath);
  const projectPath = resolveWorkspacePath(args.projectPath);

  // POST creates-or-gets a session for the module
  const result = await apiClient.training.createSession(args.moduleId, { projectPath });

  return {
    success: true,
    session: result.session,
  };
}

export async function handleTrainingSessionList(args: { projectPath?: string; status?: 'active' | 'archived' }) {
  if (args.projectPath) validateProjectPath(args.projectPath);
  const projectPath = args.projectPath ? resolveWorkspacePath(args.projectPath) : undefined;

  const result = await apiClient.training.listSessions({ projectPath, status: args.status });

  return {
    success: true,
    sessions: result.sessions,
    total: result.total,
  };
}

// --- Incident Handlers ---

export async function handleIncidentCreate(args: {
  projectPath: string;
  moduleId: string;
  type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description?: string;
  context?: IncidentContext;
  checkSimilar?: boolean;
}) {
  validateProjectPath(args.projectPath);
  const projectPath = resolveWorkspacePath(args.projectPath);

  // Get or create session for module via API
  const sessionResult = await apiClient.training.createSession(args.moduleId, { projectPath });
  const session = sessionResult.session;

  // Create the incident via API
  const incidentResult = await apiClient.training.createIncident({
    sessionId: session.id,
    type: args.type,
    severity: args.severity,
    title: args.title,
    description: args.description,
    context: args.context,
  });
  const incident = incidentResult.incident;

  // Check for similar incidents to suggest lesson creation (opt-in)
  let suggestion: { action: string; reason: string; similarIncidentIds: string[] } | undefined;
  if (args.checkSimilar) {
    try {
      // Try semantic search via mem0 first, fall back to keyword matching
      let similarIncidentIds: string[] = [];
      let usedSemantic = false;

      try {
        const { getMem0ClientIfAvailable } = await import('./memory.js');
        const mem0 = await getMem0ClientIfAvailable();
        if (mem0) {
          const searchQuery = `${args.type} ${args.severity}: ${args.title} ${args.description || ''}`;
          const projectId = projectPath.split('/').pop() || args.moduleId;
          const results = await mem0.search(searchQuery, projectId, 10);

          // Filter for incident memories with score >= 0.7
          const similarMemories = results.filter(
            m => m.score !== undefined
              && m.score >= 0.7
              && m.metadata_?.sourceType === 'incident'
              && m.metadata_?.incidentId !== incident.id
          );

          if (similarMemories.length > 0) {
            similarIncidentIds = similarMemories
              .map(m => m.metadata_?.incidentId as string)
              .filter(Boolean);
            usedSemantic = true;
          }
        }
      } catch {
        // mem0 unavailable -- fall through to keyword fallback
      }

      // Keyword fallback when mem0 not available or returned no results
      if (!usedSemantic) {
        const listResult = await apiClient.training.listIncidents({
          sessionId: session.id,
          status: 'open',
        });

        const existingIncidents = listResult.incidents || [];
        const incidentText = `${incident.title} ${args.description || ''}`;
        const similarIncidents = existingIncidents.filter((i: any) =>
          i.id !== incident.id && hasSimilarKeywords(`${i.title} ${i.description || ''}`, incidentText)
        );
        similarIncidentIds = similarIncidents.map((i: any) => i.id);
      }

      if (similarIncidentIds.length >= 2) {
        suggestion = {
          action: 'create_lesson',
          reason: `Found ${similarIncidentIds.length} similar incidents for module "${args.moduleId}". Consider creating a lesson to capture the pattern.`,
          similarIncidentIds,
        };
      }
    } catch {
      // Non-critical - skip suggestion on error
    }
  }

  // Auto-extract memory to mem0 (fire-and-forget)
  try {
    const { getMem0ClientIfAvailable } = await import('./memory.js');
    const mem0 = await getMem0ClientIfAvailable();
    if (mem0) {
      const memContent = [
        `Incident [${args.severity}/${args.type}]: ${args.title}`,
        args.description || '',
        args.context?.errorMessage ? `Error: ${args.context.errorMessage}` : '',
      ].filter(Boolean).join('\n');

      // Derive projectId from workspace path
      const projectId = projectPath.split('/').pop() || args.moduleId;
      mem0.addSmart(memContent, projectId, {
        sourceType: 'incident',
        incidentId: incident.id,
        moduleId: args.moduleId,
        severity: args.severity,
      }).catch(() => {});
    }
  } catch {
    // Non-blocking
  }

  return {
    success: true,
    incident,
    message: `Incident created: ${incident.id}`,
    ...(suggestion ? { suggestion } : {}),
  };
}

export async function handleIncidentUpdate(args: {
  incidentId: string;
  status?: IncidentStatus;
  resolution?: string;
  severity?: IncidentSeverity;
}) {
  const result = await apiClient.training.updateIncident(args.incidentId, {
    status: args.status,
    resolution: args.resolution,
    severity: args.severity,
  });

  return {
    success: true,
    incident: result.incident,
  };
}

export async function handleIncidentList(args: {
  projectPath?: string;
  moduleId?: string;
  status?: IncidentStatus;
  type?: IncidentType;
  severity?: IncidentSeverity;
}) {
  if (args.projectPath) validateProjectPath(args.projectPath);
  const projectPath = args.projectPath ? resolveWorkspacePath(args.projectPath) : undefined;

  // The API server handles sessionId lookup and projectPath scoping
  const result = await apiClient.training.listIncidents({
    projectPath,
    type: args.type,
    severity: args.severity,
    status: args.status,
  });

  return {
    success: true,
    incidents: result.incidents,
    total: result.total,
  };
}

// --- Lesson Handlers ---

export async function handleLessonCreate(args: {
  projectPath: string;
  moduleId: string;
  incidentIds?: string[];
  title: string;
  problem: string;
  rootCause: string;
  solution: string;
  applicability?: Applicability;
}) {
  validateProjectPath(args.projectPath);
  const projectPath = resolveWorkspacePath(args.projectPath);

  // Get or create session for module via API
  const sessionResult = await apiClient.training.createSession(args.moduleId, { projectPath });
  const session = sessionResult.session;

  const result = await apiClient.training.createLesson({
    sessionId: session.id,
    incidentIds: args.incidentIds,
    title: args.title,
    problem: args.problem,
    rootCause: args.rootCause,
    solution: args.solution,
    applicability: args.applicability,
  });
  const lesson = result.lesson;

  // Auto-capture lesson to mem0 (fire-and-forget)
  try {
    const { getMem0ClientIfAvailable } = await import('./memory.js');
    const mem0 = await getMem0ClientIfAvailable();
    if (mem0) {
      const memContent = [
        `Lesson: ${args.title}`,
        `Problem: ${args.problem}`,
        `Root Cause: ${args.rootCause}`,
        `Solution: ${args.solution}`,
      ].join('\n');

      const projectId = projectPath.split('/').pop() || args.moduleId;
      mem0.addSmart(memContent, projectId, {
        sourceType: 'lesson',
        lessonId: lesson.id,
        moduleId: args.moduleId,
      }).catch(() => {});
    }
  } catch {
    // Non-blocking
  }

  return {
    success: true,
    lesson,
    message: `Lesson created: ${lesson.id}`,
  };
}

export async function handleLessonApprove(args: { lessonId: string; approver: string }) {
  const result = await apiClient.training.approveLesson(args.lessonId, { approver: args.approver });
  const lesson = result.lesson;

  if (!lesson) {
    return { success: false, error: 'Lesson not found' };
  }

  return {
    success: true,
    lesson,
    message: `Lesson approved by ${args.approver}`,
    suggestion: {
      action: 'create_skill',
      reason: 'Lesson approved. Consider creating a reusable skill from the solution.',
      skillTemplate: {
        name: `Skill: ${lesson.title}`,
        type: 'procedure',
        content: `## Problem\n${lesson.problem}\n\n## Solution\n${lesson.solution}`,
      },
    },
  };
}

export async function handleLessonList(args: { projectPath?: string; moduleId?: string; status?: LessonStatus }) {
  if (args.projectPath) validateProjectPath(args.projectPath);
  const projectPath = args.projectPath ? resolveWorkspacePath(args.projectPath) : undefined;

  // The API server handles sessionId lookup and projectPath scoping
  const result = await apiClient.training.listLessons({
    projectPath,
    status: args.status,
  });

  return {
    success: true,
    lessons: result.lessons,
    total: result.total,
  };
}

// --- Skill Handlers ---

export async function handleSkillCreate(args: {
  projectPath: string;
  name: string;
  description?: string;
  lessonIds?: string[];
  type: SkillType;
  content: string;
  trigger?: TriggerConfig;
  applicability?: Applicability;
}) {
  validateProjectPath(args.projectPath);
  const projectPath = resolveWorkspacePath(args.projectPath);

  // The API server handles duplicate checking
  const result = await apiClient.training.createSkill({
    projectPath,
    name: args.name,
    description: args.description,
    lessonIds: args.lessonIds,
    type: args.type,
    content: args.content,
    trigger: args.trigger,
    applicability: args.applicability,
  });

  return {
    success: true,
    skill: result.skill,
    message: `Skill created: ${result.skill.name}`,
  };
}

export async function handleSkillUpdate(args: {
  skillId: string;
  name?: string;
  description?: string;
  content?: string;
  status?: SkillStatus;
  trigger?: TriggerConfig;
  applicability?: Applicability;
}) {
  const result = await apiClient.training.updateSkill(args.skillId, {
    name: args.name,
    description: args.description,
    content: args.content,
    status: args.status,
    trigger: args.trigger,
    applicability: args.applicability,
  });

  return {
    success: true,
    skill: result.skill,
  };
}

export async function handleSkillList(args: { projectPath?: string; status?: SkillStatus; type?: SkillType }) {
  if (args.projectPath) validateProjectPath(args.projectPath);
  const projectPath = args.projectPath ? resolveWorkspacePath(args.projectPath) : undefined;

  const result = await apiClient.training.listSkills({
    projectPath,
    status: args.status,
    type: args.type,
  });

  return {
    success: true,
    skills: result.skills,
    total: result.total,
  };
}

// --- Rule Handlers ---

export async function handleRuleCreate(args: {
  projectPath: string;
  name: string;
  description?: string;
  skillIds?: string[];
  level: RuleLevel;
  enforcement: RuleEnforcement;
  content: string;
  applicability?: Applicability;
}) {
  validateProjectPath(args.projectPath);
  const projectPath = resolveWorkspacePath(args.projectPath);

  // The API server handles duplicate checking
  const result = await apiClient.training.createRule({
    projectPath,
    name: args.name,
    description: args.description,
    skillIds: args.skillIds,
    level: args.level,
    enforcement: args.enforcement,
    content: args.content,
    applicability: args.applicability,
  });

  return {
    success: true,
    rule: result.rule,
    message: `Rule created: ${result.rule.name}`,
  };
}

export async function handleRuleUpdate(args: {
  ruleId: string;
  name?: string;
  description?: string;
  content?: string;
  level?: RuleLevel;
  enforcement?: RuleEnforcement;
  status?: RuleStatus;
  applicability?: Applicability;
}) {
  const result = await apiClient.training.updateRule(args.ruleId, {
    name: args.name,
    description: args.description,
    content: args.content,
    level: args.level,
    enforcement: args.enforcement,
    status: args.status,
    applicability: args.applicability,
  });

  return {
    success: true,
    rule: result.rule,
  };
}

export async function handleRuleList(args: {
  projectPath?: string;
  status?: RuleStatus;
  level?: RuleLevel;
  enforcement?: RuleEnforcement;
}) {
  if (args.projectPath) validateProjectPath(args.projectPath);
  const projectPath = args.projectPath ? resolveWorkspacePath(args.projectPath) : undefined;

  const result = await apiClient.training.listRules({
    projectPath,
    status: args.status,
    level: args.level,
    enforcement: args.enforcement,
  });

  return {
    success: true,
    rules: result.rules,
    total: result.total,
  };
}

export async function handleRuleCheck(args: {
  projectPath: string;
  moduleId: string;
  role: string;
  taskType: string;
}) {
  validateProjectPath(args.projectPath);

  const result = await apiClient.training.checkRules({
    module: args.moduleId,
    role: args.role,
    taskType: args.taskType,
  });

  return {
    success: true,
    rules: result.rules,
    total: result.total,
    message: result.total > 0
      ? `Found ${result.total} applicable rules`
      : 'No applicable rules found',
  };
}

// --- Context Handlers ---

export async function handleTrainingContextGet(args: {
  projectPath: string;
  moduleId: string;
  role: string;
  taskType: string;
}) {
  validateProjectPath(args.projectPath);
  const projectPath = resolveWorkspacePath(args.projectPath);

  const result = await apiClient.training.getContext(args.moduleId, {
    projectPath,
    role: args.role,
    taskType: args.taskType,
  });

  const context = result.context;

  // Build context prompt for injection
  const contextPrompt = buildTrainingContextPrompt(context);

  return {
    success: true,
    context,
    contextPrompt,
    summary: {
      skills: context.skills?.length ?? 0,
      rules: context.rules?.length ?? 0,
      lessons: context.recentLessons?.length ?? 0,
    },
  };
}

// --- Feedback Handlers ---

export async function handleTrainingFeedbackSubmit(args: {
  entityType: 'skill' | 'rule';
  entityId: string;
  taskId?: string;
  outcome: FeedbackOutcome;
  notes?: string;
}) {
  // Record skill usage if applicable
  if (args.entityType === 'skill') {
    try {
      await apiClient.training.recordSkillUsage(args.entityId, {});
    } catch {
      // Non-critical - skill usage tracking failure shouldn't block feedback
    }
  }

  const result = await apiClient.training.createFeedback({
    entityType: args.entityType,
    entityId: args.entityId,
    taskId: args.taskId,
    outcome: args.outcome,
    comment: args.notes,
  });

  return {
    success: true,
    feedback: result.feedback,
    message: `Feedback recorded: ${args.outcome} for ${args.entityType} ${args.entityId}`,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

function buildTrainingContextPrompt(context: {
  skills: any[];
  rules: any[];
  recentLessons: any[];
}): string {
  const lines: string[] = [];

  if (context.skills.length > 0 || context.rules.length > 0 || context.recentLessons.length > 0) {
    lines.push('## Project-Specific Training');
    lines.push('');
  }

  if (context.skills.length > 0) {
    lines.push('### Active Skills');
    for (const skill of context.skills) {
      lines.push(`- **${skill.name}** (${skill.type}): ${skill.description || skill.content.substring(0, 100)}...`);
    }
    lines.push('');
  }

  if (context.rules.length > 0) {
    lines.push('### Mandatory Rules');
    for (const rule of context.rules) {
      const prefix = rule.level.toUpperCase();
      lines.push(`- **${prefix}**: ${rule.name} - ${rule.content}`);
    }
    lines.push('');
  }

  if (context.recentLessons.length > 0) {
    lines.push('### Recent Lessons Learned');
    for (const lesson of context.recentLessons) {
      lines.push(`- **${lesson.title}**: ${lesson.solution}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// =============================================================================
// Unified Handler for Switch Statement
// =============================================================================

export async function handleTrainingRoomTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; [key: string]: unknown }> {
  switch (name) {
    case 'training_session_get':
      return handleTrainingSessionGet(args as any);
    case 'training_session_list':
      return handleTrainingSessionList(args as any);
    case 'incident_create':
      return handleIncidentCreate(args as any);
    case 'incident_update':
      return handleIncidentUpdate(args as any);
    case 'incident_list':
      return handleIncidentList(args as any);
    case 'lesson_create':
      return handleLessonCreate(args as any);
    case 'lesson_approve':
      return handleLessonApprove(args as any);
    case 'lesson_list':
      return handleLessonList(args as any);
    case 'skill_create':
      return handleSkillCreate(args as any);
    case 'skill_update':
      return handleSkillUpdate(args as any);
    case 'skill_list':
      return handleSkillList(args as any);
    case 'rule_create':
      return handleRuleCreate(args as any);
    case 'rule_update':
      return handleRuleUpdate(args as any);
    case 'rule_list':
      return handleRuleList(args as any);
    case 'rule_check':
      return handleRuleCheck(args as any);
    case 'training_context_get':
      return handleTrainingContextGet(args as any);
    case 'training_feedback_submit':
      return handleTrainingFeedbackSubmit(args as any);
    default:
      return { success: false, error: `Unknown training room tool: ${name}` };
  }
}
