import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { Args, Command, Flags } from '@oclif/core';

import { resolveTemplatesDir } from '../lib/resolve-paths.js';

// Versions are read from this.config.version (oclif reads package.json) at runtime.
// No hardcoded version constants - prevents drift between package.json and code.

interface SidStackConfig {
  projectId: string;
  projectName: string;
  projectPath: string;
  version: string;
  createdAt: string;
  updatedAt?: string;
}

interface GovernanceVersion {
  version: string;
  sidstackVersion: string;
  initializedAt: string;
  updatedAt: string;
}

export default class Update extends Command {
  static description = 'Update existing SidStack project to latest version';

  static examples = [
    '<%= config.bin %> update',
    '<%= config.bin %> update /path/to/project',
    '<%= config.bin %> update --governance',
    '<%= config.bin %> update --governance-only',
  ];

  static flags = {
    governance: Flags.boolean({
      char: 'g',
      description: 'Update governance files (if installed)',
      default: false,
    }),
    'governance-only': Flags.boolean({
      description: 'Only update governance, skip other updates',
      default: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Force update even if versions match',
      default: false,
    }),
  };

  static args = {
    path: Args.string({
      description: 'Project path (defaults to current directory)',
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Update);

    const projectPath = args.path ? path.resolve(args.path) : process.cwd();
    const sidstackDir = path.join(projectPath, '.sidstack');
    const configPath = path.join(sidstackDir, 'config.json');
    const versionPath = path.join(sidstackDir, 'version.json');

    // Check governance status
    const hasGovernance = fs.existsSync(versionPath);
    const governanceOnly = flags['governance-only'];
    const updateGovernance = flags.governance || governanceOnly || hasGovernance;

    // For governance-only mode, we don't need config.json
    if (!governanceOnly) {
      // Check if project is initialized
      if (!fs.existsSync(configPath)) {
        this.error(`No SidStack project found at ${projectPath}. Run 'sidstack init' first.`);
      }
    }

    // For governance-only, check if governance is installed
    if (governanceOnly && !hasGovernance) {
      this.error(`Governance not installed at ${projectPath}. Run 'sidstack init --governance' first.`);
    }

    this.log(`\n🔄 SidStack Update`);
    this.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    if (!governanceOnly && fs.existsSync(configPath)) {
      // Read existing config
      const config: SidStackConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

      this.log(`  Project: ${config.projectName}`);
      this.log(`  Version: ${config.version} → ${this.config.version}`);
      this.log('');

      // 1. Update config.json
      this.log('📋 Updating configuration...');
      const updatedConfig = {
        ...config,
        version: this.config.version,
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));
      this.log('  ✓ config.json updated');

      // 2. Update .mcp.json
      this.log('\n📦 Updating MCP configuration...');
      const mcpPath = path.join(projectPath, '.mcp.json');
      this.updateMcpConfig(mcpPath);
      this.log('  ✓ .mcp.json updated');

      // 3. Update .claude/settings.local.json
      this.log('\n⚙️  Updating Claude settings...');
      const settingsPath = path.join(projectPath, '.claude', 'settings.local.json');
      this.ensureClaudeSettings(settingsPath);
      this.log('  ✓ Claude settings updated');

      // 4. Update CLAUDE.md with Claude session
      this.log('\n📄 Updating CLAUDE.md...');
      const claudeMdPath = path.join(projectPath, 'CLAUDE.md');

      if (!fs.existsSync(claudeMdPath)) {
        // No CLAUDE.md, generate new
        const content = this.getClaudeMdTemplate(config.projectName, projectPath);
        fs.writeFileSync(claudeMdPath, content);
        this.log('  ✓ CLAUDE.md created');
      } else {
        // Spawn Claude to merge updates
        this.log('  🤖 Spawning Claude to update CLAUDE.md...\n');
        await this.spawnClaudeForUpdate(projectPath, mcpPath, config.projectName);
      }
    }

    // 5. Update Governance (if installed)
    if (updateGovernance && hasGovernance) {
      this.log('\n📜 Updating Governance...');
      const updated = this.updateGovernance(projectPath, flags.force);
      if (updated) {
        this.log('  ✓ Governance updated to v' + this.config.version);
      } else {
        this.log('  ✓ Governance already up to date');
      }
    } else if (updateGovernance && !hasGovernance) {
      this.log('\n📜 Governance not installed (use --governance with init to install)');
    }

    this.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.log('✅ Update Complete!');
    this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  private updateMcpConfig(mcpPath: string): void {
    const sidstackServer = {
      command: 'npx',
      args: ['-y', '@sidstack/mcp-server@latest'],
    };

    let mcpConfig: any = { mcpServers: {} };

    if (fs.existsSync(mcpPath)) {
      try {
        mcpConfig = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
        mcpConfig.mcpServers = mcpConfig.mcpServers || {};
      } catch {
        // Reset if malformed
      }
    }

    mcpConfig.mcpServers.sidstack = sidstackServer;
    fs.writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2));
  }

  private ensureClaudeSettings(settingsPath: string): void {
    const settingsDir = path.dirname(settingsPath);
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }

    let settings: any = {
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: ['sidstack'],
      disabledMcpjsonServers: [],
    };

    if (fs.existsSync(settingsPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        if (!settings.enabledMcpjsonServers?.includes('sidstack')) {
          settings.enabledMcpjsonServers = settings.enabledMcpjsonServers || [];
          settings.enabledMcpjsonServers.push('sidstack');
        }
      } catch {
        // Reset if malformed
      }
    }

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  }

  private spawnClaudeForUpdate(
    projectPath: string,
    _mcpConfigPath: string,
    projectName: string
  ): Promise<void> {
    return new Promise((resolve) => {
      // Write new template to temp file for Claude to read
      const newTemplate = this.getClaudeMdTemplate(projectName, projectPath);
      const tempPath = path.join(projectPath, '.sidstack', 'claude-md-update.md');
      fs.writeFileSync(tempPath, newTemplate);

      const prompt = 'Read CLAUDE.md and .sidstack/claude-md-update.md. Merge the new template into CLAUDE.md: keep all existing user content, update or add the SidStack Governance section from the template. Then delete .sidstack/claude-md-update.md. Report what changed.';

      this.log('  Opening Claude Code to merge CLAUDE.md...');

      const claude = spawn('claude', [prompt], {
        cwd: projectPath,
        stdio: 'inherit',
      });

      claude.on('error', (err) => {
        this.warn(`Could not start Claude: ${err.message}`);
        this.log('  You can manually merge .sidstack/claude-md-update.md into CLAUDE.md');
        resolve();
      });

      claude.on('close', () => {
        // Clean up temp file if Claude didn't
        try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
        resolve();
      });
    });
  }

  private getClaudeMdTemplate(projectName: string, _projectPath: string): string {
    const templatePath = path.join(resolveTemplatesDir(__dirname, 'governance'), 'CLAUDE.md.template');

    try {
      if (fs.existsSync(templatePath)) {
        const template = fs.readFileSync(templatePath, 'utf-8');
        return template.replace(/\{projectName\}/g, projectName);
      }
    } catch { /* use fallback */ }

    return `# ${projectName} - Claude Code Instructions

## SidStack Governance

This project uses SidStack governance for AI agent quality.

### Agent Roles
- **Orchestrator**: Task breakdown and delegation only
- **Worker**: All implementation (features, bugs, design, tests, docs)
- **Reviewer**: Independent verification (code review, security audit)

### Quality Gates (MANDATORY before completing any task)
\`\`\`bash
pnpm typecheck   # 0 errors
pnpm lint        # 0 errors
pnpm test        # All pass
\`\`\`

### Slash Commands
| Command | Description |
|---------|-------------|
| \`/sidstack:agent worker [task]\` | Spawn governed Worker |
| \`/sidstack:agent reviewer [task]\` | Spawn Reviewer |
| \`/sidstack governance\` | View governance overview |
| \`/sidstack:knowledge build\` | Build knowledge docs |
`;
  }

  /**
   * Update governance files from templates
   * Returns true if files were updated, false if already up to date
   */
  private updateGovernance(projectPath: string, force: boolean): boolean {
    const versionPath = path.join(projectPath, '.sidstack', 'version.json');

    // Read current version
    let currentVersion: GovernanceVersion;
    try {
      currentVersion = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
    } catch {
      this.warn('Could not read governance version, will update all files');
      currentVersion = {
        version: '0.0.0',
        sidstackVersion: '0.0.0',
        initializedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // Check if update is needed
    if (!force && currentVersion.sidstackVersion === this.config.version) {
      return false;
    }

    this.log(`  Current: v${currentVersion.sidstackVersion}`);
    this.log(`  Latest:  v${this.config.version}`);

    // Step 1: Cleanup old managed files before copying new ones
    this.cleanupManagedFiles(projectPath);

    // Get templates directory
    const templatesDir = resolveTemplatesDir(__dirname, 'governance');

    if (!fs.existsSync(templatesDir)) {
      this.warn(`Templates directory not found: ${templatesDir}`);
      return false;
    }

    // Update .sidstack directory
    const sourceSidstack = path.join(templatesDir, '.sidstack');
    const targetSidstack = path.join(projectPath, '.sidstack');

    // Update managed subdirectories (analysis only — principles/skills/workflows were removed as dead docs)
    const subdirs = ['analysis'];
    for (const subdir of subdirs) {
      const sourceSubdir = path.join(sourceSidstack, subdir);
      const targetSubdir = path.join(targetSidstack, subdir);

      if (fs.existsSync(sourceSubdir)) {
        this.copyDirectorySync(sourceSubdir, targetSubdir);
        this.log(`  ✓ Updated .sidstack/${subdir}/`);
      }
    }

    // Update additional governance files (training-templates.json, project-profile.template.yaml)
    const additionalFiles = ['training-templates.json', 'project-profile.template.yaml'];
    for (const file of additionalFiles) {
      const sourceFile = path.join(sourceSidstack, file);
      const targetFile = path.join(targetSidstack, file);
      if (fs.existsSync(sourceFile)) {
        fs.copyFileSync(sourceFile, targetFile);
      }
    }

    // Update .claude/commands/sidstack.md hub file (FIX: was missing)
    const sourceHubCommand = path.join(templatesDir, '.claude/commands/sidstack.md');
    const targetHubCommand = path.join(projectPath, '.claude/commands/sidstack.md');
    if (fs.existsSync(sourceHubCommand)) {
      fs.mkdirSync(path.dirname(targetHubCommand), { recursive: true });
      fs.copyFileSync(sourceHubCommand, targetHubCommand);
      this.log('  ✓ Updated .claude/commands/sidstack.md');
    }

    // Update .claude/commands/sidstack/ directory
    const sourceCommands = path.join(templatesDir, '.claude/commands/sidstack');
    const targetCommands = path.join(projectPath, '.claude/commands/sidstack');

    if (fs.existsSync(sourceCommands)) {
      fs.mkdirSync(path.dirname(targetCommands), { recursive: true });
      this.copyDirectorySync(sourceCommands, targetCommands);
      this.log('  ✓ Updated .claude/commands/sidstack/');
    }

    // Update .claude/hooks directory (API-integrated hooks)
    const sourceHooks = path.join(templatesDir, '.claude/hooks');
    const targetHooks = path.join(projectPath, '.claude/hooks');

    if (fs.existsSync(sourceHooks)) {
      fs.mkdirSync(targetHooks, { recursive: true });
      this.copyDirectorySync(sourceHooks, targetHooks);
      // Make hooks executable
      const hookFiles = fs.readdirSync(targetHooks);
      for (const hookFile of hookFiles) {
        const hookPath = path.join(targetHooks, hookFile);
        if (hookFile.endsWith('.sh')) {
          fs.chmodSync(hookPath, 0o755);
        }
      }
      this.log('  ✓ Updated .claude/hooks/');
    }

    // Update .claude/scripts directory (FIX: was missing)
    const sourceScripts = path.join(templatesDir, '.claude/scripts');
    const targetScripts = path.join(projectPath, '.claude/scripts');

    if (fs.existsSync(sourceScripts)) {
      fs.mkdirSync(targetScripts, { recursive: true });
      this.copyDirectorySync(sourceScripts, targetScripts);
      // Make scripts executable
      const scriptFiles = fs.readdirSync(targetScripts);
      for (const scriptFile of scriptFiles) {
        const scriptPath = path.join(targetScripts, scriptFile);
        if (scriptFile.endsWith('.sh')) {
          fs.chmodSync(scriptPath, 0o755);
        }
      }
      this.log('  ✓ Updated .claude/scripts/');
    }

    // Update .claude/skills/ from templates/skills/sidstack/ (FIX: was copying wrong source)
    const sidstackSkillsSource = resolveTemplatesDir(__dirname, 'skills/sidstack');
    const targetSkillsDir = path.join(projectPath, '.claude/skills');

    if (fs.existsSync(sidstackSkillsSource)) {
      fs.mkdirSync(targetSkillsDir, { recursive: true });
      const skillDirs = fs.readdirSync(sidstackSkillsSource, { withFileTypes: true });
      let copiedCount = 0;
      for (const entry of skillDirs) {
        if (entry.isDirectory()) {
          const skillSourceDir = path.join(sidstackSkillsSource, entry.name);
          const skillTargetDir = path.join(targetSkillsDir, entry.name);
          this.copyDirectorySync(skillSourceDir, skillTargetDir);
          copiedCount++;
        }
      }
      if (copiedCount > 0) {
        this.log(`  ✓ Updated .claude/skills/ (${copiedCount} auto-trigger skills)`);
      }
    }

    // Update .claude/settings.json (hook configuration)
    const sourceSettings = path.join(templatesDir, '.claude/settings.json');
    const targetSettings = path.join(projectPath, '.claude/settings.json');

    if (fs.existsSync(sourceSettings)) {
      // Merge with existing settings if present
      let settings: Record<string, unknown> = {};
      if (fs.existsSync(targetSettings)) {
        try {
          settings = JSON.parse(fs.readFileSync(targetSettings, 'utf-8'));
        } catch { /* ignore parse errors */ }
      }

      // Read template settings
      const templateSettings = JSON.parse(fs.readFileSync(sourceSettings, 'utf-8'));

      // Merge hooks (template takes precedence for hook definitions)
      settings.hooks = templateSettings.hooks;

      fs.writeFileSync(targetSettings, JSON.stringify(settings, null, 2));
      this.log('  ✓ Updated .claude/settings.json');
    }

    // Update governance.md from template
    const sourceGovernance = path.join(sourceSidstack, 'governance.md');
    const targetGovernance = path.join(targetSidstack, 'governance.md');
    if (fs.existsSync(sourceGovernance)) {
      fs.copyFileSync(sourceGovernance, targetGovernance);
      this.log('  ✓ Updated governance.md');
    }

    // Replace template placeholders in updated files
    const now = new Date().toISOString();
    const replacePlaceholders = (filePath: string) => {
      if (!fs.existsSync(filePath)) return;
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('{{SIDSTACK_VERSION}}') || content.includes('{{INITIALIZED_AT}}')) {
        const updated = content
          .replace(/\{\{SIDSTACK_VERSION\}\}/g, this.config.version)
          .replace(/\{\{INITIALIZED_AT\}\}/g, currentVersion.initializedAt)
          .replace(/\{\{UPDATED_AT\}\}/g, now);
        fs.writeFileSync(filePath, updated);
      }
    };
    replacePlaceholders(targetGovernance);
    replacePlaceholders(versionPath);

    // Update version.json
    const updatedVersion: GovernanceVersion = {
      version: currentVersion.version,
      sidstackVersion: this.config.version,
      initializedAt: currentVersion.initializedAt,
      updatedAt: now,
    };
    fs.writeFileSync(versionPath, JSON.stringify(updatedVersion, null, 2));

    return true;
  }

  /**
   * Clean up old managed files before updating to prevent conflicts
   * Only removes SidStack-managed files, preserves user customizations
   */
  private cleanupManagedFiles(projectPath: string): void {
    // Directories managed entirely by SidStack (safe to remove and recreate)
    const managedDirs = [
      path.join(projectPath, '.claude', 'hooks'),
      path.join(projectPath, '.claude', 'commands', 'sidstack'),
      path.join(projectPath, '.claude', 'scripts'),
    ];

    // SidStack-managed skill folders (current + legacy for cleanup)
    const managedSkillDirs = [
      // Current skills
      path.join(projectPath, '.claude', 'skills', 'sidstack-aware'),
      path.join(projectPath, '.claude', 'skills', 'sidstack-dev'),
      // Legacy skills (cleaned up on update)
      path.join(projectPath, '.claude', 'skills', 'sidstack-implement'),
      path.join(projectPath, '.claude', 'skills', 'sidstack-review'),
      path.join(projectPath, '.claude', 'skills', 'sidstack-e2e-test'),
      path.join(projectPath, '.claude', 'skills', 'sidstack-knowledge-first'),
      path.join(projectPath, '.claude', 'skills', 'sidstack-impact-safe'),
      path.join(projectPath, '.claude', 'skills', 'sidstack-lesson-detector'),
      path.join(projectPath, '.claude', 'skills', 'sidstack-training-context'),
    ];

    // Files managed by SidStack
    const managedFiles = [
      path.join(projectPath, '.claude', 'commands', 'sidstack.md'),
    ];

    // Remove managed directories
    for (const dir of managedDirs) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }

    // Remove SidStack-managed skills only (preserve user's custom skills)
    for (const skillDir of managedSkillDirs) {
      if (fs.existsSync(skillDir)) {
        fs.rmSync(skillDir, { recursive: true, force: true });
      }
    }

    // Remove managed files
    for (const file of managedFiles) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }

    // Remove hooks from settings.json (will be recreated from template)
    const settingsPath = path.join(projectPath, '.claude', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        delete settings.hooks;
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      } catch {
        // Corrupt file, will be overwritten
      }
    }
  }

  /**
   * Recursively copy a directory
   */
  private copyDirectorySync(source: string, target: string): void {
    if (!fs.existsSync(source)) {
      return;
    }

    fs.mkdirSync(target, { recursive: true });

    const entries = fs.readdirSync(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const targetPath = path.join(target, entry.name);

      if (entry.isDirectory()) {
        this.copyDirectorySync(sourcePath, targetPath);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }
}
