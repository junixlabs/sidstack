/**
 * Traceability API Routes
 *
 * Endpoint for the traceability matrix (spec → task → test coverage).
 */

import { Router } from 'express';
import { getDB, buildTraceabilityMatrix, detectWorkspace } from '@sidstack/shared';

export const traceabilityRouter: Router = Router();

// GET /api/traceability/matrix?projectId=X&projectPath=Y&specId=Z
traceabilityRouter.get('/matrix', async (req, res) => {
  try {
    const projectId = req.query.projectId as string;
    const projectPath = req.query.projectPath as string;
    const specId = req.query.specId as string | undefined;
    const taskId = req.query.taskId as string | undefined;

    if (!projectId || !projectPath) {
      return res.status(400).json({ error: 'projectId and projectPath are required' });
    }

    const workspace = detectWorkspace(projectPath);
    const workspacePath = workspace ? workspace.workspaceRoot : projectPath;

    const db = await getDB();
    const result = await buildTraceabilityMatrix(db, workspacePath, projectId, specId, taskId);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Failed to build traceability matrix:', error);
    res.status(500).json({ error: 'Failed to build traceability matrix' });
  }
});
