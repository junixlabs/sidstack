import { Args, Command, Flags } from '@oclif/core';
import { confirm } from '@inquirer/prompts';

import { getSkillDiscovery } from '../../lib/config/skill-discovery.js';

export default class SkillRemove extends Command {
  static description = 'Remove a skill from project or user directory';

  static examples = [
    '<%= config.bin %> skill remove my-skill',
    '<%= config.bin %> skill remove my-skill --global',
    '<%= config.bin %> skill remove my-skill --force',
  ];

  static args = {
    name: Args.string({
      description: 'Skill name to remove',
      required: true,
    }),
  };

  static flags = {
    global: Flags.boolean({
      char: 'g',
      description: 'Remove from user directory (~/.sidstack/skills/)',
      default: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Skip confirmation prompt',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SkillRemove);
    const discovery = getSkillDiscovery();

    const targetTier = flags.global ? 'user' : 'project';

    // Check if skill exists in target tier
    if (!discovery.skillExistsInTier(args.name, targetTier)) {
      // Check if it only exists in bundle
      if (discovery.skillExistsInTier(args.name, 'bundle')) {
        this.error(`Cannot remove bundle skill '${args.name}'.

Bundle skills are read-only. Use 'sidstack skill eject ${args.name}' to copy it for customization first.`);
      }

      this.error(`Skill '${args.name}' not found in ${targetTier} directory.

Run 'sidstack skill list' to see available skills.`);
    }

    // Confirm unless --force
    if (!flags.force) {
      const confirmed = await confirm({
        message: `Are you sure you want to remove skill '${args.name}' from ${targetTier} directory?`,
        default: false,
      });

      if (!confirmed) {
        this.log('Cancelled.');
        return;
      }
    }

    // Remove skill
    const result = await discovery.removeSkillFromTier(args.name, targetTier);

    if (!result.success) {
      this.error(`Failed to remove skill: ${result.error}`);
    }

    this.log(`Removed skill '${args.name}' from ${targetTier} directory.`);
  }
}
