/**
 * Unified Context API Routes
 *
 * Manages links between tasks, specs, and knowledge documents.
 */

import { Router } from 'express';
import { getDB, TaskSpecLink, TaskKnowledgeLink, SpecType, LinkType, buildEntityContext } from '@sidstack/shared';
import type { EntityType, ContextFormat, ContextSection } from '@sidstack/shared';

export const contextRouter: Router = Router();

// ============================================================================
// Task-Spec Links
// ============================================================================

// Create spec link
contextRouter.post('/links/spec', async (req, res) => {
  try {
    const db = await getDB();
    const { taskId, specPath, specType, linkType, linkReason } = req.body;

    if (!taskId || !specPath || !specType) {
      return res.status(400).json({ error: 'taskId, specPath, and specType are required' });
    }

    const validSpecTypes: SpecType[] = ['change', 'spec', 'module'];
    if (!validSpecTypes.includes(specType)) {
      return res.status(400).json({ error: 'specType must be one of: change, spec, module' });
    }

    const link = db.createTaskSpecLink({
      taskId,
      specPath,
      specType,
      linkType: linkType || 'manual',
      linkReason,
    });

    res.status(201).json({ link });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Link already exists' });
    }
    res.status(500).json({ error: 'Failed to create spec link' });
  }
});

// Delete spec link
contextRouter.delete('/links/spec/:id', async (req, res) => {
  try {
    const db = await getDB();
    const deleted = db.deleteTaskSpecLink(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: 'Link not found' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete spec link' });
  }
});

// Get specs for task
contextRouter.get('/task/:taskId/specs', async (req, res) => {
  try {
    const db = await getDB();
    const links = db.getTaskSpecLinks(req.params.taskId);
    res.json({ links });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get spec links' });
  }
});

// Get tasks for spec
contextRouter.get('/spec/tasks', async (req, res) => {
  try {
    const db = await getDB();
    const specPath = req.query.specPath as string;

    if (!specPath) {
      return res.status(400).json({ error: 'specPath query parameter is required' });
    }

    const taskIds = db.getSpecTaskIds(specPath);
    res.json({ taskIds });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tasks for spec' });
  }
});

// ============================================================================
// Task-Knowledge Links
// ============================================================================

// Create knowledge link
contextRouter.post('/links/knowledge', async (req, res) => {
  try {
    const db = await getDB();
    const { taskId, knowledgePath, linkType, linkReason } = req.body;

    if (!taskId || !knowledgePath) {
      return res.status(400).json({ error: 'taskId and knowledgePath are required' });
    }

    const link = db.createTaskKnowledgeLink({
      taskId,
      knowledgePath,
      linkType: linkType || 'manual',
      linkReason,
    });

    res.status(201).json({ link });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Link already exists' });
    }
    res.status(500).json({ error: 'Failed to create knowledge link' });
  }
});

