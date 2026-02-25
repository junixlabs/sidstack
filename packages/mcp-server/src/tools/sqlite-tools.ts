/**
 * SQLite-based MCP Tools for SidStack
 *
 * Core tools for:
 * - Task management (create, update, list)
 * - Work history (sessions, entries, progress)
 * - Task governance and validation
 *
 * All database operations go through the SidStack API server via HTTP.
 */

import {
  type TaskType,
  resolveGovernance,
  inferTaskType,
  normalizeTitle,
  type AcceptanceCriterion,
  // Workspace detection
  detectWorkspace,
  loadWorkspaceConfig,
  createApiClient,
  ApiClientError,
} from '@sidstack/shared';
import * as path from 'path';
import * as fs from 'fs';

interface SidStackConfig {
  projectId: string;
  projectName: string;
  projectPath: string;
  version?: string;
}

// Singleton API client
const apiClient = createApiClient();

/**
 * Read projectId from .sidstack/config.json in the given directory
 * Uses workspace detection to find config from worktree paths
 * Returns null if config doesn't exist or is invalid
 */
function readProjectConfig(projectPath: string): SidStackConfig | null {
  // First try workspace detection (handles worktrees)
  const workspace = detectWorkspace(projectPath);
  if (workspace) {
    try {
      return loadWorkspaceConfig(workspace.workspaceRoot);
    } catch {
      // Fall through to legacy check
    }
  }

  // Legacy: direct config.json check
  const configPath = path.join(projectPath, '.sidstack', 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content) as SidStackConfig;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Resolve projectId via API fallback (for remote/HTTP mode).
 * Calls the API server to match projectPath to a known project.
 * Returns null if API is unavailable or project not found.
 */
async function resolveProjectIdViaApi(projectPath: string): Promise<string | null> {
  try {
    const result = await apiClient.request<any>('GET', '/api/projects/by-path', undefined, {
      path: projectPath,
    });
    return result?.project?.id || null;
  } catch {
    // API unavailable or project not found
    return null;
  }
}

/**
 * Resolve projectId with workspace detection and API fallback
 *
 * Resolution order:
 * 1. Use provided projectId if given
 * 2. Detect workspace from cwd (handles worktrees)
 * 3. Fallback: resolve via API (for remote/HTTP mode)
 * 4. Throw error if none works
 */
async function resolveProjectId(providedProjectId?: string, startPath?: string): Promise<string> {
  // If projectId provided, use it
  if (providedProjectId) {
    return providedProjectId;
  }

  // Try workspace detection from startPath or cwd
  const searchPath = startPath || process.cwd();
  const workspace = detectWorkspace(searchPath);

  if (workspace?.projectId) {
    return workspace.projectId;
  }

  // Fallback: resolve via API (for remote/HTTP mode)
  const apiProjectId = await resolveProjectIdViaApi(searchPath);
  if (apiProjectId) {
    return apiProjectId;
  }

  throw new Error(
    'projectId is required. Either provide it explicitly or run from inside a SidStack workspace/project.'
  );
}

/**
 * Resolve workspace path from projectPath (handles worktrees)
 * Returns the actual workspace root where .sidstack/ lives.
 * Falls back to projectPath as-is when workspace detection fails (remote mode).
 */
function resolveWorkspacePath(projectPath: string): string {
  try {
    const workspace = detectWorkspace(projectPath);
    if (workspace) {
      return workspace.workspaceRoot;
    }
  } catch {
    // Workspace detection can fail in remote mode — fall through
  }
  return projectPath;
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
    description: `Update a task status, progress, notes, or solution plan.

Solution plan flow:
1. Analyze task → write solutionPlan (root cause + approach + logic changes) → set status="review"
2. User reviews plan → approves (planStatus="approved") or requests revision (planStatus="revision_requested" + planReviewNotes)
3. Plan approved → set status="in_progress" → implement according to plan
4. Done → provide implementSummary → set status="completed"`,
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'ID of the task to update' },
        status: { type: 'string', enum: ['pending', 'review', 'in_progress', 'completed', 'blocked', 'failed', 'cancelled'] },
        progress: { type: 'number', minimum: 0, maximum: 100, description: 'Progress percentage' },
        notes: { type: 'string', description: 'Status update notes' },
        branch: { type: 'string', description: 'Git branch name to link this task to' },
        solutionPlan: { type: 'string', description: 'Solution plan: root cause, approach, logic changes. Required when moving to "review" status.' },
        planStatus: { type: 'string', enum: ['draft', 'approved', 'revision_requested'], description: 'Plan review status' },
        planReviewNotes: { type: 'string', description: 'Review feedback when requesting plan revision' },
        implementSummary: { type: 'string', description: 'Summary of what was changed and how it was verified. Required when completing a task.' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'task_list',
    description: `List tasks with smart filtering and field selection.

Presets:
- "actionable" (default): pending + in_progress tasks
- "blocked": only blocked tasks
- "recent": updated in last 24h
- "epics": top-level tasks only (no parent)
- "all": everything with pagination

Fields (controls response size):
- "minimal" (default): id, title, status, taskType, priority, assignedAgent (~100 bytes/task, ~2.6k tokens for 100 tasks)
- "standard": + description, notes, progress, branch, moduleId, timestamps
- "full": all columns including governance, acceptanceCriteria, validation

Use task_get for full details of a specific task.

Examples:
- task_list({ projectId: "x" }) → actionable tasks, minimal fields
- task_list({ projectId: "x", search: "auth" }) → search in title/description
- task_list({ projectId: "x", preset: "epics" }) → top-level tasks only
- task_list({ projectId: "x", preset: "all", limit: 50 }) → paginated
- task_list({ projectId: "x", fields: "standard" }) → more detail per task`,
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
          items: { type: 'string', enum: ['pending', 'review', 'in_progress', 'completed', 'blocked', 'failed', 'cancelled'] },
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
        limit: { type: 'number', description: 'Max results (default: 50). Limits: minimal=500, standard=200, full=50' },
        offset: { type: 'number', description: 'Skip first N results' },
        fields: {
          type: 'string',
          enum: ['minimal', 'standard', 'full'],
          description: 'Field detail level (default: "minimal"). Use "minimal" for overview, "standard" for more context, "full" for governance data'
        },
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
        projectPath: { type: 'string', description: 'Project path for running quality gates and doc sync (optional, resolved from task if not provided)' },
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

/**
 * Helper to format an API error into a tool response
 */
function formatApiError(error: unknown, fallbackMessage: string): { content: Array<{ type: string; text: string }> } {
  if (error instanceof ApiClientError) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error.message,
          status: error.status,
          details: error.body,
        }),
      }],
    };
  }
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: false,
        error: fallbackMessage,
        details: error instanceof Error ? error.message : String(error),
      }),
    }],
  };
}

