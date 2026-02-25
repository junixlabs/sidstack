import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { Args, Command, Flags } from '@oclif/core';

import {
  detectWorkspace,
  getWorktreeStatus,
  getDeskPath,
} from '@sidstack/shared';
import { successResponse, errorResponse, ExitCodes } from '../../lib/output.js';

export default class WorktreeRemove extends Command {
  static description = 'Remove a worktree from the workspace';

  static examples = [
    '<%= config.bin %> worktree remove wt-1',
    '<%= config.bin %> worktree remove wt-2 --force',
    '<%= config.bin %> worktree remove wt-3 --json',
  ];

  static flags = {
    force: Flags.boolean({
      char: 'f',
      description: 'Force removal even if worktree has uncommitted changes',
      default: false,
    }),
    json: Flags.boolean({
      char: 'j',
      description: 'Output in JSON format',
      default: false,
    }),
    'keep-branch': Flags.boolean({
      description: 'Keep the git branch after removing worktree',
      default: true,
    }),
  };

  static args = {
    name: Args.string({
      description: 'Worktree name to remove',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(WorktreeRemove);
    const { name } = args;
    const { force, json } = flags;
    const keepBranch = flags['keep-branch'];

    // Detect workspace
    const workspace = detectWorkspace(process.cwd());

    if (!workspace) {
      if (json) {
        this.log(JSON.stringify(errorResponse('worktree:remove', [
          { code: 'NOT_WORKSPACE', message: 'Not inside a SidStack workspace.' },
        ], ExitCodes.NOT_INITIALIZED), null, 2));
      } else {
        this.error('Not inside a SidStack workspace.');
      }
      return;
    }

    const worktreePath = getDeskPath(workspace.workspaceRoot, name);

    // Check if worktree exists
    if (!fs.existsSync(worktreePath)) {
      if (json) {
        this.log(JSON.stringify(errorResponse('worktree:remove', [
          { code: 'WORKTREE_NOT_FOUND', message: `Worktree '${name}' not found.` },
        ]), null, 2));
      } else {
        this.error(`Worktree '${name}' not found.`);
      }
      return;
    }

    // Check worktree status
    const status = getWorktreeStatus(worktreePath);

    if (status.status !== 'idle' && !force) {
      if (json) {
        this.log(JSON.stringify(errorResponse('worktree:remove', [
          {
            code: 'WORKTREE_IN_USE',
            message: `Worktree '${name}' is ${status.status}. Use --force to remove anyway.`,
            suggestion: `Complete or abandon the current work first, or use --force.`,
          },
        ]), null, 2));
      } else {
        this.error(`Worktree '${name}' is ${status.status}. Use --force to remove anyway.`);
      }
      return;
    }

    try {
      // Check for uncommitted changes
      if (!force) {
        try {
          const gitStatus = execSync(`git -C "${worktreePath}" status --porcelain 2>/dev/null`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
          }).trim();

          if (gitStatus) {
            if (json) {
              this.log(JSON.stringify(errorResponse('worktree:remove', [
                {
                  code: 'UNCOMMITTED_CHANGES',
                  message: `Worktree '${name}' has uncommitted changes. Use --force to remove anyway.`,
                },
              ]), null, 2));
            } else {
              this.error(`Worktree '${name}' has uncommitted changes. Use --force to remove anyway.`);
            }
            return;
          }
        } catch {
          // Ignore git errors
        }
      }

      if (!json) {
        this.log(`Removing worktree '${name}'...`);
      }

      // Get branch name before removing
      let branchName: string | undefined;
      try {
        branchName = execSync(`git -C "${worktreePath}" rev-parse --abbrev-ref HEAD 2>/dev/null`, {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
      } catch {
        // Ignore
      }

      // Remove via git worktree (from project root)
      const workspaceRoot = workspace.workspaceRoot;
      const forceFlag = force ? '--force' : '';

      try {
        execSync(`git worktree remove ${forceFlag} "${worktreePath}"`, {
          cwd: workspaceRoot,
          stdio: json ? 'pipe' : 'inherit',
        });
      } catch {
        // If git worktree remove fails, try manual removal
        if (force) {
          fs.rmSync(worktreePath, { recursive: true, force: true });
          // Prune worktrees
          execSync(`git worktree prune`, { cwd: workspaceRoot, stdio: 'pipe' });
        } else {
          throw new Error('Git worktree remove failed. Use --force to force removal.');
        }
      }

      // Optionally delete the branch
      if (!keepBranch && branchName && branchName !== 'main' && branchName !== 'master') {
        try {
          execSync(`git branch -d ${branchName}`, { cwd: workspaceRoot, stdio: 'pipe' });
          if (!json) {
            this.log(`  Branch '${branchName}' deleted.`);
          }
        } catch {
          // Branch might have unmerged changes, don't force delete
          if (!json) {
            this.log(`  Branch '${branchName}' not deleted (has unmerged changes).`);
          }
        }
      }

      if (json) {
        this.log(JSON.stringify(successResponse('worktree:remove', {
          name,
          path: worktreePath,
          removed: true,
          branchKept: keepBranch,
          branch: branchName,
        }), null, 2));
      } else {
        this.log('');
        this.log(`✓ Worktree '${name}' removed successfully`);
        if (branchName && keepBranch) {
          this.log(`  Branch '${branchName}' kept. Delete with: git branch -d ${branchName}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (json) {
        this.log(JSON.stringify(errorResponse('worktree:remove', [
          { code: 'REMOVE_ERROR', message: `Failed to remove worktree: ${message}` },
        ]), null, 2));
      } else {
        this.error(`Failed to remove worktree: ${message}`);
      }
    }
  }
}
