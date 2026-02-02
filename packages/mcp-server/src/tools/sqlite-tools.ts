/**
 * SQLite-based MCP Tools for SidStack
 *
 * Core tools for:
 * - Task management (create, update, list)
 * - Work history (sessions, entries, progress)
 * - Task governance and validation
 */

import {
  SidStackDB,
  getDB,
  type TaskType,
  TASK_TYPES,
  resolveGovernance,
  inferTaskType,
  normalizeTitle,
  validateTaskCompletion,
  validateTaskGovernance,
  validateSubtasksForCompletion,
  createViolation,
  type AcceptanceCriterion,
  type TaskForValidation,
  type ProgressLogEntry,
  type SubtaskForValidation,
} from '@sidstack/shared';
import * as path from 'path';

// Get database - always goes through getDB() which handles singleton + auto-reload
async function getDatabase(): Promise<SidStackDB> {
  // getDB() manages singleton instance and auto-reloads if file changed externally
  // No local caching here - let getDB() handle it centrally
  return await getDB();
}

/**
 * Resolve projectId: projectId is now REQUIRED in schema
 * Throws error if not provided to prevent accidental 'default' usage
 */
function resolveProjectId(providedProjectId?: string): string {
  if (!providedProjectId) {
    throw new Error('projectId is required');
  }
  return providedProjectId;
}

// =============================================================================
// Tool Definitions
// =============================================================================