export async function handleSqliteTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {

  switch (toolName) {
    // =========================================================================
    // Task Handlers
    // =========================================================================
    case 'task_create': {
      const title = (args.title as string || '').trim();
      const description = (args.description as string || '').trim();

      // Client-side validation: title must have meaningful content (not just prefix)
      const titleContent = title.replace(/^\[[\w-]+\]\s*/, '').trim();
      if (!titleContent || titleContent.length < 5) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Title must contain a meaningful description (at least 5 characters after [TYPE] prefix)',
              hint: 'Example: [feature] Add user authentication to login page',
            }),
          }],
        };
      }

      // Client-side validation: description must be substantive
      if (!description || description.length < 20) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Description is too short. Provide a detailed description (at least 20 characters)',
              hint: 'Include: what needs to be done, why, and the expected outcome. Analyze the problem before creating a task.',
            }),
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

      // Resolve governance based on task type (client-side for early validation)
      const governance = resolveGovernance(taskType);

      // Build acceptance criteria if provided
      const rawCriteria = args.acceptanceCriteria as Array<{ description: string }> | undefined;
      const acceptanceCriteria: AcceptanceCriterion[] = (rawCriteria || []).map((c, i) => ({
        id: `ac-${Date.now()}-${i}`,
        description: c.description,
        completed: false,
      }));

      // Client-side validation: feature/bugfix/security require acceptance criteria
      if (governance.requiredCriteria && acceptanceCriteria.length === 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `${taskType} tasks require acceptance criteria`,
              hint: 'Add acceptanceCriteria array with at least one criterion. Analyze the task requirements first.',
            }),
          }],
        };
      }

      // Resolve projectId
      let projectId: string;
      try {
        projectId = await resolveProjectId(args.projectId as string);
      } catch (e) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: e instanceof Error ? e.message : 'Failed to resolve projectId',
            }),
          }],
        };
      }

      try {
        // The API server handles project auto-creation, governance resolution, and task creation
        const result = await apiClient.tasks.create({
          title: normalizedTitle,
          description,
          projectId,
          priority: (args.priority as string) || 'medium',
          assignedAgent: args.assignedAgent as string | undefined,
          createdBy: (args.createdBy as string) || 'user',
          taskType,
          moduleId: args.moduleId as string | undefined,
          branch: args.branch as string | undefined,
          acceptanceCriteria: rawCriteria,
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              task: result.task,
              governance: result.governance,
            }),
          }],
        };
      } catch (error) {
        return formatApiError(error, 'Failed to create task');
      }
    }

    case 'task_breakdown': {
      const parentTaskId = args.parentTaskId as string;
      let projectId: string;
      try {
        projectId = await resolveProjectId(args.projectId as string);
      } catch (e) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: e instanceof Error ? e.message : 'Failed to resolve projectId',
            }),
          }],
        };
      }
      const subtasks = args.subtasks as Array<{ title: string; description?: string; priority?: string }>;

      try {
        const result = await apiClient.tasks.breakdown(parentTaskId, {
          subtasks,
          projectId,
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, parentTaskId: result.parentTaskId, subtasks: result.subtasks }),
          }],
        };
      } catch (error) {
        return formatApiError(error, 'Failed to break down task');
      }
    }

    case 'task_update': {
      const taskId = args.taskId as string;
      const newStatus = args.status as string | undefined;
      const newProgress = args.progress as number | undefined;
      const notes = args.notes as string | undefined;
      const branch = args.branch as string | undefined;
      const solutionPlan = args.solutionPlan as string | undefined;
      const planStatus = args.planStatus as string | undefined;
      const planReviewNotes = args.planReviewNotes as string | undefined;
      const implementSummary = args.implementSummary as string | undefined;

      try {
        // Build update body — the API server handles progress logging, subtask validation, etc.
        const updateBody: Record<string, unknown> = {};
        if (newStatus !== undefined) updateBody.status = newStatus;
        if (newProgress !== undefined) updateBody.progress = newProgress;
        if (notes !== undefined) updateBody.notes = notes;
        if (branch !== undefined) updateBody.branch = branch;
        if (solutionPlan !== undefined) updateBody.solutionPlan = solutionPlan;
        if (planStatus !== undefined) updateBody.planStatus = planStatus;
        if (planReviewNotes !== undefined) updateBody.planReviewNotes = planReviewNotes;
        if (implementSummary !== undefined) updateBody.implementSummary = implementSummary;

        const result = await apiClient.tasks.update(taskId, updateBody);

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, task: result.task }) }],
        };
      } catch (error) {
        return formatApiError(error, 'Failed to update task');
      }
    }

    case 'task_list': {
      let projectId: string;
      try {
        projectId = await resolveProjectId(args.projectId as string);
      } catch (e) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: e instanceof Error ? e.message : 'Failed to resolve projectId',
            }),
          }],
        };
      }

      // Build query params
      const query: Record<string, string | number | boolean | undefined> = {
        projectId,
      };

      if (args.preset) query.preset = args.preset as string;
      if (args.status) query.status = (args.status as string[]).join(',');
      if (args.taskType) query.taskType = (args.taskType as string[]).join(',');
      if (args.priority) query.priority = args.priority as string;
      if (args.parentOnly !== undefined) query.parentOnly = args.parentOnly as boolean;
      if (args.search) query.search = args.search as string;
      if (args.assignedAgent) query.assignedAgent = args.assignedAgent as string;
      query.limit = (args.limit as number) || 50;
      query.offset = (args.offset as number) || 0;
      query.fields = (args.fields as string) || 'minimal';

      try {
        const result = await apiClient.tasks.list(query as any);
        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: true,
            ...result,
            _query: { projectId, ...query }
          }) }],
        };
      } catch (error) {
        return formatApiError(error, 'Failed to list tasks');
      }
    }

    case 'task_get': {
      try {
        const result = await apiClient.tasks.get(args.taskId as string);
        if (!result.task) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Task not found' }) }],
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, task: result.task }) }],
        };
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 404) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Task not found' }) }],
          };
        }
        return formatApiError(error, 'Failed to get task');
      }
    }

    case 'task_governance_check': {
      const taskId = args.taskId as string;

      try {
        const result = await apiClient.tasks.check(taskId);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              taskId,
              canComplete: result.canComplete,
              blockers: result.blockers,
              warnings: result.warnings,
              hints: result.hints,
              validation: result.validation,
            }),
          }],
        };
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 404) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Task not found' }) }],
          };
        }
        return formatApiError(error, 'Failed to check task governance');
      }
    }

    case 'task_complete': {
      const taskId = args.taskId as string;
      const force = (args.force as boolean) || false;
      const reason = args.reason as string | undefined;
      const agentId = args.agentId as string | undefined;
      const projectPath = args.projectPath as string | undefined;

      try {
        // The API server handles all validation, governance, quality gates,
        // violation logging, ticket completion, and follow-up task creation
        const result = await apiClient.tasks.complete(taskId, {
          force,
          reason,
          agentId,
          projectPath,
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              task: result.task,
              validation: result.validation,
              forcedCompletion: result.forcedCompletion,
              violationId: result.violationId,
              linkedTicketCompleted: result.linkedTicketCompleted,
              gateResults: result.gateResults,
              humanFollowUps: result.humanFollowUps,
              staleDocWarnings: result.staleDocWarnings,
              trainingFeedbackPrompt: result.trainingFeedbackPrompt,
              hint: result.trainingFeedbackPrompt
                ? 'Use training_feedback_submit to record whether skills/rules helped or hindered this task.'
                : undefined,
            }),
          }],
        };
      } catch (error) {
        if (error instanceof ApiClientError) {
          // Handle structured error responses from the API (422 for governance blockers, 400 for missing reason)
          const body = error.body as Record<string, unknown> | undefined;
          if (body && (error.status === 422 || error.status === 400)) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  ...body,
                }),
              }],
            };
          }
        }
        return formatApiError(error, 'Failed to complete task');
      }
    }

    // =========================================================================
    // Work History Handlers
    // =========================================================================
    case 'work_session_start': {
      try {
        const result = await apiClient.request<any>('POST', '/api/progress/sessions/start', {
          workspacePath: args.workspacePath as string,
          claudeSessionId: args.claudeSessionId as string | undefined,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, session: result.session }) }],
        };
      } catch (error) {
        return formatApiError(error, 'Failed to start work session');
      }
    }

    case 'work_session_end': {
      const sessionId = args.sessionId as string;
      try {
        await apiClient.request<any>('POST', `/api/progress/sessions/${sessionId}/end`, {
          summary: args.summary as string | undefined,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, sessionId }) }],
        };
      } catch (error) {
        return formatApiError(error, 'Failed to end work session');
      }
    }

    case 'work_entry_log': {
      try {
        const result = await apiClient.request<any>('POST', '/api/progress/entries', {
          sessionId: args.sessionId as string,
          workspacePath: args.workspacePath as string,
          actionType: args.actionType as string,
          actionName: args.actionName as string,
          taskId: args.taskId as string | undefined,
          details: args.details as string | undefined,
          resultSummary: args.resultSummary as string | undefined,
          durationMs: args.durationMs as number | undefined,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, entry: result.entry }) }],
        };
      } catch (error) {
        return formatApiError(error, 'Failed to log work entry');
      }
    }

    case 'work_history_get': {
      try {
        const result = await apiClient.request<any>('GET', '/api/progress/history', undefined, {
          workspacePath: args.workspacePath as string,
          timeframeHours: (args.timeframeHours as number) || 24,
          sessionId: args.sessionId as string | undefined,
          taskId: args.taskId as string | undefined,
          page: (args.page as number) || 1,
          pageSize: (args.pageSize as number) || 50,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, entries: result.entries, total: result.total }) }],
        };
      } catch (error) {
        return formatApiError(error, 'Failed to get work history');
      }
    }

    case 'task_progress_history': {
      try {
        const result = await apiClient.tasks.getProgress(args.taskId as string);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, history: result.progressHistory }) }],
        };
      } catch (error) {
        return formatApiError(error, 'Failed to get task progress history');
      }
    }

    // =========================================================================
    // Project Handlers
    // =========================================================================
    case 'project_list': {
      try {
        const result = await apiClient.projects.list();
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, projects: result.projects }) }],
        };
      } catch (error) {
        return formatApiError(error, 'Failed to list projects');
      }
    }

    case 'project_get': {
      try {
        const result = await apiClient.request<any>('GET', '/api/projects/by-path', undefined, {
          path: args.path as string,
        });
        if (!result.project) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }) }],
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, project: result.project }) }],
        };
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 404) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }) }],
          };
        }
        return formatApiError(error, 'Failed to get project');
      }
    }

    case 'project_current': {
      const cwd = process.cwd();

      // Read projectId from .sidstack/config.json (created by sidstack init) — local FS operation
      const config = readProjectConfig(cwd);
      const projectId = config?.projectId || null;
      const projectName = config?.projectName || path.basename(cwd);

      // Check if project exists in database via API
      let project = null;
      try {
        if (projectId) {
          const result = await apiClient.projects.get(projectId);
          project = result.project || null;
        } else {
          const result = await apiClient.request<any>('GET', '/api/projects/by-path', undefined, { path: cwd });
          project = result.project || null;
        }
      } catch {
        // Project not found in DB, that's ok
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            projectId: projectId || 'not-initialized',
            projectName,
            projectPath: cwd,
            configExists: !!config,
            project: project || null,
            hint: !config
              ? 'No .sidstack/config.json found. Run "sidstack init" to initialize this project.'
              : project
                ? 'Project exists in database'
                : 'Project config found but not in database yet - will be auto-created on first task',
          }),
        }],
      };
    }

    // =========================================================================
    // Migration Handlers
    // =========================================================================
    case 'task_migrate_governance': {
      try {
        const result = await apiClient.request<any>('POST', '/api/tasks/migrate-governance');
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
            }),
          }],
        };
      } catch (error) {
        return formatApiError(error, 'Failed to migrate task governance. The API endpoint may not be available yet.');
      }
    }

    default:
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` }) }],
      };
  }
}
