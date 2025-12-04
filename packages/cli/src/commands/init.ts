import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { Args, Command, Flags } from '@oclif/core';

import { detectProject } from '../lib/project-detector.js';
import { CommandDiscovery } from '../lib/config/command-discovery.js';
import { PresetLoader, type PresetConfig } from '../lib/preset-loader.js';

export default class Init extends Command {
  static description = 'Initialize SidStack workspace';

  static examples = [
    '<%= config.bin %> init',
    '<%= config.bin %> init /path/to/project',
    '<%= config.bin %> init --project-name my-app',
    '<%= config.bin %> init --preset minimal',
    '<%= config.bin %> init --no-frameworks  # Skip governance and openspec',
    '<%= config.bin %> init --scan  # Scan codebase and generate knowledge docs',
  ];

  static flags = {
    'project-name': Flags.string({
      char: 'n',
      description: 'Project name',
    }),
    preset: Flags.string({
      char: 'p',
      description: 'Use a preset configuration (minimal, fullstack-typescript, typescript-backend, python-data)',
    }),
    'list-presets': Flags.boolean({
      description: 'List available presets and exit',
      default: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Force initialization (overwrite existing)',
      default: false,
    }),
    'no-frameworks': Flags.boolean({
      description: 'Skip governance and openspec (minimal setup)',
      default: false,
    }),
    commands: Flags.string({
      char: 'c',
      description: 'Install commands (all, core, optional, or comma-separated names)',
    }),
    scan: Flags.boolean({
      char: 's',
      description: 'After init, scan codebase with AI to generate knowledge docs',
      default: false,
    }),
    json: Flags.boolean({
      char: 'j',
      description: 'Output in JSON format (agent-friendly)',
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
    const { args, flags } = await this.parse(Init);
    const presetLoader = new PresetLoader();

    // Handle --list-presets
    if (flags['list-presets']) {
      const presets = presetLoader.listPresets();
      if (flags.json) {
        this.log(JSON.stringify({ presets }, null, 2));
      } else {
        this.log('Available presets:');
        this.log('');
        for (const preset of presets) {
          this.log(`  ${preset.name}`);
          this.log(`    ${preset.displayName} - ${preset.description}`);
          this.log(`    Language: ${preset.language}, Type: ${preset.projectType}`);
          this.log(`    Agents: ${preset.agentCount}, Skills: ${preset.skillCount}`);
          this.log('');
        }
      }
      return;
    }

    // Validate preset if provided
    let presetConfig: PresetConfig | null = null;
    if (flags.preset) {
      presetConfig = presetLoader.loadPreset(flags.preset);
      if (!presetConfig) {
        const available = presetLoader.getPresetNames().join(', ');
        this.error(`Unknown preset: ${flags.preset}. Available: ${available}`);
      }
    }

    const projectPath = args.path ? path.resolve(args.path) : process.cwd();
    const projectName = flags['project-name'] || path.basename(projectPath);
    const projectId = randomUUID();
    const sidstackDir = path.join(projectPath, '.sidstack');

    // Check if already initialized
    if (fs.existsSync(sidstackDir) && !flags.force) {
      this.error(`Workspace already initialized at ${projectPath}. Use --force to reinitialize.`);
    }

    this.log(`Initializing SidStack workspace...`);
    this.log(`  Project: ${projectName}`);
    this.log(`  Path: ${projectPath}`);
    this.log('');

    // 1. Create .sidstack directory
    if (!fs.existsSync(sidstackDir)) {
      fs.mkdirSync(sidstackDir, { recursive: true });
    }
    this.log('✓ Created .sidstack/ directory');

    // 2. Create config file
    const config: Record<string, unknown> = {
      projectId,
      projectName,
      projectPath,
      version: '0.1.0',
      createdAt: new Date().toISOString(),
    };

    // Add preset configuration if specified
    if (presetConfig) {
      config.preset = presetConfig.name;
      config.agents = presetConfig.agents;
      config.skills = presetConfig.skills;
      config.defaults = presetConfig.defaults;
      config.recommended = presetConfig.recommended;
    }

    fs.writeFileSync(
      path.join(sidstackDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );
    this.log('✓ Created config.json');

    // Log preset info if used
    if (presetConfig) {
      this.log(`  Preset: ${presetConfig.displayName}`);
      this.log(`  Agents: ${Object.keys(presetConfig.agents).join(', ')}`);
    }

    // 3. Create MCP config for Claude Code at project root (.mcp.json)
    // Use local path since @sidstack/mcp-server is not published to npm yet
    const sidstackRoot = path.resolve(__dirname, '../../../../');
    const mcpServerPath = path.join(sidstackRoot, 'packages/mcp-server/dist/index.js');

    const mcpConfig = {
      mcpServers: {
        sidstack: {
          type: 'stdio',
          command: 'node',
          args: [mcpServerPath],
        },
      },
    };

    fs.writeFileSync(
      path.join(projectPath, '.mcp.json'),
      JSON.stringify(mcpConfig, null, 2)
    );
    this.log('✓ Created .mcp.json (Claude Code MCP integration)');

    // 4. Create .claude/settings.local.json to auto-approve MCP servers
    const claudeSettingsDir = path.join(projectPath, '.claude');
    if (!fs.existsSync(claudeSettingsDir)) {
      fs.mkdirSync(claudeSettingsDir, { recursive: true });
    }
    const claudeSettings = {
      enableAllProjectMcpServers: true,
      enabledMcpjsonServers: ['sidstack'],
      disabledMcpjsonServers: [],
    };
    fs.writeFileSync(
      path.join(claudeSettingsDir, 'settings.local.json'),
      JSON.stringify(claudeSettings, null, 2)
    );
    this.log('✓ Created .claude/settings.local.json (MCP auto-approval)');

    // 5. Create directory structure
    const docsDir = path.join(projectPath, 'docs');
    const logsDir = path.join(projectPath, 'logs');

    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    this.log('✓ Created docs/ and logs/ directories');

    // 6. Update .gitignore
    this.updateGitignore(projectPath);

    // 7. Detect project type
    this.log('');
    this.log('Analyzing project...');
    const projectInfo = detectProject(projectPath);

    if (projectInfo.isNew) {
      this.log(`✓ Detected: New project (${projectInfo.type})`);
      if (projectInfo.hasPrd) {
        this.log(`✓ Found PRD: ${projectInfo.prdPath}`);
      }
    } else {
      this.log(`✓ Detected: Existing codebase`);
      this.log(`  Tech: ${projectInfo.techStack?.language || 'Unknown'} / ${projectInfo.techStack?.framework || 'Unknown'}`);
      this.log(`  Files: ${projectInfo.detectedFiles.join(', ')}`);
    }

    // 7. Install frameworks (governance + openspec by default)
    const installedFrameworks: string[] = [];

    if (!flags['no-frameworks']) {
      this.log('');
      this.log('Installing OpenSpec...');
      this.initOpenSpec(projectPath, projectName);
      installedFrameworks.push('OpenSpec');

      this.log('');
      this.log('Installing Governance...');
      this.initGovernance(projectPath);
      installedFrameworks.push('Governance');
    }

    // 8. Handle --commands flag (independent of governance)
    if (flags.commands && flags['no-frameworks']) {
      this.log('');
      this.log('Installing commands...');
      const installedCount = await this.installCommands(projectPath, flags.commands);
      if (installedCount > 0) {
        this.log(`✓ Installed ${installedCount} command(s)`);
      }
    }

    // Done - output result
    if (flags.json) {
      // JSON output for agents
      const result = {
        success: true,
        projectId,
        projectName,
        projectPath,
        preset: presetConfig?.name || null,
        frameworks: installedFrameworks,
        agents: presetConfig ? Object.keys(presetConfig.agents) : [],
        recommended: presetConfig?.recommended || {},
      };
      this.log(JSON.stringify(result, null, 2));
      return;
    }

    this.log('');
    this.log('═══════════════════════════════════════════════════════════════');
    this.log('✅ SidStack workspace initialized!');
    this.log('═══════════════════════════════════════════════════════════════');
    this.log('');
    if (presetConfig) {
      this.log(`Preset: ${presetConfig.displayName}`);
      this.log(`  Language: ${presetConfig.language}`);
      this.log(`  Agents: ${Object.keys(presetConfig.agents).join(', ')}`);
      this.log('');
    }
    if (installedFrameworks.length > 0) {
      this.log(`Installed: ${installedFrameworks.join(', ')}`);
      this.log('');
    }

    // Launch Claude session
    if (flags.scan) {
      await this.launchScanSession(projectPath);
    } else if (!flags['no-frameworks']) {
      await this.launchOnboardingSession(projectPath, projectName, installedFrameworks);
    } else {
      this.logNextSteps(installedFrameworks, presetConfig);
    }
  }

  private async launchOnboardingSession(
    projectPath: string,
    _projectName: string,
    _installedFrameworks: string[]
  ): Promise<void> {
    this.log('Opening Claude Code with SidStack onboarding...');
    this.log('');

    const initialPrompt = 'Read CLAUDE.md and .sidstack/governance.md only. Then give me a concise welcome to SidStack: what was installed, the 3 agent roles, and key slash commands. Do NOT explore or scan the codebase.';

    return new Promise((resolve) => {
      const claude = spawn('claude', [initialPrompt], {
        cwd: projectPath,
        stdio: 'inherit',
      });

      claude.on('error', () => {
        this.log('Could not start Claude Code. Make sure `claude` is installed.');
        this.log('');
        this.logNextSteps(['governance'], null);
        resolve();
      });

      claude.on('close', () => {
        resolve();
      });
    });
  }

  private async launchScanSession(projectPath: string): Promise<void> {
    // Ensure .sidstack/knowledge/ directories exist
    const knowledgeDir = path.join(projectPath, '.sidstack', 'knowledge');
    for (const sub of ['modules', 'api', 'database', 'business-logic', 'patterns']) {
      fs.mkdirSync(path.join(knowledgeDir, sub), { recursive: true });
    }

    this.log('Launching AI-powered knowledge scan...');
    this.log('Claude Code will analyze your codebase and generate knowledge docs.');
    this.log('');

    // Read the scan prompt from the skill file (check target project first, then source)
    const targetSkillPath = path.join(projectPath, '.sidstack/skills/knowledge/scan-project.md');
    const sidstackRoot = path.resolve(__dirname, '../../../../');
    const sourceSkillPath = path.join(sidstackRoot, '.sidstack/skills/knowledge/scan-project.md');
    const skillPath = fs.existsSync(targetSkillPath) ? targetSkillPath : sourceSkillPath;

    let scanPrompt: string;
    if (fs.existsSync(skillPath)) {
      const content = fs.readFileSync(skillPath, 'utf-8');
      // Extract prompt after the second --- (YAML frontmatter delimiter)
      const parts = content.split('---');
      // parts[0] is empty (before first ---), parts[1] is frontmatter, parts[2+] is content
      scanPrompt = parts.slice(2).join('---').trim();
    } else {
      // Fallback inline prompt if skill file not found
      scanPrompt = 'Scan this project and generate structured knowledge documentation in .sidstack/knowledge/. Explore the codebase using Glob, Grep, and Read tools. Create markdown docs with YAML frontmatter for: project structure, API endpoints, database schema, business logic, and design patterns. Be concise - max 10-15 docs.';
    }

    return new Promise((resolve) => {
      const claude = spawn('claude', [scanPrompt], {
        cwd: projectPath,
        stdio: 'inherit',
      });

      claude.on('error', () => {
        this.log('Could not start Claude Code. Make sure `claude` is installed.');
        this.log('');
        this.log('You can run the scan manually later:');
        this.log('  claude "Scan this project and generate .sidstack/knowledge/ docs"');
        resolve();
      });

      claude.on('close', (code) => {
        if (code === 0) {
          this.log('');
          this.log('Knowledge scan complete! Check .sidstack/knowledge/ for generated docs.');
        }
        resolve();
      });
    });
  }

  private logNextSteps(
    selectedFrameworks: string[],
    presetConfig: PresetConfig | null
  ): void {
    this.log('Next steps:');
    this.log('  1. Start Agent Manager app');
    this.log('  2. Open terminal as orchestrator');
    this.log('  3. Use MCP tools to spawn agents');
    let stepNum = 4;
    if (selectedFrameworks.includes('openspec')) {
      this.log(`  ${stepNum}. Create specs in openspec/specs/`);
      stepNum++;
      this.log(`  ${stepNum}. Use /openspec:proposal to create changes`);
      stepNum++;
    }
    if (selectedFrameworks.includes('governance')) {
      this.log(`  ${stepNum}. Use /sidstack:agent [role] [task] to spawn governed agents`);
      stepNum++;
      this.log(`  ${stepNum}. Read .sidstack/governance.md for governance overview`);
      stepNum++;
    }
    if (presetConfig?.recommended && Object.keys(presetConfig.recommended).length > 0) {
      this.log('');
      this.log('Recommended tools for this preset:');
      for (const [key, value] of Object.entries(presetConfig.recommended)) {
        this.log(`  ${key}: ${value}`);
      }
    }
    this.log('');
  }

  private initOpenSpec(projectPath: string, projectName: string): void {
    const openspecDir = path.join(projectPath, 'openspec');
    const changesDir = path.join(openspecDir, 'changes');
    const archiveDir = path.join(changesDir, 'archive');
    const specsDir = path.join(openspecDir, 'specs');

    // Create directories
    fs.mkdirSync(archiveDir, { recursive: true });
    fs.mkdirSync(specsDir, { recursive: true });
    this.log('✓ Created openspec/ directory structure');

    // Create AGENTS.md
    const agentsMd = `# OpenSpec Instructions

Instructions for AI coding assistants using OpenSpec for spec-driven development.

## Quick Start

\`\`\`bash
# List active changes
openspec list

# Show a change or spec
openspec show [item]

# Validate changes
openspec validate [item] --strict

# Archive after deployment
openspec archive <change-id>
\`\`\`

## Workflow

### 1. Creating Changes
Create a proposal when you need to:
- Add features or functionality
- Make breaking changes
- Change architecture or patterns

\`\`\`bash
mkdir -p openspec/changes/add-feature-name/specs
\`\`\`

### 2. Proposal Structure
\`\`\`
openspec/changes/[change-id]/
├── proposal.md     # Why and what
├── tasks.md        # Implementation checklist
├── design.md       # Technical decisions (optional)
└── specs/          # Delta changes
    └── [capability]/
        └── spec.md # ADDED/MODIFIED/REMOVED
\`\`\`

### 3. Spec Delta Format
\`\`\`markdown
## ADDED Requirements
### Requirement: Feature Name
The system SHALL...

#### Scenario: Success case
- **WHEN** action happens
- **THEN** expected result
\`\`\`

## Directory Structure
\`\`\`
openspec/
├── AGENTS.md       # This file
├── project.md      # Project context
├── specs/          # Current truth - what IS built
└── changes/        # Proposals - what SHOULD change
    └── archive/    # Completed changes
\`\`\`

## Best Practices
- Default to simple solutions (<100 lines)
- One capability per spec
- Always validate before implementing
- Archive changes after deployment
`;

    fs.writeFileSync(path.join(openspecDir, 'AGENTS.md'), agentsMd);
    this.log('✓ Created AGENTS.md');

    // Create project.md
    const projectMd = `# Project Context

## Purpose
${projectName} - [Add project description here]

## Tech Stack
- [Add technologies]

## Conventions
- [Add coding conventions]

## Constraints
- [Add constraints]
`;

    fs.writeFileSync(path.join(openspecDir, 'project.md'), projectMd);
    this.log('✓ Created project.md');

    // Create .gitkeep in archive and specs
    fs.writeFileSync(path.join(archiveDir, '.gitkeep'), '');
    fs.writeFileSync(path.join(specsDir, '.gitkeep'), '');
    this.log('✓ Created placeholder files');
  }

  private initGovernance(projectPath: string): void {
    const sidstackRoot = path.resolve(__dirname, '../../../../');
    const templatesDir = path.join(sidstackRoot, 'packages/cli/templates/governance');

    // Copy .sidstack directory
    const sourceSidstack = path.join(templatesDir, '.sidstack');
    const targetSidstack = path.join(projectPath, '.sidstack');

    this.copyDirectorySync(sourceSidstack, targetSidstack);
    this.log('✓ Created .sidstack/ governance structure');

    // Update version.json with actual values
    const versionFile = path.join(targetSidstack, 'version.json');
    const versionContent = fs.readFileSync(versionFile, 'utf-8');
    const now = new Date().toISOString();
    const updatedVersion = versionContent
      .replace('{{SIDSTACK_VERSION}}', '0.1.0')
      .replace('{{INITIALIZED_AT}}', now)
      .replace('{{UPDATED_AT}}', now);
    fs.writeFileSync(versionFile, updatedVersion);
    this.log('✓ Created version.json');

    // Copy .claude/commands/sidstack directory
    const sourceCommands = path.join(templatesDir, '.claude/commands/sidstack');
    const targetCommands = path.join(projectPath, '.claude/commands/sidstack');

    // Ensure .claude/commands exists
    fs.mkdirSync(path.dirname(targetCommands), { recursive: true });
    this.copyDirectorySync(sourceCommands, targetCommands);
    this.log('✓ Created .claude/commands/sidstack/ (slash commands)');

    // Copy .claude/hooks directory
    const sourceHooks = path.join(templatesDir, '.claude/hooks');
    const targetHooks = path.join(projectPath, '.claude/hooks');
    if (fs.existsSync(sourceHooks)) {
      this.copyDirectorySync(sourceHooks, targetHooks);
      // Make hook scripts executable
      const hookFiles = fs.readdirSync(targetHooks);
      for (const file of hookFiles) {
        if (file.endsWith('.sh')) {
          fs.chmodSync(path.join(targetHooks, file), 0o755);
        }
      }
      this.log('✓ Created .claude/hooks/ (session hooks)');
    }

    // Copy .claude/settings.json (Claude Code hooks config)
    const sourceSettings = path.join(templatesDir, '.claude/settings.json');
    const targetSettings = path.join(projectPath, '.claude/settings.json');
    if (fs.existsSync(sourceSettings)) {
      // Merge with existing settings if present
      let settings: Record<string, unknown> = {};
      if (fs.existsSync(targetSettings)) {
        try {
          settings = JSON.parse(fs.readFileSync(targetSettings, 'utf-8'));
        } catch {
          // Ignore parse errors, overwrite
        }
      }
      const sourceSettingsContent = JSON.parse(fs.readFileSync(sourceSettings, 'utf-8'));
      // Merge hooks (source takes precedence)
      settings.hooks = { ...((settings.hooks as Record<string, unknown>) || {}), ...sourceSettingsContent.hooks };
      fs.writeFileSync(targetSettings, JSON.stringify(settings, null, 2));
      this.log('✓ Created .claude/settings.json (Claude Code hooks)');
    }

    // Copy .claude/scripts directory
    const sourceScripts = path.join(templatesDir, '.claude/scripts');
    const targetScripts = path.join(projectPath, '.claude/scripts');
    if (fs.existsSync(sourceScripts)) {
      this.copyDirectorySync(sourceScripts, targetScripts);
      // Make scripts executable
      const scriptFiles = fs.readdirSync(targetScripts);
      for (const file of scriptFiles) {
        if (file.endsWith('.sh')) {
          fs.chmodSync(path.join(targetScripts, file), 0o755);
        }
      }
      this.log('✓ Created .claude/scripts/ (helper scripts)');
    }

    // Create or merge CLAUDE.md
    const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
    const templateFile = path.join(templatesDir, 'CLAUDE.md.template');

    if (!fs.existsSync(claudeMdPath)) {
      // Case A: No CLAUDE.md exists - create from template
      if (fs.existsSync(templateFile)) {
        const projectName = path.basename(projectPath);
        const template = fs.readFileSync(templateFile, 'utf-8');
        const content = template.replace(/\{projectName\}/g, projectName);
        fs.writeFileSync(claudeMdPath, content);
        this.log('✓ Created CLAUDE.md with SidStack governance instructions');
      }
    } else {
      // Case B: CLAUDE.md exists - append SidStack section if not present
      const existingContent = fs.readFileSync(claudeMdPath, 'utf-8');
      if (!existingContent.includes('## SidStack Governance')) {
        const template = fs.readFileSync(templateFile, 'utf-8');
        const sectionStart = template.indexOf('## SidStack Governance');
        const governanceSection = sectionStart >= 0 ? template.substring(sectionStart) : template;
        const separator = existingContent.endsWith('\n') ? '\n' : '\n\n';
        fs.writeFileSync(claudeMdPath, existingContent + separator + governanceSection);
        this.log('✓ Appended SidStack Governance section to existing CLAUDE.md');
      } else {
        this.log('✓ CLAUDE.md already has SidStack Governance section');
      }
    }

    // Log summary
    this.log('');
    this.log('Governance installed:');
    this.log('  Principles: code-quality, testing, security, collaboration');
    this.log('  Skills: implement-feature, fix-bug, test-feature, verify-fix, handoff, code-review');
    this.log('  Workflows: new-feature');
    this.log('  Commands: /sidstack, /sidstack:agent, /sidstack:knowledge');
    this.log('  Hooks: SessionStart, PreCompact (context persistence)');
    this.log('  Scripts: .claude/scripts/open-claude-session.sh (auto-detect terminal)');
  }

  private copyDirectorySync(source: string, target: string): void {
    if (!fs.existsSync(source)) {
      throw new Error(`Source directory not found: ${source}`);
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

  private updateGitignore(projectPath: string): void {
    const gitignorePath = path.join(projectPath, '.gitignore');

    const sidstackIgnores = `
# SidStack
.sidstack/
.mcp.json
logs/
.claude/settings.local.json
.claude/context-state.json
`;

    if (fs.existsSync(gitignorePath)) {
      // Check if already has SidStack section
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      if (content.includes('# SidStack')) {
        this.log('✓ .gitignore already has SidStack entries');
        return;
      }
      // Append to existing .gitignore
      fs.appendFileSync(gitignorePath, sidstackIgnores);
      this.log('✓ Updated .gitignore with SidStack entries');
    } else {
      // Create new .gitignore
      fs.writeFileSync(gitignorePath, sidstackIgnores.trim() + '\n');
      this.log('✓ Created .gitignore with SidStack entries');
    }
  }

  private async installCommands(projectPath: string, commandsArg: string): Promise<number> {
    const discovery = new CommandDiscovery({ projectDir: projectPath });
    const bundleCommands = await discovery.getCommandsFromSource('bundle');

    let commandsToInstall: string[] = [];

    if (commandsArg === 'all') {
      commandsToInstall = bundleCommands.map((c) => c.config.name.split(': ').pop()?.toLowerCase().replace(/\s+/g, '-') || '');
    } else if (commandsArg === 'core') {
      commandsToInstall = bundleCommands
        .filter((c) => c.config.category === 'core')
        .map((c) => c.config.name.split(': ').pop()?.toLowerCase().replace(/\s+/g, '-') || '');
    } else if (commandsArg === 'optional') {
      commandsToInstall = bundleCommands
        .filter((c) => c.config.category === 'optional')
        .map((c) => c.config.name.split(': ').pop()?.toLowerCase().replace(/\s+/g, '-') || '');
    } else {
      // Comma-separated list of command names
      commandsToInstall = commandsArg.split(',').map((c) => c.trim());
    }

    let installedCount = 0;
    for (const cmdName of commandsToInstall) {
      if (!cmdName) continue;
      const cmd = await discovery.resolveCommand(cmdName);
      if (cmd && cmd.source === 'bundle') {
        try {
          await discovery.copyToProject(cmdName);
          this.log(`  ✓ ${cmdName}`);
          installedCount++;
        } catch {
          this.log(`  ✗ ${cmdName}: Failed to copy`);
        }
      } else if (!cmd) {
        this.log(`  ✗ ${cmdName}: Not found`);
      }
    }

    return installedCount;
  }
}
