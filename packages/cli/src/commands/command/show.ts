import { Args, Command, Flags } from '@oclif/core';

import { getCommandDiscovery } from '../../lib/config/command-discovery.js';

export default class CommandShow extends Command {
  static description = 'Show details of a Claude Code command';

  static examples = [
    '<%= config.bin %> command show knowledge',
    '<%= config.bin %> command show agent --json',
  ];

  static args = {
    name: Args.string({
      description: 'Command name to show',
      required: true,
    }),
  };

  static flags = {
    json: Flags.boolean({
      description: 'Output in JSON format',
      default: false,
    }),
    content: Flags.boolean({
      description: 'Show full content of the command file',
      default: false,
    }),
  };

  async run(): Promise<void> {
    // Check if current directory exists
    try {
      process.cwd();
    } catch {
      this.error(
        `Current directory no longer exists.\n\n` +
          `This usually happens when:\n` +
          `  - The directory was deleted or renamed\n` +
          `  - You're in a temporary directory that was cleaned up\n\n` +
          `Next steps:\n` +
          `  1. cd ~                    # Go to home directory\n` +
          `  2. cd /path/to/project     # Navigate to your project\n` +
          `  3. sidstack command show   # Run the command again`
      );
    }

    const { args, flags } = await this.parse(CommandShow);
    const discovery = getCommandDiscovery();

    const command = await discovery.resolveCommand(args.name);

    if (!command) {
      this.error(`Command '${args.name}' not found.

Run 'sidstack command list' to see available commands.`);
    }

    // JSON output
    if (flags.json) {
      const output = {
        name: args.name,
        slashCommand: `/sidstack:${args.name}`,
        config: command.config,
        source: command.source,
        sourcePath: command.sourcePath,
        ...(flags.content ? { body: command.body } : {}),
      };
      this.log(JSON.stringify(output, null, 2));
      return;
    }

    // Human-readable output
    this.log('');
    this.log(`Command: ${args.name}`);
    this.log('═'.repeat(50));
    this.log('');
    this.log(`  Name:        ${command.config.name}`);
    this.log(`  Description: ${command.config.description}`);
    this.log(`  Category:    ${command.config.category}`);
    this.log(`  Version:     ${command.config.version || '1.0.0'}`);
    this.log(`  Source:      ${command.source}`);
    this.log(`  Path:        ${command.sourcePath}`);
    this.log('');
    this.log(`  Usage:       /sidstack:${args.name}`);
    this.log('');

    if (command.config.tags && command.config.tags.length > 0) {
      this.log(`  Tags:        ${command.config.tags.join(', ')}`);
      this.log('');
    }

    // Show content if requested
    if (flags.content) {
      this.log('Content:');
      this.log('─'.repeat(50));
      this.log(command.body);
      this.log('─'.repeat(50));
    } else {
      this.log('Tip: Use --content flag to see the full command content.');
    }
  }
}
