import { Command, Flags } from '@oclif/core';

import {
  loadGovernanceSummary,
  governanceExists,
  GovernanceSummary,
} from '../../lib/governance-loader.js';
import { ExitCodes, successResponse, errorResponse, formatTable } from '../../lib/output.js';
import { createError, ErrorCodes } from '../../lib/validator.js';

interface GovernanceShowData {
  initialized: boolean;
  principles: {
    total: number;
    valid: number;
    list: Array<{ name: string; description?: string; valid: boolean }>;
  };
  skills: {
    total: number;
    byCategory: Record<string, number>;
    list: Array<{ name: string; category: string; description?: string; valid: boolean }>;
  };
  agents: {
    total: number;
    valid: number;
    list: Array<{ name: string; description?: string; valid: boolean }>;
  };
}

export default class GovernanceShow extends Command {
  static description = 'Show governance system overview (agent-friendly with JSON output)';

  static examples = [
    '<%= config.bin %> governance show',
    '<%= config.bin %> governance show --json',
    '<%= config.bin %> governance show --section principles',
    '<%= config.bin %> governance show --quiet',
  ];

  static flags = {
    json: Flags.boolean({
      char: 'j',
      description: 'Output in JSON format (agent-friendly)',
      default: false,
    }),
    section: Flags.string({
      char: 's',
      description: 'Show specific section only',
      options: ['principles', 'skills', 'agents', 'all'],
      default: 'all',
    }),
    quiet: Flags.boolean({
      char: 'q',
      description: 'Minimal output (counts only)',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(GovernanceShow);
    const projectPath = process.cwd();

    // Check if governance is initialized
    const exists = await governanceExists(projectPath);
    if (!exists) {
      const error = createError(
        ErrorCodes.NOT_FOUND,
        'Governance not initialized. Run "sidstack governance init" first.',
        { suggestion: 'Run "sidstack governance init" to initialize governance' }
      );

      if (flags.json) {
        const response = errorResponse('governance show', [error], ExitCodes.NOT_INITIALIZED);
        this.log(JSON.stringify(response, null, 2));
        this.exit(ExitCodes.NOT_INITIALIZED);
      }

      this.error(error.message);
    }

    // Load governance summary
    const { summary, errors } = await loadGovernanceSummary(projectPath);

    // Build show data
    const data = this.buildShowData(summary);

    // JSON output
    if (flags.json) {
      const response = successResponse('governance show', data, {
        warnings: errors.map(e => ({ code: e.code, message: e.message })),
      });
      this.log(JSON.stringify(response, null, 2));
      if (errors.length > 0) {
        this.exit(ExitCodes.WARNING);
      }
      return;
    }

    // Quiet mode
    if (flags.quiet) {
      this.log(`Principles: ${data.principles.total}`);
      this.log(`Skills: ${data.skills.total}`);
      this.log(`Agents: ${data.agents.total}`);
      return;
    }

    // Human-readable output
    this.displayGovernance(data, flags.section);
  }

  private buildShowData(summary: GovernanceSummary): GovernanceShowData {
    const principles = {
      total: summary.principles.length,
      valid: summary.principles.filter(p => p.valid).length,
      list: summary.principles.map(p => ({
        name: p.name,
        description: p.description,
        valid: p.valid,
      })),
    };

    const byCategory: Record<string, number> = {};
    for (const skill of summary.skills) {
      byCategory[skill.category] = (byCategory[skill.category] || 0) + 1;
    }

    const skills = {
      total: summary.skills.length,
      byCategory,
      list: summary.skills.map(s => ({
        name: s.name,
        category: s.category,
        description: s.description,
        valid: s.valid,
      })),
    };

    const agents = {
      total: summary.agents.length,
      valid: summary.agents.filter(a => a.valid).length,
      list: summary.agents.map(a => ({
        name: a.name,
        description: a.description,
        valid: a.valid,
      })),
    };

    return {
      initialized: true,
      principles,
      skills,
      agents,
    };
  }

  private displayGovernance(data: GovernanceShowData, section: string): void {
    this.log('');
    this.log('SidStack Governance Overview');
    this.log('═'.repeat(50));

    if (section === 'all' || section === 'principles') {
      this.log('');
      this.log('PRINCIPLES');
      this.log('─'.repeat(50));
      if (data.principles.list.length === 0) {
        this.log('  No principles defined');
      } else {
        const headers = ['Name', 'Description', 'Valid'];
        const rows = data.principles.list.map(p => [
          p.name,
          (p.description ?? '-').substring(0, 40),
          p.valid ? '✓' : '✗',
        ]);
        this.log(formatTable(headers, rows));
      }
    }

    if (section === 'all' || section === 'skills') {
      this.log('');
      this.log('SKILLS');
      this.log('─'.repeat(50));
      if (data.skills.list.length === 0) {
        this.log('  No skills defined');
      } else {
        this.log(`  Categories: ${Object.entries(data.skills.byCategory).map(([k, v]) => `${k}(${v})`).join(', ')}`);
        this.log('');
        const headers = ['Name', 'Category', 'Valid'];
        const rows = data.skills.list.map(s => [s.name, s.category, s.valid ? '✓' : '✗']);
        this.log(formatTable(headers, rows));
      }
    }

    if (section === 'all' || section === 'agents') {
      this.log('');
      this.log('AGENTS');
      this.log('─'.repeat(50));
      if (data.agents.list.length === 0) {
        this.log('  No agents defined');
      } else {
        const headers = ['Name', 'Description', 'Valid'];
        const rows = data.agents.list.map(a => [
          a.name,
          (a.description ?? '-').substring(0, 40),
          a.valid ? '✓' : '✗',
        ]);
        this.log(formatTable(headers, rows));
      }
    }

    this.log('');
    this.log('─'.repeat(50));
    this.log('Summary:');
    this.log(`  ${data.principles.valid}/${data.principles.total} principles valid`);
    this.log(`  ${data.skills.total} skills in ${Object.keys(data.skills.byCategory).length} categories`);
    this.log(`  ${data.agents.valid}/${data.agents.total} agents valid`);
  }
}
