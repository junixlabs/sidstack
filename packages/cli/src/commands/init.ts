import { spawn, execSync } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { Args, Command, Flags } from '@oclif/core';

import { detectProject } from '../lib/project-detector.js';
import { checkPrerequisites } from '../lib/prerequisites.js';
import {
  saveWorkspaceConfig,
  ensureSidstackLocal,
  updateWorktreeStatus,
  getRepository,
  type WorkspaceConfig,
} from '@sidstack/shared';
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
    '<%= config.bin %> init --with-agents',
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
    'with-agents': Flags.boolean({
      description: 'Copy SidStack Worker/Reviewer agents to project .claude/agents/',
      default: false,
    }),
    workspace: Flags.boolean({
      char: 'w',
      description: 'Initialize as workspace with git bare repo structure (supports worktrees)',
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

    // Handle --workspace flag: convert to workspace structure
    if (flags.workspace) {
      await this.initAsWorkspace(projectPath, flags);
      return;
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

    const sidstackDir = path.join(projectPath, '.sidstack');
    const configPath = path.join(sidstackDir, 'config.json');

    // Check if already initialized
    if (fs.existsSync(sidstackDir) && !flags.force) {
      this.error(`Workspace already initialized at ${projectPath}. Use --force to reinitialize.`);
    }

    // Preserve existing projectId when re-initializing to maintain task associations
    let projectId: string;
    if (fs.existsSync(configPath)) {
      try {
        const existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        projectId = existingConfig.projectId || randomUUID();
        if (!flags.json) {
          this.log(`ℹ Preserving existing projectId: ${projectId.substring(0, 8)}...`);
        }
      } catch {
        projectId = randomUUID();
      }
    } else {
      projectId = randomUUID();
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
    // Default: local stdio mode via npx
    // For remote servers, users can switch to streamable-http mode (see docs/QUICK_START.md)
    const mcpConfig = {
      mcpServers: {
        sidstack: {
          command: 'npx',
          args: ['-y', '@sidstack/mcp-server@latest'],
        },
        // Remote server alternative (uncomment and replace above):
        // sidstack: {
        //   type: "streamable-http",
        //   url: "https://mcp.your-server.com/mcp",
        //   headers: {
        //     Authorization: "Bearer YOUR_API_KEY"
        //   }
        // }
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

    // 9. Optionally copy SidStack agents
    if (flags['with-agents']) {
      this.log('');
      this.log('Installing SidStack agents...');
      this.copyAgents(projectPath);
    }

    // 10. Create starter tasks for knowledge bootstrapping
    const taskCount = await this.createStarterTasks(projectId, projectName, projectPath);
    if (!flags.json) {
      this.log('');
      this.log(`✓ Created ${taskCount} starter tasks for knowledge bootstrapping`);
      this.log('  View tasks: sidstack task list or open Task Manager (⌘2) in Desktop App');
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
        setupMode,
        agents: presetConfig ? Object.keys(presetConfig.agents) : [],
        recommended: presetConfig?.recommended || {},
        starterTasks: taskCount,
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
      // Guided mode: launch agent to work on starter tasks
      if (taskCount > 0 && prereqs.claudeAvailable) {
        await this.launchTaskBootstrapSession(projectPath, projectId, taskCount);
      } else {
        this.log('');
        if (taskCount === 0) {
          this.log('Could not create starter tasks. You can create them manually:');
          this.log('  claude "Use sidstack MCP tools to create knowledge docs for this project"');
        } else {
          this.log('Claude Code not detected. Install it first, then run:');
          this.log('  claude "task_list to see starter tasks, then work through them one by one"');
        }
        this.logCompletionGuide(prereqs.claudeAvailable);
      }
    } else {
      // Custom mode: optionally run scan, then show guide
      if (runScan) {
        await this.launchScanSession(projectPath);
      }
      if (taskCount > 0 && prereqs.claudeAvailable && isInteractive) {
        this.log('');
        this.log(`${taskCount} starter tasks are ready. Launch an agent to work through them?`);
        this.log('  Run: claude "task_list to see starter tasks, then work through them one by one"');
      }
      this.logCompletionGuide(prereqs.claudeAvailable);
    }
  }

  private async createStarterTasks(projectId: string, projectName: string, projectPath: string): Promise<number> {
    try {
      const repo = await getRepository();

      // Ensure project exists in DB
      const existingProject = await repo.projects.get(projectId);
      if (!existingProject) {
        await repo.projects.create({
          id: projectId,
          name: projectName,
          path: projectPath,
          status: 'active',
        });
      }

      const tasks = [
        {
          title: '[docs] Project Discovery — analyze codebase and confirm with user',
          description: `IMPORTANT: This task MUST be completed first, before all other tasks.

You are setting up project documentation. Do NOT auto-generate docs without user input.

## Step 1: Analyze (silent — do not create any files yet)
Read these files to understand the project:
- README.md, CLAUDE.md, package.json (or composer.json, Cargo.toml, etc.)
- Folder structure (ls src/, ls app/, etc.)
- Config files, .env.example, docker-compose.yml
- Database: migrations, models, schema files

## Step 2: Present Summary
Tell the user what you found:
- "Here's what I understand about your project: [summary]"
- Tech stack, framework, language
- Main folders/modules you identified
- Any integrations you spotted (DB, APIs, services)

## Step 3: Ask Key Questions (one at a time)
Ask these questions and WAIT for answers:

1. "What does this project do, in your own words? Who are the main users?"
2. "What are the main domains/modules? I found [X, Y, Z] — is that correct, or am I missing something?"
3. "Any critical business rules that must ALWAYS be true?" (e.g., "orders must have at least 1 item")
4. "Any known gotchas, tech debt, or sensitive areas I should document?"
5. "What stage is the project in?" (MVP, growth, mature, maintenance)

## Step 4: Save Context
Create ONE file: .sidstack/knowledge/00-context/project-discovery.md
Include ALL answers from the user — this becomes the foundation for all other tasks.

Use knowledge_create MCP tool. Type: guide. Status: active.

## Then
Mark this task complete and proceed to the remaining tasks. Use the discovery context for accuracy.`,
          taskType: 'docs' as const,
          acceptanceCriteria: [
            { description: 'Codebase analyzed and summary presented to user' },
            { description: 'All 5 key questions asked and answered by user' },
            { description: 'project-discovery.md created with user-confirmed context' },
          ],
        },
        {
          title: '[docs] Create project context documentation',
          description: `Using the confirmed context from the Project Discovery task, create documentation in .sidstack/knowledge/00-context/:

1. **business-model.md** — Product description, value proposition, target users, revenue model
2. **domain-glossary.md** — Key domain terms with definitions (min 10 terms)
3. **constraints.md** — Technical constraints, non-goals, known limitations, scope boundaries

Use knowledge_create MCP tool. Type: guide. Status: draft.
Base content on BOTH code analysis AND user answers from discovery.`,
          taskType: 'docs' as const,
          acceptanceCriteria: [
            { description: 'business-model.md created with product description' },
            { description: 'domain-glossary.md created with at least 10 terms' },
            { description: 'constraints.md created with non-goals section' },
          ],
        },
        {
          title: '[docs] Create technical architecture documentation',
          description: `Using discovery context + code analysis, create architecture documentation in .sidstack/knowledge/01-architecture/:

1. **system-overview.md** — High-level architecture, component diagram (text), tech stack summary
2. **module-boundaries.md** — Logical modules, their responsibilities, dependencies between them
3. **data-flow.md** — How data moves through the system (request → processing → storage → response)

Read source code, package.json, config files. Cross-reference with user's domain descriptions from discovery.`,
          taskType: 'docs' as const,
          acceptanceCriteria: [
            { description: 'system-overview.md created with tech stack and components' },
            { description: 'module-boundaries.md created with at least 3 modules identified' },
          ],
        },
        {
          title: '[docs] Document key architecture decisions',
          description: `Identify and document key architecture decisions in .sidstack/knowledge/02-decisions/:

For each decision create a file: YYYY-MM-DD-slug.md with:
- Context: what prompted the decision
- Decision: what was chosen
- Alternatives: what was considered
- Consequences: trade-offs accepted

Look for evidence in: README, package.json (framework choices), config files, folder structure.
Create at least 2 ADR documents.`,
          taskType: 'docs' as const,
          acceptanceCriteria: [
            { description: 'At least 2 ADR documents created with full context/decision/consequences' },
          ],
        },
        {
          title: '[docs] Create coding standards documentation',
          description: `Analyze the codebase and document coding standards in .sidstack/knowledge/03-standards/:

1. **coding-conventions.md** — Naming patterns, file structure, import ordering, code style
2. **error-handling.md** — Error handling patterns, error types, logging conventions
3. **testing-rules.md** — Test file naming, test structure, coverage requirements

Use MUST/SHOULD/MAY statements. Each rule should be verifiable.
Derive standards from actual code patterns, not generic best practices.`,
          taskType: 'docs' as const,
          acceptanceCriteria: [
            { description: 'coding-conventions.md with project-specific naming patterns' },
            { description: 'At least 5 MUST/SHOULD rules documented' },
          ],
        },
        {
          title: '[docs] Create data documentation',
          description: `Analyze database/data layer and create documentation in .sidstack/knowledge/04-data/:

1. **schema-overview.md** — Database technology, tables/collections, relationships
2. **data-ownership.md** — Which module owns which data, read/write access rules

Look for: database files, ORM models, migration files, schema definitions, SQL files.
If no database found, document data structures and state management instead.`,
          taskType: 'docs' as const,
          acceptanceCriteria: [
            { description: 'schema-overview.md created (or state-management.md if no DB)' },
          ],
        },
        {
          title: '[docs] Create API documentation',
          description: `Analyze API layer and create documentation in .sidstack/knowledge/05-api/:

1. **overview.md** — Base URL, API style (REST/GraphQL/RPC), authentication method
2. **endpoints-{resource}.md** — One doc per resource group (users, products, etc.)
3. **error-codes.md** — Error format, status codes, error response structure

Look for: route files, controller files, API handlers, middleware, OpenAPI specs.
If no API found, document CLI commands or internal interfaces instead.`,
          taskType: 'docs' as const,
          acceptanceCriteria: [
            { description: 'overview.md created with API style and auth method' },
            { description: 'At least 1 endpoint group documented' },
          ],
        },
        {
          title: '[docs] Create operations documentation',
          description: `Analyze deployment/ops setup and create documentation in .sidstack/knowledge/06-operations/:

1. **deployment-flow.md** — How to build, deploy, environments (dev/staging/prod)
2. **environment-config.md** — Environment variables, config files, secrets management

Look for: Dockerfile, docker-compose, CI/CD files (.github/workflows, Jenkinsfile), Makefile.
If no ops setup found, document local development setup instead.`,
          taskType: 'docs' as const,
          acceptanceCriteria: [
            { description: 'deployment-flow.md or local-dev-setup.md created' },
          ],
        },
        {
          title: '[docs] Create project brief documentation',
          description: `Create initial project documentation in .sidstack/knowledge/07-projects/:

1. **initial-setup/brief.md** — Project goals, scope, success criteria, timeline
2. **initial-setup/design.md** — Technical approach, key decisions, risks

This captures the current state of the project as it begins using SidStack.`,
          taskType: 'docs' as const,
          acceptanceCriteria: [
            { description: 'brief.md created with project goals and scope' },
          ],
        },
        {
          title: '[docs] Create incident documentation template',
          description: `Review the codebase for common gotchas and create an initial incident doc in .sidstack/knowledge/08-incidents/:

1. **common-gotchas.md** — Known issues, common mistakes, footguns in the codebase

If no obvious issues found, create a template incident doc with the project's actual tech stack context.`,
          taskType: 'docs' as const,
          acceptanceCriteria: [
            { description: 'At least 1 incident/gotcha document created' },
          ],
        },
        {
          title: '[docs] Create demo ticket from real project context',
          description: `Create ONE realistic ticket using the ticket_create MCP tool:
- Analyze the project and find a real improvement opportunity, bug risk, or missing feature
- Use the project's actual context (not generic placeholder)
- Set appropriate priority (low/medium/high) and type (bug/feature/improvement/task)
- Write a clear title and description

This demonstrates the Ticket Queue feature for the project.`,
          taskType: 'docs' as const,
          acceptanceCriteria: [
            { description: '1 ticket created via ticket_create with real project context' },
          ],
        },
        {
          title: '[docs] Create demo training entry from real project context',
          description: `Create ONE realistic training entry using MCP tools:
1. incident_create: A common mistake, confusion point, or gotcha found in the codebase
   - Use real context (actual file paths, actual patterns)
   - Set appropriate severity and type
2. lesson_create: Extract a lesson from the incident
   - Problem: what can go wrong
   - Root cause: why it happens
   - Solution: how to prevent it

This demonstrates the Training Room feature for the project.`,
          taskType: 'docs' as const,
          acceptanceCriteria: [
            { description: '1 incident created via incident_create' },
            { description: '1 lesson created via lesson_create' },
          ],
        },
      ];

      for (const task of tasks) {
        await repo.tasks.create({
          projectId,
          title: task.title,
          description: task.description,
          status: 'pending',
          priority: 'medium',
          createdBy: 'sidstack-init',
          taskType: task.taskType,
          acceptanceCriteria: JSON.stringify(
            task.acceptanceCriteria.map((ac, i) => ({
              id: `ac-init-${i}`,
              description: ac.description,
              completed: false,
            }))
          ),
        });
      }

      return tasks.length;
    } catch (err) {
      // Non-fatal: tasks are nice-to-have, init should still succeed
      const msg = err instanceof Error ? err.message : String(err);
      this.log(`⚠ Could not create starter tasks: ${msg}`);
      return 0;
    }
  }

  private async launchTaskBootstrapSession(
    projectPath: string,
    projectId: string,
    taskCount: number
  ): Promise<void> {
    this.log('Launching Claude Code to work through starter tasks...');
    this.log('');

    const prompt = `You have ${taskCount} starter tasks created by sidstack init. Work through them IN ORDER:

1. task_list({ projectId: "${projectId}" }) to see all tasks
2. IMPORTANT: Start with "Project Discovery" task FIRST — this is a conversation with the user
   - Analyze the codebase silently
   - Present what you found to the user
   - Ask 5 key questions about business context, domains, rules, gotchas, stage
   - WAIT for user answers before proceeding
   - Save confirmed context to project-discovery.md
3. After discovery is confirmed, work through remaining tasks using both code analysis AND user context
4. For each task: task_update to in_progress → do the work → task_complete when done
5. Use knowledge_create, ticket_create, incident_create, lesson_create MCP tools

Do NOT auto-generate business docs without user confirmation. Technical docs (architecture, standards) can be derived from code but should reference the discovery context.`;

    return new Promise((resolve) => {
      const claude = spawn('claude', [prompt], {
        cwd: projectPath,
        stdio: 'inherit',
      });

      claude.on('error', () => {
        this.log('Could not start Claude Code. Make sure `claude` is installed.');
        this.log('');
        this.log('You can work through the tasks manually:');
        this.log('  claude "task_list to see starter tasks, then work through them"');
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
    for (const sub of ['architecture', 'domain', 'patterns']) {
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
          const categories = ['architecture', 'domain', 'patterns'];
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

    this.copyDirectorySync(sourceSidstack, targetSidstack, ['knowledge']);
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
    this.log('  Principles: task-management, code-quality, testing, security, collaboration, quality-gates, documentation');
    this.log('  Auto-skill: sidstack-aware (knowledge, impact, training, progress, lessons)');
    this.log('  Workflow skill: /sidstack-dev (feature, fix, hotfix, review, test modes)');
    this.log('  Commands: /sidstack (hub), /sidstack:agent, /sidstack:knowledge');
    this.log('  Hooks: SessionStart, PreCompact, UserPromptSubmit, PreToolUse (security), PostToolUse');
    this.log('  Scripts: .claude/scripts/open-claude-session.sh (auto-detect terminal)');
  }

  private copyAgents(projectPath: string): void {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const userAgentsDir = path.join(homeDir, '.sidstack', 'agents');
    const bundledAgentsDir = resolveTemplatesDir(__dirname, 'agents');
    const targetAgentsDir = path.join(projectPath, '.claude', 'agents');

    // Determine source: prefer user-level global, fall back to bundled
    let sourceDir: string;
    if (fs.existsSync(userAgentsDir) && fs.readdirSync(userAgentsDir).some(f => f.endsWith('.md'))) {
      sourceDir = userAgentsDir;
      this.log(`  Using agents from ~/.sidstack/agents/`);
    } else if (fs.existsSync(bundledAgentsDir)) {
      sourceDir = bundledAgentsDir;
      this.log(`  Using bundled agent templates`);
    } else {
      this.log('⚠ No agents found. Install agents to ~/.sidstack/agents/ first.');
      return;
    }

    // Create target directory
    fs.mkdirSync(targetAgentsDir, { recursive: true });

    // Copy agent .md files
    const agentFiles = fs.readdirSync(sourceDir).filter(f => f.endsWith('.md'));
    let copiedCount = 0;

    for (const file of agentFiles) {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetAgentsDir, file);

      // Skip if already exists (don't overwrite user customizations)
      if (fs.existsSync(targetPath)) {
        this.log(`  ⚠ Skipping ${file} (already exists)`);
        continue;
      }

      fs.copyFileSync(sourcePath, targetPath);
      copiedCount++;
    }

    if (copiedCount > 0) {
      this.log(`✓ Copied ${copiedCount} agent(s) to .claude/agents/`);
      this.log('  Agents: ' + agentFiles.join(', '));
      this.log('');
      this.log('  Usage: Claude Code will auto-discover these agents.');
      this.log('  Spawn via Task tool with subagent_type: "sidstack-worker" or "sidstack-reviewer"');
    } else {
      this.log('  No new agents to copy (all already exist)');
    }
  }

  private cleanupOldVersion(projectPath: string): void {
    this.log('Cleaning up previous version...');

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
      // Legacy skills (cleaned up on re-init)
      path.join(projectPath, '.claude', 'skills', 'sidstack-implement'),
      path.join(projectPath, '.claude', 'skills', 'sidstack-review'),
      path.join(projectPath, '.claude', 'skills', 'sidstack-e2e-test'),
      path.join(projectPath, '.claude', 'skills', 'sidstack-knowledge-first'),
      path.join(projectPath, '.claude', 'skills', 'sidstack-impact-safe'),
      path.join(projectPath, '.claude', 'skills', 'sidstack-lesson-detector'),
      path.join(projectPath, '.claude', 'skills', 'sidstack-training-context'),
    ];

    // Note: .sidstack/knowledge/ is NOT in managedDirs — user-owned, never deleted on re-init

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

  private copyDirectorySync(source: string, target: string, excludeDirs?: string[]): void {
    if (!fs.existsSync(source)) {
      throw new Error(`Source directory not found: ${source}`);
    }

    fs.mkdirSync(target, { recursive: true });

    const entries = fs.readdirSync(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const targetPath = path.join(target, entry.name);

      if (entry.isDirectory()) {
        if (excludeDirs?.includes(entry.name)) continue;
        this.copyDirectorySync(sourcePath, targetPath);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }

  /**
   * Copy directory contents but skip files that already exist (safe for re-init).
   * Returns counts of new and skipped files.
   */
  private copyDirectoryIfNotExist(
    source: string,
    target: string,
    counts: { created: number; skipped: number } = { created: 0, skipped: 0 }
  ): { created: number; skipped: number } {
    if (!fs.existsSync(source)) return counts;

    fs.mkdirSync(target, { recursive: true });

    const entries = fs.readdirSync(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const targetPath = path.join(target, entry.name);

      if (entry.isDirectory()) {
        this.copyDirectoryIfNotExist(sourcePath, targetPath, counts);
      } else if (fs.existsSync(targetPath)) {
        counts.skipped++;
      } else {
        fs.copyFileSync(sourcePath, targetPath);
        counts.created++;
      }
    }

    return counts;
  }

  /**
   * Deploy PM knowledge document templates to .sidstack/knowledge/.
   * Uses safe copy (won't overwrite existing user-edited docs).
   * Replaces {{INITIALIZED_AT}} placeholder in frontmatter.
   */
  private initKnowledgeTemplates(projectPath: string): void {
    const templatesDir = resolveTemplatesDir(__dirname, 'governance');
    const sourceKnowledge = path.join(templatesDir, '.sidstack', 'knowledge');

    if (!fs.existsSync(sourceKnowledge)) return;

    const targetKnowledge = path.join(projectPath, '.sidstack', 'knowledge');
    const counts = this.copyDirectoryIfNotExist(sourceKnowledge, targetKnowledge);

    // Replace {{INITIALIZED_AT}} in newly created files
    if (counts.created > 0) {
      const now = new Date().toISOString();
      this.replaceInKnowledgeDocs(targetKnowledge, now);
    }

    // Count files per category for summary
    const categories: string[] = [];
    if (fs.existsSync(targetKnowledge)) {
      const dirs = fs.readdirSync(targetKnowledge, { withFileTypes: true });
      for (const d of dirs) {
        if (d.isDirectory()) {
          const count = this.countMarkdownFiles(path.join(targetKnowledge, d.name));
          if (count > 0) {
            categories.push(`${d.name} (${count})`);
          }
        }
      }
    }

    if (counts.created > 0 || counts.skipped > 0) {
      this.log(`✓ PM document templates: ${counts.created} new, ${counts.skipped} existing skipped`);
      if (categories.length > 0) {
        this.log(`  Categories: ${categories.join(', ')}`);
      }
    }
  }

  /**
   * Replace {{INITIALIZED_AT}} placeholder in knowledge doc files recursively.
   */
  private replaceInKnowledgeDocs(dir: string, timestamp: string): void {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.replaceInKnowledgeDocs(fullPath, timestamp);
      } else if (entry.name.endsWith('.md')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        if (content.includes('{{INITIALIZED_AT}}')) {
          const updated = content.replace(/\{\{INITIALIZED_AT\}\}/g, timestamp);
          fs.writeFileSync(fullPath, updated);
        }
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

  /**
   * Initialize current directory as a workspace with git bare repo structure
   */
  private async initAsWorkspace(
    projectPath: string,
    flags: { json: boolean; force: boolean; 'project-name'?: string }
  ): Promise<void> {
    const projectName = flags['project-name'] || path.basename(projectPath);

    // Check if already a workspace
    if (fs.existsSync(path.join(projectPath, '.bare')) && !flags.force) {
      if (flags.json) {
        this.log(JSON.stringify({
          success: false,
          error: 'Already a workspace. Use --force to reinitialize.',
        }, null, 2));
      } else {
        this.error('Already a workspace. Use --force to reinitialize.');
      }
      return;
    }

    // Check for existing .git
    const hasGit = fs.existsSync(path.join(projectPath, '.git'));
    if (!hasGit) {
      if (flags.json) {
        this.log(JSON.stringify({
          success: false,
          error: 'Not a git repository. Initialize git first: git init',
        }, null, 2));
      } else {
        this.error('Not a git repository. Initialize git first: git init');
      }
      return;
    }

    try {
      if (!flags.json) {
        this.log('');
        this.log('Converting to SidStack Workspace');
        this.log('=================================');
        this.log('');
      }

      // Step 1: Get current branch
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: projectPath,
        encoding: 'utf-8',
      }).trim();

      if (!flags.json) {
        this.log(`1. Current branch: ${currentBranch}`);
      }

      // Step 2: Create temporary clone
      const tempDir = path.join(projectPath, '.workspace-temp');
      const bareDir = path.join(projectPath, '.bare');
      const mainDir = path.join(projectPath, 'main');

      if (!flags.json) {
        this.log('2. Creating bare repository...');
      }

      // Clone to bare
      execSync(`git clone --bare "${projectPath}" "${bareDir}"`, {
        stdio: flags.json ? 'pipe' : 'inherit',
      });

      // Step 3: Move current files to temp
      if (!flags.json) {
        this.log('3. Reorganizing files...');
      }

      fs.mkdirSync(tempDir, { recursive: true });

      // Move all files except .bare, .sidstack to temp
      const entries = fs.readdirSync(projectPath);
      for (const entry of entries) {
        if (entry === '.bare' || entry === '.workspace-temp') continue;

        const srcPath = path.join(projectPath, entry);
        const destPath = path.join(tempDir, entry);

        fs.renameSync(srcPath, destPath);
      }

      // Step 4: Create main worktree from bare
      if (!flags.json) {
        this.log('4. Creating main worktree...');
      }

      execSync(`git -C "${bareDir}" worktree add "${mainDir}" ${currentBranch}`, {
        stdio: flags.json ? 'pipe' : 'inherit',
      });

      // Step 5: Copy files from temp to main (except .git)
      if (!flags.json) {
        this.log('5. Restoring project files...');
      }

      const tempEntries = fs.readdirSync(tempDir);
      for (const entry of tempEntries) {
        if (entry === '.git') continue; // Skip old .git

        const srcPath = path.join(tempDir, entry);
        const destPath = path.join(mainDir, entry);

        // Remove if exists in main (from git checkout)
        if (fs.existsSync(destPath)) {
          fs.rmSync(destPath, { recursive: true, force: true });
        }

        fs.renameSync(srcPath, destPath);
      }

      // Cleanup temp
      fs.rmSync(tempDir, { recursive: true, force: true });

      // Step 6: Initialize .sidstack at workspace level
      if (!flags.json) {
        this.log('6. Initializing SidStack...');
      }

      const sidstackDir = path.join(projectPath, '.sidstack');
      fs.mkdirSync(sidstackDir, { recursive: true });

      // Create config
      const config: WorkspaceConfig = {
        projectId: randomUUID(),
        projectName,
        projectPath,
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        isWorkspace: true,
        worktrees: ['main'],
      };

      saveWorkspaceConfig(projectPath, config);

      // Copy governance templates
      const templatesDir = resolveTemplatesDir(__dirname, 'governance');
      const governanceDir = templatesDir;

      if (fs.existsSync(governanceDir)) {
        // Copy .sidstack content
        this.copyDirectorySync(path.join(governanceDir, '.sidstack'), sidstackDir);

        // Copy CLAUDE.md template
        const claudeTemplate = path.join(governanceDir, 'CLAUDE.md.template');
        if (fs.existsSync(claudeTemplate)) {
          let content = fs.readFileSync(claudeTemplate, 'utf-8');
          content = content.replace(/\{projectName\}/g, projectName);
          fs.writeFileSync(path.join(projectPath, 'CLAUDE.md'), content);
        }
      }

      // Step 7: Create wt-1 worktree
      if (!flags.json) {
        this.log('7. Creating wt-1 worktree...');
      }

      const wt1Dir = path.join(projectPath, 'wt-1');
      execSync(`git -C "${bareDir}" worktree add "${wt1Dir}" ${currentBranch}`, {
        stdio: flags.json ? 'pipe' : 'inherit',
      });

      ensureSidstackLocal(wt1Dir);
      updateWorktreeStatus(wt1Dir, {
        status: 'idle',
        branch: currentBranch,
      });

      config.worktrees = ['main', 'wt-1'];
      saveWorkspaceConfig(projectPath, config);

      // Step 8: Create .gitignore at workspace level
      const gitignoreContent = `# SidStack workspace
.sidstack-local/
*.log
.DS_Store
`;
      fs.writeFileSync(path.join(projectPath, '.gitignore'), gitignoreContent);

      if (flags.json) {
        this.log(JSON.stringify({
          success: true,
          workspace: projectPath,
          projectId: config.projectId,
          projectName,
          branch: currentBranch,
          worktrees: ['main', 'wt-1'],
        }, null, 2));
      } else {
        this.log('');
        this.log('✓ Workspace created successfully!');
        this.log('');
        this.log('Structure:');
        this.log(`  ${projectPath}/`);
        this.log('  ├── .sidstack/     # Shared governance & knowledge');
        this.log('  ├── CLAUDE.md      # Shared AI instructions');
        this.log('  ├── .bare/         # Git bare repository');
        this.log('  ├── main/          # Main branch (your code is here)');
        this.log('  └── wt-1/          # Working worktree (ready to use)');
        this.log('');
        this.log('Your code has been moved to main/');
        this.log('');
        this.log('Next steps:');
        this.log(`  cd ${wt1Dir}`);
        this.log('  # Start working');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (flags.json) {
        this.log(JSON.stringify({
          success: false,
          error: `Failed to convert to workspace: ${message}`,
        }, null, 2));
      } else {
        this.error(`Failed to convert to workspace: ${message}`);
      }
    }
  }

}
