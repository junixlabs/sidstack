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

interface DeskInfo extends WorktreeStatus {
  gitBranch?: string;
  gitStatus?: string;
}

export default class DeskList extends Command {
  static description = 'List all agent desks in the workspace';

  static examples = [
    '<%= config.bin %> desk list',
    '<%= config.bin %> desk list --json',
    '<%= config.bin %> desk list --verbose',
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
    const { flags } = await this.parse(DeskList);
    const { json, verbose } = flags;

    // Detect workspace
    const workspace = detectWorkspace(process.cwd());

    if (!workspace) {
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:list', [
          { code: 'NOT_WORKSPACE', message: 'Not inside a SidStack workspace.' },
        ], ExitCodes.NOT_INITIALIZED), null, 2));
      } else {
        this.error('Not inside a SidStack workspace.');
      }
      return;
    }

    // Get desks from .sidstack-local markers in desks/ directory
    const deskNames = listWorktrees(workspace.workspaceRoot);

    // Build desk info
    const desks: DeskInfo[] = [];

    for (const name of deskNames) {
      const deskPath = getDeskPath(workspace.workspaceRoot, name);
      const info = this.getDeskInfo(deskPath, name, verbose);
      desks.push(info);
    }

    if (json) {
      this.log(JSON.stringify(successResponse('desk:list', {
        workspace: workspace.workspaceRoot,
        projectId: workspace.projectId,
        projectName: workspace.projectName,
        desks,
        count: desks.length,
      }), null, 2));
    } else {
      this.log('');
      this.log(`Workspace: ${workspace.projectName}`);
      this.log(`Path: ${workspace.workspaceRoot}`);
      this.log('');

      if (desks.length === 0) {
        this.log('No agent desks found. Create one with:');
        this.log('  sidstack desk add worker-1');
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
        const headers = ['Name', 'Status', 'Branch', 'Task', 'Role', 'Git Status'];
        const rows = desks.map(d => [
          d.name,
          `${statusIcons[d.status] || '?'} ${d.status}`,
          d.gitBranch || d.branch || '-',
          d.taskId || '-',
          d.agentRole || '-',
          d.gitStatus || '-',
        ]);
        this.log(formatTable(headers, rows));
      } else {
        const headers = ['Name', 'Status', 'Branch', 'Role', 'Task'];
        const rows = desks.map(d => [
          d.name,
          `${statusIcons[d.status] || '?'} ${d.status}`,
          d.gitBranch || d.branch || '-',
          d.agentRole || '-',
          d.taskId || '-',
        ]);
        this.log(formatTable(headers, rows));
      }

      this.log('');
      this.log(`Total: ${desks.length} agent desk(s)`);
      this.log('');
      this.log('Status: ○ idle  ◐ assigned  ● working  ◉ review');
    }
  }

  private getDeskInfo(deskPath: string, name: string, verbose: boolean): DeskInfo {
    const status = getWorktreeStatus(deskPath);

    const info: DeskInfo = {
      ...status,
      name,
    };

    // Get git info if verbose
    if (verbose || !status.branch) {
      try {
        const branch = execSync(`git -C "${deskPath}" rev-parse --abbrev-ref HEAD 2>/dev/null`, {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        info.gitBranch = branch;

        if (verbose) {
          const gitStatus = execSync(`git -C "${deskPath}" status --porcelain 2>/dev/null`, {
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
        info.gitBranch = '-';
        info.gitStatus = 'unknown';
      }
    }

    return info;
  }
}
