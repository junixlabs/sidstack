import { Args, Command, Flags } from '@oclif/core';

import {
  governanceExists,
  getGovernancePaths,
  validatePrincipleFile,
  validateSkillFile,
  validateAgentFile,
  loadGovernanceSummary,
} from '../../lib/governance-loader.js';

import {
  ExitCodes,
  validationResponse,
  ValidationResult,
  ValidationItem,
  CLIError,
  CLIWarning,
} from '../../lib/output.js';
import { createError, createWarning, ErrorCodes, listFiles } from '../../lib/validator.js';

type CheckScope = 'all' | 'principles' | 'skills' | 'agents';

export default class GovernanceCheck extends Command {
  static description = 'Validate governance compliance (agent-friendly with exit codes)';

  static examples = [
    '<%= config.bin %> governance check',
    '<%= config.bin %> governance check --json',
    '<%= config.bin %> governance check principles',
    '<%= config.bin %> governance check modules --strict',
    '<%= config.bin %> governance check module terminal',
  ];

  static args = {
    scope: Args.string({
      description: 'What to check: all, principles, skills, agents, modules, or "module <id>"',
      required: false,
      default: 'all',
    }),
    target: Args.string({
      description: 'Target ID when scope is "module"',
      required: false,
    }),
  };

  static flags = {
    json: Flags.boolean({
      char: 'j',
      description: 'Output in JSON format (agent-friendly)',
      default: false,
    }),
    strict: Flags.boolean({
      description: 'Treat warnings as errors',
      default: false,
    }),
    quiet: Flags.boolean({
      char: 'q',
      description: 'Minimal output (VALID/INVALID only)',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(GovernanceCheck);
    const projectPath = process.cwd();

    // Check if governance exists
    const exists = await governanceExists(projectPath);
    if (!exists) {
      const error = createError(
        ErrorCodes.NOT_FOUND,
        'Governance not initialized',
        { suggestion: 'Run "sidstack governance init" to initialize governance' }
      );

      if (flags.json) {
        const result: ValidationResult = {
          totalFiles: 0,
          validFiles: 0,
          invalidFiles: 0,
          items: [],
        };
        const response = validationResponse('governance check', result);
        response.errors = [error];
        response.exitCode = ExitCodes.NOT_INITIALIZED;
        response.success = false;
        this.log(JSON.stringify(response, null, 2));
        this.exit(ExitCodes.NOT_INITIALIZED);
      }

      this.error(error.message);
    }

    // Determine scope
    let scope: CheckScope = (args.scope as CheckScope) || 'all';
    const target = args.target;

    // Run validation
    const items: ValidationItem[] = [];

    if (scope === 'all' || scope === 'principles') {
      const principleItems = await this.checkPrinciples(projectPath);
      items.push(...principleItems);
    }

    if (scope === 'all' || scope === 'skills') {
      const skillItems = await this.checkSkills(projectPath);
      items.push(...skillItems);
    }

    if (scope === 'all' || scope === 'agents') {
      const agentItems = await this.checkAgents(projectPath);
      items.push(...agentItems);
    }

    // Build result
    const result: ValidationResult = {
      totalFiles: items.length,
      validFiles: items.filter(i => i.valid).length,
      invalidFiles: items.filter(i => !i.valid).length,
      items,
    };

    // JSON output
    if (flags.json) {
      const response = validationResponse('governance check', result, { strict: flags.strict });
      this.log(JSON.stringify(response, null, 2));
      this.exit(response.exitCode);
    }

    // Quiet mode
    if (flags.quiet) {
      const hasWarnings = items.some(i => i.warnings.length > 0);
      const hasErrors = result.invalidFiles > 0;
      if (hasErrors || (flags.strict && hasWarnings)) {
        this.log('INVALID');
        this.exit(ExitCodes.VALIDATION_FAILED);
      }
      this.log('VALID');
      return;
    }

    // Human-readable output
    this.displayResults(result, scope, flags.strict);

    // Exit with appropriate code
    const hasErrors = result.invalidFiles > 0;
    const hasWarnings = items.some(i => i.warnings.length > 0);

    if (hasErrors) {
      this.exit(ExitCodes.VALIDATION_FAILED);
    } else if (flags.strict && hasWarnings) {
      this.exit(ExitCodes.VALIDATION_FAILED);
    } else if (hasWarnings) {
      this.exit(ExitCodes.WARNING);
    }
  }

  private async checkPrinciples(projectPath: string): Promise<ValidationItem[]> {
    const paths = getGovernancePaths(projectPath);
    const files = await listFiles(paths.principles, '.md');
    const items: ValidationItem[] = [];

    for (const file of files) {
      const result = await validatePrincipleFile(file);
      items.push({
        file,
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings.map(w =>
          createWarning('PRINCIPLE_WARNING', w, { file })
        ),
      });
    }

    return items;
  }

  private async checkSkills(projectPath: string): Promise<ValidationItem[]> {
    const paths = getGovernancePaths(projectPath);
    const categories = ['dev', 'qa', 'shared'];
    const items: ValidationItem[] = [];

    for (const category of categories) {
      const categoryPath = `${paths.skills}/${category}`;
      const files = await listFiles(categoryPath, '.md');

      for (const file of files) {
        const result = await validateSkillFile(file);
        items.push({
          file,
          valid: result.valid,
          errors: result.errors,
          warnings: result.warnings.map(w =>
            createWarning('SKILL_WARNING', w, { file })
          ),
        });
      }
    }

    return items;
  }

  private async checkAgents(projectPath: string): Promise<ValidationItem[]> {
    const paths = getGovernancePaths(projectPath);
    const files = await listFiles(paths.agents, '.md');
    const items: ValidationItem[] = [];

    for (const file of files) {
      const result = await validateAgentFile(file);
      items.push({
        file,
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings.map(w =>
          createWarning('AGENT_WARNING', w, { file })
        ),
      });
    }

    return items;
  }

  private displayResults(result: ValidationResult, scope: string, strict: boolean): void {
    this.log('');
    this.log(`Governance Check (scope: ${scope})`);
    this.log('═'.repeat(50));

    if (result.items.length === 0) {
      this.log('No items to check.');
      return;
    }

    // Group by type
    const principles = result.items.filter(i => i.file.includes('/principles/'));
    const skills = result.items.filter(i => i.file.includes('/skills/'));
    const agents = result.items.filter(i => i.file.includes('/agents/'));
    if (principles.length > 0) {
      this.log('');
      this.log('PRINCIPLES');
      this.log('─'.repeat(50));
      this.displayItemGroup(principles);
    }

    if (skills.length > 0) {
      this.log('');
      this.log('SKILLS');
      this.log('─'.repeat(50));
      this.displayItemGroup(skills);
    }

    if (agents.length > 0) {
      this.log('');
      this.log('AGENTS');
      this.log('─'.repeat(50));
      this.displayItemGroup(agents);
    }

    // Summary
    this.log('');
    this.log('─'.repeat(50));
    const totalWarnings = result.items.reduce((sum, i) => sum + i.warnings.length, 0);
    const totalErrors = result.items.reduce((sum, i) => sum + i.errors.length, 0);

    this.log(`Total: ${result.totalFiles} items checked`);
    this.log(`Valid: ${result.validFiles} | Invalid: ${result.invalidFiles}`);
    this.log(`Errors: ${totalErrors} | Warnings: ${totalWarnings}`);

    if (strict && totalWarnings > 0) {
      this.log('');
      this.log('Note: --strict mode treats warnings as errors');
    }
  }

  private displayItemGroup(items: ValidationItem[]): void {
    for (const item of items) {
      const name = item.file.split('/').pop() ?? item.file;
      const icon = item.valid ? (item.warnings.length > 0 ? '⚠' : '✓') : '✗';
      this.log(`  ${icon} ${name}`);

      for (const error of item.errors) {
        this.log(`      ✗ ${error.message}`);
        if (error.suggestion) {
          this.log(`        → ${error.suggestion}`);
        }
      }

      for (const warning of item.warnings) {
        this.log(`      ⚠ ${warning.message}`);
        if (warning.suggestion) {
          this.log(`        → ${warning.suggestion}`);
        }
      }
    }
  }
}
