import { Router, Request, Response } from 'express';
import {
  getRepository,
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
import { emitSseEvent } from '../events';

export const tasksRouter: Router = Router();

// List tasks — unified endpoint with fields param
tasksRouter.get('/', async (req, res) => {
  try {
    const repo = await getRepository();
    const projectId = (req.query.projectId as string) || 'default';
    const result = await repo.tasks.list(projectId, {
      preset: req.query.preset as any,
      status: req.query.status ? (req.query.status as string).split(',') : undefined,
      taskType: req.query.taskType ? (req.query.taskType as string).split(',') : undefined,
      priority: req.query.priority as string | undefined,
      parentOnly: req.query.parentOnly === 'true',
      search: req.query.search as string | undefined,
      assignedAgent: req.query.assignedAgent as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      fields: (req.query.fields as any) || 'standard',
    });
    res.json(result);
  } catch (error) {
    console.error('[tasks] Error listing tasks:', error);
    res.status(500).json({ error: 'Failed to list tasks' });
  }
});

// Get task by ID
tasksRouter.get('/:id', async (req, res) => {
  try {
    const repo = await getRepository();
    const task = await repo.tasks.get(req.params.id);

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
    const repo = await getRepository();
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
      branch,
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

    // Reject feature/bugfix/security tasks without acceptance criteria
    if (governance.requiredCriteria && acceptanceCriteria.length === 0) {
      return res.status(400).json({
        error: `${taskType} tasks require acceptance criteria`,
        hint: 'Add acceptanceCriteria array with at least one criterion.',
      });
    }

    const criteriaValid = !governance.requiredCriteria || acceptanceCriteria.length > 0;

    // Ensure project exists
    const project = await repo.projects.get(projectId);
    if (!project) {
      return res.status(400).json({
        error: `Project "${projectId}" not found. Register it first via sidstack init or the projects API.`,
      });
    }

    const task = await repo.tasks.create({
      projectId,
      title: normalizedTitle,
      description: description || '',
      status: 'pending',
      priority,
      assignedAgent,
      createdBy,
      taskType,
      moduleId,
      branch,
      governance: JSON.stringify(governance),
      acceptanceCriteria: JSON.stringify(acceptanceCriteria),
      validation: JSON.stringify({
        progressHistoryCount: 0,
        titleFormatValid: true,
        qualityGatesPassed: false,
        acceptanceCriteriaValid: criteriaValid,
      }),
    });

    emitSseEvent({
      type: 'task_created',
      projectId,
      entityId: task.id,
      title: task.title,
      summary: `New ${taskType} task created`,
      timestamp: Date.now(),
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
    const repo = await getRepository();
    const { status, progress, notes, moduleId, assignedAgent, branch, solutionPlan, planStatus, planReviewNotes, implementSummary } = req.body;
    const taskId = req.params.id;

    const currentTask = await repo.tasks.get(taskId);
    if (!currentTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Status transition: → review requires solutionPlan
    if (status === 'review') {
      const plan = solutionPlan || currentTask.solutionPlan;
      if (!plan || String(plan).trim().length < 20) {
        return res.status(400).json({
          error: 'Moving to review requires a solutionPlan (min 20 chars)',
          hint: 'Provide solutionPlan with: root cause, approach, and logic changes.',
        });
      }
    }

    // Status transition: review → in_progress requires planStatus=approved
    if (status === 'in_progress' && currentTask.status === 'review') {
      if (currentTask.planStatus !== 'approved' && planStatus !== 'approved') {
        return res.status(400).json({
          error: 'Cannot start work on a task in review without an approved plan',
          hint: 'Set planStatus to "approved" first.',
        });
      }
    }

    // Status transition: → completed requires implementSummary
    if (status === 'completed') {
      const summary = implementSummary || currentTask.implementSummary;
      if (!summary || String(summary).trim().length < 10) {
        return res.status(400).json({
          error: 'Completing a task requires an implementSummary (min 10 chars)',
          hint: 'Provide implementSummary with: what changed and how it was verified.',
        });
      }
    }

    // Validate subtasks when completing a task
    if (status === 'completed') {
      const subtasks = await repo.tasks.getSubtasks(taskId);
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

    // Build update — auto-set planStatus=draft when solutionPlan submitted with review
    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (progress !== undefined) updates.progress = progress;
    if (notes !== undefined) updates.notes = notes;
    if (moduleId !== undefined) updates.moduleId = moduleId;
    if (assignedAgent !== undefined) updates.assignedAgent = assignedAgent;
    if (branch !== undefined) updates.branch = branch;
    if (solutionPlan !== undefined) updates.solutionPlan = solutionPlan;
    if (implementSummary !== undefined) updates.implementSummary = implementSummary;

    // planStatus logic
    if (planStatus !== undefined) {
      updates.planStatus = planStatus;
    } else if (status === 'review' && solutionPlan) {
      updates.planStatus = 'draft';
    }
    if (planReviewNotes !== undefined) updates.planReviewNotes = planReviewNotes;

    const task = await repo.tasks.update(taskId, updates as any);

    if (task) {
      emitSseEvent({
        type: 'task_updated',
        projectId: currentTask.projectId,
        entityId: taskId,
        title: task.title,
        summary: status ? `Task status → ${status}` : 'Task updated',
        timestamp: Date.now(),
      });
    }

    res.json({ task });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Create subtasks (breakdown)
tasksRouter.post('/:id/breakdown', async (req, res) => {
  try {
    const repo = await getRepository();
    const parentTaskId = req.params.id;
    const { subtasks } = req.body;

    const parentTask = await repo.tasks.get(parentTaskId);
    if (!parentTask) {
      return res.status(404).json({ error: 'Parent task not found' });
    }

    const createdSubtasks = [];
    for (const st of subtasks as any[]) {
      const created = await repo.tasks.create({
        projectId: parentTask.projectId,
        parentTaskId,
        title: st.title,
        description: st.description || '',
        status: 'pending',
        priority: st.priority || 'medium',
        createdBy: 'orchestrator',
      });
      createdSubtasks.push(created);
    }

    res.status(201).json({ parentTaskId, subtasks: createdSubtasks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create subtasks' });
  }
});

// Get task progress history
tasksRouter.get('/:id/progress', async (req, res) => {
  try {
    const repo = await getRepository();
    const taskId = req.params.id;

    const task = await repo.tasks.get(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const history = await repo.tasks.getProgressHistory(taskId);
    res.json({ task, progressHistory: history });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get task progress' });
  }
});

// Get task governance info
tasksRouter.get('/:id/governance', async (req, res) => {
  try {
    const repo = await getRepository();
    const taskId = req.params.id;

    const task = await repo.tasks.get(taskId);
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
    const repo = await getRepository();
    const taskId = req.params.id;

    const task = await repo.tasks.get(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get progress history for this task
    const progressHistory = await repo.tasks.getProgressHistory(taskId);
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
    const repo = await getRepository();
    const taskId = req.params.id;
    const { force = false, reason, agentId } = req.body;

    const task = await repo.tasks.get(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get progress history
    const progressHistory = await repo.tasks.getProgressHistory(taskId);
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
      const dbViolation = await repo.tasks.logViolation({
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
    const updatedTask = await repo.tasks.update(taskId, {
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
      const linkedTicket = await repo.tickets.getByTaskId(taskId);
      if (linkedTicket && linkedTicket.status !== 'completed' && linkedTicket.status !== 'rejected') {
        await repo.tickets.update(linkedTicket.id, { status: 'completed' });
        linkedTicketCompleted = linkedTicket.id;
      }
    } catch {
      // Non-blocking: ticket completion failure should not affect task completion
    }

    emitSseEvent({
      type: 'task_completed',
      projectId: task.projectId,
      entityId: taskId,
      title: task.title,
      summary: 'Task completed',
      timestamp: Date.now(),
    });

    res.json({
      task: updatedTask,
      validation: validationResult.validation,
      forcedCompletion: force && !validationResult.canComplete,
      violationId,
      linkedTicketCompleted,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete task' });
  }
});
