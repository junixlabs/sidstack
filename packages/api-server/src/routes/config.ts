/**
 * API routes for agent configuration and skill management
 *
 * Endpoints:
 * - GET/PUT /api/config/agents/:type - Get/update agent configuration
 * - GET /api/config/agents - List all agents
 * - GET/POST /api/config/skills - List/create skills
 * - GET/PUT/DELETE /api/config/skills/:name - Get/update/delete skill
 * - GET /api/config/presets - List available presets
 * - GET /api/config/presets/:name - Get preset details
 */

import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const router: RouterType = Router();

// Configuration paths
const getProjectDir = (req: Request): string => {
  return (req.query.projectDir as string) || process.cwd();
};

const getClaudeDir = (projectDir: string): string => path.join(projectDir, '.claude');
const getAgentsDir = (projectDir: string): string => path.join(getClaudeDir(projectDir), 'agents');
const getSkillsDir = (projectDir: string): string => path.join(getClaudeDir(projectDir), 'skills');
const getUserDir = (): string => path.join(process.env.HOME || '', '.sidstack');
const getBundleDir = (): string => path.join(__dirname, '../../../cli/templates');

// Helper: Parse YAML frontmatter file
function parseMarkdownFile(filePath: string): { config: Record<string, unknown>; body: string } | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return null;

    return {
      config: parseYaml(match[1]) as Record<string, unknown>,
      body: match[2].trim(),
    };
  } catch {
    return null;
  }
}