export const sqliteTools = [
  // =========================================================================
  // Task Tools
  // =========================================================================
  {
    name: 'task_create',
    description: 'Create a new task with governance auto-linked based on task type. IMPORTANT: Analyze the problem first and provide a detailed description with problem statement, root cause (if known), and solution approach. Do NOT create tasks with vague or empty descriptions.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title. Format: [TYPE] clear imperative description (min 5 chars after prefix, max 100 chars). Example: [bugfix] Fix login timeout on slow connections' },
        description: { type: 'string', description: 'Detailed task description (min 20 chars). Must include: problem statement, root cause (if known), and solution approach.' },
        taskType: {
          type: 'string',
          enum: ['feature', 'bugfix', 'refactor', 'test', 'docs', 'infra', 'security', 'perf', 'debt', 'spike'],
          description: 'Task type (auto-inferred from title if not provided)',
        },
        moduleId: { type: 'string', description: 'Module ID for module-specific governance (optional)' },
        acceptanceCriteria: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string', description: 'Criterion description' },
            },
            required: ['description'],
          },
          description: 'Acceptance criteria (required for feature/bugfix/security tasks)',
        },
        projectId: { type: 'string', description: 'Project ID (REQUIRED)' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium' },
        assignedAgent: { type: 'string', description: 'Agent role to assign' },
        createdBy: { type: 'string', default: 'user', description: 'Who created this task' },
        branch: { type: 'string', description: 'Git branch name to link this task to' },
      },
      required: ['title', 'description', 'projectId'],
    },
  },
  {
    name: 'task_breakdown',
    description: 'Break down a parent task into sub-tasks with relationships',
    inputSchema: {
      type: 'object',
      properties: {
        parentTaskId: { type: 'string', description: 'ID of the parent task to break down' },
        projectId: { type: 'string', description: 'Project ID (REQUIRED)' },
        subtasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            },
            required: ['title'],
          },
        },
      },
      required: ['parentTaskId', 'subtasks', 'projectId'],
    },
  },
  {
    name: 'task_update',
    description: 'Update a task status, progress, or notes',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'ID of the task to update' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'blocked', 'failed', 'cancelled'] },
        progress: { type: 'number', minimum: 0, maximum: 100, description: 'Progress percentage' },
        notes: { type: 'string', description: 'Status update notes' },
        branch: { type: 'string', description: 'Git branch name to link this task to' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'task_list',
    description: `List tasks with smart filtering. Default returns actionable tasks (pending/in_progress) in compact mode.

Presets:
- "actionable" (default): pending + in_progress tasks
- "blocked": only blocked tasks
- "recent": updated in last 24h
- "epics": top-level tasks only (no parent)
- "all": everything with pagination

Examples:
- task_list({ projectId: "x" }) → actionable tasks, compact
- task_list({ projectId: "x", search: "auth" }) → search in title/description
- task_list({ projectId: "x", preset: "epics" }) → top-level tasks only
- task_list({ projectId: "x", preset: "all", limit: 10 }) → paginated`,
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Project ID (REQUIRED)' },
        preset: {
          type: 'string',
          enum: ['actionable', 'blocked', 'recent', 'epics', 'all'],
          description: 'Smart filter preset. Default: "actionable"'
        },
        status: {
          type: 'array',
          items: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'blocked', 'failed', 'cancelled'] },
          description: 'Filter by status(es). Overrides preset.'
        },
        taskType: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by task type(s): feature, bugfix, refactor, etc.'
        },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Filter by priority' },
        parentOnly: { type: 'boolean', description: 'Only top-level tasks (no parentTaskId)' },
        search: { type: 'string', description: 'Search in title and description' },
        assignedAgent: { type: 'string', description: 'Filter by assigned agent' },
        limit: { type: 'number', description: 'Max results (default: 30, max: 100)' },
        offset: { type: 'number', description: 'Skip first N results' },
        compact: { type: 'boolean', description: 'Exclude large JSON fields (default: true)' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'task_get',
    description: 'Get a task by ID',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'task_governance_check',
    description: 'Check if a task can be completed based on governance rules. Returns blockers, warnings, and hints.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID to check' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'task_complete',
    description: 'Complete a task with validation. Validates governance rules and blocks if requirements not met. Use force=true to bypass (logs violation).',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID to complete' },
        force: { type: 'boolean', default: false, description: 'Force completion even if validation fails (logs governance violation)' },
        reason: { type: 'string', description: 'Reason for force completion (required if force=true)' },
        agentId: { type: 'string', description: 'Agent ID completing the task' },
      },
      required: ['taskId'],
    },
  },

  // =========================================================================
  // Work History Tools
  // =========================================================================
  {
    name: 'work_session_start',
    description: 'Start a new work session for a workspace',
    inputSchema: {
      type: 'object',
      properties: {
        workspacePath: { type: 'string', description: 'Workspace path' },
        claudeSessionId: { type: 'string', description: 'Claude session ID (optional)' },
      },
      required: ['workspacePath'],
    },
  },
  {
    name: 'work_session_end',
    description: 'End a work session with optional summary',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID to end' },
        summary: { type: 'string', description: 'Session summary' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'work_entry_log',
    description: 'Log a work entry (tool call, file change, decision)',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        workspacePath: { type: 'string', description: 'Workspace path' },
        actionType: {
          type: 'string',
          enum: ['tool_call', 'file_change', 'decision', 'status_update', 'error'],
          description: 'Type of action'
        },
        actionName: { type: 'string', description: 'Action name (e.g., Read, Edit, Bash)' },
        taskId: { type: 'string', description: 'Related task ID (optional)' },
        details: { type: 'string', description: 'JSON details' },
        resultSummary: { type: 'string', description: 'Brief result summary' },
        durationMs: { type: 'number', description: 'Duration in milliseconds' },
      },
      required: ['sessionId', 'workspacePath', 'actionType', 'actionName'],
    },
  },
  {
    name: 'work_history_get',
    description: 'Get work history for a workspace within a timeframe',
    inputSchema: {
      type: 'object',
      properties: {
        workspacePath: { type: 'string', description: 'Workspace path' },
        timeframeHours: { type: 'number', default: 24, description: 'Timeframe in hours' },
        sessionId: { type: 'string', description: 'Filter by session ID' },
        taskId: { type: 'string', description: 'Filter by task ID' },
        page: { type: 'number', default: 1, description: 'Page number' },
        pageSize: { type: 'number', default: 50, description: 'Page size' },
      },
      required: ['workspacePath'],
    },
  },
  {
    name: 'task_progress_log',
    description: 'Log progress for a task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID' },
        sessionId: { type: 'string', description: 'Session ID' },
        progress: { type: 'number', minimum: 0, maximum: 100, description: 'Progress percentage' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'blocked', 'completed', 'failed'] },
        currentStep: { type: 'string', description: 'Current step description' },
        notes: { type: 'string', description: 'Notes' },
        artifacts: { type: 'array', items: { type: 'string' }, description: 'List of artifact paths' },
      },
      required: ['taskId', 'sessionId', 'progress', 'status'],
    },
  },
  {
    name: 'task_progress_history',
    description: 'Get progress history for a task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID' },
      },
      required: ['taskId'],
    },
  },

  // =========================================================================
  // Project Tools
  // =========================================================================
  {
    name: 'project_list',
    description: 'List all projects',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'project_get',
    description: 'Get a project by path',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Project path' },
      },
      required: ['path'],
    },
  },
  {
    name: 'project_current',
    description: 'Get the current project context. Returns projectId (derived from cwd), project path, and project info if it exists in the database.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // =========================================================================
  // Migration Tools
  // =========================================================================
  {
    name: 'task_migrate_governance',
    description: 'Migrate existing tasks to include governance fields. Legacy tasks are marked to skip validation.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // =========================================================================
  // Claude Session Tools
  // =========================================================================
  {
    name: 'session_launch',
    description: 'Launch Claude Code session in external terminal and track it. Returns session ID for tracking.',
    inputSchema: {
      type: 'object',
      properties: {
        projectDir: { type: 'string', description: 'Project directory (required)' },
        taskId: { type: 'string', description: 'Task ID to link session to' },
        moduleId: { type: 'string', description: 'Module ID to link session to' },
        prompt: { type: 'string', description: 'Initial prompt for Claude (passed as CLI argument)' },
        terminal: {
          type: 'string',
          enum: ['iTerm', 'Terminal', 'Warp', 'Alacritty', 'kitty', 'ghostty'],
          description: 'Override terminal detection'
        },
        mode: {
          type: 'string',
          enum: ['normal', 'skip-permissions', 'continue', 'print', 'verbose'],
          description: 'Launch mode. "skip-permissions" adds --dangerously-skip-permissions flag'
        },
        includeContext: {
          type: 'boolean',
          description: 'Auto-inject knowledge context (task, module docs, training) into the session prompt. Defaults to true when taskId or moduleId is provided.'
        },
        includeTraining: {
          type: 'boolean',
          description: 'Include training context (skills, rules) in the session prompt. Requires moduleId.'
        },
        agentRole: {
          type: 'string',
          description: 'Agent role for filtering applicable training context (e.g., dev, qa, ba)'
        },
        taskType: {
          type: 'string',
          description: 'Task type for filtering applicable training context (e.g., feature, bugfix)'
        },
      },
      required: ['projectDir'],
    },
  },
  {
    name: 'session_list',
    description: 'List Claude sessions with filters',
    inputSchema: {
      type: 'object',
      properties: {
        workspacePath: { type: 'string', description: 'Filter by workspace path' },
        taskId: { type: 'string', description: 'Filter by task ID' },
        moduleId: { type: 'string', description: 'Filter by module ID' },
        status: {
          type: 'array',
          items: { type: 'string', enum: ['launching', 'active', 'completed', 'error', 'terminated'] },
          description: 'Filter by status(es)'
        },
        limit: { type: 'number', default: 20, description: 'Max results (default: 20)' },
        offset: { type: 'number', default: 0, description: 'Offset for pagination' },
      },
    },
  },
  {
    name: 'session_get',
    description: 'Get Claude session details by ID',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'session_update_status',
    description: 'Update session status',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        status: {
          type: 'string',
          enum: ['active', 'completed', 'error', 'terminated'],
          description: 'New status'
        },
        exitCode: { type: 'number', description: 'Exit code (for completed status)' },
        errorMessage: { type: 'string', description: 'Error message (for error status)' },
      },
      required: ['sessionId', 'status'],
    },
  },
  {
    name: 'session_resume',
    description: 'Resume a previous Claude session with context. Launches new session with --continue flag.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID to resume' },
        additionalPrompt: { type: 'string', description: 'Additional context for resume' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'session_stats',
    description: 'Get session statistics',
    inputSchema: {
      type: 'object',
      properties: {
        workspacePath: { type: 'string', description: 'Filter by workspace' },
        taskId: { type: 'string', description: 'Filter by task ID' },
        moduleId: { type: 'string', description: 'Filter by module ID' },
      },
    },
  },
  {
    name: 'session_log_event',
    description: 'Log an event for a session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        eventType: {
          type: 'string',
          enum: ['launched', 'prompt_sent', 'active', 'error', 'resumed', 'completed', 'terminated'],
          description: 'Event type'
        },
        details: { type: 'object', description: 'Event details (optional)' },
      },
      required: ['sessionId', 'eventType'],
    },
  },
] satisfies Array<{
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}>;

