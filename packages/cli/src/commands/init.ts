import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { Args, Command, Flags } from '@oclif/core';

import { detectProject } from '../lib/project-detector.js';
import { checkPrerequisites } from '../lib/prerequisites.js';
import { runInitWizard, type SetupMode } from '../lib/init-prompts.js';
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
    let setupMode: SetupMode = 'custom';
    let runScan = flags.scan;

    if (isInteractive) {
      // Interactive wizard
      if (!flags.json) {
        this.log('Analyzing project...');
        if (projectInfo.isNew) {
          this.log(`  Detected: New project (${projectInfo.type})`);
        } else {
          const lang = projectInfo.techStack?.language || 'Unknown';
          const framework = projectInfo.techStack?.framework || 'Unknown';
          this.log(`  Detected: ${lang} / ${framework} (existing project)`);
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
      setupMode = wizardResult.setupMode;
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

    // 8. Install Governance system (always installed)
    this.log('');
    this.log('Installing Governance...');
    this.initGovernance(projectPath);

    // Done - output result
    if (flags.json) {
      // JSON output for agents
      const result = {
        success: true,
        projectId,
        projectName,
        projectPath,
        preset: presetConfig?.name || null,
        setupMode,
        agents: presetConfig ? Object.keys(presetConfig.agents) : [],
        recommended: presetConfig?.recommended || {},
      };
      this.log(JSON.stringify(result, null, 2));
      return;
    }

    // Post-init verification
    this.log('');
    this.log('Verifying installation...');
    const verification = verifyInit(projectPath);

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

    // Launch based on setup mode
    if (setupMode === 'guided') {
      // Guided mode: always launch onboarding interview
      await this.launchOnboardingSession(projectPath, projectName);
    } else {
      // Custom mode: optionally run scan, then show guide
      if (runScan) {
        await this.launchScanSession(projectPath);
      }
      this.logCompletionGuide(prereqs.claudeAvailable);
    }
  }

  private async launchOnboardingSession(
    projectPath: string,
    _projectName: string
  ): Promise<void> {
    this.log('Starting interactive onboarding with Claude Code...');
    this.log('Claude will interview you about your project and set up the Project Hub.');
    this.log('');

    const initialPrompt = `You are the SidStack Business Discovery Assistant. Your job is to deeply understand this project's business context through a structured interview, then generate comprehensive documentation.

## Your Role
Conduct a thorough but conversational interview to understand:
- What the project does and why it exists
- Who uses it and what value it provides
- Core features and business rules
- Technical architecture and constraints
- Quality requirements and sensitive areas

## Phase 1: Welcome & Context
1. Read CLAUDE.md, .sidstack/config.json, and README.md (if exists) to get initial context.
2. Welcome the user briefly. Mention SidStack is now installed.
3. Say: "I'd like to understand your project thoroughly so I can set up intelligent documentation. This takes about 5-10 minutes and will make future AI sessions much more effective. Ready?"
   - If skip → jump to Phase 5 (Quick Setup).

## Phase 2: Project Identity (ask one at a time, be conversational)

### 2.1 What & Why
- "In one sentence, what does this project do?"
  → Save as: product_description

- "What problem does it solve? Why would someone use it?"
  → Save as: value_proposition

### 2.2 Who
- "Who are the main users? Any distinct user types or personas?"
  Examples: "End users", "Admin users", "API consumers", "Internal team"
  → Save as: user_personas[]

### 2.3 Stage
- "What stage is the project in?"
  Options: Idea/Planning, MVP/Early, Growth, Mature, Maintenance
  → Save as: project_stage

## Phase 3: Core Features & Domains

### 3.1 Domain Discovery
- "What are the main areas or modules of your project? For example: Authentication, Payments, Dashboard..."
  → Save as: domains[]

### 3.2 For EACH domain (iterate):
- "Tell me about [domain]:"
  a. "What's its main purpose?"
  b. "What are the key features?"
  c. "Any critical business rules that MUST always be true?"
     Examples: "Orders must have at least 1 item", "Passwords must be hashed"
  d. "Is this a core feature or supporting feature?"

→ Save as: domain_details[domain] = { purpose, features[], businessRules[], isCoreFeature }

### 3.3 Dependencies
- "How do these domains relate? Which ones depend on others?"
  → Save as: domain_relationships{}

## Phase 4: Technical & Quality Context

### 4.1 Architecture (quick)
- "High-level architecture? Monolith, microservices, serverless?"
  → Save as: architecture_type

### 4.2 Integrations
- "Any external services or APIs integrated? (payments, email, storage, etc.)"
  → Save as: integrations[]

### 4.3 Core Entities
- "What are the main data entities? (User, Order, Product, etc.)"
  → Save as: core_entities[]

### 4.4 Sensitive Areas
- "What code is most critical? What should never break?"
  → Save as: sensitive_areas[]

### 4.5 Known Gotchas
- "Any tech debt, known issues, or gotchas that someone new should know?"
  → Save as: known_issues[]

## Phase 5: Generate Documentation

After collecting answers, generate files:

### 5.1 Project Profile (.sidstack/project-profile.yaml)
\`\`\`yaml
name: {project-name}
description: {product_description}
valueProposition: {value_proposition}
stage: {project_stage}
architecture: {architecture_type}

users:
  - name: {persona_name}
    description: {persona_description}

domains:
  - id: {domain-id}
    name: {domain-name}
    purpose: {purpose}
    isCoreFeature: {true/false}
    features:
      - {feature1}
      - {feature2}
    businessRules:
      - {rule1}
      - {rule2}
    dependsOn:
      - {dependency}

integrations:
  - name: {integration}
    purpose: {why}

coreEntities:
  - {entity1}
  - {entity2}

sensitiveAreas:
  - {area1}
  - {area2}

knownIssues:
  - {issue1}
\`\`\`

### 5.2 Capability Map (.sidstack/capabilities/)

**L0 root:**
\`\`\`yaml
id: {project-name}
name: {Project Name}
level: L0
purpose: {product_description}
valueProposition: {value_proposition}
status: active
maturity: {stage → developing/stable/mature}
users: {user_personas}
\`\`\`

**L1 per domain:**
\`\`\`yaml
id: {domain-id}
name: {Domain Name}
level: L1
parent: {project-name}
purpose: {domain_details.purpose}
isCoreFeature: {domain_details.isCoreFeature}
status: active
features:
  - {feature1}
  - {feature2}
businessRules:
  - {rule1}
  - {rule2}
relationships:
  dependsOn: {dependencies}
sensitiveAreas: {if applicable}
\`\`\`

**L2 per core feature (optional, for complex domains):**
\`\`\`yaml
id: {feature-id}
name: {Feature Name}
level: L2
parent: {domain-id}
purpose: {feature purpose}
businessRules:
  - {specific rules}
\`\`\`

### 5.3 Knowledge Docs (.sidstack/knowledge/)

Create starter docs from interview:

**business-logic/{domain}-overview.md:**
\`\`\`markdown
---
id: {domain}-overview
type: business-logic
title: {Domain Name} Overview
module: {domain-id}
status: active
---

# {Domain Name}

## Purpose
{domain_details.purpose}

## Key Features
{list features}

## Business Rules
{list rules with explanations}

## Dependencies
{list what this domain depends on and why}
\`\`\`

**constraints/business-rules.md:**
\`\`\`markdown
---
id: business-rules
type: guide
title: Business Rules & Invariants
status: active
---

# Business Rules

## Critical Invariants
{rules that MUST always be true}

## Domain-Specific Rules
{rules per domain}
\`\`\`

### 5.4 Summary
Tell the user what was created:
- "Created Project Profile with {N} domains, {M} business rules"
- "Generated {X} capability files for Project Hub"
- "Created {Y} knowledge docs in .sidstack/knowledge/"
- "Open SidStack Desktop (Cmd+1) to see your Project Hub"

## Phase 6: Quick Actions
Offer follow-up actions:
1. "Want me to scan your codebase to enhance these docs with actual code patterns?"
2. "Should I create your first task to review and refine this documentation?"
3. "Ready to start working? What would you like to do first?"

## Rules
- Be conversational, not robotic. React to answers naturally.
- Ask ONE question at a time. Wait for answer before proceeding.
- If user gives short answers, probe deeper: "Can you tell me more about...?"
- If user says "skip" or seems impatient, offer: "I can do a quick setup instead. Skip to essentials?"
- Summarize what you understood before generating files: "Let me confirm I understood correctly..."
- Use the folder name as projectId for MCP tool calls.
- After generating files, always verify they were created successfully.`;


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

          // Count generated docs by category
          const categories = ['modules', 'api', 'database', 'business-logic', 'patterns'];
          let totalDocs = 0;
          const found: string[] = [];
          for (const cat of categories) {
            const catDir = path.join(knowledgeDir, cat);
            const count = this.countMarkdownFiles(catDir);
            if (count > 0) {
              found.push(`${cat} (${count})`);
              totalDocs += count;
            }
          }

          if (totalDocs === 0) {
            this.log('Warning: No knowledge docs were generated. You can re-run with:');
            this.log('  sidstack init --scan --force');
          } else {
            this.log(`Knowledge scan complete!`);
            this.log(`  ${totalDocs} docs generated: ${found.join(', ')}`);
            this.log('');
            this.log('MCP tools now available in Claude Code:');
            this.log('  knowledge_search  - search across all docs');
            this.log('  knowledge_context - inject project context into sessions');
            this.log('  knowledge_health  - check coverage and quality');
          }
        }
        resolve();
      });
    });
  }

  private countMarkdownFiles(dir: string): number {
    if (!fs.existsSync(dir)) return 0;
    let count = 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        count += this.countMarkdownFiles(fullPath);
      } else if (entry.name.endsWith('.md') && !entry.name.startsWith('_')) {
        count++;
      }
    }
    return count;
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

    // Copy SidStack skills to .claude/skills/ (auto-trigger behaviors)
    // Skills follow Claude Code format: skill-name/SKILL.md
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
        this.log(`✓ Created .claude/skills/ (${copiedCount} auto-trigger skills)`);
      }
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
    this.log('  Auto-skills: sidstack-aware, sidstack-knowledge-first, sidstack-impact-safe');
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

    // SidStack-managed skill folders only (preserve user's custom skills)
    const managedSkillDirs = [
      path.join(projectPath, '.claude', 'skills', 'sidstack-aware'),
      path.join(projectPath, '.claude', 'skills', 'sidstack-knowledge-first'),
      path.join(projectPath, '.claude', 'skills', 'sidstack-impact-safe'),
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

    // Only remove SidStack-managed skills, preserve user's custom skills
    for (const skillDir of managedSkillDirs) {
      if (fs.existsSync(skillDir)) {
        fs.rmSync(skillDir, { recursive: true, force: true });
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
