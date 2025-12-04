import { Router } from 'express';
import { getDB } from '@sidstack/shared';

export const progressRouter: Router = Router();

// =============================================================================
// Work Sessions
// =============================================================================

// Start a work session
progressRouter.post('/sessions/start', async (req, res) => {
  try {
    const db = await getDB();
    const { workspacePath, claudeSessionId } = req.body;

    if (!workspacePath) {
      return res.status(400).json({ error: 'workspacePath is required' });
    }

    const session = db.startWorkSession(workspacePath, claudeSessionId);
    res.status(201).json({ success: true, session });
  } catch (error) {
    console.error('Failed to start session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// End a work session
progressRouter.post('/sessions/:sessionId/end', async (req, res) => {
  try {
    const db = await getDB();
    const { sessionId } = req.params;
    const { summary } = req.body;

    db.endWorkSession(sessionId, summary);
    res.json({ success: true, sessionId });
  } catch (error) {
    console.error('Failed to end session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Get sessions for workspace
progressRouter.get('/sessions', async (req, res) => {
  try {
    const db = await getDB();
    const workspacePath = req.query.workspacePath as string;
    const timeframeHours = parseInt(req.query.timeframeHours as string) || 24;

    if (!workspacePath) {
      return res.status(400).json({ error: 'workspacePath is required' });
    }

    const sessions = db.getWorkSessions(workspacePath, timeframeHours);
    res.json({ success: true, sessions });
  } catch (error) {
    console.error('Failed to get sessions:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// Get active session for workspace
progressRouter.get('/sessions/active', async (req, res) => {
  try {
    const db = await getDB();
    const workspacePath = req.query.workspacePath as string;

    if (!workspacePath) {
      return res.status(400).json({ error: 'workspacePath is required' });
    }

    const session = db.getActiveWorkSession(workspacePath);
    res.json({ success: true, session });
  } catch (error) {
    console.error('Failed to get active session:', error);
    res.status(500).json({ error: 'Failed to get active session' });
  }
});

// =============================================================================
// Work Entries
// =============================================================================

// Log a work entry
progressRouter.post('/entries', async (req, res) => {
  try {
    const db = await getDB();
    const { sessionId, workspacePath, actionType, actionName, taskId, details, resultSummary, durationMs } = req.body;

    if (!sessionId || !workspacePath || !actionType || !actionName) {
      return res.status(400).json({ error: 'sessionId, workspacePath, actionType, and actionName are required' });
    }

    const entry = db.logWorkEntry({
      sessionId,
      workspacePath,
      actionType,
      actionName,
      taskId,
      details,
      resultSummary,
      durationMs,
    });

    res.status(201).json({ success: true, entry });
  } catch (error) {
    console.error('Failed to log work entry:', error);
    res.status(500).json({ error: 'Failed to log work entry' });
  }
});

// Get work history
progressRouter.get('/history', async (req, res) => {
  try {
    const db = await getDB();
    const workspacePath = req.query.workspacePath as string;
    const timeframeHours = parseInt(req.query.timeframeHours as string) || 24;
    const sessionId = req.query.sessionId as string | undefined;
    const taskId = req.query.taskId as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;

    if (!workspacePath) {
      return res.status(400).json({ error: 'workspacePath is required' });
    }

    const { entries, total } = db.getWorkHistory(workspacePath, timeframeHours, { sessionId, taskId }, page, pageSize);
    res.json({ success: true, entries, total, page, pageSize });
  } catch (error) {
    console.error('Failed to get work history:', error);
    res.status(500).json({ error: 'Failed to get work history' });
  }
});

// =============================================================================
// Task Progress
// =============================================================================

// Log task progress
progressRouter.post('/task-progress', async (req, res) => {
  try {
    const db = await getDB();
    const { taskId, sessionId, progress, status, currentStep, notes, artifacts } = req.body;

    if (!taskId || !sessionId || progress === undefined || !status) {
      return res.status(400).json({ error: 'taskId, sessionId, progress, and status are required' });
    }

    const progressLog = db.logTaskProgress({
      taskId,
      sessionId,
      progress,
      status,
      currentStep,
      notes,
      artifacts: JSON.stringify(artifacts || []),
    });

    res.status(201).json({ success: true, progressLog });
  } catch (error) {
    console.error('Failed to log task progress:', error);
    res.status(500).json({ error: 'Failed to log task progress' });
  }
});

// Get task progress history
progressRouter.get('/task-progress/:taskId', async (req, res) => {
  try {
    const db = await getDB();
    const { taskId } = req.params;

    const history = db.getTaskProgressHistory(taskId);
    res.json({ success: true, history });
  } catch (error) {
    console.error('Failed to get task progress history:', error);
    res.status(500).json({ error: 'Failed to get task progress history' });
  }
});

// =============================================================================
// Cleanup
// =============================================================================

// Cleanup old entries (admin endpoint)
progressRouter.post('/cleanup', async (req, res) => {
  try {
    const db = await getDB();
    const retentionDays = parseInt(req.body.retentionDays as string) || 30;

    const result = db.cleanupWorkHistory(retentionDays);
    res.json({ success: true, deleted: result });
  } catch (error) {
    console.error('Failed to cleanup work history:', error);
    res.status(500).json({ error: 'Failed to cleanup work history' });
  }
});