// =============================================================================
// Tool Handlers
// =============================================================================

export async function handleSqliteTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const database = await getDatabase();

  switch (toolName) {
    // =========================================================================
    // Task Handlers
    // =========================================================================
    case 'task_create': {
      const title = (args.title as string || '').trim();
      const description = (args.description as string || '').trim();

      // Validate: title must have meaningful content (not just prefix)
      const titleContent = title.replace(/^\[[\w-]+\]\s*/, '').trim();
      if (!titleContent || titleContent.length < 5) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Title must contain a meaningful description (at least 5 characters after [TYPE] prefix)',
              hint: 'Example: [feature] Add user authentication to login page',
            }, null, 2),
          }],
        };
      }

      // Validate: description must be substantive
      if (!description || description.length < 20) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Description is too short. Provide a detailed description (at least 20 characters)',
              hint: 'Include: what needs to be done, why, and the expected outcome. Analyze the problem before creating a task.',
            }, null, 2),
          }],
        };
      }

      // Infer or use provided task type
      let taskType = args.taskType as TaskType | undefined;
      if (!taskType) {
        taskType = inferTaskType(title, description);
      }

      // Normalize title to include [TYPE] prefix
      const normalizedTitle = normalizeTitle(title, taskType);

      // Resolve governance based on task type
      const governance = resolveGovernance(taskType);

      // Build acceptance criteria if provided
      const rawCriteria = args.acceptanceCriteria as Array<{ description: string }> | undefined;
      const acceptanceCriteria: AcceptanceCriterion[] = (rawCriteria || []).map((c, i) => ({
        id: `ac-${Date.now()}-${i}`,
        description: c.description,
        completed: false,
      }));

      // Validate: feature/bugfix/security require acceptance criteria
      if (governance.requiredCriteria && acceptanceCriteria.length === 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `${taskType} tasks require acceptance criteria`,
              hint: 'Add acceptanceCriteria array with at least one criterion. Analyze the task requirements first.',
            }, null, 2),
          }],
        };
      }

      // Validate: project must exist (prevent orphaned tasks)
      let projectId = resolveProjectId(args.projectId as string);
      let project = database.getProject(projectId);

      // If project not found by ID, try to find by current working directory path
      if (!project) {
        const cwd = process.cwd();
        const projectByPath = database.getProjectByPath(cwd);
        if (projectByPath) {
          // Found project by path - use its ID
          projectId = projectByPath.id;
          project = projectByPath;
        }
      }

      if (!project) {
        // Get available projects for helpful error message
        const availableProjects = database.listProjects();
        const projectIds = availableProjects.map(p => p.id);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Project not found: ${projectId}`,
              hint: 'Open the project in SidStack first to auto-register it, or use an existing projectId',
              availableProjects: projectIds.length > 0 ? projectIds : [],
              nextAction: projectIds.length > 0
                ? `Use one of: ${projectIds.join(', ')}`
                : 'Open this project in SidStack app first to register it',
            }, null, 2),
          }],
        };
      }

      const task = database.createTask({
        projectId,
        title: normalizedTitle,
        description,
        priority: (args.priority as 'low' | 'medium' | 'high') || 'medium',
        assignedAgent: args.assignedAgent as string | undefined,
        createdBy: (args.createdBy as string) || 'user',
        status: 'pending',
        taskType,
        moduleId: args.moduleId as string | undefined,
        branch: args.branch as string | undefined,
        governance: JSON.stringify(governance),
        acceptanceCriteria: JSON.stringify(acceptanceCriteria),
        validation: JSON.stringify({
          progressHistoryCount: 0,
          titleFormatValid: true,
          qualityGatesPassed: false,
          acceptanceCriteriaValid: acceptanceCriteria.length === 0 || !governance.requiredCriteria,
        }),
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            task,
            governance: {
              taskType,
              principles: governance.principles,
              skills: governance.skills,
              qualityGates: governance.qualityGates.map(g => g.id),
              requiredCriteria: governance.requiredCriteria,
            },
          }, null, 2),
        }],
      };
    }

    case 'task_breakdown': {
      const parentTaskId = args.parentTaskId as string;
      let projectId = resolveProjectId(args.projectId as string);
      const subtasks = args.subtasks as Array<{ title: string; description?: string; priority?: string }>;

      // Validate: project must exist
      let project = database.getProject(projectId);

      // If project not found by ID, try to find by current working directory path
      if (!project) {
        const cwd = process.cwd();
        const projectByPath = database.getProjectByPath(cwd);
        if (projectByPath) {
          projectId = projectByPath.id;
          project = projectByPath;
        }
      }

      if (!project) {
        const availableProjects = database.listProjects();
        const projectIds = availableProjects.map(p => p.id);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Project not found: ${projectId}`,
              hint: 'Open the project in SidStack first to auto-register it, or use an existing projectId',
              availableProjects: projectIds.length > 0 ? projectIds : [],
              nextAction: projectIds.length > 0
                ? `Use one of: ${projectIds.join(', ')}`
                : 'Open this project in SidStack app first to register it',
            }, null, 2),
          }],
        };
      }

      const parentTask = database.getTask(parentTaskId);
      if (!parentTask) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Parent task not found' }) }],
        };
      }

      const createdSubtasks = subtasks.map((st) =>
        database.createTask({
          projectId,
          parentTaskId,
          title: st.title,
          description: st.description || '',
          priority: (st.priority as 'low' | 'medium' | 'high') || 'medium',
          status: 'pending',
          createdBy: 'orchestrator',
        })
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ success: true, parentTaskId, subtasks: createdSubtasks }, null, 2),
        }],
      };
    }

    case 'task_update': {
      const taskId = args.taskId as string;
      const newStatus = args.status as string | undefined;
      const updates: Record<string, unknown> = {};
      if (newStatus) updates.status = newStatus;
      if (args.progress !== undefined) updates.progress = args.progress;
      if (args.notes) updates.notes = args.notes;
      if (args.branch !== undefined) updates.branch = args.branch;

      // Validate subtasks when completing a task
      if (newStatus === 'completed') {
        const subtasks = database.getSubtasks(taskId);
        if (subtasks.length > 0) {
          const subtaskValidation = validateSubtasksForCompletion(
            subtasks.map(s => ({
              id: s.id,
              title: s.title,
              status: s.status,
              notes: s.notes,
            } as SubtaskForValidation))
          );

          if (!subtaskValidation.canComplete) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'Cannot complete task with incomplete subtasks',
                  blockers: subtaskValidation.blockers,
                  incompleteSubtasks: subtaskValidation.incompleteSubtasks.map(s => ({
                    id: s.id,
                    title: s.title,
                    status: s.status,
                  })),
                  cancelledWithoutReason: subtaskValidation.cancelledWithoutReason.map(s => ({
                    id: s.id,
                    title: s.title,
                  })),
                  hint: 'Complete or cancel all subtasks first. Cancelled subtasks must have notes explaining the reason.',
                }, null, 2),
              }],
            };
          }
        }
      }

      const task = database.updateTask(taskId, updates);
      if (!task) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Task not found' }) }],
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, task }, null, 2) }],
      };
    }

    case 'task_list': {
      const projectId = resolveProjectId(args.projectId as string);

      // Build smart filters
      type PresetType = 'actionable' | 'blocked' | 'recent' | 'epics' | 'all';
      const filters: {
        preset?: PresetType;
        status?: string[];
        taskType?: string[];
        priority?: string;
        parentOnly?: boolean;
        search?: string;
        assignedAgent?: string;
        limit?: number;
        offset?: number;
        compact?: boolean;
      } = {};

      // Apply preset or default to 'actionable'
      const presetValue = args.preset as string | undefined;
      const validPresets: PresetType[] = ['actionable', 'blocked', 'recent', 'epics', 'all'];
      filters.preset = validPresets.includes(presetValue as PresetType)
        ? (presetValue as PresetType)
        : 'actionable';

      // Override with specific filters if provided
      if (args.status) filters.status = args.status as string[];
      if (args.taskType) filters.taskType = args.taskType as string[];
      if (args.priority) filters.priority = args.priority as string;
      if (args.parentOnly !== undefined) filters.parentOnly = args.parentOnly as boolean;
      if (args.search) filters.search = args.search as string;
      if (args.assignedAgent) filters.assignedAgent = args.assignedAgent as string;

      // Pagination
      filters.limit = Math.min((args.limit as number) || 30, 100);
      filters.offset = (args.offset as number) || 0;

      // Compact mode (default true)
      filters.compact = args.compact !== false;

      const result = database.listTasksSmart(projectId, filters);
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: true,
          ...result,
          _query: { projectId, ...filters }
        }, null, 2) }],
      };
    }

    case 'task_get': {
      const task = database.getTask(args.taskId as string);
      if (!task) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Task not found' }) }],
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, task }, null, 2) }],
      };
    }

    case 'task_governance_check': {
      const taskId = args.taskId as string;
      const task = database.getTask(taskId);

      if (!task) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Task not found' }) }],
        };
      }

      // Get progress history for this task
      const progressHistory = database.getTaskProgressHistory(taskId);
      const progressEntries: ProgressLogEntry[] = progressHistory.map(p => ({
        id: p.id,
        taskId: p.taskId,
        progress: p.progress,
        createdAt: p.createdAt,
      }));

      // Parse stored JSON fields
      const taskForValidation: TaskForValidation = {
        id: task.id,
        title: task.title,
        taskType: task.taskType as TaskType | undefined,
        governance: task.governance ? JSON.parse(task.governance) : undefined,
        acceptanceCriteria: task.acceptanceCriteria ? JSON.parse(task.acceptanceCriteria) : undefined,
        validation: task.validation ? JSON.parse(task.validation) : undefined,
      };

      // Run validation
      const result = validateTaskCompletion(taskForValidation, progressEntries);

      // Get applicable training rules if moduleId is set
      let trainingRules: {
        blockers: Array<{ id: string; name: string; content: string; level: string }>;
        warnings: Array<{ id: string; name: string; content: string; level: string }>;
      } = { blockers: [], warnings: [] };

      if (task.moduleId) {
        try {
          const trainingContext = database.getTrainingContext(
            task.moduleId,
            'dev',
            task.taskType || 'general'
          );

          // Separate rules by level
          for (const rule of trainingContext.rules) {
            const ruleInfo = { id: rule.id, name: rule.name, content: rule.content, level: rule.level };
            if (rule.level === 'must' && rule.enforcement === 'gate') {
              trainingRules.blockers.push(ruleInfo);
            } else if (rule.level === 'should') {
              trainingRules.warnings.push(ruleInfo);
            }
          }
        } catch {
          // Ignore training context errors
        }
      }

      // Merge training rule blockers with validation blockers
      const allBlockers = [
        ...result.blockers,
        ...trainingRules.blockers.map(r => `[TRAINING RULE] ${r.name}: ${r.content}`),
      ];
      const allWarnings = [
        ...result.warnings,
        ...trainingRules.warnings.map(r => `[TRAINING RULE] ${r.name}: ${r.content}`),
      ];

      // If training rules have blockers, task cannot complete
      const canComplete = result.canComplete && trainingRules.blockers.length === 0;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            taskId,
            canComplete,
            blockers: allBlockers,
            warnings: allWarnings,
            hints: result.hints,
            validation: result.validation,
            trainingRules: {
              blockingRules: trainingRules.blockers.length,
              warningRules: trainingRules.warnings.length,
              rules: trainingRules,
            },
          }, null, 2),
        }],
      };
    }

    case 'task_complete': {
      const taskId = args.taskId as string;
      const force = (args.force as boolean) || false;
      const reason = args.reason as string | undefined;
      const agentId = args.agentId as string | undefined;

      const task = database.getTask(taskId);
      if (!task) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Task not found' }) }],
        };
      }

      // Get progress history
      const progressHistory = database.getTaskProgressHistory(taskId);
      const progressEntries: ProgressLogEntry[] = progressHistory.map(p => ({
        id: p.id,
        taskId: p.taskId,
        progress: p.progress,
        createdAt: p.createdAt,
      }));

      // Parse stored JSON fields
      const taskForValidation: TaskForValidation = {
        id: task.id,
        title: task.title,
        taskType: task.taskType as TaskType | undefined,
        governance: task.governance ? JSON.parse(task.governance) : undefined,
        acceptanceCriteria: task.acceptanceCriteria ? JSON.parse(task.acceptanceCriteria) : undefined,
        validation: task.validation ? JSON.parse(task.validation) : undefined,
      };

      // Run validation
      const validationResult = validateTaskCompletion(taskForValidation, progressEntries);

      // If validation fails and not forcing
      if (!validationResult.canComplete && !force) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Task cannot be completed due to governance blockers',
              blockers: validationResult.blockers,
              hints: validationResult.hints,
              validation: validationResult.validation,
              hint: 'Use force=true with reason to bypass (logs governance violation)',
            }, null, 2),
          }],
        };
      }

      // If forcing without reason
      if (force && !validationResult.canComplete && !reason) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Force completion requires a reason',
              hint: 'Provide reason parameter explaining why bypass is needed',
            }, null, 2),
          }],
        };
      }

      // Log governance violation if forcing past blockers
      let violationId: string | undefined;
      if (force && !validationResult.canComplete) {
        const violation = createViolation(
          taskId,
          'forced_completion',
          validationResult.blockers,
          reason,
          agentId
        );
        // Serialize blockers for database storage
        const dbViolation = database.logGovernanceViolation({
          taskId: violation.taskId,
          violationType: violation.violationType,
          blockers: JSON.stringify(violation.blockers),
          reason: violation.reason,
          agentId: violation.agentId,
          timestamp: violation.timestamp,
          resolvedBy: violation.resolvedBy,
          resolvedAt: violation.resolvedAt,
        });
        violationId = dbViolation.id;
      }

      // Update task to completed
      const updatedTask = database.updateTask(taskId, {
        status: 'completed',
        progress: 100,
        validation: JSON.stringify({
          progressHistoryCount: progressEntries.length,
          titleFormatValid: validationResult.validation.titleFormat.passed,
          qualityGatesPassed: validationResult.validation.qualityGates.passed_overall,
          acceptanceCriteriaValid: validationResult.validation.acceptanceCriteria.passed,
          lastValidatedAt: Date.now(),
        }),
      });

      // Auto-complete linked ticket if this task was created from a ticket
      let linkedTicketCompleted: string | undefined;
      try {
        const linkedTicket = database.getTicketByTaskId(taskId);
        if (linkedTicket && linkedTicket.status !== 'completed' && linkedTicket.status !== 'rejected') {
          database.updateTicket(linkedTicket.id, { status: 'completed' });
          linkedTicketCompleted = linkedTicket.id;
        }
      } catch {
        // Non-blocking: ticket completion failure should not affect task completion
      }

      // Get applicable training context for feedback prompt
      let trainingFeedbackPrompt: {
        message: string;
        skills: Array<{ id: string; name: string }>;
        rules: Array<{ id: string; name: string }>;
      } | undefined;

      if (task.moduleId) {
        try {
          const trainingContext = database.getTrainingContext(
            task.moduleId,
            agentId || 'dev',
            task.taskType || 'general'
          );

          if (trainingContext.skills.length > 0 || trainingContext.rules.length > 0) {
            trainingFeedbackPrompt = {
              message: `Task completed! Please provide feedback on the training content that was applicable:`,
              skills: trainingContext.skills.map(s => ({ id: s.id, name: s.name })),
              rules: trainingContext.rules.map(r => ({ id: r.id, name: r.name })),
            };
          }
        } catch {
          // Ignore training context errors
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            task: updatedTask,
            validation: validationResult.validation,
            forcedCompletion: force && !validationResult.canComplete,
            violationId,
            linkedTicketCompleted,
            trainingFeedbackPrompt,
            hint: trainingFeedbackPrompt
              ? 'Use training_feedback_submit to record whether skills/rules helped or hindered this task.'
              : undefined,
          }, null, 2),
        }],
      };
    }

    // =========================================================================
    // Work History Handlers
    // =========================================================================
    case 'work_session_start': {
      const session = database.startWorkSession(
        args.workspacePath as string,
        args.claudeSessionId as string | undefined
      );
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, session }, null, 2) }],
      };
    }

    case 'work_session_end': {
      database.endWorkSession(
        args.sessionId as string,
        args.summary as string | undefined
      );
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, sessionId: args.sessionId }) }],
      };
    }

    case 'work_entry_log': {
      const entry = database.logWorkEntry({
        sessionId: args.sessionId as string,
        workspacePath: args.workspacePath as string,
        actionType: args.actionType as 'tool_call' | 'file_change' | 'decision' | 'status_update' | 'error',
        actionName: args.actionName as string,
        taskId: args.taskId as string | undefined,
        details: args.details as string | undefined,
        resultSummary: args.resultSummary as string | undefined,
        durationMs: args.durationMs as number | undefined,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, entry }, null, 2) }],
      };
    }

    case 'work_history_get': {
      const { entries, total } = database.getWorkHistory(
        args.workspacePath as string,
        (args.timeframeHours as number) || 24,
        {
          sessionId: args.sessionId as string | undefined,
          taskId: args.taskId as string | undefined,
        },
        (args.page as number) || 1,
        (args.pageSize as number) || 50
      );
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, entries, total }, null, 2) }],
      };
    }

    case 'task_progress_log': {
      const progressLog = database.logTaskProgress({
        taskId: args.taskId as string,
        sessionId: args.sessionId as string,
        progress: args.progress as number,
        status: args.status as 'pending' | 'in_progress' | 'blocked' | 'completed' | 'failed',
        currentStep: args.currentStep as string | undefined,
        notes: args.notes as string | undefined,
        artifacts: JSON.stringify(args.artifacts || []),
      });
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, progressLog }, null, 2) }],
      };
    }

    case 'task_progress_history': {
      const history = database.getTaskProgressHistory(args.taskId as string);
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, history }, null, 2) }],
      };
    }

    // =========================================================================
    // Project Handlers
    // =========================================================================
    case 'project_list': {
      const projects = database.listProjects();
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, projects }, null, 2) }],
      };
    }

    case 'project_get': {
      const project = database.getProjectByPath(args.path as string);
      if (!project) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }) }],
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, project }, null, 2) }],
      };
    }

    case 'project_current': {
      const cwd = process.cwd();
      const projectId = path.basename(cwd) || 'unknown';
      const project = database.getProjectByPath(cwd);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            projectId,
            projectPath: cwd,
            project: project || null,
            hint: project
              ? 'Project exists in database'
              : 'Project not in database yet - will be auto-created on first task',
          }, null, 2),
        }],
      };
    }

    // =========================================================================
    // Migration Handlers
    // =========================================================================
    case 'task_migrate_governance': {
      const result = database.migrateTasksToGovernance();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            migrated: result.migrated,
            skipped: result.skipped,
            errors: result.errors,
            message: result.migrated > 0
              ? `Migrated ${result.migrated} tasks with legacy flag (validation skipped)`
              : 'No tasks needed migration',
          }, null, 2),
        }],
      };
    }

    // =========================================================================
    // Claude Session Handlers
    // =========================================================================
    case 'session_launch': {
      const { projectDir, taskId, moduleId, prompt, terminal, mode, includeContext, includeTraining, agentRole, taskType } = args as {
        projectDir: string;
        taskId?: string;
        moduleId?: string;
        prompt?: string;
        terminal?: string;
        mode?: string;
        includeContext?: boolean;
        includeTraining?: boolean;
        agentRole?: string;
        taskType?: string;
      };

      // Import external session launcher and settings dynamically
      const { launchClaudeSession, detectTerminal, getSessionSettings, createKnowledgeService, buildSessionContext, createSessionContextOptions } = await import('@sidstack/shared');

      // Load project settings as defaults
      const projectSessionSettings = getSessionSettings(projectDir);

      // Use explicit params if provided, otherwise fall back to project settings, then system detection
      const resolvedTerminal = terminal || projectSessionSettings.defaultTerminal || detectTerminal();
      const resolvedMode = mode || projectSessionSettings.defaultMode || 'normal';

      // Determine if context should be injected
      // Default: true when taskId or moduleId is provided, false otherwise
      const shouldInjectContext = includeContext !== undefined
        ? includeContext
        : !!(taskId || moduleId);

      // Build knowledge + training context via buildSessionContext
      let contextPrompt: string | undefined;
      let contextEntities: string[] = [];
      if (shouldInjectContext && (taskId || moduleId)) {
        try {
          const knowledgeService = createKnowledgeService(projectDir);
          const contextOptions = createSessionContextOptions({
            db: database,
            knowledgeService,
            workspacePath: projectDir,
            taskId,
            moduleId,
            includeTraining: includeTraining !== undefined ? includeTraining : !!moduleId,
            agentRole: agentRole || 'dev',
            taskType: taskType || 'general',
          });
          const builtContext = await buildSessionContext(contextOptions);
          if (builtContext.prompt && builtContext.metadata.entities.length > 0) {
            contextPrompt = builtContext.prompt;
            contextEntities = builtContext.metadata.entities;
          }
        } catch {
          // Context failure must NOT block launch
        }
      }

      // Combine context with user prompt
      const finalPrompt = contextPrompt && prompt
        ? `${contextPrompt}\n---\n\n${prompt}`
        : contextPrompt || prompt;

      // Create session record
      const session = database.createClaudeSession({
        workspacePath: projectDir,
        taskId,
        moduleId,
        terminal: resolvedTerminal as any,
        launchMode: resolvedMode as any,
        initialPrompt: finalPrompt,
      });

      // Log launched event with settings info
      database.logSessionEvent({
        claudeSessionId: session.id,
        eventType: 'launched',
        details: {
          terminal: resolvedTerminal,
          mode: resolvedMode,
          taskId,
          moduleId,
          usedProjectSettings: !terminal || !mode,
          contextInjected: !!contextPrompt,
          contextEntities,
        },
      });

      // Launch the actual session
      const result = await launchClaudeSession({
        projectDir,
        context: { prompt: finalPrompt },
        terminal: resolvedTerminal as any,
        mode: resolvedMode as any,
      });

      if (result.success) {
        // Update session with process info
        database.updateClaudeSession(session.id, {
          status: 'active',
          pid: result.pid,
          terminalWindowId: result.terminalWindowId,
        });

        // Create linked work session
        const workSession = database.startWorkSession(projectDir, session.id);
        database.linkClaudeSessionToWorkSession(session.id, workSession.id);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              sessionId: session.id,
              workSessionId: workSession.id,
              terminal: result.terminal,
              command: result.command,
              pid: result.pid,
              contextInjected: !!contextPrompt,
              contextEntities,
            }, null, 2),
          }],
        };
      } else {
        database.markClaudeSessionError(session.id, result.error || 'Launch failed');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              sessionId: session.id,
              error: result.error,
            }, null, 2),
          }],
        };
      }
    }

    case 'session_list': {
      const { workspacePath, taskId, moduleId, status, limit, offset } = args as {
        workspacePath?: string;
        taskId?: string;
        moduleId?: string;
        status?: string[];
        limit?: number;
        offset?: number;
      };

      const result = database.listClaudeSessions({
        workspacePath,
        taskId,
        moduleId,
        status: status as any,
        limit: limit || 20,
        offset: offset || 0,
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            sessions: result.sessions,
            total: result.total,
          }, null, 2),
        }],
      };
    }

    case 'session_get': {
      const { sessionId } = args as { sessionId: string };
      const session = database.getClaudeSession(sessionId);

      if (!session) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Session not found' }) }],
        };
      }

      const events = database.getSessionEvents(sessionId);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            session,
            events,
          }, null, 2),
        }],
      };
    }

    case 'session_update_status': {
      const { sessionId, status, exitCode, errorMessage } = args as {
        sessionId: string;
        status: string;
        exitCode?: number;
        errorMessage?: string;
      };

      let session;
      switch (status) {
        case 'active':
          session = database.markClaudeSessionActive(sessionId);
          break;
        case 'completed':
          session = database.markClaudeSessionCompleted(sessionId, exitCode);
          break;
        case 'error':
          session = database.markClaudeSessionError(sessionId, errorMessage || 'Unknown error');
          break;
        case 'terminated':
          session = database.markClaudeSessionTerminated(sessionId);
          break;
        default:
          return {
            content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Invalid status: ${status}` }) }],
          };
      }

      if (!session) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Session not found' }) }],
        };
      }

      database.logSessionEvent({
        claudeSessionId: sessionId,
        eventType: status as any,
        details: { exitCode, errorMessage },
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ success: true, session }, null, 2),
        }],
      };
    }

    case 'session_resume': {
      const { sessionId, additionalPrompt } = args as {
        sessionId: string;
        additionalPrompt?: string;
      };

      const original = database.getClaudeSession(sessionId);
      if (!original) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Session not found' }) }],
        };
      }

      if (!original.canResume) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Session cannot be resumed' }) }],
        };
      }

      // Build resume context
      const context = database.buildResumeContext(sessionId);

      // Build resume prompt
      const parts = [`Continuing work on ${original.taskId || 'this project'}.`];
      if (context.filesTouched.length > 0) {
        parts.push(`Files previously touched: ${context.filesTouched.join(', ')}`);
      }
      if (context.lastActions.length > 0) {
        parts.push(`Last actions: ${context.lastActions.join(', ')}`);
      }
      if (context.taskProgress) {
        parts.push(`Task progress: ${context.taskProgress}%`);
      }
      if (additionalPrompt) {
        parts.push(additionalPrompt);
      }
      const resumePrompt = parts.join('\n\n');

      // Import external session launcher
      const { launchClaudeSession } = await import('@sidstack/shared');

      // Create new session with continue mode
      const newSession = database.createClaudeSession({
        workspacePath: original.workspacePath,
        taskId: original.taskId,
        moduleId: original.moduleId,
        terminal: original.terminal,
        launchMode: 'continue',
        initialPrompt: resumePrompt,
      });

      // Launch the session
      const result = await launchClaudeSession({
        projectDir: original.workspacePath,
        context: { prompt: resumePrompt },
        terminal: original.terminal,
        mode: 'continue',
      });

      if (result.success) {
        database.updateClaudeSession(newSession.id, {
          status: 'active',
          pid: result.pid,
          terminalWindowId: result.terminalWindowId,
        });

        // Record resume on original session
        database.recordClaudeSessionResume(sessionId);
        database.logSessionEvent({
          claudeSessionId: sessionId,
          eventType: 'resumed',
          details: { newSessionId: newSession.id },
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              originalSessionId: sessionId,
              newSessionId: newSession.id,
              terminal: result.terminal,
              resumeContext: context,
            }, null, 2),
          }],
        };
      } else {
        database.markClaudeSessionError(newSession.id, result.error || 'Resume failed');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: false, error: result.error }, null, 2),
          }],
        };
      }
    }

    case 'session_stats': {
      const { workspacePath, taskId, moduleId } = args as {
        workspacePath?: string;
        taskId?: string;
        moduleId?: string;
      };

      const stats = database.getClaudeSessionStats({ workspacePath, taskId, moduleId });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ success: true, stats }, null, 2),
        }],
      };
    }

    case 'session_log_event': {
      const { sessionId, eventType, details } = args as {
        sessionId: string;
        eventType: string;
        details?: Record<string, unknown>;
      };

      const event = database.logSessionEvent({
        claudeSessionId: sessionId,
        eventType: eventType as any,
        details,
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ success: true, event }, null, 2),
        }],
      };
    }

    default:
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` }) }],
      };
  }
}
