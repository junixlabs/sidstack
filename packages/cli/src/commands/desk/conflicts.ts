import { Command, Flags } from '@oclif/core';
import { detectWorkspace, DeskManager } from '@sidstack/shared';
import { successResponse, errorResponse, ExitCodes } from '../../lib/output.js';

export default class DeskConflicts extends Command {
  static description = 'Detect cross-desk file conflicts';

  static examples = [
    '<%= config.bin %> desk conflicts',
    '<%= config.bin %> desk conflicts --json',
  ];

  static flags = {
    json: Flags.boolean({
      char: 'j',
      description: 'Output in JSON format',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DeskConflicts);
    const { json } = flags;

    const workspace = detectWorkspace(process.cwd());
    if (!workspace) {
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:conflicts', [
          { code: 'NOT_WORKSPACE', message: 'Not inside a SidStack workspace.' },
        ], ExitCodes.NOT_INITIALIZED), null, 2));
      } else {
        this.error('Not inside a SidStack workspace.');
      }
      return;
    }

    try {
      const mgr = new DeskManager(workspace.workspaceRoot);
      const report = mgr.conflicts();

      if (json) {
        this.log(JSON.stringify(successResponse('desk:conflicts', report), null, 2));
      } else {
        if (!report.hasConflicts) {
          this.log('No cross-desk file conflicts detected.');
          return;
        }

        this.log('');
        this.log(`Cross-desk file conflicts: ${report.conflicts.length}`);
        this.log('');
        for (const conflict of report.conflicts) {
          this.log(`  ! ${conflict.file}`);
          this.log(`    Modified by: ${conflict.desks.join(', ')}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:conflicts', [
          { code: 'CONFLICT_ERROR', message },
        ]), null, 2));
      } else {
        this.error(message);
      }
    }
  }
}
