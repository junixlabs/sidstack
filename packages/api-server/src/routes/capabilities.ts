/**
 * Capability Registry API Routes (Project Intelligence Hub)
 *
 * CRUD for business-level capabilities loaded from YAML files.
 */

import { Router } from 'express';
import {
  loadAllCapabilities,
  loadCapability,
  writeCapability,
  deleteCapability,
  resolveHierarchy,
  queryCapabilities,
  getCapabilityStats,
  capabilitiesExist,
} from '@sidstack/shared';
import type { CapabilityDefinition, CapabilityQuery } from '@sidstack/shared';

export const capabilitiesRouter: Router = Router();

function getProjectPath(req: { query: { projectPath?: string } }): string {
  return (req.query.projectPath as string) || process.cwd();
}

// List capabilities with optional filters
capabilitiesRouter.get('/', (req, res) => {
  try {
    const projectPath = getProjectPath(req);

    if (!capabilitiesExist(projectPath)) {
      return res.json({ capabilities: [], stats: null, exists: false });
    }

    const all = loadAllCapabilities(projectPath);
    const definitions = all.map((c) => c.definition);

    const query: CapabilityQuery = {};
    if (req.query.level) query.level = req.query.level as any;
    if (req.query.status) query.status = req.query.status as any;
    if (req.query.maturity) query.maturity = req.query.maturity as any;
    if (req.query.parent) query.parent = req.query.parent as string;
    if (req.query.tag) query.tag = req.query.tag as string;
    if (req.query.moduleId) query.moduleId = req.query.moduleId as string;

    const hasFilters = Object.keys(query).length > 0;
    const filtered = hasFilters ? queryCapabilities(definitions, query) : definitions;
    const stats = getCapabilityStats(definitions);

    res.json({ capabilities: filtered, stats, exists: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list capabilities' });
  }
});

// Get hierarchy (resolved tree)
capabilitiesRouter.get('/hierarchy', (req, res) => {
  try {
    const projectPath = getProjectPath(req);
    const all = loadAllCapabilities(projectPath);
    const definitions = all.map((c) => c.definition);
    const tree = resolveHierarchy(definitions);
    const stats = getCapabilityStats(definitions);

    res.json({ tree, stats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve hierarchy' });
  }
});

// Get single capability
capabilitiesRouter.get('/:id', (req, res) => {
  try {
    const projectPath = getProjectPath(req);
    const loaded = loadCapability(projectPath, req.params.id);

    if (!loaded) {
      return res.status(404).json({ error: 'Capability not found' });
    }

    res.json({ capability: loaded.definition, filePath: loaded.filePath });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get capability' });
  }
});

// Create capability
capabilitiesRouter.post('/', (req, res) => {
  try {
    const projectPath = getProjectPath(req);
    const definition = req.body as CapabilityDefinition;

    if (!definition.id || !definition.name || !definition.level || !definition.purpose) {
      return res.status(400).json({
        error: 'Required fields: id, name, level, purpose',
      });
    }

    // Check if already exists
    const existing = loadCapability(projectPath, definition.id);
    if (existing) {
      return res.status(409).json({ error: `Capability '${definition.id}' already exists` });
    }

    // Set defaults
    if (!definition.status) definition.status = 'planned';
    if (!definition.maturity) definition.maturity = 'planned';

    const filePath = writeCapability(projectPath, definition);
    res.status(201).json({ capability: definition, filePath });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create capability' });
  }
});

// Update capability
capabilitiesRouter.patch('/:id', (req, res) => {
  try {
    const projectPath = getProjectPath(req);
    const existing = loadCapability(projectPath, req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Capability not found' });
    }

    const updated: CapabilityDefinition = {
      ...existing.definition,
      ...req.body,
      id: existing.definition.id, // Prevent ID change
    };

    const filePath = writeCapability(projectPath, updated);
    res.json({ capability: updated, filePath });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update capability' });
  }
});

// Delete capability
capabilitiesRouter.delete('/:id', (req, res) => {
  try {
    const projectPath = getProjectPath(req);
    const deleted = deleteCapability(projectPath, req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: 'Capability not found' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete capability' });
  }
});
