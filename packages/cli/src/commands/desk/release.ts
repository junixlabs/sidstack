import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { Args, Command, Flags } from '@oclif/core';

import {
  detectWorkspace,
  getWorktreeStatus,
  updateWorktreeStatus,
  getDeskPath,
} from '@sidstack/shared';
import { successResponse, errorResponse, ExitCodes } from '../../lib/output.js';

export default class DeskRelease extends Command {
  static description = 'Release a desk after task completion (reset to main, clear task)';

  static examples = [
    '<%= config.bin %> desk release desk-1',
    '<%= config.bin %> desk release desk-2 --force',
    '<%= config.bin %> desk release desk-1 --json',
  ];

  static flags = {
    force: Flags.boolean({
      char: 'f',
      description: 'Force release even with uncommitted changes',
      default: false,
    }),
    'delete-branch': Flags.boolean({
      description: 'Delete the feature branch after release (default: true)',
      default: true,
      allowNo: true,
    }),
    json: Flags.boolean({
      char: 'j',
      description: 'Output in JSON format',
      default: false,
    }),
  };

  static args = {
    name: Args.string({
      description: 'Desk name to release',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(DeskRelease);
    const { name } = args;
    const { force, json } = flags;
    const deleteBranch = flags['delete-branch'];

    // Detect workspace
    const workspace = detectWorkspace(process.cwd());

    if (!workspace) {
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:release', [
          { code: 'NOT_WORKSPACE', message: 'Not inside a SidStack workspace.' },
        ], ExitCodes.NOT_INITIALIZED), null, 2));
      } else {
        this.error('Not inside a SidStack workspace.');
      }
      return;
    }

    const deskPath = getDeskPath(workspace.workspaceRoot, name);

    if (!fs.existsSync(deskPath)) {
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:release', [
          { code: 'DESK_NOT_FOUND', message: `Desk '${name}' not found.` },
        ]), null, 2));
      } else {
        this.error(`Desk '${name}' not found.`);
      }
      return;
    }

    const session = getWorktreeStatus(deskPath);

    if (session.status === 'idle') {
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:release', [
          { code: 'ALREADY_IDLE', message: `Desk '${name}' is already idle.` },
        ]), null, 2));
      } else {
        this.error(`Desk '${name}' is already idle.`);
      }
      return;
    }

    // Check for uncommitted changes
    try {
      const gitStatus = execSync('git status --porcelain', {
        cwd: deskPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      if (gitStatus && !force) {
        const lines = gitStatus.split('\n');
        const msg = `Desk '${name}' has ${lines.length} uncommitted change(s). Use --force to override.`;
        if (json) {
          this.log(JSON.stringify(errorResponse('desk:release', [
            { code: 'UNCOMMITTED_CHANGES', message: msg },
          ]), null, 2));
        } else {
          this.error(msg);
        }
        return;
      }
    } catch {
      // Ignore git errors
    }

    try {
      // Get current branch before resetting
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: deskPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      if (!json) {
        this.log(`Releasing desk '${name}'...`);
      }

      // Discard changes if force
      if (force) {
        try {
          execSync('git checkout -- .', {
            cwd: deskPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
          });
          execSync('git clean -fd', {
            cwd: deskPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
          });
        } catch {
          // Ignore cleanup errors
        }
      }

      // Switch to main
      execSync('git checkout main', {
        cwd: deskPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Pull latest (ignore errors if no remote)
      try {
        execSync('git pull origin main', {
          cwd: deskPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch {
        // No remote — proceed
      }

      // Delete feature branch locally
      let branchDeleted = false;
      if (deleteBranch && currentBranch && currentBranch !== 'main') {
        try {
          execSync(`git branch -D ${currentBranch}`, {
            cwd: deskPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
          });
          branchDeleted = true;
        } catch {
          // Branch might already be deleted
        }
      }

      // Update session
      updateWorktreeStatus(deskPath, {
        status: 'idle',
        taskId: undefined,
        branch: 'main',
      });

      if (json) {
        this.log(JSON.stringify(successResponse('desk:release', {
          desk: name,
          path: deskPath,
          previousBranch: currentBranch,
          branchDeleted,
          status: 'idle',
        }), null, 2));
      } else {
        this.log('');
        this.log(`Desk '${name}' released`);
        this.log(`  Previous branch: ${currentBranch}`);
        if (branchDeleted) {
          this.log(`  Branch deleted: ${currentBranch}`);
        }
        this.log(`  Status: idle`);
        this.log('');
        this.log(`Desk is now available for the next task.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:release', [
          { code: 'GIT_ERROR', message: `Failed to release desk: ${message}` },
        ]), null, 2));
      } else {
        this.error(`Failed to release desk: ${message}`);
      }
    }
  }
}
