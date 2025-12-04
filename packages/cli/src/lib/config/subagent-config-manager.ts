/**
 * SubagentConfigManager - 3-tier configuration lookup for agent templates
 *
 * Lookup priority:
 * 1. Project-level: .claude/agents/ in the current project
 * 2. User-level: ~/.sidstack/agents/ (shared across all projects)
 * 3. CLI Bundle: packages/cli/templates/agents/ (built-in defaults)
 *
 * Supports variant selection based on language and project type.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { AgentConfig, parseAgentFile, validateAgentConfig } from './migrate-agents.js';

export interface ResolvedAgentConfig {
  config: AgentConfig;
  body: string;
  source: 'project' | 'user' | 'bundle';
  sourcePath: string;
}

export interface VariantSelection {
  language?: 'typescript' | 'go' | 'python';
  projectType?: 'backend-api' | 'microservices' | 'data-pipeline' | 'fullstack';
}

export interface SubagentConfigManagerOptions {
  projectDir?: string;
  userDir?: string;
  bundleDir?: string;
}

export class SubagentConfigManager {
  private projectAgentsDir: string;
  private userAgentsDir: string;
  private bundleAgentsDir: string;

  constructor(options: SubagentConfigManagerOptions = {}) {
    const projectDir = options.projectDir || process.cwd();
    const userDir = options.userDir || path.join(process.env.HOME || '', '.sidstack');
    const bundleDir =
      options.bundleDir || path.join(__dirname, '../../../templates/agents');

    this.projectAgentsDir = path.join(projectDir, '.claude', 'agents');
    this.userAgentsDir = path.join(userDir, 'agents');
    this.bundleAgentsDir = bundleDir;
  }

  /**
   * Resolve an agent configuration with 3-tier lookup
   */
  async resolveAgent(
    agentType: string,
    variant?: VariantSelection
  ): Promise<ResolvedAgentConfig | null> {
    const agentFileName = `${agentType}-agent.md`;

    // Priority 1: Project-level
    const projectConfig = await this.loadFromDirectory(
      this.projectAgentsDir,
      agentFileName,
      'project'
    );
    if (projectConfig) {
      return projectConfig;
    }

    // Priority 2: User-level
    const userConfig = await this.loadFromDirectory(this.userAgentsDir, agentFileName, 'user');
    if (userConfig) {
      return userConfig;
    }

    // Priority 3: Bundle with variant support
    return this.loadFromBundle(agentType, variant);
  }

  /**
   * Load agent config from a directory
   */
  private async loadFromDirectory(
    directory: string,
    fileName: string,
    source: 'project' | 'user' | 'bundle'
  ): Promise<ResolvedAgentConfig | null> {
    const filePath = path.join(directory, fileName);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const parsed = parseAgentFile(content);

      if (!parsed) {
        console.warn(`Invalid agent file format: ${filePath}`);
        return null;
      }

      return {
        config: parsed.config,
        body: parsed.body,
        source,
        sourcePath: filePath,
      };
    } catch (error) {
      console.warn(`Failed to load agent from ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Load agent config from bundle with variant resolution
   */
  private async loadFromBundle(
    agentType: string,
    variant?: VariantSelection
  ): Promise<ResolvedAgentConfig | null> {
    const agentFileName = `${agentType}-agent.md`;

    // Try variant paths in order of specificity
    const variantPaths: string[] = [];

    // Most specific: project type + language variant
    if (variant?.projectType && variant?.language) {
      variantPaths.push(
        path.join(
          this.bundleAgentsDir,
          'variants',
          'project-types',
          variant.projectType,
          agentFileName
        )
      );
    }

    // Project type variant
    if (variant?.projectType) {
      variantPaths.push(
        path.join(
          this.bundleAgentsDir,
          'variants',
          'project-types',
          variant.projectType,
          agentFileName
        )
      );
    }

    // Language variant
    if (variant?.language) {
      variantPaths.push(
        path.join(this.bundleAgentsDir, 'variants', variant.language, agentFileName)
      );
    }

    // Base template (fallback)
    variantPaths.push(path.join(this.bundleAgentsDir, 'base', agentFileName));

    // Try each path in order
    for (const variantPath of variantPaths) {
      if (fs.existsSync(variantPath)) {
        const result = await this.loadFromDirectory(
          path.dirname(variantPath),
          path.basename(variantPath),
          'bundle'
        );
        if (result) {
          return result;
        }
      }
    }

    return null;
  }

  /**
   * List all available agents across all tiers
   */
  async listAvailableAgents(): Promise<
    Array<{
      name: string;
      source: 'project' | 'user' | 'bundle';
      path: string;
    }>
  > {
    const agents: Array<{
      name: string;
      source: 'project' | 'user' | 'bundle';
      path: string;
    }> = [];
    const seen = new Set<string>();

    // Project-level agents
    if (fs.existsSync(this.projectAgentsDir)) {
      const files = await fs.promises.readdir(this.projectAgentsDir);
      for (const file of files) {
        if (file.endsWith('-agent.md')) {
          const name = file.replace('.md', '');
          if (!seen.has(name)) {
            seen.add(name);
            agents.push({
              name,
              source: 'project',
              path: path.join(this.projectAgentsDir, file),
            });
          }
        }
      }
    }

    // User-level agents
    if (fs.existsSync(this.userAgentsDir)) {
      const files = await fs.promises.readdir(this.userAgentsDir);
      for (const file of files) {
        if (file.endsWith('-agent.md')) {
          const name = file.replace('.md', '');
          if (!seen.has(name)) {
            seen.add(name);
            agents.push({
              name,
              source: 'user',
              path: path.join(this.userAgentsDir, file),
            });
          }
        }
      }
    }

    // Bundle base agents
    const basePath = path.join(this.bundleAgentsDir, 'base');
    if (fs.existsSync(basePath)) {
      const files = await fs.promises.readdir(basePath);
      for (const file of files) {
        if (file.endsWith('-agent.md')) {
          const name = file.replace('.md', '');
          if (!seen.has(name)) {
            seen.add(name);
            agents.push({
              name,
              source: 'bundle',
              path: path.join(basePath, file),
            });
          }
        }
      }
    }

    return agents;
  }

  /**
   * List available variants for an agent
   */
  async listVariants(agentType: string): Promise<
    Array<{
      variant: string;
      path: string;
    }>
  > {
    const variants: Array<{ variant: string; path: string }> = [];
    const agentFileName = `${agentType}-agent.md`;

    // Language variants
    const languageVariantsDir = path.join(this.bundleAgentsDir, 'variants');
    if (fs.existsSync(languageVariantsDir)) {
      const languages = await fs.promises.readdir(languageVariantsDir);
      for (const lang of languages) {
        if (lang === 'project-types') continue;

        const variantPath = path.join(languageVariantsDir, lang, agentFileName);
        if (fs.existsSync(variantPath)) {
          variants.push({
            variant: `language/${lang}`,
            path: variantPath,
          });
        }
      }
    }

    // Project type variants
    const projectTypesDir = path.join(this.bundleAgentsDir, 'variants', 'project-types');
    if (fs.existsSync(projectTypesDir)) {
      const projectTypes = await fs.promises.readdir(projectTypesDir);
      for (const projectType of projectTypes) {
        const variantPath = path.join(projectTypesDir, projectType, agentFileName);
        if (fs.existsSync(variantPath)) {
          variants.push({
            variant: `project-type/${projectType}`,
            path: variantPath,
          });
        }
      }
    }

    return variants;
  }

  /**
   * Copy an agent template to project directory
   */
  async copyToProject(
    agentType: string,
    variant?: VariantSelection
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      // Resolve the agent
      const resolved = await this.resolveAgent(agentType, variant);
      if (!resolved) {
        return { success: false, error: `Agent not found: ${agentType}` };
      }

      // Ensure project agents directory exists
      await fs.promises.mkdir(this.projectAgentsDir, { recursive: true });

      // Write to project directory
      const destPath = path.join(this.projectAgentsDir, `${agentType}-agent.md`);

      // Reconstruct the file content
      const content = this.reconstructAgentFile(resolved.config, resolved.body);
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
   * Copy an agent template to user directory
   */
  async copyToUser(
    agentType: string,
    variant?: VariantSelection
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      // Resolve the agent
      const resolved = await this.resolveAgent(agentType, variant);
      if (!resolved) {
        return { success: false, error: `Agent not found: ${agentType}` };
      }

      // Ensure user agents directory exists
      await fs.promises.mkdir(this.userAgentsDir, { recursive: true });

      // Write to user directory
      const destPath = path.join(this.userAgentsDir, `${agentType}-agent.md`);

      // Reconstruct the file content
      const content = this.reconstructAgentFile(resolved.config, resolved.body);
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
   * Reconstruct agent file content from config and body
   */
  private reconstructAgentFile(config: AgentConfig, body: string): string {
    // Build YAML frontmatter manually to preserve order
    const yaml = `name: ${config.name}
description: ${config.description}
model: ${config.model}${config.extends ? `\nextends: ${config.extends}` : ''}
tools:
${config.tools.map((t) => `  - ${t}`).join('\n')}
permissionMode: ${config.permissionMode}
skills:
${config.skills.map((s) => `  - ${s}`).join('\n')}
metadata:
${Object.entries(config.metadata)
  .map(([k, v]) => `  ${k}: "${v}"`)
  .join('\n')}`;

    return `---
${yaml}
---

${body}`;
  }

  /**
   * Update agent config in place
   */
  async updateAgentConfig(
    agentType: string,
    updates: Partial<AgentConfig>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // First try project level
      let filePath = path.join(this.projectAgentsDir, `${agentType}-agent.md`);

      if (!fs.existsSync(filePath)) {
        // Try user level
        filePath = path.join(this.userAgentsDir, `${agentType}-agent.md`);
      }

      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'Agent not found in project or user directory' };
      }

      // Read current content
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const parsed = parseAgentFile(content);

      if (!parsed) {
        return { success: false, error: 'Invalid agent file format' };
      }

      // Merge updates
      const newConfig: AgentConfig = {
        ...parsed.config,
        ...updates,
        metadata: {
          ...parsed.config.metadata,
          ...updates.metadata,
        },
      };

      // Validate
      const errors = validateAgentConfig(newConfig);
      if (errors.length > 0) {
        return { success: false, error: `Validation errors: ${errors.join(', ')}` };
      }

      // Write back
      const newContent = this.reconstructAgentFile(newConfig, parsed.body);
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
   * Get the effective configuration for an agent (merging extends)
   */
  async getEffectiveConfig(
    agentType: string,
    variant?: VariantSelection
  ): Promise<ResolvedAgentConfig | null> {
    const resolved = await this.resolveAgent(agentType, variant);
    if (!resolved) return null;

    // If config extends another, merge them
    if (resolved.config.extends) {
      const basePath = resolved.config.extends;

      // Load base config (always from bundle)
      const baseFilePath = path.join(this.bundleAgentsDir, `${basePath}.md`);
      if (fs.existsSync(baseFilePath)) {
        const baseContent = await fs.promises.readFile(baseFilePath, 'utf-8');
        const baseParsed = parseAgentFile(baseContent);

        if (baseParsed) {
          // Merge: variant overrides base
          resolved.config = {
            ...baseParsed.config,
            ...resolved.config,
            tools: resolved.config.tools || baseParsed.config.tools,
            skills: resolved.config.skills || baseParsed.config.skills,
            metadata: {
              ...baseParsed.config.metadata,
              ...resolved.config.metadata,
            },
          };
          delete resolved.config.extends;
        }
      }
    }

    return resolved;
  }
}

// Export singleton instance
let instance: SubagentConfigManager | null = null;

export function getSubagentConfigManager(
  options?: SubagentConfigManagerOptions
): SubagentConfigManager {
  if (!instance || options) {
    instance = new SubagentConfigManager(options);
  }
  return instance;
}
