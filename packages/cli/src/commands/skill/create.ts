import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

import { Command, Flags } from '@oclif/core';
import { input, select } from '@inquirer/prompts';

import { getSkillDiscovery, SkillConfig } from '../../lib/config/skill-discovery.js';

export default class SkillCreate extends Command {
  static description = 'Create a new custom skill';

  static examples = [
    '<%= config.bin %> skill create',
    '<%= config.bin %> skill create --global',
    '<%= config.bin %> skill create --name my-skill --description "My custom skill"',
  ];

  static flags = {
    global: Flags.boolean({
      char: 'g',
      description: 'Create in user directory (~/.sidstack/skills/)',
      default: false,
    }),
    name: Flags.string({
      char: 'n',
      description: 'Skill name',
    }),
    description: Flags.string({
      char: 'd',
      description: 'Skill description',
    }),
    category: Flags.string({
      char: 'c',
      description: 'Skill category (core, optional)',
      options: ['core', 'optional'],
    }),
    priority: Flags.string({
      char: 'p',
      description: 'Skill priority (critical, high, medium, low)',
      options: ['critical', 'high', 'medium', 'low'],
    }),
    'body-file': Flags.string({
      description: 'Path to file containing skill body content',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(SkillCreate);
    const discovery = getSkillDiscovery();

    // Collect skill metadata (interactive or from flags)
    let name = flags.name;
    let description = flags.description;
    let category = flags.category as 'core' | 'optional' | undefined;
    let priority = flags.priority as 'critical' | 'high' | 'medium' | 'low' | undefined;

    // Interactive prompts for missing values
    if (!name) {
      name = await input({
        message: 'Skill name (lowercase, hyphens allowed):',
        validate: (value) => {
          if (!value) return 'Name is required';
          if (!/^[a-z0-9-]+$/.test(value)) return 'Name must be lowercase letters, numbers, and hyphens only';
          return true;
        },
      });
    }

    if (!description) {
      description = await input({
        message: 'Skill description:',
        validate: (value) => value ? true : 'Description is required',
      });
    }

    if (!category) {
      category = await select({
        message: 'Skill category:',
        choices: [
          { name: 'core - Always loaded for agents', value: 'core' },
          { name: 'optional - Loaded on demand', value: 'optional' },
        ],
      }) as 'core' | 'optional';
    }

    if (!priority) {
      priority = await select({
        message: 'Skill priority:',
        choices: [
          { name: 'critical - Highest priority, applied first', value: 'critical' },
          { name: 'high - Important skill', value: 'high' },
          { name: 'medium - Standard priority', value: 'medium' },
          { name: 'low - Lowest priority, applied last', value: 'low' },
        ],
      }) as 'critical' | 'high' | 'medium' | 'low';
    }

    // Get body content
    let body: string;

    if (flags['body-file']) {
      // Read from file
      if (!fs.existsSync(flags['body-file'])) {
        this.error(`Body file not found: ${flags['body-file']}`);
      }
      body = fs.readFileSync(flags['body-file'], 'utf-8');
    } else {
      // Open editor for body content
      body = await this.editInEditor(name, description);
    }

    // Check if skill already exists
    const targetTier = flags.global ? 'user' : 'project';
    if (discovery.skillExistsInTier(name, targetTier)) {
      this.error(`Skill '${name}' already exists in ${targetTier} directory.

Use 'sidstack skill remove ${name}' to remove it first, or choose a different name.`);
    }

    // Create skill
    const config: SkillConfig = {
      name,
      description,
      category,
      priority,
    };

    const result = await discovery.createSkill(config, body, targetTier);

    if (!result.success) {
      this.error(`Failed to create skill: ${result.error}`);
    }

    this.log('');
    this.log(`Created skill '${name}' in ${targetTier} directory.`);
    this.log(`Path: ${result.path}`);
  }

  private async editInEditor(name: string, description: string): Promise<string> {
    const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
    const tempFile = path.join(os.tmpdir(), `skill-${name}-${Date.now()}.md`);

    // Create template content
    const template = `# ${name}

${description}

## When to Apply This Skill

- [Describe when agents should use this skill]

## Instructions

[Add skill instructions here]

## Rules

1. [Rule 1]
2. [Rule 2]

## Examples

[Add examples if helpful]
`;

    fs.writeFileSync(tempFile, template, 'utf-8');

    try {
      // Open editor
      execSync(`${editor} "${tempFile}"`, { stdio: 'inherit' });

      // Read edited content
      const content = fs.readFileSync(tempFile, 'utf-8');
      return content;
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }
}
