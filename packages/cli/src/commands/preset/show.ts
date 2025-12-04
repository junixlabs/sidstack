/**
 * preset show - Show detailed information about a preset
 *
 * Agent-friendly output with JSON support.
 */

import { Args, Command, Flags } from '@oclif/core';
import { loadPreset, getPresetNames } from '../../lib/preset-loader.js';
import { successResponse, errorResponse, ExitCodes } from '../../lib/output.js';

export default class PresetShow extends Command {
  static description = 'Show detailed information about a preset';

  static examples = [
    '<%= config.bin %> preset show minimal',
    '<%= config.bin %> preset show fullstack-typescript --json',
    '<%= config.bin %> preset show typescript-backend --section agents',
  ];

  static args = {
    name: Args.string({
      description: 'Preset name',
      required: true,
    }),
  };

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
    section: Flags.string({
      char: 's',
      description: 'Show specific section (agents, skills, defaults, recommended)',
      options: ['agents', 'skills', 'defaults', 'recommended', 'all'],
      default: 'all',
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(PresetShow);

    const preset = loadPreset(args.name);

    if (!preset) {
      const available = getPresetNames().join(', ');

      if (flags.json) {
        const response = errorResponse('preset show', [
          {
            code: 'PRESET_NOT_FOUND',
            message: `Preset not found: ${args.name}`,
            suggestion: `Available presets: ${available}`,
          },
        ]);
        this.log(JSON.stringify(response, null, 2));
      } else {
        this.error(`Preset not found: ${args.name}\nAvailable: ${available}`);
      }
      process.exit(ExitCodes.ERROR);
    }

    // Filter data based on section
    let data: Record<string, unknown> = { ...preset };
    if (flags.section !== 'all') {
      data = {
        name: preset.name,
        [flags.section]: preset[flags.section as keyof typeof preset],
      };
    }

    if (flags.json) {
      const response = successResponse('preset show', data);
      this.log(JSON.stringify(response, null, 2));
      return;
    }

    if (flags.quiet) {
      this.log(preset.name);
      return;
    }

    // Human-readable output
    this.log(`Preset: ${preset.name}`);
    this.log(`  Display Name: ${preset.displayName}`);
    this.log(`  Description: ${preset.description}`);
    this.log(`  Language: ${preset.language}`);
    this.log(`  Project Type: ${preset.projectType}`);
    this.log('');

    if (flags.section === 'all' || flags.section === 'agents') {
      this.log('Agents:');
      for (const [role, config] of Object.entries(preset.agents)) {
        this.log(`  ${role}:`);
        this.log(`    Base: ${config.base}`);
        if (config.variant) this.log(`    Variant: ${config.variant}`);
        if (config.specialty) this.log(`    Specialty: ${config.specialty}`);
        this.log(`    Skills: ${config.skills.join(', ')}`);
      }
      this.log('');
    }

    if (flags.section === 'all' || flags.section === 'skills') {
      this.log('Skills:');
      this.log(`  Core: ${preset.skills.core.join(', ')}`);
      if (preset.skills.optional.length > 0) {
        this.log(`  Optional: ${preset.skills.optional.join(', ')}`);
      }
      this.log('');
    }

    if (flags.section === 'all' || flags.section === 'defaults') {
      this.log('Defaults:');
      this.log(`  Model: ${preset.defaults.model}`);
      this.log(`  Permission Mode: ${preset.defaults.permissionMode}`);
      this.log(`  File Locking: ${preset.defaults.enableFileLocking}`);
      this.log(`  Progress Reporting: ${preset.defaults.enableProgressReporting}`);
      this.log('');
    }

    if ((flags.section === 'all' || flags.section === 'recommended') &&
        Object.keys(preset.recommended).length > 0) {
      this.log('Recommended Tools:');
      for (const [key, value] of Object.entries(preset.recommended)) {
        this.log(`  ${key}: ${value}`);
      }
      this.log('');
    }

    this.log(`Usage: sidstack init --preset ${preset.name}`);

    process.exit(ExitCodes.SUCCESS);
  }
}
