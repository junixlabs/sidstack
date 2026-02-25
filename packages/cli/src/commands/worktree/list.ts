import { execSync } from 'child_process';

import { Command, Flags } from '@oclif/core';

import {
  detectWorkspace,
  listWorktrees,
  getWorktreeStatus,
  getDeskPath,
  type WorktreeStatus,
} from '@sidstack/shared';
import { successResponse, errorResponse, formatTable, ExitCodes } from '../../lib/output.js';

interface WorktreeInfo extends WorktreeStatus {
  gitBranch?: string;
  gitStatus?: string;
}

export default class WorktreeList extends Command {
  static description = 'List all worktrees in the workspace';

  static examples = [
    '<%= config.bin %> worktree list',
    '<%= config.bin %> worktree list --json',
    '<%= config.bin %> worktree list --verbose',
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
    const { flags } = await this.parse(WorktreeList);
    const { json, verbose } = flags;

    // Detect workspace
    const workspace = detectWorkspace(process.cwd());

    if (!workspace) {
      if (json) {
        this.log(JSON.stringify(errorResponse('worktree:list', [
          { code: 'NOT_WORKSPACE', message: 'Not inside a SidStack workspace.' },
        ], ExitCodes.NOT_INITIALIZED), null, 2));
      } else {
        this.error('Not inside a SidStack workspace.');
      }
      return;
    }

    // Get worktrees from .sidstack-local markers in desks/ directory
    const worktreeNames = listWorktrees(workspace.workspaceRoot);

    // Build worktree info
    const worktrees: WorktreeInfo[] = [];

    for (const name of worktreeNames) {
      const wtPath = getDeskPath(workspace.workspaceRoot, name);
      const info = this.getWorktreeInfo(wtPath, name, verbose);
      worktrees.push(info);
    }

    if (json) {
      this.log(JSON.stringify(successResponse('worktree:list', {
        workspace: workspace.workspaceRoot,
        projectId: workspace.projectId,
        projectName: workspace.projectName,
        worktrees,
        count: worktrees.length,
      }), null, 2));
    } else {
      this.log('');
      this.log(`Workspace: ${workspace.projectName}`);
      this.log(`Path: ${workspace.workspaceRoot}`);
      this.log('');

      if (worktrees.length === 0) {
        this.log('No worktrees found. Create one with:');
        this.log('  sidstack worktree add wt-1');
        return;
      }

      // Status icons
      const statusIcons: Record<string, string> = {
        idle: '○',
        assigned: '◐',
        working: '●',
        review: '◉',
      };

      if (verbose) {
        // Detailed table
        const headers = ['Name', 'Status', 'Branch', 'Task', 'Agent', 'Git Status'];
        const rows = worktrees.map(wt => [
          wt.name,
          `${statusIcons[wt.status] || '?'} ${wt.status}`,
          wt.gitBranch || wt.branch || '-',
          wt.taskId || '-',
          wt.agentRole || '-',
          wt.gitStatus || '-',
        ]);
        this.log(formatTable(headers, rows));
      } else {
        // Simple table
        const headers = ['Name', 'Status', 'Branch', 'Task'];
        const rows = worktrees.map(wt => [
          wt.name,
          `${statusIcons[wt.status] || '?'} ${wt.status}`,
          wt.gitBranch || wt.branch || '-',
          wt.taskId || '-',
        ]);
        this.log(formatTable(headers, rows));
      }

      this.log('');
      this.log(`Total: ${worktrees.length} worktree(s)`);

      // Show legend
      this.log('');
      this.log('Status: ○ idle  ◐ assigned  ● working  ◉ review');
    }
  }

  private getWorktreeInfo(wtPath: string, name: string, verbose: boolean): WorktreeInfo {
    const status = getWorktreeStatus(wtPath);

    const info: WorktreeInfo = {
      ...status,
      name,
    };

    // Get git info if verbose
    if (verbose || !status.branch) {
      try {
        // Get current branch
        const branch = execSync(`git -C "${wtPath}" rev-parse --abbrev-ref HEAD 2>/dev/null`, {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        info.gitBranch = branch;

        if (verbose) {
          // Get git status summary
          const gitStatus = execSync(`git -C "${wtPath}" status --porcelain 2>/dev/null`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
          }).trim();

          if (gitStatus) {
            const lines = gitStatus.split('\n');
            info.gitStatus = `${lines.length} change(s)`;
          } else {
            info.gitStatus = 'clean';
          }
        }
      } catch {
        // Git command failed, probably not a git repo
        info.gitBranch = '-';
        info.gitStatus = 'unknown';
      }
    }

    return info;
  }
}
