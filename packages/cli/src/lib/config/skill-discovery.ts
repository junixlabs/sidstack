/**
 * SkillDiscovery - 3-tier configuration lookup for skill templates
 *
 * Lookup priority:
 * 1. Project-level: .claude/skills/ in the current project
 * 2. User-level: ~/.sidstack/skills/ (shared across all projects)
 * 3. CLI Bundle: packages/cli/templates/skills/ (built-in defaults)
 *
 * Skills are automatically discovered and loaded based on agent configuration.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export interface SkillConfig {
  name: string;
  description: string;
  category: 'core' | 'optional';
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface ResolvedSkill {
  config: SkillConfig;
  body: string;
  source: 'project' | 'user' | 'bundle';
  sourcePath: string;
}

export interface SkillDiscoveryOptions {
  projectDir?: string;
  userDir?: string;
  bundleDir?: string;
}

export class SkillDiscovery {
  private projectSkillsDir: string;
  private userSkillsDir: string;
  private bundleSkillsDir: string;

  constructor(options: SkillDiscoveryOptions = {}) {
    const projectDir = options.projectDir || process.cwd();
    const userDir = options.userDir || path.join(process.env.HOME || '', '.sidstack');
    const bundleDir = options.bundleDir || path.join(__dirname, '../../../templates/skills');

    this.projectSkillsDir = path.join(projectDir, '.claude', 'skills');
    this.userSkillsDir = path.join(userDir, 'skills');
    this.bundleSkillsDir = bundleDir;
  }

  /**
   * Parse a skill file and extract config
   */
  private parseSkillFile(content: string): { config: SkillConfig; body: string } | null {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!frontmatterMatch) {
      return null;
    }

    try {
      const config = parseYaml(frontmatterMatch[1]) as SkillConfig;
      const body = frontmatterMatch[2].trim();

      return { config, body };
    } catch {
      return null;
    }
  }

  /**
   * Resolve a skill with 3-tier lookup
   */
  async resolveSkill(skillName: string): Promise<ResolvedSkill | null> {
    const skillFileName = `${skillName}.md`;

    // Priority 1: Project-level
    const projectSkill = await this.loadFromDirectory(
      this.projectSkillsDir,
      skillFileName,
      'project'
    );
    if (projectSkill) {
      return projectSkill;
    }

    // Priority 2: User-level
    const userSkill = await this.loadFromDirectory(this.userSkillsDir, skillFileName, 'user');
    if (userSkill) {
      return userSkill;
    }

    // Priority 3: Bundle (check both core and optional)
    const bundleSkill = await this.loadFromBundle(skillName);
    if (bundleSkill) {
      return bundleSkill;
    }

    return null;
  }

  /**
   * Load skill from a directory
   */
  private async loadFromDirectory(
    directory: string,
    fileName: string,
    source: 'project' | 'user' | 'bundle'
  ): Promise<ResolvedSkill | null> {
    const filePath = path.join(directory, fileName);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const parsed = this.parseSkillFile(content);

      if (!parsed) {
        console.warn(`Invalid skill file format: ${filePath}`);
        return null;
      }

      return {
        config: parsed.config,
        body: parsed.body,
        source,
        sourcePath: filePath,
      };
    } catch (error) {
      console.warn(`Failed to load skill from ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Load skill from bundle (core or optional)
   */
  private async loadFromBundle(skillName: string): Promise<ResolvedSkill | null> {
    const skillFileName = `${skillName}.md`;

    // Try core directory first
    const corePath = path.join(this.bundleSkillsDir, 'core', skillFileName);
    if (fs.existsSync(corePath)) {
      return this.loadFromDirectory(path.dirname(corePath), skillFileName, 'bundle');
    }

    // Try optional directory
    const optionalPath = path.join(this.bundleSkillsDir, 'optional', skillFileName);
    if (fs.existsSync(optionalPath)) {
      return this.loadFromDirectory(path.dirname(optionalPath), skillFileName, 'bundle');
    }

    return null;
  }

  /**
   * Resolve multiple skills
   */
  async resolveSkills(skillNames: string[]): Promise<ResolvedSkill[]> {
    const skills: ResolvedSkill[] = [];

    for (const name of skillNames) {
      const skill = await this.resolveSkill(name);
      if (skill) {
        skills.push(skill);
      } else {
        console.warn(`Skill not found: ${name}`);
      }
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    skills.sort((a, b) => priorityOrder[a.config.priority] - priorityOrder[b.config.priority]);

    return skills;
  }

  /**
   * Get combined skill content for an agent
   */
  async getSkillsContent(skillNames: string[]): Promise<string> {
    const skills = await this.resolveSkills(skillNames);

    if (skills.length === 0) {
      return '';
    }

    const sections = skills.map((skill) => {
      return `## Skill: ${skill.config.name}

${skill.body}`;
    });

    return `# Agent Skills

${sections.join('\n\n---\n\n')}`;
  }

  /**
   * List all available skills across all tiers
   */
  async listAvailableSkills(): Promise<
    Array<{
      name: string;
      config: SkillConfig;
      source: 'project' | 'user' | 'bundle';
      path: string;
    }>
  > {
    const skills: Array<{
      name: string;
      config: SkillConfig;
      source: 'project' | 'user' | 'bundle';
      path: string;
    }> = [];
    const seen = new Set<string>();

    // Helper to add skills from a directory
    const addSkillsFromDir = async (
      dir: string,
      source: 'project' | 'user' | 'bundle'
    ): Promise<void> => {
      if (!fs.existsSync(dir)) return;

      const files = await fs.promises.readdir(dir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          const name = file.replace('.md', '');
          if (seen.has(name)) continue;

          const filePath = path.join(dir, file);
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const parsed = this.parseSkillFile(content);

          if (parsed) {
            seen.add(name);
            skills.push({
              name,
              config: parsed.config,
              source,
              path: filePath,
            });
          }
        }
      }
    };

    // Project skills
    await addSkillsFromDir(this.projectSkillsDir, 'project');

    // User skills
    await addSkillsFromDir(this.userSkillsDir, 'user');

    // Bundle skills (core + optional)
    await addSkillsFromDir(path.join(this.bundleSkillsDir, 'core'), 'bundle');
    await addSkillsFromDir(path.join(this.bundleSkillsDir, 'optional'), 'bundle');

    return skills;
  }

  /**
   * List skills by category
   */
  async listSkillsByCategory(): Promise<{
    core: Array<{ name: string; config: SkillConfig; source: string }>;
    optional: Array<{ name: string; config: SkillConfig; source: string }>;
  }> {
    const all = await this.listAvailableSkills();

    return {
      core: all.filter((s) => s.config.category === 'core'),
      optional: all.filter((s) => s.config.category === 'optional'),
    };
  }

  /**
   * Copy a skill to project directory
   */
  async copyToProject(
    skillName: string
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      const skill = await this.resolveSkill(skillName);
      if (!skill) {
        return { success: false, error: `Skill not found: ${skillName}` };
      }

      // Ensure project skills directory exists
      await fs.promises.mkdir(this.projectSkillsDir, { recursive: true });

      // Write to project directory
      const destPath = path.join(this.projectSkillsDir, `${skillName}.md`);
      const content = this.reconstructSkillFile(skill.config, skill.body);
      await fs.promises.writeFile(destPath, content, 'utf-8');

      return { success: true, path: destPath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Copy a skill to user directory
   */
  async copyToUser(
    skillName: string
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      const skill = await this.resolveSkill(skillName);
      if (!skill) {
        return { success: false, error: `Skill not found: ${skillName}` };
      }

      // Ensure user skills directory exists
      await fs.promises.mkdir(this.userSkillsDir, { recursive: true });

      // Write to user directory
      const destPath = path.join(this.userSkillsDir, `${skillName}.md`);
      const content = this.reconstructSkillFile(skill.config, skill.body);
      await fs.promises.writeFile(destPath, content, 'utf-8');

      return { success: true, path: destPath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Reconstruct skill file content
   */
  private reconstructSkillFile(config: SkillConfig, body: string): string {
    const yaml = stringifyYaml(config);
    return `---
${yaml.trim()}
---

${body}`;
  }

  /**
   * Create a custom skill
   */
  async createSkill(
    config: SkillConfig,
    body: string,
    destination: 'project' | 'user'
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      // Validate config
      const errors = this.validateSkillConfig(config);
      if (errors.length > 0) {
        return { success: false, error: `Validation errors: ${errors.join(', ')}` };
      }

      const destDir = destination === 'project' ? this.projectSkillsDir : this.userSkillsDir;

      // Ensure directory exists
      await fs.promises.mkdir(destDir, { recursive: true });

      // Write file
      const destPath = path.join(destDir, `${config.name}.md`);
      const content = this.reconstructSkillFile(config, body);
      await fs.promises.writeFile(destPath, content, 'utf-8');

      return { success: true, path: destPath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update an existing skill
   */
  async updateSkill(
    skillName: string,
    updates: { config?: Partial<SkillConfig>; body?: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Find the skill (project or user level only)
      let filePath = path.join(this.projectSkillsDir, `${skillName}.md`);
      if (!fs.existsSync(filePath)) {
        filePath = path.join(this.userSkillsDir, `${skillName}.md`);
      }

      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'Skill not found in project or user directory' };
      }

      // Read current content
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const parsed = this.parseSkillFile(content);

      if (!parsed) {
        return { success: false, error: 'Invalid skill file format' };
      }

      // Merge updates
      const newConfig: SkillConfig = {
        ...parsed.config,
        ...updates.config,
      };
      const newBody = updates.body ?? parsed.body;

      // Validate
      const errors = this.validateSkillConfig(newConfig);
      if (errors.length > 0) {
        return { success: false, error: `Validation errors: ${errors.join(', ')}` };
      }

      // Write back
      const newContent = this.reconstructSkillFile(newConfig, newBody);
      await fs.promises.writeFile(filePath, newContent, 'utf-8');

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Delete a skill (only from project or user level)
   */
  async deleteSkill(skillName: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Try project level first
      let filePath = path.join(this.projectSkillsDir, `${skillName}.md`);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return { success: true };
      }

      // Try user level
      filePath = path.join(this.userSkillsDir, `${skillName}.md`);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return { success: true };
      }

      return { success: false, error: 'Skill not found in project or user directory' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get the source tier of a skill
   */
  async getSkillSource(skillName: string): Promise<'project' | 'user' | 'bundle' | null> {
    const skill = await this.resolveSkill(skillName);
    return skill?.source ?? null;
  }

  /**
   * Check if skill exists in a specific tier
   */
  skillExistsInTier(skillName: string, tier: 'project' | 'user' | 'bundle'): boolean {
    const skillFileName = `${skillName}.md`;

    switch (tier) {
      case 'project':
        return fs.existsSync(path.join(this.projectSkillsDir, skillFileName));
      case 'user':
        return fs.existsSync(path.join(this.userSkillsDir, skillFileName));
      case 'bundle': {
        const corePath = path.join(this.bundleSkillsDir, 'core', skillFileName);
        const optionalPath = path.join(this.bundleSkillsDir, 'optional', skillFileName);
        return fs.existsSync(corePath) || fs.existsSync(optionalPath);
      }
      default:
        return false;
    }
  }

  /**
   * Get all skills grouped by source
   */
  async getAllSkillsGrouped(): Promise<{
    project: Array<{ name: string; config: SkillConfig; path: string }>;
    user: Array<{ name: string; config: SkillConfig; path: string }>;
    bundle: Array<{ name: string; config: SkillConfig; path: string }>;
  }> {
    const result = {
      project: [] as Array<{ name: string; config: SkillConfig; path: string }>,
      user: [] as Array<{ name: string; config: SkillConfig; path: string }>,
      bundle: [] as Array<{ name: string; config: SkillConfig; path: string }>,
    };

    const addSkillsFromDir = async (
      dir: string,
      target: Array<{ name: string; config: SkillConfig; path: string }>
    ): Promise<void> => {
      if (!fs.existsSync(dir)) return;

      const files = await fs.promises.readdir(dir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          const name = file.replace('.md', '');
          const filePath = path.join(dir, file);
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const parsed = this.parseSkillFile(content);

          if (parsed) {
            target.push({
              name,
              config: parsed.config,
              path: filePath,
            });
          }
        }
      }
    };

    // Get skills from each tier (no deduplication - show actual files)
    await addSkillsFromDir(this.projectSkillsDir, result.project);
    await addSkillsFromDir(this.userSkillsDir, result.user);
    await addSkillsFromDir(path.join(this.bundleSkillsDir, 'core'), result.bundle);
    await addSkillsFromDir(path.join(this.bundleSkillsDir, 'optional'), result.bundle);

    return result;
  }

  /**
   * Get directories for external use
   */
  getDirectories(): { project: string; user: string; bundle: string } {
    return {
      project: this.projectSkillsDir,
      user: this.userSkillsDir,
      bundle: this.bundleSkillsDir,
    };
  }

  /**
   * Remove skill from a specific tier
   */
  async removeSkillFromTier(
    skillName: string,
    tier: 'project' | 'user'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const dir = tier === 'project' ? this.projectSkillsDir : this.userSkillsDir;
      const filePath = path.join(dir, `${skillName}.md`);

      if (!fs.existsSync(filePath)) {
        return { success: false, error: `Skill '${skillName}' not found in ${tier} directory` };
      }

      await fs.promises.unlink(filePath);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate skill config
   */
  validateSkillConfig(config: SkillConfig): string[] {
    const errors: string[] = [];

    if (!config.name) {
      errors.push('Missing required field: name');
    }

    if (!config.description) {
      errors.push('Missing required field: description');
    }

    if (!config.category || !['core', 'optional'].includes(config.category)) {
      errors.push('Invalid or missing category. Must be: core or optional');
    }

    if (!config.priority || !['critical', 'high', 'medium', 'low'].includes(config.priority)) {
      errors.push('Invalid or missing priority. Must be: critical, high, medium, or low');
    }

    return errors;
  }
}

// Export singleton instance
let instance: SkillDiscovery | null = null;

export function getSkillDiscovery(options?: SkillDiscoveryOptions): SkillDiscovery {
  if (!instance || options) {
    instance = new SkillDiscovery(options);
  }
  return instance;
}