// Helper: Write YAML frontmatter file
function writeMarkdownFile(
  filePath: string,
  config: Record<string, unknown>,
  body: string
): boolean {
  try {
    const yaml = stringifyYaml(config);
    const content = `---\n${yaml.trim()}\n---\n\n${body}`;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// AGENT CONFIGURATION ENDPOINTS
// ============================================================================

/**
 * GET /api/config/agents
 * List all available agent configurations
 */
router.get('/agents', async (req: Request, res: Response) => {
  try {
    const projectDir = getProjectDir(req);
    const agents: Array<{
      name: string;
      type: string;
      source: 'project' | 'user' | 'bundle';
      path: string;
      config?: Record<string, unknown>;
    }> = [];
    const seen = new Set<string>();

    // Project agents
    const projectAgentsDir = getAgentsDir(projectDir);
    if (fs.existsSync(projectAgentsDir)) {
      const files = fs.readdirSync(projectAgentsDir);
      for (const file of files) {
        if (file.endsWith('-agent.md')) {
          const name = file.replace('.md', '');
          const type = name.replace('-agent', '');
          if (!seen.has(name)) {
            seen.add(name);
            const parsed = parseMarkdownFile(path.join(projectAgentsDir, file));
            agents.push({
              name,
              type,
              source: 'project',
              path: path.join(projectAgentsDir, file),
              config: parsed?.config,
            });
          }
        }
      }
    }

    // User agents
    const userAgentsDir = path.join(getUserDir(), 'agents');
    if (fs.existsSync(userAgentsDir)) {
      const files = fs.readdirSync(userAgentsDir);
      for (const file of files) {
        if (file.endsWith('-agent.md')) {
          const name = file.replace('.md', '');
          const type = name.replace('-agent', '');
          if (!seen.has(name)) {
            seen.add(name);
            const parsed = parseMarkdownFile(path.join(userAgentsDir, file));
            agents.push({
              name,
              type,
              source: 'user',
              path: path.join(userAgentsDir, file),
              config: parsed?.config,
            });
          }
        }
      }
    }

    // Bundle agents
    const bundleAgentsDir = path.join(getBundleDir(), 'agents', 'base');
    if (fs.existsSync(bundleAgentsDir)) {
      const files = fs.readdirSync(bundleAgentsDir);
      for (const file of files) {
        if (file.endsWith('-agent.md')) {
          const name = file.replace('.md', '');
          const type = name.replace('-agent', '');
          if (!seen.has(name)) {
            seen.add(name);
            const parsed = parseMarkdownFile(path.join(bundleAgentsDir, file));
            agents.push({
              name,
              type,
              source: 'bundle',
              path: path.join(bundleAgentsDir, file),
              config: parsed?.config,
            });
          }
        }
      }
    }

    res.json({ agents });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/config/agents/:type
 * Get agent configuration by type (dev, ba, qa, etc.)
 */
router.get('/agents/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const projectDir = getProjectDir(req);
    const fileName = `${type}-agent.md`;

    // Try project first
    let filePath = path.join(getAgentsDir(projectDir), fileName);
    let source: 'project' | 'user' | 'bundle' = 'project';

    if (!fs.existsSync(filePath)) {
      // Try user
      filePath = path.join(getUserDir(), 'agents', fileName);
      source = 'user';
    }

    if (!fs.existsSync(filePath)) {
      // Try bundle
      filePath = path.join(getBundleDir(), 'agents', 'base', fileName);
      source = 'bundle';
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `Agent not found: ${type}` });
    }

    const parsed = parseMarkdownFile(filePath);
    if (!parsed) {
      return res.status(500).json({ error: 'Failed to parse agent file' });
    }

    res.json({
      type,
      source,
      path: filePath,
      config: parsed.config,
      body: parsed.body,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/config/agents/:type
 * Update agent configuration
 */
router.put('/agents/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { config, body, destination = 'project' } = req.body;
    const projectDir = getProjectDir(req);
    const fileName = `${type}-agent.md`;

    // Determine destination path
    let destPath: string;
    if (destination === 'project') {
      destPath = path.join(getAgentsDir(projectDir), fileName);
    } else if (destination === 'user') {
      destPath = path.join(getUserDir(), 'agents', fileName);
    } else {
      return res.status(400).json({ error: 'Invalid destination. Must be: project or user' });
    }

    // Get existing content if only updating config
    let finalConfig = config;
    let finalBody = body;

    if (!body) {
      // Try to read existing body
      const existing = parseMarkdownFile(destPath);
      if (existing) {
        finalBody = existing.body;
        finalConfig = { ...existing.config, ...config };
      } else {
        // Try to read from bundle
        const bundlePath = path.join(getBundleDir(), 'agents', 'base', fileName);
        const bundleContent = parseMarkdownFile(bundlePath);
        if (bundleContent) {
          finalBody = bundleContent.body;
          finalConfig = { ...bundleContent.config, ...config };
        } else {
          return res.status(400).json({ error: 'Body is required when creating new agent' });
        }
      }
    }

    // Write file
    const success = writeMarkdownFile(destPath, finalConfig, finalBody);
    if (!success) {
      return res.status(500).json({ error: 'Failed to write agent file' });
    }

    res.json({
      success: true,
      path: destPath,
      message: `Agent ${type} saved to ${destination}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// SKILL MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/config/skills
 * List all available skills
 */
router.get('/skills', async (req: Request, res: Response) => {
  try {
    const projectDir = getProjectDir(req);
    const skills: Array<{
      name: string;
      category: string;
      source: 'project' | 'user' | 'bundle';
      path: string;
      config?: Record<string, unknown>;
    }> = [];
    const seen = new Set<string>();

    // Helper to add skills from a directory
    const addSkillsFromDir = (
      dir: string,
      source: 'project' | 'user' | 'bundle',
      category?: string
    ) => {
      if (!fs.existsSync(dir)) return;

      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          const name = file.replace('.md', '');
          if (seen.has(name)) continue;
          seen.add(name);

          const parsed = parseMarkdownFile(path.join(dir, file));
          skills.push({
            name,
            category: category || (parsed?.config?.category as string) || 'optional',
            source,
            path: path.join(dir, file),
            config: parsed?.config,
          });
        }
      }
    };

    // Project skills
    addSkillsFromDir(getSkillsDir(projectDir), 'project');

    // User skills
    addSkillsFromDir(path.join(getUserDir(), 'skills'), 'user');

    // Bundle skills
    addSkillsFromDir(path.join(getBundleDir(), 'skills', 'core'), 'bundle', 'core');
    addSkillsFromDir(path.join(getBundleDir(), 'skills', 'optional'), 'bundle', 'optional');

    res.json({ skills });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/config/skills/:name
 * Get skill by name
 */
router.get('/skills/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const projectDir = getProjectDir(req);
    const fileName = `${name}.md`;

    // Try project first
    let filePath = path.join(getSkillsDir(projectDir), fileName);
    let source: 'project' | 'user' | 'bundle' = 'project';

    if (!fs.existsSync(filePath)) {
      // Try user
      filePath = path.join(getUserDir(), 'skills', fileName);
      source = 'user';
    }

    if (!fs.existsSync(filePath)) {
      // Try bundle core
      filePath = path.join(getBundleDir(), 'skills', 'core', fileName);
      source = 'bundle';
    }

    if (!fs.existsSync(filePath)) {
      // Try bundle optional
      filePath = path.join(getBundleDir(), 'skills', 'optional', fileName);
      source = 'bundle';
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `Skill not found: ${name}` });
    }

    const parsed = parseMarkdownFile(filePath);
    if (!parsed) {
      return res.status(500).json({ error: 'Failed to parse skill file' });
    }

    res.json({
      name,
      source,
      path: filePath,
      config: parsed.config,
      body: parsed.body,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/config/skills
 * Create a new skill
 */
router.post('/skills', async (req: Request, res: Response) => {
  try {
    const { name, config, body, destination = 'project' } = req.body;
    const projectDir = getProjectDir(req);

    if (!name || !config || !body) {
      return res.status(400).json({ error: 'name, config, and body are required' });
    }

    // Determine destination path
    let destPath: string;
    if (destination === 'project') {
      destPath = path.join(getSkillsDir(projectDir), `${name}.md`);
    } else if (destination === 'user') {
      destPath = path.join(getUserDir(), 'skills', `${name}.md`);
    } else {
      return res.status(400).json({ error: 'Invalid destination. Must be: project or user' });
    }

    // Check if exists
    if (fs.existsSync(destPath)) {
      return res.status(409).json({ error: `Skill already exists: ${name}` });
    }

    // Write file
    const success = writeMarkdownFile(destPath, config, body);
    if (!success) {
      return res.status(500).json({ error: 'Failed to write skill file' });
    }

    res.status(201).json({
      success: true,
      path: destPath,
      message: `Skill ${name} created in ${destination}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/config/skills/:name
 * Update an existing skill
 */
router.put('/skills/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { config, body } = req.body;
    const projectDir = getProjectDir(req);
    const fileName = `${name}.md`;

    // Find existing skill (project or user only - can't update bundle)
    let filePath = path.join(getSkillsDir(projectDir), fileName);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(getUserDir(), 'skills', fileName);
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: `Skill not found in project or user directory: ${name}`,
      });
    }

    // Get existing content
    const existing = parseMarkdownFile(filePath);
    if (!existing) {
      return res.status(500).json({ error: 'Failed to parse existing skill file' });
    }

    const finalConfig = config ? { ...existing.config, ...config } : existing.config;
    const finalBody = body || existing.body;

    // Write file
    const success = writeMarkdownFile(filePath, finalConfig, finalBody);
    if (!success) {
      return res.status(500).json({ error: 'Failed to write skill file' });
    }

    res.json({
      success: true,
      path: filePath,
      message: `Skill ${name} updated`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/config/skills/:name
 * Delete a skill (project or user only)
 */
router.delete('/skills/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const projectDir = getProjectDir(req);
    const fileName = `${name}.md`;

    // Find existing skill (project or user only)
    let filePath = path.join(getSkillsDir(projectDir), fileName);
    let source = 'project';

    if (!fs.existsSync(filePath)) {
      filePath = path.join(getUserDir(), 'skills', fileName);
      source = 'user';
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: `Skill not found in project or user directory: ${name}`,
      });
    }

    // Delete file
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: `Skill ${name} deleted from ${source}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// PRESET ENDPOINTS
// ============================================================================

/**
 * GET /api/config/presets
 * List all available presets
 */
router.get('/presets', async (req: Request, res: Response) => {
  try {
    const presetsDir = path.join(getBundleDir(), 'presets');
    const presets: Array<{
      name: string;
      displayName: string;
      description: string;
      language: string;
      projectType: string;
    }> = [];

    if (fs.existsSync(presetsDir)) {
      const files = fs.readdirSync(presetsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(presetsDir, file);
          const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          presets.push({
            name: content.name,
            displayName: content.displayName,
            description: content.description,
            language: content.language,
            projectType: content.projectType,
          });
        }
      }
    }

    res.json({ presets });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/config/presets/:name
 * Get preset details
 */
router.get('/presets/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const presetsDir = path.join(getBundleDir(), 'presets');
    const filePath = path.join(presetsDir, `${name}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `Preset not found: ${name}` });
    }

    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    res.json(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
