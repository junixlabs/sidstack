import { Args, Command, Flags } from '@oclif/core';

import { getCommandDiscovery } from '../../lib/config/command-discovery.js';

export default class CommandUpdate extends Command {
  static description = 'Update Claude Code commands from bundle';

  static examples = [
    '<%= config.bin %> command update',
    '<%= config.bin %> command update knowledge',
    '<%= config.bin %> command update --check',
    '<%= config.bin %> command update --all',
  ];

  static args = {
    name: Args.string({
      description: 'Command name to update (omit to check all)',
      required: false,
    }),
  };

  static flags = {
    check: Flags.boolean({
      description: 'Only check for updates, do not apply',
      default: false,
    }),
    all: Flags.boolean({
      description: 'Update all outdated commands',
      default: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Force update even if version is same',
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
          `  3. sidstack command update # Run the command again`
      );
    }

    const { args, flags } = await this.parse(CommandUpdate);
    const discovery = getCommandDiscovery();

    // Get update info
    const updates = await discovery.checkForUpdates();

    if (updates.length === 0) {
      this.log('');
      this.log('No installed commands found that have bundle versions.');
      this.log('');
      this.log('Run "sidstack command list" to see available commands.');
      return;
    }

    // If specific command requested
    if (args.name) {
      const update = updates.find((u) => u.name === args.name);
      if (!update) {
        this.error(`Command '${args.name}' not found in project or user directory, or not in bundle.`);
      }

      if (!update.needsUpdate && !flags.force) {
        this.log('');
        this.log(`Command '${args.name}' is up to date (v${update.currentVersion}).`);
        return;
      }

      if (flags.check) {
        this.log('');
        if (update.needsUpdate) {
          this.log(`Update available: ${args.name} v${update.currentVersion} → v${update.bundleVersion}`);
        } else {
          this.log(`No update needed: ${args.name} v${update.currentVersion}`);
        }
        return;
      }

      // Apply update
      const result =
        update.source === 'project'
          ? await discovery.copyToProject(args.name)
          : await discovery.copyToUser(args.name);

      if (!result.success) {
        this.error(`Failed to update: ${result.error}`);
      }

      this.log('');
      this.log(`✓ Updated '${args.name}' v${update.currentVersion} → v${update.bundleVersion}`);
      this.log(`  Path: ${result.path}`);
      return;
    }

    // Check only mode
    if (flags.check) {
      this.log('');
      this.log('Checking for updates...');
      this.log('');

      let hasUpdates = false;
      for (const update of updates) {
        if (update.needsUpdate) {
          hasUpdates = true;
          this.log(`  ⬆ ${update.name}: v${update.currentVersion} → v${update.bundleVersion} (${update.source})`);
        } else {
          this.log(`  ✓ ${update.name}: v${update.currentVersion} (up to date)`);
        }
      }

      this.log('');
      if (hasUpdates) {
        this.log('Run "sidstack command update --all" to apply updates.');
      } else {
        this.log('All commands are up to date.');
      }
      return;
    }

    // Update all mode
    if (flags.all || !args.name) {
      const toUpdate = updates.filter((u) => u.needsUpdate || flags.force);

      if (toUpdate.length === 0) {
        this.log('');
        this.log('All commands are up to date.');
        return;
      }

      this.log('');
      this.log(`Updating ${toUpdate.length} command(s)...`);
      this.log('');

      let updated = 0;
      let failed = 0;

      for (const update of toUpdate) {
        const result =
          update.source === 'project'
            ? await discovery.copyToProject(update.name)
            : await discovery.copyToUser(update.name);

        if (result.success) {
          this.log(`  ✓ ${update.name}: v${update.currentVersion} → v${update.bundleVersion}`);
          updated++;
        } else {
          this.log(`  ✗ ${update.name}: ${result.error}`);
          failed++;
        }
      }

      this.log('');
      this.log(`Updated: ${updated}, Failed: ${failed}`);
    }
  }
}
