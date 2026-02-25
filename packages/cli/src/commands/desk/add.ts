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

export default class DeskAdd extends Command {
  static description = 'Add a new agent desk to the workspace';

  static examples = [
    '<%= config.bin %> desk add worker-1',
    '<%= config.bin %> desk add worker-2 -b feature/auth',
    '<%= config.bin %> desk add reviewer-1 --branch main',
    '<%= config.bin %> desk add worker-3 --json',
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
      description: 'Force creation even if desk exists',
      default: false,
    }),
    role: Flags.string({
      char: 'r',
      description: 'Agent role (worker or reviewer)',
      options: ['worker', 'reviewer'],
      default: 'worker',
    }),
  };

  static args = {
    name: Args.string({
      description: 'Agent desk name (e.g., worker-1, reviewer-1)',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(DeskAdd);
    const { name } = args;
    const { branch, json, force, role } = flags;
    const fromBranch = flags['from-branch'];

    // Detect workspace
    const workspace = detectWorkspace(process.cwd());

    if (!workspace) {
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:add', [
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

    const deskPath = getDeskPath(workspace.workspaceRoot, name);

    // Check if desk already exists
    if (fs.existsSync(deskPath) && !force) {
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:add', [
          { code: 'DESK_EXISTS', message: `Agent desk '${name}' already exists. Use --force to overwrite.` },
        ]), null, 2));
      } else {
        this.error(`Agent desk '${name}' already exists. Use --force to overwrite.`);
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
          gitCmd = `git worktree add "${deskPath}" ${branch}`;
        } catch {
          // Branch doesn't exist, create it
          const baseBranch = fromBranch || 'main';
          gitCmd = `git worktree add -b ${branch} "${deskPath}" ${baseBranch}`;
          targetBranch = branch;
        }
      } else {
        // No branch specified, create worktree on main
        gitCmd = `git worktree add "${deskPath}" main`;
        targetBranch = 'main';
      }

      if (!json) {
        this.log(`Creating agent desk '${name}'...`);
      }

      // Execute git worktree add
      execSync(gitCmd, { cwd: workspaceRoot, stdio: json ? 'pipe' : 'inherit' });

      // Create .sidstack-local/ marker
      ensureSidstackLocal(deskPath);

      // Initialize desk status
      updateWorktreeStatus(deskPath, {
        status: 'idle',
        branch: targetBranch,
        agentRole: role,
      });

      if (json) {
        this.log(JSON.stringify(successResponse('desk:add', {
          name,
          path: deskPath,
          branch: targetBranch,
          role,
          status: 'idle',
        }), null, 2));
      } else {
        this.log('');
        this.log(`Agent desk '${name}' created successfully`);
        this.log(`  Path: ${deskPath}`);
        this.log(`  Branch: ${targetBranch}`);
        this.log(`  Role: ${role}`);
        this.log('');
        this.log(`To start working:`);
        this.log(`  cd ${deskPath}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:add', [
          { code: 'GIT_ERROR', message: `Failed to create agent desk: ${message}` },
        ]), null, 2));
      } else {
        this.error(`Failed to create agent desk: ${message}`);
      }
    }
  }
}
