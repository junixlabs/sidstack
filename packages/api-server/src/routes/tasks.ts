import { Router, Request, Response } from 'express';
import {
  getDB,
  type TaskType,
  resolveGovernance,
  inferTaskType,
  normalizeTitle,
  validateTaskCompletion,
  validateSubtasksForCompletion,
  createViolation,
  type AcceptanceCriterion,
  type TaskForValidation,
  type ProgressLogEntry,
} from '@sidstack/shared';

export const tasksRouter: Router = Router();

// List tasks
tasksRouter.get('/', async (req, res) => {
  try {
    // getDB() now auto-reloads if file changed externally (e.g., by MCP server)
    const db = await getDB();
    const projectId = (req.query.projectId as string) || 'default';
    const status = req.query.status as string | undefined;
    console.log('[tasks] Listing tasks for projectId:', projectId);

    const tasks = db.listTasks(projectId, { status });
    console.log('[tasks] Found', tasks.length, 'tasks');
    res.json({ tasks });
  } catch (error) {
    console.error('[tasks] Error listing tasks:', error);
    res.status(500).json({ error: 'Failed to list tasks' });
  }
});

// Get task by ID
tasksRouter.get('/:id', async (req, res) => {
  try {
    const db = await getDB();
    const task = db.getTask(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ task });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get task' });
  }
});

