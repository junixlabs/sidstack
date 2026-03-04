import { Command, Flags } from '@oclif/core';
import { detectWorkspace, DeskManager } from '@sidstack/shared';
import { successResponse, errorResponse, ExitCodes } from '../../lib/output.js';

export default class DeskHealth extends Command {
  static description = 'Check health of all agent desks';

  static examples = [
    '<%= config.bin %> desk health',
    '<%= config.bin %> desk health --json',
  ];

  static flags = {
    json: Flags.boolean({
      char: 'j',
      description: 'Output in JSON format',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DeskHealth);
    const { json } = flags;

    const workspace = detectWorkspace(process.cwd());
    if (!workspace) {
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:health', [
          { code: 'NOT_WORKSPACE', message: 'Not inside a SidStack workspace.' },
        ], ExitCodes.NOT_INITIALIZED), null, 2));
      } else {
        this.error('Not inside a SidStack workspace.');
      }
      return;
    }

    try {
      const mgr = new DeskManager(workspace.workspaceRoot);
      const report = await mgr.health();

      if (json) {
        this.log(JSON.stringify(successResponse('desk:health', report), null, 2));
      } else {
        this.log('');
        this.log(`Desks: ${report.desks}`);
        this.log(`Status: ${report.healthy ? 'Healthy' : 'Issues found'}`);

        if (report.issues.length > 0) {
          this.log('');
          this.log('Issues:');
          for (const issue of report.issues) {
            const icon = issue.type === 'corrupted_session' || issue.type === 'orphan_worktree'
              ? '!'
              : '?';
            this.log(`  ${icon} [${issue.desk}] ${issue.type}: ${issue.message}`);
          }
        } else {
          this.log('  No issues found.');
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:health', [
          { code: 'HEALTH_ERROR', message },
        ]), null, 2));
      } else {
        this.error(message);
      }
    }
  }
}
