import { Router, Request, Response } from 'express';
import { getDB, ProjectSettings, DEFAULT_PROJECT_SETTINGS, mergeWithDefaults, validateSettings, getSettingsPath } from '@sidstack/shared';
import * as fs from 'fs/promises';
import * as path from 'path';

export const projectsApiRouter: Router = Router();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper to ensure .sidstack directory exists
 */
async function ensureSidstackDir(projectPath: string): Promise<void> {
  const sidstackDir = path.join(projectPath, '.sidstack');
  try {
    await fs.mkdir(sidstackDir, { recursive: true });
  } catch (error) {
    // Directory already exists, ignore
  }
}

/**
 * Read settings from file, returns defaults if not found
 */
async function readSettingsFile(projectPath: string): Promise<ProjectSettings> {
  const settingsPath = getSettingsPath(projectPath);
  try {
    const content = await fs.readFile(settingsPath, 'utf-8');
    const parsed = JSON.parse(content);
    return mergeWithDefaults(parsed);
  } catch (error) {
    // File doesn't exist or is invalid, return defaults
    return DEFAULT_PROJECT_SETTINGS;
  }
}

/**
 * Write settings to file
 */
async function writeSettingsFile(projectPath: string, settings: ProjectSettings): Promise<void> {
  await ensureSidstackDir(projectPath);
  const settingsPath = getSettingsPath(projectPath);
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

// ============================================================================
// IMPORTANT: Specific routes MUST come BEFORE parameterized routes (/:id)
// Express matches routes in order - /:id would match "/settings" as id="settings"
// ============================================================================

// ============================================================================
// Project Settings Endpoints (specific routes - must be first!)
// ============================================================================

// GET /api/projects/settings?path=<projectPath>
// Get project settings
projectsApiRouter.get('/settings', async (req, res) => {
  try {
    const projectPath = req.query.path as string;

    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }

    const settings = await readSettingsFile(projectPath);
    res.json({ success: true, settings });
  } catch (error) {
    console.error('[settings:get] Error:', error);
    res.status(500).json({ error: 'Failed to get project settings' });
  }
});

// PUT /api/projects/settings?path=<projectPath>
// Replace all project settings
projectsApiRouter.put('/settings', async (req, res) => {
  try {
    const projectPath = req.query.path as string;

    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }

    const settings = mergeWithDefaults(req.body);
    const validation = validateSettings(settings);

    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid settings', errors: validation.errors });
    }

    await writeSettingsFile(projectPath, settings);
    res.json({ success: true, settings });
  } catch (error) {
    console.error('[settings:put] Error:', error);
    res.status(500).json({ error: 'Failed to save project settings' });
  }
});

// PATCH /api/projects/settings?path=<projectPath>
// Partial update of project settings
projectsApiRouter.patch('/settings', async (req, res) => {
  try {
    const projectPath = req.query.path as string;

    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }

    // Read current settings
    const current = await readSettingsFile(projectPath);

    // Deep merge with updates
    const updated: ProjectSettings = {
      version: current.version,
      session: { ...current.session, ...req.body.session },
      sync: { ...current.sync, ...req.body.sync },
      agent: { ...current.agent, ...req.body.agent },
    };

    const validation = validateSettings(updated);

    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid settings', errors: validation.errors });
    }

    await writeSettingsFile(projectPath, updated);
    res.json({ success: true, settings: updated });
  } catch (error) {
    console.error('[settings:patch] Error:', error);
    res.status(500).json({ error: 'Failed to update project settings' });
  }
});

// DELETE /api/projects/settings?path=<projectPath>
// Reset project settings to defaults
projectsApiRouter.delete('/settings', async (req, res) => {
  try {
    const projectPath = req.query.path as string;

    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }

    const settingsPath = getSettingsPath(projectPath);

    try {
      await fs.unlink(settingsPath);
    } catch (error) {
      // File doesn't exist, that's fine
    }

    res.json({ success: true, settings: DEFAULT_PROJECT_SETTINGS });
  } catch (error) {
    console.error('[settings:delete] Error:', error);
    res.status(500).json({ error: 'Failed to reset project settings' });
  }
});

// ============================================================================
// Project OKRs (read from .sidstack/project-okrs.json)
// ============================================================================

// GET /api/projects/okrs?path=<projectPath>
projectsApiRouter.get('/okrs', async (req, res) => {
  try {
    const projectPath = req.query.path as string;
    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }
    const okrsPath = path.join(projectPath, '.sidstack', 'project-okrs.json');
    const content = await fs.readFile(okrsPath, 'utf-8');
    const okrs = JSON.parse(content);
    res.json({ success: true, okrs });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.json({ success: true, okrs: null });
    }
    console.error('[okrs:get] Error:', error);
    res.status(500).json({ error: 'Failed to read project OKRs' });
  }
});

// PUT /api/projects/okrs?path=<projectPath>
projectsApiRouter.put('/okrs', async (req, res) => {
  try {
    const projectPath = req.query.path as string;
    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }
    await ensureSidstackDir(projectPath);
    const okrsPath = path.join(projectPath, '.sidstack', 'project-okrs.json');
    await fs.writeFile(okrsPath, JSON.stringify(req.body, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (error) {
    console.error('[okrs:put] Error:', error);
    res.status(500).json({ error: 'Failed to save project OKRs' });
  }
});

// ============================================================================
// Other Specific Routes (must come before /:id)
// ============================================================================

// Get project by path
projectsApiRouter.get('/by-path', async (req, res) => {
  try {
    const db = await getDB();
    const path = req.query.path as string;

    if (!path) {
      return res.status(400).json({ error: 'Path query parameter is required' });
    }

    const project = db.getProjectByPath(path);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get project' });
  }
});

// ============================================================================
// Base Project CRUD Endpoints
// ============================================================================

// List projects
projectsApiRouter.get('/', async (req, res) => {
  try {
    const db = await getDB();
    const projects = db.listProjects();
    res.json({ projects });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// Create project
projectsApiRouter.post('/', async (req, res) => {
  try {
    const db = await getDB();
    const { id, name, path, status = 'active' } = req.body;

    if (!id || !name || !path) {
      return res.status(400).json({ error: 'Project ID, name, and path are required' });
    }

    // Check if project exists
    const existing = db.getProject(id);
    if (existing) {
      return res.status(409).json({ error: 'Project already exists' });
    }

    const project = db.createProject({ id, name, path, status });
    res.status(201).json({ project });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// ============================================================================
// Parameterized Routes (MUST be last - /:id matches anything!)
// ============================================================================

// Get project by ID
projectsApiRouter.get('/:id', async (req, res) => {
  try {
    const db = await getDB();
    const project = db.getProject(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get project tasks
    const tasks = db.listTasks(req.params.id);

    res.json({ project, tasks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get project' });
  }
});