// Delete knowledge link
contextRouter.delete('/links/knowledge/:id', async (req, res) => {
  try {
    const db = await getDB();
    const deleted = db.deleteTaskKnowledgeLink(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: 'Link not found' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete knowledge link' });
  }
});

// Get knowledge for task
contextRouter.get('/task/:taskId/knowledge', async (req, res) => {
  try {
    const db = await getDB();
    const links = db.getTaskKnowledgeLinks(req.params.taskId);
    res.json({ links });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get knowledge links' });
  }
});

// Get tasks for knowledge
contextRouter.get('/knowledge/tasks', async (req, res) => {
  try {
    const db = await getDB();
    const knowledgePath = req.query.knowledgePath as string;

    if (!knowledgePath) {
      return res.status(400).json({ error: 'knowledgePath query parameter is required' });
    }

    const taskIds = db.getKnowledgeTaskIds(knowledgePath);
    res.json({ taskIds });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tasks for knowledge' });
  }
});

// ============================================================================
// Entity Context Builder (Project Intelligence Hub)
// ============================================================================

// Build entity context
contextRouter.get('/entity/:entityType/:entityId', async (req, res) => {
  try {
    const db = await getDB();
    const { entityType, entityId } = req.params;
    const format = (req.query.format as string) || 'claude';
    const depth = parseInt(req.query.depth as string) || 1;
    const maxTokens = parseInt(req.query.maxTokens as string) || 8000;
    const sections = req.query.sections
      ? (req.query.sections as string).split(',') as ContextSection[]
      : undefined;

    const result = buildEntityContext(db, {
      entityType: entityType as EntityType,
      entityId,
      format: format as ContextFormat,
      sections,
      maxTokens,
      depth,
    });

    res.json({
      success: true,
      entity: result.entity,
      formatted: result.formatted,
      related: {
        tasks: result.related.tasks.length,
        sessions: result.related.sessions.length,
        knowledge: result.related.knowledge.length,
        impact: result.related.impact.length,
        rules: result.related.governance.rules.length,
        skills: result.related.governance.skills.length,
        tickets: result.related.tickets.length,
        incidents: result.related.incidents.length,
        lessons: result.related.lessons.length,
      },
      references: result.references.length,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to build entity context' });
  }
});

// Task start context
contextRouter.get('/task/:taskId/start-context', async (req, res) => {
  try {
    const db = await getDB();
    const { taskId } = req.params;
    const format = (req.query.format as string) || 'claude';
    const maxTokens = parseInt(req.query.maxTokens as string) || 8000;

    const task = db.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const result = buildEntityContext(db, {
      entityType: 'task',
      entityId: taskId,
      format: format as ContextFormat,
      sections: ['capability', 'knowledge', 'impact', 'governance', 'history', 'references'],
      maxTokens,
      depth: 1,
    });

    res.json({
      success: true,
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        progress: task.progress,
        taskType: task.taskType,
      },
      context: result.formatted || JSON.stringify(result, null, 2),
      related: {
        sessions: result.related.sessions.length,
        knowledge: result.related.knowledge.length,
        impact: result.related.impact.length,
        rules: result.related.governance.rules.length,
        skills: result.related.governance.skills.length,
        tickets: result.related.tickets.length,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to build task start context' });
  }
});

// Task complete with context
contextRouter.post('/task/:taskId/complete-context', async (req, res) => {
  try {
    const db = await getDB();
    const { taskId } = req.params;
    const { sessionId, knowledgeCreated, lessonsLearned, notes } = req.body;

    const task = db.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const refsCreated: string[] = [];

    db.updateTask(taskId, { status: 'completed', progress: 100, notes: notes || task.notes });

    if (sessionId) {
      try {
        db.createEntityReference({
          sourceType: 'task', sourceId: taskId,
          targetType: 'session', targetId: sessionId,
          relationship: 'implemented_by', createdBy: 'system',
        });
        refsCreated.push('task -> session (implemented_by)');
      } catch { /* duplicate */ }
    }

    if (knowledgeCreated) {
      for (const knowledgeId of knowledgeCreated) {
        if (sessionId) {
          try {
            db.createEntityReference({
              sourceType: 'session', sourceId: sessionId,
              targetType: 'knowledge', targetId: knowledgeId,
              relationship: 'creates', createdBy: 'system',
            });
            refsCreated.push(`session -> knowledge:${knowledgeId} (creates)`);
          } catch { /* duplicate */ }
        }
        try {
          db.createEntityReference({
            sourceType: 'task', sourceId: taskId,
            targetType: 'knowledge', targetId: knowledgeId,
            relationship: 'requires_context', createdBy: 'system',
          });
          refsCreated.push(`task -> knowledge:${knowledgeId} (requires_context)`);
        } catch { /* duplicate */ }
      }
    }

    if (lessonsLearned && sessionId) {
      for (const lessonId of lessonsLearned) {
        try {
          db.createEntityReference({
            sourceType: 'session', sourceId: sessionId,
            targetType: 'lesson', targetId: lessonId,
            relationship: 'creates', createdBy: 'system',
          });
          refsCreated.push(`session -> lesson:${lessonId} (creates)`);
        } catch { /* duplicate */ }
      }
    }

    res.json({
      success: true,
      task: { id: task.id, title: task.title, status: 'completed', progress: 100 },
      referencesCreated: refsCreated,
      summary: `Task completed. ${refsCreated.length} entity references created.`,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete task with context' });
  }
});

// ============================================================================
// Unified Context
// ============================================================================

// Get full context for task
contextRouter.get('/task/:taskId', async (req, res) => {
  try {
    const db = await getDB();
    const taskId = req.params.taskId;

    // Get task info
    const task = db.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get unified context
    const context = db.getUnifiedContext(taskId);

    // Get recent activity (optional)
    const recentActivity = db.getRecentWorkEntries(taskId, 10);

    res.json({
      task,
      specLinks: context.specLinks,
      knowledgeLinks: context.knowledgeLinks,
      dismissedPaths: context.dismissedPaths,
      recentActivity,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get unified context' });
  }
});

// ============================================================================
// Suggestions
// ============================================================================

// Dismiss suggestion
contextRouter.post('/suggestions/dismiss', async (req, res) => {
  try {
    const db = await getDB();
    const { taskId, suggestedPath, suggestionType } = req.body;

    if (!taskId || !suggestedPath || !suggestionType) {
      return res.status(400).json({ error: 'taskId, suggestedPath, and suggestionType are required' });
    }

    if (!['spec', 'knowledge'].includes(suggestionType)) {
      return res.status(400).json({ error: 'suggestionType must be spec or knowledge' });
    }

    const dismissed = db.dismissSuggestion(taskId, suggestedPath, suggestionType);
    res.json({ dismissed });
  } catch (error) {
    res.status(500).json({ error: 'Failed to dismiss suggestion' });
  }
});

// Check if suggestion is dismissed
contextRouter.get('/suggestions/dismissed', async (req, res) => {
  try {
    const db = await getDB();
    const taskId = req.query.taskId as string;
    const suggestedPath = req.query.suggestedPath as string;

    if (!taskId || !suggestedPath) {
      return res.status(400).json({ error: 'taskId and suggestedPath query parameters are required' });
    }

    const isDismissed = db.isDismissed(taskId, suggestedPath);
    res.json({ isDismissed });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check dismissed status' });
  }
});

export default contextRouter;
