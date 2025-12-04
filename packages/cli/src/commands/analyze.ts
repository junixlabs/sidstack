import * as fs from 'fs';
import * as path from 'path';

import { Args, Command, Flags } from '@oclif/core';

import { getKeyFilesForAnalysis, collectContextForClaude, ClaudeAnalysisConfig } from '../lib/claude-analyzer.js';
import { SpecDrivenAnalyzer } from '../lib/spec-driven-analyzer.js';

interface SidStackConfig {
  projectId: string;
  projectName: string;
  projectPath: string;
  version: string;
}

export default class Analyze extends Command {
  static description = 'Prepare codebase analysis context for Claude Code CLI';

  static examples = [
    '<%= config.bin %> analyze',
    '<%= config.bin %> analyze /path/to/project',
    '<%= config.bin %> analyze --specs           # Generate .sidstack/ spec files',
    '<%= config.bin %> analyze --specs --force   # Regenerate spec files',
    '<%= config.bin %> analyze --validate        # Validate spec files',
    '<%= config.bin %> analyze --list-files      # Show key files to read',
    '<%= config.bin %> analyze --generate-prompt # Generate analysis prompt',
  ];

  static flags = {
    specs: Flags.boolean({
      char: 's',
      description: 'Generate .sidstack/ spec files (Markdown + Mermaid)',
      default: false,
    }),
    validate: Flags.boolean({
      char: 'v',
      description: 'Validate existing .sidstack/ spec files',
      default: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Force regenerate spec files (use with --specs)',
      default: false,
    }),
    'list-files': Flags.boolean({
      char: 'l',
      description: 'List key files for Claude Code to read',
      default: false,
    }),
    'generate-prompt': Flags.boolean({
      char: 'p',
      description: 'Generate analysis prompt with code samples',
      default: false,
    }),
    depth: Flags.string({
      char: 'd',
      description: 'Analysis depth',
      options: ['quick', 'standard', 'deep'],
      default: 'standard',
    }),
  };

  static args = {
    path: Args.string({
      description: 'Project path (defaults to current directory)',
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Analyze);

    const projectPath = args.path ? path.resolve(args.path) : process.cwd();

    // Handle --specs flag: generate .sidstack/ spec files
    if (flags.specs) {
      await this.generateSpecs(projectPath, flags.force);
      return;
    }

    // Handle --validate flag: validate existing spec files
    if (flags.validate) {
      await this.validateSpecs(projectPath);
      return;
    }

    const sidstackDir = path.join(projectPath, '.sidstack');
    const configPath = path.join(sidstackDir, 'config.json');

    // Check if project is initialized
    if (!fs.existsSync(configPath)) {
      this.error(`No SidStack project found at ${projectPath}. Run 'sidstack init' first.`);
    }

    const config: SidStackConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    const analysisConfig: Partial<ClaudeAnalysisConfig> = {
      analysisDepth: flags.depth as 'quick' | 'standard' | 'deep',
      maxFilesPerModule: flags.depth === 'deep' ? 20 : flags.depth === 'quick' ? 5 : 10,
      maxCodeLinesPerFile: flags.depth === 'deep' ? 300 : flags.depth === 'quick' ? 100 : 200,
    };

    if (flags['list-files']) {
      // List key files for analysis
      const files = await getKeyFilesForAnalysis(projectPath, analysisConfig);
      this.log(`\n📁 Key files for ${config.projectName} analysis:\n`);
      files.forEach(f => this.log(`  ${f}`));
      this.log(`\n💡 Run 'claude' in the project directory and read these files for analysis.`);
      return;
    }

    if (flags['generate-prompt']) {
      // Generate full analysis prompt
      const context = await collectContextForClaude(projectPath, analysisConfig);
      this.log(context.prompt);
      return;
    }

    // Default: Show instructions for Claude Code CLI usage
    this.log(`\n🔬 SidStack Codebase Analysis`);
    this.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.log(`  Project: ${config.projectName}`);
    this.log(`  Project ID: ${config.projectId}`);
    this.log(`  Path: ${projectPath}`);
    this.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    this.log(`📋 To analyze this project with Claude Code CLI:\n`);
    this.log(`  1. Open Claude Code in the project directory:`);
    this.log(`     cd ${projectPath} && claude\n`);
    this.log(`  2. Ask Claude to analyze and populate the graph:`);
    this.log(`     "Analyze this codebase and populate the SidStack knowledge graph.`);
    this.log(`      Use mcp__sidstack tools to create Module and Feature nodes`);
    this.log(`      for project ID: ${config.projectId}"\n`);
    this.log(`  Or use the slash command:`);
    this.log(`     /analyze-project ${projectPath}\n`);
    this.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.log(`\nOptions:`);
    this.log(`  --specs (-s)           Generate .sidstack/ spec files`);
    this.log(`  --force (-f)           Force regenerate (with --specs)`);
    this.log(`  --validate (-v)        Validate spec files`);
    this.log(`  --list-files (-l)      Show key files to read`);
    this.log(`  --generate-prompt (-p) Generate full analysis prompt`);
  }

  /**
   * Generate .sidstack/ spec files using SpecDrivenAnalyzer
   */
  private async generateSpecs(projectPath: string, force: boolean): Promise<void> {
    this.log(`\n📊 Generating project specs...`);
    this.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const analyzer = new SpecDrivenAnalyzer(projectPath, { force });

    try {
      const spec = await analyzer.analyze();

      this.log(`\n✅ Specs generated successfully!`);
      this.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      this.log(`  Project: ${spec.name}`);
      this.log(`  Modules: ${spec.modules.length}`);
      this.log(`  Tech Stack: ${spec.techStack.join(', ')}`);
      this.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      this.log(`📁 Output: ${path.join(projectPath, '.sidstack/')}`);
      this.log(`   - project.md (overview with dependency diagram)`);
      this.log(`   - modules/*.md (${spec.modules.length} module specs)`);
      this.log(`   - index.md (navigation)`);
      this.log(`\n💡 Open .sidstack/project.md in the Desktop App to view.`);
    } catch (error) {
      this.error(`Failed to generate specs: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Validate .sidstack/ spec files
   */
  private async validateSpecs(projectPath: string): Promise<void> {
    this.log(`\n🔍 Validating project specs...`);
    this.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const sidstackDir = path.join(projectPath, '.sidstack');
    if (!fs.existsSync(sidstackDir)) {
      this.error(`No .sidstack/ directory found. Run 'sidstack analyze --specs' first.`);
    }

    const analyzer = new SpecDrivenAnalyzer(projectPath);

    try {
      const result = await analyzer.validate();

      this.log('');
      SpecDrivenAnalyzer.printValidationResult(result);
      this.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      if (!result.valid) {
        this.exit(1);
      }
    } catch (error) {
      this.error(`Validation failed: ${error instanceof Error ? error.message : error}`);
    }
  }
}
