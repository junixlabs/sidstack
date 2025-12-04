import { Command, Flags } from '@oclif/core';

import { getCommandDiscovery } from '../../lib/config/command-discovery.js';

export default class CommandList extends Command {
  static description = 'List all available Claude Code commands';

  static examples = [
    '<%= config.bin %> command list',
    '<%= config.bin %> command list --json',
    '<%= config.bin %> command list --source bundle',
    '<%= config.bin %> command list --category optional',
  ];

  static flags = {
    json: Flags.boolean({
      description: 'Output in JSON format',
      default: false,
    }),
    source: Flags.string({
      char: 's',
      description: 'Filter by source (project, user, bundle)',
      options: ['project', 'user', 'bundle'],
    }),
    category: Flags.string({
      char: 'c',
      description: 'Filter by category (core, optional)',
      options: ['core', 'optional'],
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
          `  3. sidstack command list   # Run the command again`
      );
    }

    const { flags } = await this.parse(CommandList);
    const discovery = getCommandDiscovery();

    const grouped = await discovery.getAllCommandsGrouped();

    // Apply source filter
    let sources: Array<'project' | 'user' | 'bundle'> = ['project', 'user', 'bundle'];
    if (flags.source) {
      sources = [flags.source as 'project' | 'user' | 'bundle'];
    }

    // Build output data
    interface CommandEntry {
      name: string;
      description: string;
      category: string;
      version: string;
      source: string;
      path: string;
      slashCommand: string;
    }

    const commands: CommandEntry[] = [];

    for (const source of sources) {
      for (const cmd of grouped[source]) {
        // Apply category filter
        if (flags.category && cmd.config.category !== flags.category) {
          continue;
        }

        commands.push({
          name: cmd.name,
          description: cmd.config.description,
          category: cmd.config.category,
          version: cmd.config.version || '1.0.0',
          source,
          path: cmd.path,
          slashCommand: `/sidstack:${cmd.name}`,
        });
      }
    }

    // JSON output
    if (flags.json) {
      this.log(JSON.stringify(commands, null, 2));
      return;
    }

    // Human-readable output
    if (commands.length === 0) {
      this.log('No commands found.');
      this.log('');
      this.log('Run "sidstack command add <name>" to add a command from the bundle.');
      return;
    }

    // Group by source for display
    const bySource: Record<string, CommandEntry[]> = {};
    for (const cmd of commands) {
      if (!bySource[cmd.source]) {
        bySource[cmd.source] = [];
      }
      bySource[cmd.source].push(cmd);
    }

    const sourceLabels: Record<string, string> = {
      project: 'Project (.claude/commands/sidstack/)',
      user: 'User (~/.sidstack/commands/)',
      bundle: 'Bundle (built-in)',
    };

    for (const source of ['project', 'user', 'bundle']) {
      const sourceCommands = bySource[source];
      if (!sourceCommands || sourceCommands.length === 0) continue;

      this.log('');
      this.log(`${sourceLabels[source]}`);
      this.log('─'.repeat(50));

      for (const cmd of sourceCommands) {
        const categoryBadge = cmd.category === 'core' ? '[core]' : '[opt]';
        const versionBadge = `v${cmd.version}`;
        this.log(`  ${cmd.name} ${categoryBadge} ${versionBadge}`);
        this.log(`    ${cmd.description}`);
        this.log(`    Usage: ${cmd.slashCommand}`);
      }
    }

    this.log('');
    this.log(`Total: ${commands.length} command(s)`);
    this.log('');
    this.log('Tip: Use "sidstack command add <name>" to add a command to your project.');
  }
}
