import { Args, Command, Flags } from '@oclif/core';

import { getCommandDiscovery } from '../../lib/config/command-discovery.js';

export default class CommandRemove extends Command {
  static description = 'Remove a Claude Code command from project or user directory';

  static examples = [
    '<%= config.bin %> command remove knowledge',
    '<%= config.bin %> command remove sidstack --global',
  ];

  static args = {
    name: Args.string({
      description: 'Command name to remove',
      required: true,
    }),
  };

  static flags = {
    global: Flags.boolean({
      char: 'g',
      description: 'Remove from user directory (~/.sidstack/commands/)',
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
          `  3. sidstack command remove # Run the command again`
      );
    }

    const { args, flags } = await this.parse(CommandRemove);
    const discovery = getCommandDiscovery();

    const targetTier = flags.global ? 'user' : 'project';
    const targetLabel = flags.global ? 'user directory' : 'project';

    // Check if command exists in target tier
    if (!discovery.commandExistsInTier(args.name, targetTier)) {
      this.error(`Command '${args.name}' not found in ${targetLabel}.

Run 'sidstack command list' to see installed commands.`);
    }

    // Remove from target
    const result = await discovery.removeCommandFromTier(args.name, targetTier);

    if (!result.success) {
      this.error(`Failed to remove command: ${result.error}`);
    }

    this.log('');
    this.log(`✓ Removed command '${args.name}' from ${targetLabel}.`);
    this.log('');

    // Check if still available from another tier
    const command = await discovery.resolveCommand(args.name);
    if (command) {
      this.log(`Note: Command is still available from ${command.source}.`);
      this.log(`      /sidstack:${args.name} will use the ${command.source} version.`);
    } else {
      this.log(`/sidstack:${args.name} is no longer available.`);
      this.log('Run "sidstack command add <name>" to re-add it.');
    }
  }
}
