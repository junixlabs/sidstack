import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { Args, Command, Flags } from '@oclif/core';

import {
  detectWorkspace,
  ensureSidstackLocal,
  updateWorktreeStatus,
  getDeskPath,
  getDesksPath,
} from '@sidstack/shared';
import { successResponse, errorResponse, ExitCodes } from '../../lib/output.js';

export default class WorktreeAdd extends Command {
  static description = 'Add a new worktree slot to the workspace';

  static examples = [
    '<%= config.bin %> worktree add wt-1',
    '<%= config.bin %> worktree add wt-2 -b feature/auth',
    '<%= config.bin %> worktree add dev --branch main',
    '<%= config.bin %> worktree add wt-3 --json',
  ];

  static flags = {
    branch: Flags.string({
      char: 'b',
      description: 'Git branch to checkout (creates new if not exists)',
    }),
    'from-branch': Flags.string({
      description: 'Create new branch from this branch (default: current branch)',
    }),
    json: Flags.boolean({
      char: 'j',
      description: 'Output in JSON format',
      default: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Force creation even if worktree exists',
      default: false,
    }),
  };

  static args = {
    name: Args.string({
      description: 'Worktree slot name (e.g., wt-1, wt-2)',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(WorktreeAdd);
    const { name } = args;
    const { branch, json, force } = flags;
    const fromBranch = flags['from-branch'];

    // Detect workspace
    const workspace = detectWorkspace(process.cwd());

    if (!workspace) {
      if (json) {
        this.log(JSON.stringify(errorResponse('worktree:add', [
          { code: 'NOT_WORKSPACE', message: 'Not inside a SidStack workspace. Run `sidstack init --workspace` first.' },
        ], ExitCodes.NOT_INITIALIZED), null, 2));
      } else {
        this.error('Not inside a SidStack workspace. Run `sidstack init --workspace` first.');
      }
      return;
    }

    // Ensure desks/ directory exists
    const desksDir = getDesksPath(workspace.workspaceRoot);
    if (!fs.existsSync(desksDir)) {
      fs.mkdirSync(desksDir, { recursive: true });
    }

    const worktreePath = getDeskPath(workspace.workspaceRoot, name);

    // Check if worktree already exists
    if (fs.existsSync(worktreePath) && !force) {
      if (json) {
        this.log(JSON.stringify(errorResponse('worktree:add', [
          { code: 'WORKTREE_EXISTS', message: `Worktree '${name}' already exists. Use --force to overwrite.` },
        ]), null, 2));
      } else {
        this.error(`Worktree '${name}' already exists. Use --force to overwrite.`);
      }
      return;
    }

    try {
      // Determine branch to use
      let targetBranch = branch || name;

      // Build git worktree command (standard git worktree from project root)
      const workspaceRoot = workspace.workspaceRoot;
      let gitCmd: string;

      if (branch) {
        // Check if branch exists
        try {
          execSync(`git rev-parse --verify ${branch}`, { cwd: workspaceRoot, stdio: 'pipe' });
          // Branch exists, just checkout
          gitCmd = `git worktree add "${worktreePath}" ${branch}`;
        } catch {
          // Branch doesn't exist, create it
          const baseBranch = fromBranch || 'main';
          gitCmd = `git worktree add -b ${branch} "${worktreePath}" ${baseBranch}`;
          targetBranch = branch;
        }
      } else {
        // No branch specified, create worktree on main
        gitCmd = `git worktree add "${worktreePath}" main`;
        targetBranch = 'main';
      }

      if (!json) {
        this.log(`Creating worktree '${name}'...`);
      }

      // Execute git worktree add
      execSync(gitCmd, { cwd: workspaceRoot, stdio: json ? 'pipe' : 'inherit' });

      // Create .sidstack-local/ marker
      ensureSidstackLocal(worktreePath);

      // Initialize worktree status
      updateWorktreeStatus(worktreePath, {
        status: 'idle',
        branch: targetBranch,
      });

      if (json) {
        this.log(JSON.stringify(successResponse('worktree:add', {
          name,
          path: worktreePath,
          branch: targetBranch,
          status: 'idle',
        }), null, 2));
      } else {
        this.log('');
        this.log(`✓ Worktree '${name}' created successfully`);
        this.log(`  Path: ${worktreePath}`);
        this.log(`  Branch: ${targetBranch}`);
        this.log('');
        this.log(`To start working:`);
        this.log(`  cd ${worktreePath}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (json) {
        this.log(JSON.stringify(errorResponse('worktree:add', [
          { code: 'GIT_ERROR', message: `Failed to create worktree: ${message}` },
        ]), null, 2));
      } else {
        this.error(`Failed to create worktree: ${message}`);
      }
    }
  }
}
