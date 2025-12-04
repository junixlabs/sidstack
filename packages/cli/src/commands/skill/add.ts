import { Args, Command, Flags } from '@oclif/core';

import { getSkillDiscovery } from '../../lib/config/skill-discovery.js';

export default class SkillAdd extends Command {
  static description = 'Add a skill to project or user directory';

  static examples = [
    '<%= config.bin %> skill add implementation-analysis',
    '<%= config.bin %> skill add code-review --global',
    '<%= config.bin %> skill add research-first --force',
  ];

  static args = {
    name: Args.string({
      description: 'Skill name to add',
      required: true,
    }),
  };

  static flags = {
    global: Flags.boolean({
      char: 'g',
      description: 'Add to user directory (~/.sidstack/skills/)',
      default: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite if skill already exists',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SkillAdd);
    const discovery = getSkillDiscovery();

    // Check if skill exists in source
    const skill = await discovery.resolveSkill(args.name);
    if (!skill) {
      this.error(`Skill '${args.name}' not found.

Run 'sidstack skill list' to see available skills.`);
    }

    const targetTier = flags.global ? 'user' : 'project';

    // Check if already exists in target
    if (discovery.skillExistsInTier(args.name, targetTier)) {
      if (!flags.force) {
        this.error(`Skill '${args.name}' already exists in ${targetTier} directory.

Use --force to overwrite.`);
      }
      this.log(`Overwriting existing skill in ${targetTier} directory...`);
    }

    // Copy to target
    const result = flags.global
      ? await discovery.copyToUser(args.name)
      : await discovery.copyToProject(args.name);

    if (!result.success) {
      this.error(`Failed to add skill: ${result.error}`);
    }

    this.log('');
    this.log(`Added skill '${args.name}' to ${targetTier} directory.`);
    this.log(`Path: ${result.path}`);
    this.log('');
    this.log('You can now customize this skill by editing the file.');
  }
}
