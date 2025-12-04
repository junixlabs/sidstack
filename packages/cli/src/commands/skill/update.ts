import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

import { Args, Command, Flags } from '@oclif/core';

import { getSkillDiscovery, SkillConfig } from '../../lib/config/skill-discovery.js';

export default class SkillUpdate extends Command {
  static description = 'Update an existing skill metadata or content';

  static examples = [
    '<%= config.bin %> skill update my-skill --priority high',
    '<%= config.bin %> skill update my-skill --edit',
    '<%= config.bin %> skill update my-skill --body-file ./new-content.md',
  ];

  static args = {
    name: Args.string({
      description: 'Skill name to update',
      required: true,
    }),
  };

  static flags = {
    priority: Flags.string({
      char: 'p',
      description: 'Update skill priority',
      options: ['critical', 'high', 'medium', 'low'],
    }),
    category: Flags.string({
      char: 'c',
      description: 'Update skill category',
      options: ['core', 'optional'],
    }),
    description: Flags.string({
      char: 'd',
      description: 'Update skill description',
    }),
    'body-file': Flags.string({
      description: 'Path to file containing new skill body content',
    }),
    edit: Flags.boolean({
      char: 'e',
      description: 'Open skill in $EDITOR for editing',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SkillUpdate);
    const discovery = getSkillDiscovery();

    // Check if skill exists in project or user directory (not bundle)
    const projectExists = discovery.skillExistsInTier(args.name, 'project');
    const userExists = discovery.skillExistsInTier(args.name, 'user');

    if (!projectExists && !userExists) {
      // Check if it's a bundle skill
      if (discovery.skillExistsInTier(args.name, 'bundle')) {
        this.error(`Cannot update bundle skill '${args.name}'.

Use 'sidstack skill eject ${args.name}' to copy it for customization first.`);
      }

      this.error(`Skill '${args.name}' not found in project or user directory.

Run 'sidstack skill list' to see available skills.`);
    }

    // Determine which tier to update
    const tier = projectExists ? 'project' : 'user';
    const dirs = discovery.getDirectories();
    const skillPath = path.join(tier === 'project' ? dirs.project : dirs.user, `${args.name}.md`);

    // Handle --edit flag
    if (flags.edit) {
      const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
      try {
        execSync(`${editor} "${skillPath}"`, { stdio: 'inherit' });
        this.log(`Skill '${args.name}' updated.`);
        return;
      } catch (e) {
        this.error(`Failed to open editor: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    // Build updates object
    const configUpdates: Partial<SkillConfig> = {};
    let bodyUpdate: string | undefined;

    if (flags.priority) {
      configUpdates.priority = flags.priority as SkillConfig['priority'];
    }

    if (flags.category) {
      configUpdates.category = flags.category as SkillConfig['category'];
    }

    if (flags.description) {
      configUpdates.description = flags.description;
    }

    if (flags['body-file']) {
      if (!fs.existsSync(flags['body-file'])) {
        this.error(`Body file not found: ${flags['body-file']}`);
      }
      bodyUpdate = fs.readFileSync(flags['body-file'], 'utf-8');
    }

    // Check if any updates provided
    if (Object.keys(configUpdates).length === 0 && !bodyUpdate) {
      this.error(`No updates specified.

Available update options:
  --priority <critical|high|medium|low>
  --category <core|optional>
  --description <text>
  --body-file <path>
  --edit (opens in $EDITOR)`);
    }

    // Apply updates
    const result = await discovery.updateSkill(args.name, {
      config: Object.keys(configUpdates).length > 0 ? configUpdates : undefined,
      body: bodyUpdate,
    });

    if (!result.success) {
      this.error(`Failed to update skill: ${result.error}`);
    }

    this.log(`Updated skill '${args.name}' in ${tier} directory.`);

    // Show what was updated
    if (Object.keys(configUpdates).length > 0) {
      this.log('Updated fields:');
      for (const [key, value] of Object.entries(configUpdates)) {
        this.log(`  ${key}: ${value}`);
      }
    }

    if (bodyUpdate) {
      this.log('  body: updated from file');
    }
  }
}
