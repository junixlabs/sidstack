import { Args, Command, Flags } from '@oclif/core';

import { getSkillDiscovery } from '../../lib/config/skill-discovery.js';

export default class SkillEject extends Command {
  static description = 'Copy a bundle skill for customization';

  static examples = [
    '<%= config.bin %> skill eject implementation-analysis',
    '<%= config.bin %> skill eject code-review --global',
    '<%= config.bin %> skill eject research-first --as my-research',
  ];

  static args = {
    name: Args.string({
      description: 'Bundle skill name to eject',
      required: true,
    }),
  };

  static flags = {
    global: Flags.boolean({
      char: 'g',
      description: 'Eject to user directory (~/.sidstack/skills/)',
      default: false,
    }),
    as: Flags.string({
      description: 'Rename the skill when ejecting',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite if skill already exists',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SkillEject);
    const discovery = getSkillDiscovery();

    // Check if skill exists in bundle
    if (!discovery.skillExistsInTier(args.name, 'bundle')) {
      this.error(`Skill '${args.name}' not found in bundle.

Run 'sidstack skill list --source bundle' to see available bundle skills.`);
    }

    const targetName = flags.as || args.name;
    const targetTier = flags.global ? 'user' : 'project';

    // Check if already exists in target
    if (discovery.skillExistsInTier(targetName, targetTier)) {
      if (!flags.force) {
        this.error(`Skill '${targetName}' already exists in ${targetTier} directory.

Use --force to overwrite.`);
      }
      this.log(`Overwriting existing skill in ${targetTier} directory...`);
    }

    // Get the bundle skill
    const skill = await discovery.resolveSkill(args.name);
    if (!skill) {
      this.error(`Failed to resolve skill '${args.name}'.`);
    }

    // Create in target with potentially new name
    const config = {
      ...skill.config,
      name: targetName,
    };

    const result = await discovery.createSkill(config, skill.body, targetTier);

    if (!result.success) {
      this.error(`Failed to eject skill: ${result.error}`);
    }

    this.log('');
    this.log(`Ejected skill '${args.name}' to ${targetTier} directory.`);
    if (flags.as) {
      this.log(`Renamed to: ${targetName}`);
    }
    this.log(`Path: ${result.path}`);
    this.log('');
    this.log('You can now customize this skill by editing the file.');
    this.log('The project/user version will take precedence over the bundle version.');
  }
}
