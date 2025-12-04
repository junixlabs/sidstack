import * as fs from 'node:fs';
import * as path from 'node:path';

import { Args, Command, Flags } from '@oclif/core';
import { parse as parseYaml } from 'yaml';

import { getSkillDiscovery, SkillConfig } from '../../lib/config/skill-discovery.js';

interface ValidationResult {
  name: string;
  path: string;
  source: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export default class SkillValidate extends Command {
  static description = 'Validate skill format and configuration';

  static examples = [
    '<%= config.bin %> skill validate',
    '<%= config.bin %> skill validate my-skill',
    '<%= config.bin %> skill validate --strict',
    '<%= config.bin %> skill validate --json',
  ];

  static args = {
    name: Args.string({
      description: 'Specific skill name to validate (validates all if omitted)',
      required: false,
    }),
  };

  static flags = {
    strict: Flags.boolean({
      description: 'Enable strict validation (additional checks)',
      default: false,
    }),
    json: Flags.boolean({
      description: 'Output in JSON format',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SkillValidate);
    const discovery = getSkillDiscovery();

    const results: ValidationResult[] = [];

    if (args.name) {
      // Validate specific skill
      const skill = await discovery.resolveSkill(args.name);
      if (!skill) {
        this.error(`Skill '${args.name}' not found.

Run 'sidstack skill list' to see available skills.`);
      }

      const result = await this.validateSkillFile(skill.sourcePath, args.name, skill.source, flags.strict);
      results.push(result);
    } else {
      // Validate all project and user skills
      const grouped = await discovery.getAllSkillsGrouped();
      const dirs = discovery.getDirectories();

      // Validate project skills
      for (const skill of grouped.project) {
        const result = await this.validateSkillFile(skill.path, skill.name, 'project', flags.strict);
        results.push(result);
      }

      // Validate user skills
      for (const skill of grouped.user) {
        const result = await this.validateSkillFile(skill.path, skill.name, 'user', flags.strict);
        results.push(result);
      }

      // Optionally validate bundle skills too
      if (flags.strict) {
        for (const skill of grouped.bundle) {
          const result = await this.validateSkillFile(skill.path, skill.name, 'bundle', flags.strict);
          results.push(result);
        }
      }
    }

    // JSON output
    if (flags.json) {
      this.log(JSON.stringify(results, null, 2));
      const hasErrors = results.some(r => !r.valid);
      if (hasErrors) {
        this.exit(1);
      }
      return;
    }

    // Human-readable output
    if (results.length === 0) {
      this.log('No skills to validate.');
      this.log('Run "sidstack skill create" to create a new skill.');
      return;
    }

    let totalErrors = 0;
    let totalWarnings = 0;

    for (const result of results) {
      const statusIcon = result.valid ? '\u2713' : '\u2717';
      const statusColor = result.valid ? '' : '';

      this.log('');
      this.log(`${statusIcon} ${result.name} (${result.source})`);
      this.log(`  Path: ${result.path}`);

      if (result.errors.length > 0) {
        for (const error of result.errors) {
          this.log(`  Error: ${error}`);
          totalErrors++;
        }
      }

      if (result.warnings.length > 0) {
        for (const warning of result.warnings) {
          this.log(`  Warning: ${warning}`);
          totalWarnings++;
        }
      }

      if (result.valid && result.warnings.length === 0) {
        this.log('  Valid');
      }
    }

    this.log('');
    this.log('─'.repeat(40));
    this.log(`Validated: ${results.length} skill(s)`);
    this.log(`Errors: ${totalErrors}`);
    this.log(`Warnings: ${totalWarnings}`);

    if (totalErrors > 0) {
      this.exit(1);
    }
  }

  private async validateSkillFile(
    filePath: string,
    name: string,
    source: string,
    strict: boolean
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      name,
      path: filePath,
      source,
      valid: true,
      errors: [],
      warnings: [],
    };

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');

      // Check frontmatter format
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

      if (!frontmatterMatch) {
        result.valid = false;
        result.errors.push('Missing or invalid YAML frontmatter. File must start with --- and have a closing ---');
        return result;
      }

      // Parse YAML
      let config: SkillConfig;
      try {
        config = parseYaml(frontmatterMatch[1]) as SkillConfig;
      } catch (e) {
        result.valid = false;
        result.errors.push(`Invalid YAML in frontmatter: ${e instanceof Error ? e.message : 'Unknown error'}`);
        return result;
      }

      // Validate required fields
      if (!config.name) {
        result.valid = false;
        result.errors.push('Missing required field: name');
      } else if (config.name !== name) {
        result.warnings.push(`Skill name '${config.name}' does not match filename '${name}'`);
      }

      if (!config.description) {
        result.valid = false;
        result.errors.push('Missing required field: description');
      }

      if (!config.category) {
        result.valid = false;
        result.errors.push('Missing required field: category');
      } else if (!['core', 'optional'].includes(config.category)) {
        result.valid = false;
        result.errors.push(`Invalid category '${config.category}'. Must be: core or optional`);
      }

      if (!config.priority) {
        result.valid = false;
        result.errors.push('Missing required field: priority');
      } else if (!['critical', 'high', 'medium', 'low'].includes(config.priority)) {
        result.valid = false;
        result.errors.push(`Invalid priority '${config.priority}'. Must be: critical, high, medium, or low`);
      }

      // Check body content
      const body = frontmatterMatch[2].trim();

      if (!body) {
        result.warnings.push('Skill body is empty');
      } else if (body.length < 50) {
        result.warnings.push('Skill body is very short (less than 50 characters)');
      }

      // Strict mode checks
      if (strict) {
        // Check for common markdown structure
        if (!body.includes('#')) {
          result.warnings.push('No headings found in skill body');
        }

        // Check description length
        if (config.description && config.description.length < 20) {
          result.warnings.push('Description is very short (less than 20 characters)');
        }

        if (config.description && config.description.length > 200) {
          result.warnings.push('Description is very long (more than 200 characters)');
        }
      }

    } catch (e) {
      result.valid = false;
      result.errors.push(`Failed to read file: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    return result;
  }
}
