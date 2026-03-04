import { Args, Command, Flags } from '@oclif/core';
import { detectWorkspace, DeskManager } from '@sidstack/shared';
import { successResponse, errorResponse, ExitCodes } from '../../lib/output.js';

export default class DeskRemove extends Command {
  static description = 'Remove an agent desk from the workspace';

  static examples = [
    '<%= config.bin %> desk remove desk-1',
    '<%= config.bin %> desk remove desk-2 --force',
    '<%= config.bin %> desk remove desk-1 --json',
  ];

  static flags = {
    force: Flags.boolean({
      char: 'f',
      description: 'Force removal even with uncommitted changes',
      default: false,
    }),
    json: Flags.boolean({
      char: 'j',
      description: 'Output in JSON format',
      default: false,
    }),
  };

  static args = {
    name: Args.string({
      description: 'Desk name to remove',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(DeskRemove);
    const { force, json } = flags;

    const workspace = detectWorkspace(process.cwd());
    if (!workspace) {
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:remove', [
          { code: 'NOT_WORKSPACE', message: 'Not inside a SidStack workspace.' },
        ], ExitCodes.NOT_INITIALIZED), null, 2));
      } else {
        this.error('Not inside a SidStack workspace.');
      }
      return;
    }

    try {
      if (!json) this.log(`Removing desk '${args.name}'...`);

      const mgr = new DeskManager(workspace.workspaceRoot);
      await mgr.remove(args.name, { force });

      if (json) {
        this.log(JSON.stringify(successResponse('desk:remove', {
          name: args.name,
          removed: true,
        }), null, 2));
      } else {
        this.log(`Desk '${args.name}' removed.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:remove', [
          { code: 'REMOVE_ERROR', message },
        ]), null, 2));
      } else {
        this.error(message);
      }
    }
  }
}
