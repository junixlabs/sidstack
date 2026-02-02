import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { Args, Command, Flags } from '@oclif/core';

import { detectProject } from '../lib/project-detector.js';
import { checkPrerequisites } from '../lib/prerequisites.js';
import { runInitWizard } from '../lib/init-prompts.js';
import { verifyInit } from '../lib/init-verify.js';
import { PresetLoader, type PresetConfig } from '../lib/preset-loader.js';
import { resolveTemplatesDir, resolveSkillsDir } from '../lib/resolve-paths.js';

export default class Init extends Command {
  static description = 'Initialize SidStack workspace';

  static examples = [
    '<%= config.bin %> init',
    '<%= config.bin %> init /path/to/project',
    '<%= config.bin %> init -n my-app --preset minimal',
    '<%= config.bin %> init --scan',
    '<%= config.bin %> init --json --force',
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

    const projectPath = args.path ? path.resolve(args.path) : process.cwd();

    // Prerequisites check
    if (!flags.json) {
      this.log('SidStack - Project Intelligence Setup');
      this.log('======================================');
      this.log('');
      this.log('Checking prerequisites...');
    }

    const prereqs = checkPrerequisites(projectPath);

    if (!flags.json) {
      for (const r of prereqs.results) {
        const icon = r.status === 'ok' ? '✓' : r.status === 'warn' ? '⚠' : '✗';
        this.log(`  ${icon} ${r.message}`);
        if (r.suggestion && r.status !== 'ok') {
          this.log(`    ${r.suggestion}`);
        }
      }
      this.log('');
    }

    if (!prereqs.canProceed) {
      this.error('Prerequisites check failed. Fix the errors above and try again.');
    }

    // Detect interactive mode: TTY with no explicit flags
    const isInteractive = !!(
      process.stdout.isTTY &&
      !flags.json &&
      !flags.preset &&
      !flags.scan &&
      !flags['project-name']
    );

    // Detect project early (needed for wizard)
    const projectInfo = detectProject(projectPath);

    // Resolve init parameters — either from wizard or flags
    let projectName: string;
    let presetConfig: PresetConfig | null = null;
    let installGovernance = true;
    let installOpenSpec = true;
    let runScan = flags.scan;

    if (isInteractive) {
      // Interactive wizard
      if (!flags.json) {
        this.log('Analyzing project...');
        if (projectInfo.isNew) {
          this.log(`  Detected: New project (${projectInfo.type})`);
        } else {
          this.log(`  Detected: ${projectInfo.techStack?.language || 'Unknown'} / ${projectInfo.techStack?.framework || 'Unknown'} (existing project)`);
        }
        this.log('');
      }

      const wizardResult = await runInitWizard(
        projectPath,
        path.basename(projectPath),
        projectInfo,
        prereqs.claudeAvailable
      );

      if (wizardResult.cancelled) {
        this.log('Init cancelled.');
        return;
      }

      projectName = wizardResult.projectName;
      installGovernance = wizardResult.installGovernance;
      installOpenSpec = wizardResult.installOpenSpec;
      runScan = wizardResult.runScan;

      if (wizardResult.preset) {
        presetConfig = presetLoader.loadPreset(wizardResult.preset);
      }
    } else {
      // Non-interactive: use flags
      projectName = flags['project-name'] || path.basename(projectPath);

      if (flags.preset) {
        presetConfig = presetLoader.loadPreset(flags.preset);
        if (!presetConfig) {
          const available = presetLoader.getPresetNames().join(', ');
          this.error(`Unknown preset: ${flags.preset}. Available: ${available}`);
        }
      }
    }

    const projectId = randomUUID();
    const sidstackDir = path.join(projectPath, '.sidstack');

    // Check if already initialized
    if (fs.existsSync(sidstackDir) && !flags.force) {
      this.error(`Workspace already initialized at ${projectPath}. Use --force to reinitialize.`);
    }

    if (!flags.json) {
      this.log(`Initializing SidStack workspace...`);
      this.log(`  Project: ${projectName}`);
      this.log(`  Path: ${projectPath}`);
      this.log('');
    }

    // Clean up old version artifacts when --force
    if (flags.force && fs.existsSync(sidstackDir)) {
      this.cleanupOldVersion(projectPath);
    }

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
      version: this.config.version,
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
    const mcpConfig = {
      mcpServers: {
        sidstack: {
          command: 'npx',
          args: ['-y', '@sidstack/mcp-server'],
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

    // 7. Log project detection (non-interactive already showed this above)
    if (!isInteractive && !flags.json) {
      this.log('');
      this.log('Analyzing project...');
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
    }

    // 8. Install frameworks based on resolved settings
    const installedFrameworks: string[] = [];

    if (installOpenSpec) {
      this.log('');
      this.log('Installing OpenSpec...');
      this.initOpenSpec(projectPath, projectName);
      installedFrameworks.push('OpenSpec');
    }

    if (installGovernance) {
      this.log('');
      this.log('Installing Governance...');
      this.initGovernance(projectPath);
      installedFrameworks.push('Governance');
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

    // Post-init verification
    this.log('');
    this.log('Verifying installation...');
    const verification = verifyInit(projectPath, {
      governance: installGovernance,
      openspec: installOpenSpec,
    });

    for (const check of verification.checks) {
      const icon = check.passed ? '✓' : '✗';
      this.log(`  ${icon} ${check.message}`);
    }

    this.log('');
    this.log('════════════════════════════════════════');
    this.log('  SidStack initialized!');
    this.log('════════════════════════════════════════');
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

    // Launch Claude session or show completion guide
    if (runScan) {
      await this.launchScanSession(projectPath);
    } else if (installGovernance) {
      await this.launchOnboardingSession(projectPath, projectName, installedFrameworks);
    } else {
      this.logCompletionGuide(prereqs.claudeAvailable);
    }
  }

  private async launchOnboardingSession(
    projectPath: string,
    _projectName: string,
    _installedFrameworks: string[]
  ): Promise<void> {
    this.log('Starting interactive onboarding with Claude Code...');
    this.log('Claude will interview you about your project and set up the Project Hub.');
    this.log('');

    const initialPrompt = `You are the SidStack onboarding assistant. SidStack was just initialized in this project.

## Your Role
Guide the user through discovering SidStack features. Interview them about their project to generate meaningful data for the Project Hub. Be conversational — ask questions, use MCP tools, and create files.

## Phase 1: Welcome
1. Read CLAUDE.md and .sidstack/config.json to get the project name and path.
2. Welcome the user. Briefly list what was installed: governance system (principles, skills, hooks), OpenSpec, MCP tools (32 tools for tasks, knowledge, impact, tickets, training, OKRs).
3. Ask: "I'd like to learn about your project so I can set up the Project Hub with your business domains. Ready to get started?"
   - If user says skip/no → jump to Phase 3.

## Phase 2: Business Logic Discovery
Interview the user to understand their project structure. Use their answers to generate capability YAML files.

### Questions to ask (one at a time, conversational):
1. "What are the 2-4 main domains or areas of your project? For example: Authentication, Payments, Dashboard, API..."
2. For each domain: "What's the main goal of [domain]?" (becomes the purpose field)
3. For each domain: "Any key business rules? For example: 'All payments must be idempotent' or 'Users must verify email before checkout'" (becomes businessRules)
4. "How do these domains relate to each other? Which ones depend on others?" (becomes relationships)

### Generate capability files:
After collecting answers, create .sidstack/capabilities/ YAML files using the Write tool:

**L0 root (project-level):**
\`\`\`yaml
id: {project-name}
name: {Project Name}
level: L0
purpose: {user's project description or detected from README}
status: active
maturity: developing
tags:
  - project
\`\`\`

**L1 per domain:**
\`\`\`yaml
id: {domain-id}
name: {Domain Name}
level: L1
parent: {project-name}
purpose: {user's answer about this domain's goal}
status: active
maturity: developing
modules:
  - {domain-id}
businessRules:
  - {rule 1 from user}
  - {rule 2 from user}
relationships:
  dependsOn:
    - {dependencies from user's answers}
tags:
  - {project-name}
\`\`\`

Tell the user: "I've created your Project Hub capability map. Open the SidStack app (Cmd+1) to see your project domains."

## Phase 3: Seed Data
Use MCP tools to create starter data. Ask before each action.

1. **Task Management** — "Let me create your first task."
   → Use task_create with projectId = folder name (read from .sidstack/config.json), title "[docs] Review and customize project governance", relevant acceptance criteria.

2. **Knowledge System** — "Let me show the knowledge system."
   → Use knowledge_list with projectPath.
   → If existing codebase: "Want me to scan your codebase to generate knowledge docs? It helps future sessions understand your project faster."

3. **Ticket Queue** — "I'll create a sample ticket to demo the intake queue."
   → Use ticket_create with a relevant customization ticket.

4. **Governance** — "Let me show what rules apply here."
   → Use rule_check with projectPath, moduleId from one of the domains created above, role "dev", taskType "feature".

5. **OKRs** — "Let me check project OKRs."
   → Use okr_list with projectPath.

## Phase 4: Feature Tour
Briefly explain remaining features:
- **Impact Analysis**: impact_analyze before risky changes — shows scope, risks, validation checklist
- **Training Room**: Lessons auto-suggested after complex debugging — captures problem, root cause, solution
- **Session Manager**: session_launch for parallel Claude sessions in external terminals
- **Slash Commands**: /sidstack (hub), /sidstack:agent worker [task] (spawn governed agent), /sidstack:knowledge build (generate knowledge)
- **Desktop App**: 7 views — Project Hub (Cmd+1), Task Manager (Cmd+2), Knowledge Browser (Cmd+3), Ticket Queue (Cmd+4), Training Room (Cmd+5), Settings (Cmd+,)

Ask: "What would you like to work on first?"

## Rules
- Be conversational. Ask one question at a time.
- Always ask before creating data or files. If user says "skip", move on.
- Use the folder name as projectId for MCP tool calls (read from .sidstack/config.json).
- For capability YAML files, use the Write tool to create files in .sidstack/capabilities/.
- Keep explanations concise — show by doing, don't lecture.
- If user seems impatient, offer to skip ahead at any point.`;

    return new Promise((resolve) => {
      const claude = spawn('claude', [initialPrompt], {
        cwd: projectPath,
        stdio: 'inherit',
      });

      claude.on('error', () => {
        this.log('Could not start Claude Code. Make sure `claude` is installed.');
        this.log('');
        this.logCompletionGuide(false);
        resolve();
      });

      claude.on('close', () => {
        this.log('');
        this.log('To continue working with SidStack, run: claude');
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

    // Read the scan prompt from the skill file (check target project first, then bundled)
    const targetSkillPath = path.join(projectPath, '.sidstack/skills/knowledge/scan-project.md');
    const bundledSkillPath = resolveSkillsDir(__dirname, 'knowledge', 'scan-project.md');
    const skillPath = fs.existsSync(targetSkillPath) ? targetSkillPath : bundledSkillPath;

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

  private logCompletionGuide(claudeAvailable: boolean): void {
    this.log('What to do next:');
    this.log('');
    if (claudeAvailable) {
      this.log('  1. Open Claude Code:        claude');
      this.log('  2. Try a command:           /sidstack status');
      this.log('  3. View governance:         cat .sidstack/governance.md');
      this.log('  4. Generate knowledge:      sidstack init --scan');
    } else {
      this.log('  1. Install Claude Code:     npm i -g @anthropic-ai/claude-code');
      this.log('  2. Then start it:           claude');
      this.log('  3. View governance:         cat .sidstack/governance.md');
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
    const templatesDir = resolveTemplatesDir(__dirname, 'governance');

    // Copy .sidstack directory
    const sourceSidstack = path.join(templatesDir, '.sidstack');
    const targetSidstack = path.join(projectPath, '.sidstack');

    this.copyDirectorySync(sourceSidstack, targetSidstack);
    this.log('✓ Created .sidstack/ governance structure');

    // Replace template placeholders in .sidstack files
    const now = new Date().toISOString();
    const replacePlaceholders = (filePath: string) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('{{SIDSTACK_VERSION}}') || content.includes('{{INITIALIZED_AT}}')) {
        const updated = content
          .replace(/\{\{SIDSTACK_VERSION\}\}/g, this.config.version)
          .replace(/\{\{INITIALIZED_AT\}\}/g, now)
          .replace(/\{\{UPDATED_AT\}\}/g, now);
        fs.writeFileSync(filePath, updated);
      }
    };

    replacePlaceholders(path.join(targetSidstack, 'version.json'));
    replacePlaceholders(path.join(targetSidstack, 'governance.md'));
    this.log('✓ Created version.json');

    // Copy .claude/commands/ (sidstack.md hub + sidstack/ subcommands)
    const commandsDir = path.join(projectPath, '.claude/commands');
    fs.mkdirSync(commandsDir, { recursive: true });

    // Copy hub command: sidstack.md -> /sidstack
    const sourceHub = path.join(templatesDir, '.claude/commands/sidstack.md');
    if (fs.existsSync(sourceHub)) {
      fs.copyFileSync(sourceHub, path.join(commandsDir, 'sidstack.md'));
    }

    // Copy subcommands: sidstack/agent.md, sidstack/knowledge.md
    const sourceCommands = path.join(templatesDir, '.claude/commands/sidstack');
    const targetCommands = path.join(commandsDir, 'sidstack');
    this.copyDirectorySync(sourceCommands, targetCommands);
    this.log('✓ Created .claude/commands/ (3 slash commands: /sidstack, :agent, :knowledge)');

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
    this.log('  Principles: task-management, code-quality, testing, security, collaboration, quality-gates');
    this.log('  Skills: implement (4), design (3), test (3), review (3), deploy (2), shared (2), knowledge (1)');
    this.log('  Workflows: new-feature');
    this.log('  Commands: /sidstack (hub), /sidstack:agent, /sidstack:knowledge');
    this.log('  Hooks: SessionStart, PreCompact, UserPromptSubmit, PreToolUse, PostToolUse');
    this.log('  Scripts: .claude/scripts/open-claude-session.sh (auto-detect terminal)');
  }

  private cleanupOldVersion(projectPath: string): void {
    this.log('Cleaning up previous version...');

    // Directories managed entirely by SidStack (safe to remove and recreate)
    const managedDirs = [
      path.join(projectPath, '.sidstack', 'principles'),
      path.join(projectPath, '.sidstack', 'skills'),
      path.join(projectPath, '.sidstack', 'workflows'),
      path.join(projectPath, '.claude', 'hooks'),
      path.join(projectPath, '.claude', 'commands', 'sidstack'),
      path.join(projectPath, '.claude', 'scripts'),
    ];

    // Files managed by SidStack (hub command)
    const managedFiles = [
      path.join(projectPath, '.claude', 'commands', 'sidstack.md'),
    ];

    for (const dir of managedDirs) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }

    for (const file of managedFiles) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }

    // Remove settings.json hooks (will be recreated from template)
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

    this.log('✓ Cleaned up old version artifacts');
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

}
