import { Command, Flags } from '@oclif/core';
import { detectWorkspace, DeskManager } from '@sidstack/shared';
import { successResponse, errorResponse, formatTable, ExitCodes } from '../../lib/output.js';

export default class DeskList extends Command {
  static description = 'List all agent desks in the workspace';

  static examples = [
    '<%= config.bin %> desk list',
    '<%= config.bin %> desk list --json',
    '<%= config.bin %> desk list --verbose',
  ];

  static flags = {
    json: Flags.boolean({
      char: 'j',
      description: 'Output in JSON format',
      default: false,
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show detailed information including git status',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DeskList);
    const { json, verbose } = flags;

    const workspace = detectWorkspace(process.cwd());
    if (!workspace) {
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:list', [
          { code: 'NOT_WORKSPACE', message: 'Not inside a SidStack workspace.' },
        ], ExitCodes.NOT_INITIALIZED), null, 2));
      } else {
        this.error('Not inside a SidStack workspace.');
      }
      return;
    }

    const mgr = new DeskManager(workspace.workspaceRoot);
    const desks = mgr.list();

    if (json) {
      this.log(JSON.stringify(successResponse('desk:list', {
        workspace: workspace.workspaceRoot,
        projectId: workspace.projectId,
        projectName: workspace.projectName,
        desks,
        count: desks.length,
      }), null, 2));
    } else {
      this.log('');
      this.log(`Workspace: ${workspace.projectName}`);
      this.log(`Path: ${workspace.workspaceRoot}`);
      this.log('');

      if (desks.length === 0) {
        this.log('No agent desks found. Create one with:');
        this.log('  sidstack desk create desk-1');
        return;
      }

      const statusIcons: Record<string, string> = {
        idle: '○',
        working: '●',
      };

      if (verbose) {
        const headers = ['Name', 'Status', 'Branch', 'Git', 'Ports'];
        const rows = desks.map(d => [
          d.name,
          `${statusIcons[d.status] || '?'} ${d.status}`,
          d.branch,
          d.git.clean ? 'clean' : `${d.git.modified}M ${d.git.untracked}U`,
          `api=${d.ports.api}`,
        ]);
        this.log(formatTable(headers, rows));
      } else {
        const headers = ['Name', 'Status', 'Branch'];
        const rows = desks.map(d => [
          d.name,
          `${statusIcons[d.status] || '?'} ${d.status}`,
          d.branch,
        ]);
        this.log(formatTable(headers, rows));
      }

      this.log('');
      this.log(`Total: ${desks.length} desk(s)`);
      this.log('');
      this.log('Status: ○ idle  ● working');
    }
  }
}
