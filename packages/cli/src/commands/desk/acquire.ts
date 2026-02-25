import { execSync } from 'child_process';
import * as path from 'path';

import { Args, Command, Flags } from '@oclif/core';

import {
  detectWorkspace,
  listAgentDesks,
  updateWorktreeStatus,
} from '@sidstack/shared';
import { successResponse, errorResponse, ExitCodes } from '../../lib/output.js';

export default class DeskAcquire extends Command {
  static description = 'Acquire an idle desk for a task (create feature branch, mark working)';

  static examples = [
    '<%= config.bin %> desk acquire --task task-123 --branch feat/auth-module',
    '<%= config.bin %> desk acquire desk-1 --task task-456 --branch fix/login-bug',
    '<%= config.bin %> desk acquire --task task-789 --branch feat/api --json',
  ];

  static flags = {
    task: Flags.string({
      char: 't',
      description: 'Task ID to assign to the desk',
      required: true,
    }),
    branch: Flags.string({
      char: 'b',
      description: 'Branch name to create (e.g., "feat/auth-module")',
      required: true,
    }),
    json: Flags.boolean({
      char: 'j',
      description: 'Output in JSON format',
      default: false,
    }),
  };

  static args = {
    name: Args.string({
      description: 'Desk name to acquire (auto-selects first idle worker if omitted)',
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(DeskAcquire);
    const { task, branch, json } = flags;
    const deskName = args.name;

    // Detect workspace
    const workspace = detectWorkspace(process.cwd());

    if (!workspace) {
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:acquire', [
          { code: 'NOT_WORKSPACE', message: 'Not inside a SidStack workspace.' },
        ], ExitCodes.NOT_INITIALIZED), null, 2));
      } else {
        this.error('Not inside a SidStack workspace.');
      }
      return;
    }

    const desks = listAgentDesks(workspace.workspaceRoot);

    // Find target desk
    let targetDesk;
    if (deskName) {
      targetDesk = desks.find(d => d.name === deskName);
      if (!targetDesk) {
        const msg = `Desk '${deskName}' not found. Available: ${desks.map(d => d.name).join(', ')}`;
        if (json) {
          this.log(JSON.stringify(errorResponse('desk:acquire', [
            { code: 'DESK_NOT_FOUND', message: msg },
          ]), null, 2));
        } else {
          this.error(msg);
        }
        return;
      }
      if (targetDesk.status !== 'idle') {
        const msg = `Desk '${deskName}' is not idle (status: ${targetDesk.status})`;
        if (json) {
          this.log(JSON.stringify(errorResponse('desk:acquire', [
            { code: 'DESK_NOT_IDLE', message: msg },
          ]), null, 2));
        } else {
          this.error(msg);
        }
        return;
      }
    } else {
      // Auto-select first idle worker
      targetDesk = desks.find(d => d.status === 'idle' && d.agentRole !== 'reviewer');
      if (!targetDesk) {
        targetDesk = desks.find(d => d.status === 'idle');
      }
      if (!targetDesk) {
        const msg = 'No idle desks available';
        if (json) {
          this.log(JSON.stringify(errorResponse('desk:acquire', [
            { code: 'NO_IDLE_DESK', message: msg },
          ]), null, 2));
        } else {
          this.error(msg);
        }
        return;
      }
    }

    const deskPath = targetDesk.path;

    try {
      if (!json) {
        this.log(`Acquiring desk '${targetDesk.name}'...`);
      }

      // Ensure on main and up-to-date
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: deskPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      if (currentBranch !== 'main') {
        execSync('git checkout main', {
          cwd: deskPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
        });
      }

      // Pull latest (ignore errors if no remote)
      try {
        execSync('git pull origin main', {
          cwd: deskPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch {
        // No remote or network issue — proceed with local main
      }

      // Create feature branch
      execSync(`git checkout -b ${branch}`, {
        cwd: deskPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Update session
      updateWorktreeStatus(deskPath, {
        status: 'working',
        taskId: task,
        branch,
      });

      if (json) {
        this.log(JSON.stringify(successResponse('desk:acquire', {
          desk: targetDesk.name,
          path: deskPath,
          branch,
          taskId: task,
          status: 'working',
        }), null, 2));
      } else {
        this.log('');
        this.log(`Desk '${targetDesk.name}' acquired`);
        this.log(`  Branch: ${branch}`);
        this.log(`  Task: ${task}`);
        this.log(`  Path: ${deskPath}`);
        this.log('');
        this.log(`Start working:`);
        this.log(`  cd ${deskPath}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:acquire', [
          { code: 'GIT_ERROR', message: `Failed to acquire desk: ${message}` },
        ]), null, 2));
      } else {
        this.error(`Failed to acquire desk: ${message}`);
      }
    }
  }
}
