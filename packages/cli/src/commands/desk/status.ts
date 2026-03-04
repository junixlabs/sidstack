import { Args, Command, Flags } from '@oclif/core';
import { detectWorkspace, DeskManager } from '@sidstack/shared';
import { successResponse, errorResponse, ExitCodes } from '../../lib/output.js';

export default class DeskStatus extends Command {
  static description = 'Show detailed status of an agent desk';

  static examples = [
    '<%= config.bin %> desk status desk-1',
    '<%= config.bin %> desk status desk-1 --json',
  ];

  static flags = {
    json: Flags.boolean({
      char: 'j',
      description: 'Output in JSON format',
      default: false,
    }),
  };

  static args = {
    desk: Args.string({
      description: 'Desk name',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(DeskStatus);
    const { json } = flags;

    const workspace = detectWorkspace(process.cwd());
    if (!workspace) {
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:status', [
          { code: 'NOT_WORKSPACE', message: 'Not inside a SidStack workspace.' },
        ], ExitCodes.NOT_INITIALIZED), null, 2));
      } else {
        this.error('Not inside a SidStack workspace.');
      }
      return;
    }

    try {
      const mgr = new DeskManager(workspace.workspaceRoot);
      const info = mgr.status(args.desk);

      if (json) {
        this.log(JSON.stringify(successResponse('desk:status', info), null, 2));
      } else {
        const statusIcon = info.status === 'working' ? '●' : '○';
        this.log('');
        this.log(`Desk: ${info.name}  ${statusIcon} ${info.status}`);
        this.log(`  Path:     ${info.path}`);
        this.log(`  Branch:   ${info.branch}`);
        this.log(`  Ports:    api=${info.ports.api} mcp=${info.ports.mcp} web=${info.ports.web} dev=${info.ports.dev}`);
        this.log(`  Activity: ${info.lastActivity}`);
        this.log('');
        this.log('Git:');
        this.log(`  Clean:     ${info.git.clean ? 'yes' : 'no'}`);
        this.log(`  Staged:    ${info.git.staged}`);
        this.log(`  Modified:  ${info.git.modified}`);
        this.log(`  Untracked: ${info.git.untracked}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:status', [
          { code: 'STATUS_ERROR', message },
        ]), null, 2));
      } else {
        this.error(message);
      }
    }
  }
}
