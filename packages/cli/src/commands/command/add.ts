import { Args, Command, Flags } from '@oclif/core';

import { getCommandDiscovery } from '../../lib/config/command-discovery.js';

export default class CommandAdd extends Command {
  static description = 'Add a Claude Code command to project or user directory';

  static examples = [
    '<%= config.bin %> command add knowledge --global',
    '<%= config.bin %> command add agent --force',
    '<%= config.bin %> command add --all-optional',
  ];

  static args = {
    name: Args.string({
      description: 'Command name to add (omit if using --all-optional)',
      required: false,
    }),
  };

  static flags = {
    global: Flags.boolean({
      char: 'g',
      description: 'Add to user directory (~/.sidstack/commands/)',
      default: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite if command already exists',
      default: false,
    }),
    'all-optional': Flags.boolean({
      description: 'Add all optional commands from bundle',
      default: false,
    }),
    'all-core': Flags.boolean({
      description: 'Add all core commands from bundle',
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
          `  3. sidstack command add    # Run the command again`
      );
    }

    const { args, flags } = await this.parse(CommandAdd);
    const discovery = getCommandDiscovery();

    const targetTier = flags.global ? 'user' : 'project';
    const targetLabel = flags.global ? 'user directory' : 'project';

    // Handle --all-optional or --all-core flags
    if (flags['all-optional'] || flags['all-core']) {
      await this.addMultipleCommands(discovery, targetTier, flags);
      return;
    }

    // Require name if not using batch flags
    if (!args.name) {
      this.error(`Command name is required.

Run 'sidstack command list --source bundle' to see available commands.
Or use --all-optional to add all optional commands.`);
    }

    // Check if command exists in source
    const command = await discovery.resolveCommand(args.name);
    if (!command) {
      this.error(`Command '${args.name}' not found.

Run 'sidstack command list --source bundle' to see available commands.`);
    }

    // Check if already exists in target
    if (discovery.commandExistsInTier(args.name, targetTier)) {
      if (!flags.force) {
        this.error(`Command '${args.name}' already exists in ${targetLabel}.

Use --force to overwrite.`);
      }
      this.log(`Overwriting existing command in ${targetLabel}...`);
    }

    // Copy to target
    const result = flags.global
      ? await discovery.copyToUser(args.name)
      : await discovery.copyToProject(args.name);

    if (!result.success) {
      this.error(`Failed to add command: ${result.error}`);
    }

    this.log('');
    this.log(`✓ Added command '${args.name}' to ${targetLabel}.`);
    this.log(`  Path: ${result.path}`);
    this.log('');
    this.log(`You can now use /sidstack:${args.name} in Claude Code.`);
  }

  private async addMultipleCommands(
    discovery: ReturnType<typeof getCommandDiscovery>,
    targetTier: 'project' | 'user',
    flags: { 'all-optional': boolean; 'all-core': boolean; force: boolean; global: boolean }
  ): Promise<void> {
    const bundleCommands = await discovery.getBundleCommands();
    const targetLabel = flags.global ? 'user directory' : 'project';

    // Filter by category
    let commandsToAdd = bundleCommands;
    if (flags['all-optional'] && !flags['all-core']) {
      commandsToAdd = bundleCommands.filter((c) => c.category === 'optional');
    } else if (flags['all-core'] && !flags['all-optional']) {
      commandsToAdd = bundleCommands.filter((c) => c.category === 'core');
    }

    if (commandsToAdd.length === 0) {
      this.log('No commands to add.');
      return;
    }

    this.log('');
    this.log(`Adding ${commandsToAdd.length} command(s) to ${targetLabel}...`);
    this.log('');

    let added = 0;
    let skipped = 0;

    for (const cmd of commandsToAdd) {
      // Check if already exists
      if (discovery.commandExistsInTier(cmd.name, targetTier)) {
        if (!flags.force) {
          this.log(`  - ${cmd.name}: Skipped (already exists, use --force to overwrite)`);
          skipped++;
          continue;
        }
      }

      const result = flags.global
        ? await discovery.copyToUser(cmd.name)
        : await discovery.copyToProject(cmd.name);

      if (result.success) {
        this.log(`  ✓ ${cmd.name}`);
        added++;
      } else {
        this.log(`  ✗ ${cmd.name}: ${result.error}`);
      }
    }

    this.log('');
    this.log(`Added: ${added}, Skipped: ${skipped}`);
    this.log('');
    this.log('You can now use these commands in Claude Code:');
    for (const cmd of commandsToAdd) {
      if (!discovery.commandExistsInTier(cmd.name, targetTier) || flags.force) {
        this.log(`  /sidstack:${cmd.name}`);
      }
    }
  }
}
