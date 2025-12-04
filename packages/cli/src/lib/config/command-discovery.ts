/**
 * CommandDiscovery - 3-tier configuration lookup for Claude Code slash commands
 *
 * Lookup priority:
 * 1. Project-level: .claude/commands/sidstack/ in the current project
 * 2. User-level: ~/.sidstack/commands/ (shared across all projects)
 * 3. CLI Bundle: packages/cli/templates/commands/ (built-in defaults)
 *
 * Commands are Claude Code slash commands (e.g., /sidstack:knowledge)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export interface CommandConfig {
  name: string;
  description: string;
  category: 'core' | 'optional';
  version?: string;
  tags?: string[];
}

export interface ResolvedCommand {
  config: CommandConfig;
  body: string;
  source: 'project' | 'user' | 'bundle';
  sourcePath: string;
}

export interface CommandDiscoveryOptions {
  projectDir?: string;
  userDir?: string;
  bundleDir?: string;
}

export class CommandDiscovery {
  private projectCommandsDir: string;
  private userCommandsDir: string;
  private bundleCommandsDir: string;

  constructor(options: CommandDiscoveryOptions = {}) {
    const projectDir = options.projectDir || process.cwd();
    const userDir = options.userDir || path.join(process.env.HOME || '', '.sidstack');
    const bundleDir = options.bundleDir || path.join(__dirname, '../../../templates/commands');

    this.projectCommandsDir = path.join(projectDir, '.claude', 'commands', 'sidstack');
    this.userCommandsDir = path.join(userDir, 'commands');
    this.bundleCommandsDir = bundleDir;
  }

  /**
   * Parse a command file and extract config
   */
  private parseCommandFile(content: string): { config: CommandConfig; body: string } | null {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!frontmatterMatch) {
      return null;
    }

    try {
      const rawConfig = parseYaml(frontmatterMatch[1]) as Record<string, unknown>;
      const body = frontmatterMatch[2].trim();

      // Normalize category (handle 'SidStack' -> 'optional')
      let category: 'core' | 'optional' = 'optional';
      if (rawConfig.category === 'core') {
        category = 'core';
      }

      const config: CommandConfig = {
        name: (rawConfig.name as string) || '',
        description: (rawConfig.description as string) || '',
        category,
        version: (rawConfig.version as string) || '1.0.0',
        tags: (rawConfig.tags as string[]) || [],
      };

      return { config, body };
    } catch {
      return null;
    }
  }

  /**
   * Resolve a command with 3-tier lookup
   */
  async resolveCommand(commandName: string): Promise<ResolvedCommand | null> {
    const commandFileName = `${commandName}.md`;

    // Priority 1: Project-level
    const projectCommand = await this.loadFromDirectory(
      this.projectCommandsDir,
      commandFileName,
      'project'
    );
    if (projectCommand) {
      return projectCommand;
    }

    // Priority 2: User-level
    const userCommand = await this.loadFromDirectory(
      this.userCommandsDir,
      commandFileName,
      'user'
    );
    if (userCommand) {
      return userCommand;
    }

    // Priority 3: Bundle (check both core and optional)
    const bundleCommand = await this.loadFromBundle(commandName);
    if (bundleCommand) {
      return bundleCommand;
    }

    return null;
  }

  /**
   * Load command from a directory
   */
  private async loadFromDirectory(
    directory: string,
    fileName: string,
    source: 'project' | 'user' | 'bundle'
  ): Promise<ResolvedCommand | null> {
    const filePath = path.join(directory, fileName);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const parsed = this.parseCommandFile(content);

      if (!parsed) {
        console.warn(`Invalid command file format: ${filePath}`);
        return null;
      }

      return {
        config: parsed.config,
        body: parsed.body,
        source,
        sourcePath: filePath,
      };
    } catch (error) {
      console.warn(`Failed to load command from ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Load command from bundle (core or optional)
   */
  private async loadFromBundle(commandName: string): Promise<ResolvedCommand | null> {
    const commandFileName = `${commandName}.md`;

    // Try core directory first
    const corePath = path.join(this.bundleCommandsDir, 'core', commandFileName);
    if (fs.existsSync(corePath)) {
      return this.loadFromDirectory(path.dirname(corePath), commandFileName, 'bundle');
    }

    // Try optional directory
    const optionalPath = path.join(this.bundleCommandsDir, 'optional', commandFileName);
    if (fs.existsSync(optionalPath)) {
      return this.loadFromDirectory(path.dirname(optionalPath), commandFileName, 'bundle');
    }

    return null;
  }

  /**
   * List all available commands across all tiers
   */
  async listAvailableCommands(): Promise<
    Array<{
      name: string;
      config: CommandConfig;
      source: 'project' | 'user' | 'bundle';
      path: string;
    }>
  > {
    const commands: Array<{
      name: string;
      config: CommandConfig;
      source: 'project' | 'user' | 'bundle';
      path: string;
    }> = [];
    const seen = new Set<string>();

    // Helper to add commands from a directory
    const addCommandsFromDir = async (
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
          const parsed = this.parseCommandFile(content);

          if (parsed) {
            seen.add(name);
            commands.push({
              name,
              config: parsed.config,
              source,
              path: filePath,
            });
          }
        }
      }
    };

    // Project commands
    await addCommandsFromDir(this.projectCommandsDir, 'project');

    // User commands
    await addCommandsFromDir(this.userCommandsDir, 'user');

    // Bundle commands (core + optional)
    await addCommandsFromDir(path.join(this.bundleCommandsDir, 'core'), 'bundle');
    await addCommandsFromDir(path.join(this.bundleCommandsDir, 'optional'), 'bundle');

    return commands;
  }

  /**
   * Get all commands grouped by source
   */
  async getAllCommandsGrouped(): Promise<{
    project: Array<{ name: string; config: CommandConfig; path: string }>;
    user: Array<{ name: string; config: CommandConfig; path: string }>;
    bundle: Array<{ name: string; config: CommandConfig; path: string }>;
  }> {
    const result = {
      project: [] as Array<{ name: string; config: CommandConfig; path: string }>,
      user: [] as Array<{ name: string; config: CommandConfig; path: string }>,
      bundle: [] as Array<{ name: string; config: CommandConfig; path: string }>,
    };

    const addCommandsFromDir = async (
      dir: string,
      target: Array<{ name: string; config: CommandConfig; path: string }>
    ): Promise<void> => {
      if (!fs.existsSync(dir)) return;

      const files = await fs.promises.readdir(dir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          const name = file.replace('.md', '');
          const filePath = path.join(dir, file);
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const parsed = this.parseCommandFile(content);

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

    // Get commands from each tier (no deduplication - show actual files)
    await addCommandsFromDir(this.projectCommandsDir, result.project);
    await addCommandsFromDir(this.userCommandsDir, result.user);
    await addCommandsFromDir(path.join(this.bundleCommandsDir, 'core'), result.bundle);
    await addCommandsFromDir(path.join(this.bundleCommandsDir, 'optional'), result.bundle);

    return result;
  }

  /**
   * Check if command exists in a specific tier
   */
  commandExistsInTier(commandName: string, tier: 'project' | 'user' | 'bundle'): boolean {
    const commandFileName = `${commandName}.md`;

    switch (tier) {
      case 'project':
        return fs.existsSync(path.join(this.projectCommandsDir, commandFileName));
      case 'user':
        return fs.existsSync(path.join(this.userCommandsDir, commandFileName));
      case 'bundle': {
        const corePath = path.join(this.bundleCommandsDir, 'core', commandFileName);
        const optionalPath = path.join(this.bundleCommandsDir, 'optional', commandFileName);
        return fs.existsSync(corePath) || fs.existsSync(optionalPath);
      }
      default:
        return false;
    }
  }

  /**
   * Copy a command to project directory
   */
  async copyToProject(
    commandName: string
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      const command = await this.resolveCommand(commandName);
      if (!command) {
        return { success: false, error: `Command not found: ${commandName}` };
      }

      // Ensure project commands directory exists
      await fs.promises.mkdir(this.projectCommandsDir, { recursive: true });

      // Write to project directory
      const destPath = path.join(this.projectCommandsDir, `${commandName}.md`);
      const content = this.reconstructCommandFile(command.config, command.body);
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
   * Copy a command to user directory
   */
  async copyToUser(
    commandName: string
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      const command = await this.resolveCommand(commandName);
      if (!command) {
        return { success: false, error: `Command not found: ${commandName}` };
      }

      // Ensure user commands directory exists
      await fs.promises.mkdir(this.userCommandsDir, { recursive: true });

      // Write to user directory
      const destPath = path.join(this.userCommandsDir, `${commandName}.md`);
      const content = this.reconstructCommandFile(command.config, command.body);
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
   * Remove command from a specific tier
   */
  async removeCommandFromTier(
    commandName: string,
    tier: 'project' | 'user'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const dir = tier === 'project' ? this.projectCommandsDir : this.userCommandsDir;
      const filePath = path.join(dir, `${commandName}.md`);

      if (!fs.existsSync(filePath)) {
        return { success: false, error: `Command '${commandName}' not found in ${tier} directory` };
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
   * Get bundle commands only (for listing what can be added)
   */
  async getBundleCommands(): Promise<
    Array<{ name: string; config: CommandConfig; path: string; category: 'core' | 'optional' }>
  > {
    const commands: Array<{
      name: string;
      config: CommandConfig;
      path: string;
      category: 'core' | 'optional';
    }> = [];

    const addCommandsFromDir = async (
      dir: string,
      category: 'core' | 'optional'
    ): Promise<void> => {
      if (!fs.existsSync(dir)) return;

      const files = await fs.promises.readdir(dir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          const name = file.replace('.md', '');
          const filePath = path.join(dir, file);
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const parsed = this.parseCommandFile(content);

          if (parsed) {
            // Override category based on directory
            parsed.config.category = category;
            commands.push({
              name,
              config: parsed.config,
              path: filePath,
              category,
            });
          }
        }
      }
    };

    await addCommandsFromDir(path.join(this.bundleCommandsDir, 'core'), 'core');
    await addCommandsFromDir(path.join(this.bundleCommandsDir, 'optional'), 'optional');

    return commands;
  }

  /**
   * Reconstruct command file content
   */
  private reconstructCommandFile(config: CommandConfig, body: string): string {
    const yamlConfig: Record<string, unknown> = {
      name: config.name,
      description: config.description,
      category: config.category,
      version: config.version || '1.0.0',
    };
    if (config.tags && config.tags.length > 0) {
      yamlConfig.tags = config.tags;
    }

    const yaml = stringifyYaml(yamlConfig);
    return `---
${yaml.trim()}
---

${body}`;
  }

  /**
   * Get directories for external use
   */
  getDirectories(): { project: string; user: string; bundle: string } {
    return {
      project: this.projectCommandsDir,
      user: this.userCommandsDir,
      bundle: this.bundleCommandsDir,
    };
  }

  /**
   * Get commands from a specific source
   */
  async getCommandsFromSource(
    source: 'project' | 'user' | 'bundle'
  ): Promise<ResolvedCommand[]> {
    const grouped = await this.getAllCommandsGrouped();
    const sourceCommands = grouped[source];

    return sourceCommands.map((cmd) => ({
      config: cmd.config,
      body: '', // Not loading body for efficiency
      source,
      sourcePath: cmd.path,
    }));
  }

  /**
   * Check for updates (compare project/user versions with bundle)
   */
  async checkForUpdates(): Promise<
    Array<{
      name: string;
      currentVersion: string;
      bundleVersion: string;
      source: 'project' | 'user';
      needsUpdate: boolean;
    }>
  > {
    const updates: Array<{
      name: string;
      currentVersion: string;
      bundleVersion: string;
      source: 'project' | 'user';
      needsUpdate: boolean;
    }> = [];

    const bundleCommands = await this.getBundleCommands();
    const bundleVersions = new Map(bundleCommands.map((c) => [c.name, c.config.version || '1.0.0']));

    // Check project commands
    const projectCommands = (await this.getAllCommandsGrouped()).project;
    for (const cmd of projectCommands) {
      const bundleVersion = bundleVersions.get(cmd.name);
      if (bundleVersion) {
        const currentVersion = cmd.config.version || '1.0.0';
        updates.push({
          name: cmd.name,
          currentVersion,
          bundleVersion,
          source: 'project',
          needsUpdate: this.compareVersions(currentVersion, bundleVersion) < 0,
        });
      }
    }

    // Check user commands
    const userCommands = (await this.getAllCommandsGrouped()).user;
    for (const cmd of userCommands) {
      const bundleVersion = bundleVersions.get(cmd.name);
      if (bundleVersion) {
        const currentVersion = cmd.config.version || '1.0.0';
        // Skip if already checked in project
        if (!updates.find((u) => u.name === cmd.name)) {
          updates.push({
            name: cmd.name,
            currentVersion,
            bundleVersion,
            source: 'user',
            needsUpdate: this.compareVersions(currentVersion, bundleVersion) < 0,
          });
        }
      }
    }

    return updates;
  }

  /**
   * Compare semantic versions (returns -1 if a < b, 0 if equal, 1 if a > b)
   */
  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const numA = partsA[i] || 0;
      const numB = partsB[i] || 0;
      if (numA < numB) return -1;
      if (numA > numB) return 1;
    }
    return 0;
  }
}

// Export singleton instance
let instance: CommandDiscovery | null = null;

export function getCommandDiscovery(options?: CommandDiscoveryOptions): CommandDiscovery {
  if (!instance || options) {
    instance = new CommandDiscovery(options);
  }
  return instance;
}
