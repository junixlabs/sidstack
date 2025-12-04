import { Args, Command, Flags } from '@oclif/core';

import { getSkillDiscovery } from '../../lib/config/skill-discovery.js';

export default class SkillShow extends Command {
  static description = 'Show skill details and content';

  static examples = [
    '<%= config.bin %> skill show implementation-analysis',
    '<%= config.bin %> skill show code-review --full',
    '<%= config.bin %> skill show research-first --json',
  ];

  static args = {
    name: Args.string({
      description: 'Skill name',
      required: true,
    }),
  };

  static flags = {
    full: Flags.boolean({
      char: 'f',
      description: 'Show complete skill content',
      default: false,
    }),
    json: Flags.boolean({
      description: 'Output in JSON format',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SkillShow);
    const discovery = getSkillDiscovery();

    const skill = await discovery.resolveSkill(args.name);

    if (!skill) {
      this.error(`Skill '${args.name}' not found.

Run 'sidstack skill list' to see available skills.`);
    }

    // JSON output
    if (flags.json) {
      this.log(JSON.stringify({
        name: skill.config.name,
        description: skill.config.description,
        category: skill.config.category,
        priority: skill.config.priority,
        source: skill.source,
        sourcePath: skill.sourcePath,
        body: flags.full ? skill.body : undefined,
      }, null, 2));
      return;
    }

    // Human-readable output
    this.log('');
    this.log(`Skill: ${skill.config.name}`);
    this.log('═'.repeat(50));
    this.log('');
    this.log(`Description: ${skill.config.description}`);
    this.log(`Category:    ${skill.config.category}`);
    this.log(`Priority:    ${skill.config.priority}`);
    this.log(`Source:      ${skill.source}`);
    this.log(`Path:        ${skill.sourcePath}`);
    this.log('');

    if (flags.full) {
      this.log('Content:');
      this.log('─'.repeat(50));
      this.log(skill.body);
    } else {
      // Show preview (first 20 lines)
      const lines = skill.body.split('\n');
      const previewLines = lines.slice(0, 20);

      this.log('Content Preview (first 20 lines):');
      this.log('─'.repeat(50));
      this.log(previewLines.join('\n'));

      if (lines.length > 20) {
        this.log('');
        this.log(`... ${lines.length - 20} more lines. Use --full to see complete content.`);
      }
    }
  }
}