// Create task with governance
tasksRouter.post('/', async (req, res) => {
  try {
    const db = await getDB();
    const {
      title,
      description,
      projectId = 'default',
      priority = 'medium',
      assignedAgent,
      createdBy = 'user',
      taskType: providedTaskType,
      moduleId,
      acceptanceCriteria: rawCriteria,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Validate title has meaningful content
    const titleContent = String(title).replace(/^\[[\w-]+\]\s*/, '').trim();
    if (titleContent.length < 5) {
      return res.status(400).json({
        error: 'Title must contain a meaningful description (at least 5 characters)',
        hint: 'Example: [feature] Add user authentication to login page',
      });
    }

    // Validate description for MCP/API callers (skip for UI quick-create which sets createdBy='ui')
    if (createdBy !== 'ui' && (!description || String(description).trim().length < 20)) {
      return res.status(400).json({
        error: 'Description is too short. Provide a detailed description (at least 20 characters)',
        hint: 'Include: what needs to be done, why, and the expected outcome.',
      });
    }

    // Infer or use provided task type
    const taskType: TaskType = providedTaskType || inferTaskType(title, description);

    // Normalize title to include [TYPE] prefix
    const normalizedTitle = normalizeTitle(title, taskType);

    // Resolve governance based on task type
    const governance = resolveGovernance(taskType);

    // Build acceptance criteria if provided
    const acceptanceCriteria: AcceptanceCriterion[] = (rawCriteria || []).map((c: { description: string }, i: number) => ({
      id: `ac-${Date.now()}-${i}`,
      description: c.description,
      completed: false,
    }));

    // Note: acceptance criteria checked in validation field below
    const criteriaValid = !governance.requiredCriteria || acceptanceCriteria.length > 0;

    // Ensure project exists
    let project = db.getProject(projectId);
    if (!project) {
      project = db.createProject({
        id: projectId,
        name: projectId,
        path: process.cwd(),
        status: 'active',
      });
    }

    const task = db.createTask({
      projectId,
      title: normalizedTitle,
      description: description || '',
      status: 'pending',
      priority,
      assignedAgent,
      createdBy,
      taskType,
      moduleId,
      governance: JSON.stringify(governance),
      acceptanceCriteria: JSON.stringify(acceptanceCriteria),
      validation: JSON.stringify({
        progressHistoryCount: 0,
        titleFormatValid: true,
        qualityGatesPassed: false,
        acceptanceCriteriaValid: criteriaValid,
      }),
    });

    res.status(201).json({
      task,
      governance: {
        taskType,
        principles: governance.principles,
        skills: governance.skills,
        qualityGates: governance.qualityGates.map(g => g.id),
        requiredCriteria: governance.requiredCriteria,
      },
    });
  } catch (error) {
    console.error('[tasks POST] Error:', error);
    res.status(500).json({
      error: 'Failed to create task',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Update task
tasksRouter.patch('/:id', async (req, res) => {
  try {
    const db = await getDB();
    const { status, progress, notes, moduleId, assignedAgent } = req.body;
    const taskId = req.params.id;

    // Validate subtasks when completing a task
    if (status === 'completed') {
      const subtasks = db.getSubtasks(taskId);
      if (subtasks.length > 0) {
        const subtaskValidation = validateSubtasksForCompletion(
          subtasks.map(s => ({
            id: s.id,
            title: s.title,
            status: s.status,
            notes: s.notes,
          }))
        );

        if (!subtaskValidation.canComplete) {
          return res.status(400).json({
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
          });
        }
      }
    }

    const task = db.updateTask(taskId, { status, progress, notes, moduleId, assignedAgent });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ task });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Create subtasks (breakdown)
tasksRouter.post('/:id/breakdown', async (req, res) => {
  try {
    const db = await getDB();
    const parentTaskId = req.params.id;
    const { subtasks } = req.body;

    const parentTask = db.getTask(parentTaskId);
    if (!parentTask) {
      return res.status(404).json({ error: 'Parent task not found' });
    }

    const createdSubtasks = (subtasks as any[]).map((st) => {
      return db.createTask({
        projectId: parentTask.projectId,
        parentTaskId,
        title: st.title,
        description: st.description || '',
        status: 'pending',
        priority: st.priority || 'medium',
        createdBy: 'orchestrator',
      });
    });

    res.status(201).json({ parentTaskId, subtasks: createdSubtasks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create subtasks' });
  }
});

// Get task progress history
tasksRouter.get('/:id/progress', async (req, res) => {
  try {
    const db = await getDB();
    const taskId = req.params.id;

    const task = db.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const history = db.getTaskProgressHistory(taskId);
    res.json({ task, progressHistory: history });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get task progress' });
  }
});

// Get task governance info
tasksRouter.get('/:id/governance', async (req, res) => {
  try {
    const db = await getDB();
    const taskId = req.params.id;

    const task = db.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const governance = task.governance ? JSON.parse(task.governance) : null;
    const acceptanceCriteria = task.acceptanceCriteria ? JSON.parse(task.acceptanceCriteria) : [];
    const validation = task.validation ? JSON.parse(task.validation) : null;

    res.json({
      taskId,
      taskType: task.taskType,
      moduleId: task.moduleId,
      governance,
      acceptanceCriteria,
      validation,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get task governance' });
  }
});

// Check task completion requirements
tasksRouter.post('/:id/check', async (req, res) => {
  try {
    const db = await getDB();
    const taskId = req.params.id;

    const task = db.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get progress history for this task
    const progressHistory = db.getTaskProgressHistory(taskId);
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

    res.json({
      taskId,
      canComplete: result.canComplete,
      blockers: result.blockers,
      warnings: result.warnings,
      hints: result.hints,
      validation: result.validation,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check task' });
  }
});

// Complete task with validation
tasksRouter.post('/:id/complete', async (req, res) => {
  try {
    const db = await getDB();
    const taskId = req.params.id;
    const { force = false, reason, agentId } = req.body;

    const task = db.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get progress history
    const progressHistory = db.getTaskProgressHistory(taskId);
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
      return res.status(422).json({
        error: 'Task cannot be completed due to governance blockers',
        blockers: validationResult.blockers,
        hints: validationResult.hints,
        validation: validationResult.validation,
        hint: 'Use force=true with reason to bypass (logs governance violation)',
      });
    }

    // If forcing without reason
    if (force && !validationResult.canComplete && !reason) {
      return res.status(400).json({
        error: 'Force completion requires a reason',
        hint: 'Provide reason parameter explaining why bypass is needed',
      });
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
      const dbViolation = db.logGovernanceViolation({
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
    const updatedTask = db.updateTask(taskId, {
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

    res.json({
      task: updatedTask,
      validation: validationResult.validation,
      forcedCompletion: force && !validationResult.canComplete,
      violationId,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete task' });
  }
});
