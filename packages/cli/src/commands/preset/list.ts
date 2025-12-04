/**
 * preset list - List available initialization presets
 *
 * Agent-friendly output with JSON support.
 */

import { Command, Flags } from '@oclif/core';
import { listPresets } from '../../lib/preset-loader.js';
import { successResponse, ExitCodes } from '../../lib/output.js';

export default class PresetList extends Command {
  static description = 'List available initialization presets';

  static examples = [
    '<%= config.bin %> preset list',
    '<%= config.bin %> preset list --json',
    '<%= config.bin %> preset list --language typescript',
  ];

  static flags = {
    json: Flags.boolean({
      char: 'j',
      description: 'Output in JSON format (agent-friendly)',
      default: false,
    }),
    quiet: Flags.boolean({
      char: 'q',
      description: 'Minimal output',
      default: false,
    }),
    language: Flags.string({
      char: 'l',
      description: 'Filter by language (typescript, python, go, any)',
    }),
    type: Flags.string({
      char: 't',
      description: 'Filter by project type (fullstack, backend, general)',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PresetList);

    let presets = listPresets();

    // Apply filters
    if (flags.language) {
      presets = presets.filter(p =>
        p.language === flags.language || p.language === 'any'
      );
    }
    if (flags.type) {
      presets = presets.filter(p =>
        p.projectType === flags.type || p.projectType === 'general'
      );
    }

    if (flags.json) {
      const response = successResponse('preset list', {
        presets,
        total: presets.length,
        filters: {
          language: flags.language || null,
          type: flags.type || null,
        },
      });
      this.log(JSON.stringify(response, null, 2));
      return;
    }

    if (flags.quiet) {
      for (const preset of presets) {
        this.log(preset.name);
      }
      return;
    }

    if (presets.length === 0) {
      this.log('No presets found matching criteria.');
      return;
    }

    this.log(`Found ${presets.length} preset(s):\n`);

    for (const preset of presets) {
      this.log(`${preset.name}`);
      this.log(`  ${preset.displayName}`);
      this.log(`  ${preset.description}`);
      this.log(`  Language: ${preset.language} | Type: ${preset.projectType}`);
      this.log(`  Agents: ${preset.agentCount} | Skills: ${preset.skillCount}`);
      this.log('');
    }

    this.log('Usage: sidstack init --preset <name>');

    process.exit(ExitCodes.SUCCESS);
  }
}
