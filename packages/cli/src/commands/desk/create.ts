import { Args, Command, Flags } from '@oclif/core';
import { detectWorkspace, DeskManager } from '@sidstack/shared';
import { successResponse, errorResponse, ExitCodes } from '../../lib/output.js';

export default class DeskCreate extends Command {
  static description = 'Create a new agent desk (persistent git worktree)';

  static examples = [
    '<%= config.bin %> desk create desk-1',
    '<%= config.bin %> desk create desk-2 --bootstrap "pnpm install"',
    '<%= config.bin %> desk create desk-review --base-branch develop',
  ];

  static flags = {
    'base-branch': Flags.string({
      description: 'Base branch to create desk from (default: main)',
      default: 'main',
    }),
    bootstrap: Flags.string({
      description: 'Command to run after desk creation (e.g., "pnpm install")',
    }),
    json: Flags.boolean({
      char: 'j',
      description: 'Output in JSON format',
      default: false,
    }),
  };

  static args = {
    name: Args.string({
      description: 'Desk name (e.g., "desk-1", "desk-review")',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(DeskCreate);
    const { json } = flags;

    const workspace = detectWorkspace(process.cwd());
    if (!workspace) {
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:create', [
          { code: 'NOT_WORKSPACE', message: 'Not inside a SidStack workspace.' },
        ], ExitCodes.NOT_INITIALIZED), null, 2));
      } else {
        this.error('Not inside a SidStack workspace.');
      }
      return;
    }

    try {
      if (!json) this.log(`Creating desk '${args.name}'...`);

      const mgr = new DeskManager(workspace.workspaceRoot);
      const info = await mgr.create(args.name, {
        baseBranch: flags['base-branch'],
        bootstrap: flags.bootstrap,
      });

      if (json) {
        this.log(JSON.stringify(successResponse('desk:create', info), null, 2));
      } else {
        this.log('');
        this.log(`Desk '${info.name}' created`);
        this.log(`  Path:   ${info.path}`);
        this.log(`  Branch: ${info.branch}`);
        this.log(`  Ports:  api=${info.ports.api} mcp=${info.ports.mcp} web=${info.ports.web} dev=${info.ports.dev}`);
        this.log('');
        this.log('Start working:');
        this.log(`  cd ${info.path}`);
        this.log(`  sidstack desk checkout ${info.name} --create feat/my-feature`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:create', [
          { code: 'CREATE_ERROR', message },
        ]), null, 2));
      } else {
        this.error(message);
      }
    }
  }
}
