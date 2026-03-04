import { Args, Command, Flags } from '@oclif/core';
import { detectWorkspace, DeskManager } from '@sidstack/shared';
import { successResponse, errorResponse, ExitCodes } from '../../lib/output.js';

export default class DeskCheckout extends Command {
  static description = 'Switch or create a branch on an agent desk';

  static examples = [
    '<%= config.bin %> desk checkout desk-1 --branch main',
    '<%= config.bin %> desk checkout desk-1 --create feat/auth-module',
    '<%= config.bin %> desk checkout desk-1 --create fix/login --from main',
  ];

  static flags = {
    branch: Flags.string({
      char: 'b',
      description: 'Existing branch to checkout',
      exclusive: ['create'],
    }),
    create: Flags.string({
      char: 'c',
      description: 'New branch name to create',
      exclusive: ['branch'],
    }),
    from: Flags.string({
      description: 'Base branch for new branch (default: current branch)',
    }),
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
    const { args, flags } = await this.parse(DeskCheckout);
    const { json } = flags;

    if (!flags.branch && !flags.create) {
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:checkout', [
          { code: 'MISSING_FLAG', message: 'Either --branch or --create is required.' },
        ]), null, 2));
      } else {
        this.error('Either --branch or --create is required.');
      }
      return;
    }

    const workspace = detectWorkspace(process.cwd());
    if (!workspace) {
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:checkout', [
          { code: 'NOT_WORKSPACE', message: 'Not inside a SidStack workspace.' },
        ], ExitCodes.NOT_INITIALIZED), null, 2));
      } else {
        this.error('Not inside a SidStack workspace.');
      }
      return;
    }

    try {
      const mgr = new DeskManager(workspace.workspaceRoot);
      let info;

      if (flags.create) {
        if (!json) this.log(`Creating branch '${flags.create}' on desk '${args.desk}'...`);
        info = mgr.checkoutCreate(args.desk, flags.create, flags.from);
      } else {
        if (!json) this.log(`Switching desk '${args.desk}' to branch '${flags.branch}'...`);
        info = mgr.checkout(args.desk, flags.branch!);
      }

      if (json) {
        this.log(JSON.stringify(successResponse('desk:checkout', info), null, 2));
      } else {
        const statusIcon = info.status === 'working' ? '●' : '○';
        this.log('');
        this.log(`Desk '${info.name}' now on branch '${info.branch}'  ${statusIcon} ${info.status}`);
        this.log(`  Path: ${info.path}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:checkout', [
          { code: 'CHECKOUT_ERROR', message },
        ]), null, 2));
      } else {
        this.error(message);
      }
    }
  }
}
