/**
 * Claude Session Manager API Routes
 *
 * Endpoints for managing Claude Code sessions,
 * linking them to tasks/modules, and tracking session lifecycle.
 */

import { Router } from 'express';
import { getDB, launchClaudeSession, isClaudeInstalled, checkSessionStatus, getSessionSettings, createKnowledgeService, buildSessionContext, createSessionContextOptions } from '@sidstack/shared';
import type { SessionFilters, CreateClaudeSessionInput, TerminalApp, LaunchMode, WindowMode } from '@sidstack/shared';

export const sessionsRouter: Router = Router();

// =============================================================================
// CRUD Operations
// =============================================================================

// Launch a new Claude session in external terminal
// This is the main endpoint that actually opens the terminal
sessionsRouter.post('/launch', async (req, res) => {
  try {
    // Check if Claude CLI is installed (skip in dev mode)
    const skipClaudeCheck = process.env.SKIP_CLAUDE_CHECK === '1' || process.env.NODE_ENV === 'development';
    if (!skipClaudeCheck && !isClaudeInstalled()) {
      return res.status(400).json({
        success: false,
        error: 'Claude CLI not installed. Run: npm install -g @anthropic-ai/claude-code',
      });
    }

    const db = await getDB();
    const {
      projectDir,
      workspacePath, // alias for projectDir
      taskId,
      moduleId,
      terminal,
      mode,
      prompt,
      windowMode,
      includeContext,
      includeTraining,
      agentRole,
      taskType,
    } = req.body;

    const projectPath = projectDir || workspacePath;
    if (!projectPath) {
      return res.status(400).json({
        success: false,
        error: 'projectDir or workspacePath is required',
      });
    }

    // Load project settings as defaults
    const projectSessionSettings = getSessionSettings(projectPath);

    // Use explicit params if provided, otherwise fall back to project settings
    const resolvedTerminal = terminal || projectSessionSettings.defaultTerminal;
    const resolvedMode = mode || projectSessionSettings.defaultMode;
    const resolvedWindowMode = windowMode || projectSessionSettings.windowMode;

    // Determine if context should be injected
    const shouldInjectContext = includeContext !== undefined
      ? includeContext
      : !!(taskId || moduleId);

    // Build knowledge + training context
    let contextPrompt: string | undefined;
    let contextEntities: string[] = [];
    if (shouldInjectContext && (taskId || moduleId)) {
      try {
        const knowledgeService = createKnowledgeService(projectPath);
        const contextOptions = createSessionContextOptions({
          db,
          knowledgeService,
          workspacePath: projectPath,
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

    // Launch the terminal
    const launchResult = await launchClaudeSession({
      projectDir: projectPath,
      terminal: resolvedTerminal as TerminalApp | undefined,
      mode: resolvedMode as LaunchMode | undefined,
      windowMode: resolvedWindowMode as WindowMode | undefined,
      context: {
        taskId,
        moduleId,
        prompt: finalPrompt,
      },
    });

    if (!launchResult.success) {
      return res.status(500).json({
        success: false,
        error: launchResult.error || 'Failed to launch terminal',
      });
    }

    // Create session record in database
    const input: CreateClaudeSessionInput = {
      workspacePath: projectPath,
      taskId,
      moduleId,
      terminal: launchResult.terminal,
      launchMode: resolvedMode || 'normal',
      initialPrompt: finalPrompt,
      pid: launchResult.pid,
      terminalWindowId: launchResult.terminalWindowId,
      claudeSessionId: launchResult.claudeSessionId,
    };

    const session = db.createClaudeSession(input);

    // Log launched event
    db.logSessionEvent({
      claudeSessionId: session.id,
      eventType: 'launched',
      details: {
        terminal: launchResult.terminal,
        launchMode: resolvedMode || 'normal',
        windowMode: resolvedWindowMode,
        taskId,
        moduleId,
        command: launchResult.command,
        claudeSessionId: launchResult.claudeSessionId,
        usedProjectSettings: !terminal || !mode || !windowMode,
        contextInjected: !!contextPrompt,
        contextEntities,
      },
    });

    res.status(201).json({
      success: true,
      session,
      launch: {
        terminal: launchResult.terminal,
        command: launchResult.command,
        pid: launchResult.pid,
        windowId: launchResult.terminalWindowId,
      },
      contextInjected: !!contextPrompt,
      contextEntities,
    });
  } catch (error) {
    console.error('Failed to launch session:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to launch session',
    });
  }
});

// =============================================================================
// Status Sync
// =============================================================================

// Check and sync a single session's status with actual terminal state
sessionsRouter.post('/:id/sync', async (req, res) => {
  try {
    const db = await getDB();
    const session = db.getClaudeSession(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Only check active/launching sessions
    if (session.status !== 'active' && session.status !== 'launching') {
      return res.json({
        success: true,
        session,
        sync: { checked: false, reason: 'Session already ended' },
      });
    }

    // Check actual status
    const statusCheck = checkSessionStatus(
      session.terminal as TerminalApp,
      session.pid || undefined,
      session.terminalWindowId || undefined
    );

    // If session is no longer alive, mark as terminated
    if (!statusCheck.isAlive) {
      const updatedSession = db.updateClaudeSession(req.params.id, {
        status: 'terminated',
        endedAt: Date.now(),
      });

      db.logSessionEvent({
        claudeSessionId: req.params.id,
        eventType: 'terminated',
        details: { reason: 'sync_detected', ...statusCheck },
      });

      return res.json({
        success: true,
        session: updatedSession,
        sync: {
          checked: true,
          wasAlive: false,
          statusChanged: true,
          method: statusCheck.method,
          details: statusCheck.details,
        },
      });
    }

    return res.json({
      success: true,
      session,
      sync: {
        checked: true,
        wasAlive: true,
        statusChanged: false,
        method: statusCheck.method,
        details: statusCheck.details,
      },
    });
  } catch (error) {
    console.error('Failed to sync session:', error);
    res.status(500).json({ error: 'Failed to sync session' });
  }
});

// Sync all active sessions
sessionsRouter.post('/sync-all', async (req, res) => {
  try {
    const db = await getDB();
    const workspacePath = req.body.workspacePath as string | undefined;

    // Get all active sessions
    const activeSessions = db.getActiveClaudeSessions(workspacePath);
    const results: Array<{ id: string; wasAlive: boolean; statusChanged: boolean }> = [];

    for (const session of activeSessions) {
      const statusCheck = checkSessionStatus(
        session.terminal as TerminalApp,
        session.pid || undefined,
        session.terminalWindowId || undefined
      );

      if (!statusCheck.isAlive) {
        db.updateClaudeSession(session.id, {
          status: 'terminated',
          endedAt: Date.now(),
        });

        db.logSessionEvent({
          claudeSessionId: session.id,
          eventType: 'terminated',
          details: { reason: 'sync_detected', ...statusCheck },
        });

        results.push({ id: session.id, wasAlive: false, statusChanged: true });
      } else {
        results.push({ id: session.id, wasAlive: true, statusChanged: false });
      }
    }

    const changed = results.filter((r) => r.statusChanged).length;

    res.json({
      success: true,
      checked: activeSessions.length,
      changed,
      results,
    });
  } catch (error) {
    console.error('Failed to sync sessions:', error);
    res.status(500).json({ error: 'Failed to sync sessions' });
  }
});

// Create a new Claude session (record only, no terminal launch)
sessionsRouter.post('/', async (req, res) => {
  try {
    const db = await getDB();
    const {
      workspacePath,
      taskId,
      moduleId,
      terminal,
      launchMode,
      initialPrompt,
      pid,
      terminalWindowId,
    } = req.body;

    if (!workspacePath || !terminal) {
      return res.status(400).json({ error: 'workspacePath and terminal are required' });
    }

    const input: CreateClaudeSessionInput = {
      workspacePath,
      taskId,
      moduleId,
      terminal,
      launchMode,
      initialPrompt,
      pid,
      terminalWindowId,
    };

    const session = db.createClaudeSession(input);

    // Log launched event
    db.logSessionEvent({
      claudeSessionId: session.id,
      eventType: 'launched',
      details: { terminal, launchMode, taskId, moduleId },
    });

    res.status(201).json({ success: true, session });
  } catch (error) {
    console.error('Failed to create session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// List sessions with filters
sessionsRouter.get('/', async (req, res) => {
  try {
    const db = await getDB();

    const filters: SessionFilters = {};

    if (req.query.workspacePath) {
      filters.workspacePath = req.query.workspacePath as string;
    }
    if (req.query.taskId) {
      filters.taskId = req.query.taskId as string;
    }
    if (req.query.moduleId) {
      filters.moduleId = req.query.moduleId as string;
    }
    if (req.query.status) {
      const statusParam = req.query.status as string;
      filters.status = statusParam.includes(',')
        ? statusParam.split(',') as any[]
        : statusParam as any;
    }
    if (req.query.terminal) {
      filters.terminal = req.query.terminal as any;
    }
    if (req.query.startedAfter) {
      filters.startedAfter = parseInt(req.query.startedAfter as string);
    }
    if (req.query.startedBefore) {
      filters.startedBefore = parseInt(req.query.startedBefore as string);
    }
    if (req.query.limit) {
      filters.limit = parseInt(req.query.limit as string);
    }
    if (req.query.offset) {
      filters.offset = parseInt(req.query.offset as string);
    }

    const result = db.listClaudeSessions(filters);
    res.json({ success: true, ...result, filters });
  } catch (error) {
    console.error('Failed to list sessions:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// Get session by ID
sessionsRouter.get('/:id', async (req, res) => {
  try {
    const db = await getDB();
    const session = db.getClaudeSession(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true, session });
  } catch (error) {
    console.error('Failed to get session:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// Update session
sessionsRouter.put('/:id', async (req, res) => {
  try {
    const db = await getDB();
    const session = db.updateClaudeSession(req.params.id, req.body);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true, session });
  } catch (error) {
    console.error('Failed to update session:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// Delete session
sessionsRouter.delete('/:id', async (req, res) => {
  try {
    const db = await getDB();
    const exists = db.getClaudeSession(req.params.id);

    if (!exists) {
      return res.status(404).json({ error: 'Session not found' });
    }

    db.deleteClaudeSession(req.params.id);
    res.json({ success: true, deleted: req.params.id });
  } catch (error) {
    console.error('Failed to delete session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// =============================================================================
// Query Shortcuts
// =============================================================================

// Get active sessions
sessionsRouter.get('/query/active', async (req, res) => {
  try {
    const db = await getDB();
    const workspacePath = req.query.workspacePath as string | undefined;
    const sessions = db.getActiveClaudeSessions(workspacePath);
    res.json({ success: true, sessions });
  } catch (error) {
    console.error('Failed to get active sessions:', error);
    res.status(500).json({ error: 'Failed to get active sessions' });
  }
});

// Get sessions by task
sessionsRouter.get('/by-task/:taskId', async (req, res) => {
  try {
    const db = await getDB();
    const sessions = db.getClaudeSessionsByTask(req.params.taskId);
    res.json({ success: true, sessions, taskId: req.params.taskId });
  } catch (error) {
    console.error('Failed to get sessions by task:', error);
    res.status(500).json({ error: 'Failed to get sessions by task' });
  }
});

// Get sessions by module
sessionsRouter.get('/by-module/:moduleId', async (req, res) => {
  try {
    const db = await getDB();
    const sessions = db.getClaudeSessionsByModule(req.params.moduleId);
    res.json({ success: true, sessions, moduleId: req.params.moduleId });
  } catch (error) {
    console.error('Failed to get sessions by module:', error);
    res.status(500).json({ error: 'Failed to get sessions by module' });
  }
});

// =============================================================================
// Status Management
// =============================================================================

// Update status
sessionsRouter.post('/:id/status', async (req, res) => {
  try {
    const db = await getDB();
    const { status, exitCode, errorMessage } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const session = db.updateClaudeSession(req.params.id, {
      status,
      exitCode,
      errorMessage,
      endedAt: ['completed', 'error', 'terminated'].includes(status) ? Date.now() : undefined,
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Log status change event
    db.logSessionEvent({
      claudeSessionId: req.params.id,
      eventType: status as any,
      details: { exitCode, errorMessage },
    });

    res.json({ success: true, session });
  } catch (error) {
    console.error('Failed to update status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Mark completed
sessionsRouter.post('/:id/complete', async (req, res) => {
  try {
    const db = await getDB();
    const { exitCode } = req.body;

    const session = db.markClaudeSessionCompleted(req.params.id, exitCode);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    db.logSessionEvent({
      claudeSessionId: req.params.id,
      eventType: 'completed',
      details: { exitCode },
    });

    res.json({ success: true, session });
  } catch (error) {
    console.error('Failed to complete session:', error);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

// Mark error
sessionsRouter.post('/:id/error', async (req, res) => {
  try {
    const db = await getDB();
    const { errorMessage } = req.body;

    if (!errorMessage) {
      return res.status(400).json({ error: 'errorMessage is required' });
    }

    const session = db.markClaudeSessionError(req.params.id, errorMessage);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    db.logSessionEvent({
      claudeSessionId: req.params.id,
      eventType: 'error',
      details: { errorMessage },
    });

    res.json({ success: true, session });
  } catch (error) {
    console.error('Failed to mark error:', error);
    res.status(500).json({ error: 'Failed to mark error' });
  }
});

// Mark terminated
sessionsRouter.post('/:id/terminate', async (req, res) => {
  try {
    const db = await getDB();
    const session = db.markClaudeSessionTerminated(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    db.logSessionEvent({
      claudeSessionId: req.params.id,
      eventType: 'terminated',
    });

    res.json({ success: true, session });
  } catch (error) {
    console.error('Failed to terminate session:', error);
    res.status(500).json({ error: 'Failed to terminate session' });
  }
});

// =============================================================================
// Events
// =============================================================================

// Get session events
sessionsRouter.get('/:id/events', async (req, res) => {
  try {
    const db = await getDB();
    const events = db.getSessionEvents(req.params.id);
    res.json({ success: true, events, sessionId: req.params.id });
  } catch (error) {
    console.error('Failed to get events:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// Log event
sessionsRouter.post('/:id/events', async (req, res) => {
  try {
    const db = await getDB();
    const { eventType, details } = req.body;

    if (!eventType) {
      return res.status(400).json({ error: 'eventType is required' });
    }

    const event = db.logSessionEvent({
      claudeSessionId: req.params.id,
      eventType,
      details,
    });

    res.status(201).json({ success: true, event });
  } catch (error) {
    console.error('Failed to log event:', error);
    res.status(500).json({ error: 'Failed to log event' });
  }
});

// =============================================================================
// Resume
// =============================================================================

// Get resume context
sessionsRouter.get('/:id/resume-context', async (req, res) => {
  try {
    const db = await getDB();
    const session = db.getClaudeSession(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const context = db.buildResumeContext(req.params.id);
    res.json({ success: true, context, sessionId: req.params.id });
  } catch (error) {
    console.error('Failed to get resume context:', error);
    res.status(500).json({ error: 'Failed to get resume context' });
  }
});

// Resume session - launches terminal with session picker
// Note: Claude's --resume flag (without ID) shows a picker for user to select session
sessionsRouter.post('/:id/resume', async (req, res) => {
  try {
    const db = await getDB();
    const originalSession = db.getClaudeSession(req.params.id);

    if (!originalSession) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!originalSession.canResume) {
      return res.status(400).json({ error: 'Session cannot be resumed' });
    }

    const { additionalPrompt, claudeSessionId: overrideClaudeSessionId, windowMode } = req.body;

    // Use the stored Claude session ID, or override if provided
    const claudeSessionId = overrideClaudeSessionId || originalSession.claudeSessionId;

    // Launch new terminal
    // If claudeSessionId is available, use --resume <id> for specific session
    // Otherwise, use --resume (shows picker)
    const launchResult = await launchClaudeSession({
      projectDir: originalSession.workspacePath,
      terminal: originalSession.terminal as TerminalApp,
      mode: 'resume',
      resumeSessionId: claudeSessionId || undefined,
      windowMode: windowMode as WindowMode | undefined,
      context: {
        prompt: additionalPrompt,
      },
    });

    if (!launchResult.success) {
      return res.status(500).json({
        success: false,
        error: launchResult.error || 'Failed to launch terminal for resume',
      });
    }

    // Update original session's resume count
    const session = db.recordClaudeSessionResume(req.params.id);

    db.logSessionEvent({
      claudeSessionId: req.params.id,
      eventType: 'resumed',
      details: {
        resumeCount: session?.resumeCount,
        terminal: launchResult.terminal,
        command: launchResult.command,
        claudeSessionId,
      },
    });

    res.json({
      success: true,
      session,
      launch: {
        terminal: launchResult.terminal,
        command: launchResult.command,
        windowId: launchResult.terminalWindowId,
      },
      note: claudeSessionId
        ? `Resuming Claude session: ${claudeSessionId}`
        : 'Claude will show a session picker. Select the session you want to resume.',
    });
  } catch (error) {
    console.error('Failed to resume session:', error);
    res.status(500).json({ error: 'Failed to resume session' });
  }
});

// =============================================================================
// Stats
// =============================================================================

// Get overall stats
sessionsRouter.get('/stats/overview', async (req, res) => {
  try {
    const db = await getDB();

    const filters: SessionFilters = {};
    if (req.query.workspacePath) {
      filters.workspacePath = req.query.workspacePath as string;
    }

    const stats = db.getClaudeSessionStats(filters);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Failed to get stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Get stats by task
sessionsRouter.get('/stats/task/:taskId', async (req, res) => {
  try {
    const db = await getDB();
    const stats = db.getClaudeSessionStats({ taskId: req.params.taskId });
    res.json({ success: true, stats, taskId: req.params.taskId });
  } catch (error) {
    console.error('Failed to get task stats:', error);
    res.status(500).json({ error: 'Failed to get task stats' });
  }
});

// Get stats by module
sessionsRouter.get('/stats/module/:moduleId', async (req, res) => {
  try {
    const db = await getDB();
    const stats = db.getClaudeSessionStats({ moduleId: req.params.moduleId });
    res.json({ success: true, stats, moduleId: req.params.moduleId });
  } catch (error) {
    console.error('Failed to get module stats:', error);
    res.status(500).json({ error: 'Failed to get module stats' });
  }
});

// =============================================================================
// Cleanup
// =============================================================================

// Cleanup old sessions
sessionsRouter.post('/cleanup', async (req, res) => {
  try {
    const db = await getDB();
    const retentionDays = parseInt(req.body.retentionDays) || 30;

    const result = db.cleanupClaudeSessions(retentionDays);
    res.json({ success: true, ...result, retentionDays });
  } catch (error) {
    console.error('Failed to cleanup sessions:', error);
    res.status(500).json({ error: 'Failed to cleanup sessions' });
  }
});
