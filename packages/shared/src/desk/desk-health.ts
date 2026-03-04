/**
 * Agent Desk v2 — Health Checks
 */

import * as fs from 'fs';
import * as path from 'path';
import { listWorktrees, getDeskPath } from '../workspace-detector.js';
import { readSession } from './desk-state.js';
import { getGitStatus, getModifiedFiles } from './desk-git.js';
import { checkPortAvailable } from './desk-env.js';
import type { DeskHealthReport, DeskHealthIssue } from './types.js';

const SIDSTACK_LOCAL = '.sidstack-local';

/**
 * Run health checks on all desks in workspace.
 */
export async function checkHealth(workspaceRoot: string): Promise<DeskHealthReport> {
  const issues: DeskHealthIssue[] = [];
  const deskNames = listWorktrees(workspaceRoot);

  // Track modified files per desk for overlap detection
  const fileMap = new Map<string, string[]>();

  for (const name of deskNames) {
    const deskPath = getDeskPath(workspaceRoot, name);

    // Check: corrupted_session
    const localDir = path.join(deskPath, SIDSTACK_LOCAL);
    const sessionFile = path.join(localDir, 'session.json');
    if (fs.existsSync(sessionFile)) {
      const session = readSession(deskPath);
      if (!session) {
        issues.push({
          desk: name,
          type: 'corrupted_session',
          message: 'session.json exists but cannot be parsed',
        });
      }
    }

    // Check: dirty_state (on main with uncommitted changes)
    const git = getGitStatus(deskPath);
    if ((git.branch === 'main' || git.branch.startsWith('agent/')) && !git.clean) {
      issues.push({
        desk: name,
        type: 'dirty_state',
        message: `Uncommitted changes on ${git.branch} (${git.modified} modified, ${git.untracked} untracked)`,
      });
    }

    // Check: stale_lock
    const lockFile = path.join(deskPath, '.git', 'index.lock');
    if (fs.existsSync(lockFile)) {
      issues.push({
        desk: name,
        type: 'stale_lock',
        message: 'Git index.lock file exists (stale lock)',
      });
    }

    // Check: missing_env
    const envFile = path.join(deskPath, '.env');
    if (!fs.existsSync(envFile)) {
      issues.push({
        desk: name,
        type: 'missing_env',
        message: 'No .env file (ports not configured)',
      });
    }

    // Track modified files for file_overlap detection
    if (!git.clean) {
      const files = getModifiedFiles(deskPath);
      for (const file of files) {
        const desks = fileMap.get(file) || [];
        desks.push(name);
        fileMap.set(file, desks);
      }
    }

    // Check: port_conflict
    const session = readSession(deskPath);
    if (session?.ports) {
      const portEntries = Object.entries(session.ports) as [string, number][];
      for (const [service, port] of portEntries) {
        if (port > 0) {
          const available = await checkPortAvailable(port);
          if (!available) {
            issues.push({
              desk: name,
              type: 'port_conflict',
              message: `Port ${port} (${service}) is already in use`,
            });
          }
        }
      }
    }
  }

  // Check: file_overlap (file modified by 2+ desks)
  for (const [file, desks] of fileMap) {
    if (desks.length > 1) {
      for (const desk of desks) {
        issues.push({
          desk,
          type: 'file_overlap',
          message: `File "${file}" is also modified by: ${desks.filter(d => d !== desk).join(', ')}`,
        });
      }
    }
  }

  // Check: orphan_worktree (git worktree list vs .desks/ directory)
  try {
    const { execSync } = require('child_process');
    const output = execSync('git worktree list --porcelain', {
      cwd: workspaceRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }) as string;

    const desksDir = path.join(workspaceRoot, '.desks');
    const blocks = output.split('\n\n').filter(Boolean);

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      const wtLine = lines.find((l: string) => l.startsWith('worktree '));
      if (!wtLine) continue;

      const wtPath = wtLine.replace('worktree ', '');
      // Only check paths under .desks/
      if (!wtPath.startsWith(desksDir)) continue;

      const name = path.basename(wtPath);
      const localMarker = path.join(wtPath, SIDSTACK_LOCAL);
      if (!fs.existsSync(localMarker)) {
        issues.push({
          desk: name,
          type: 'orphan_worktree',
          message: 'Git worktree exists but no .sidstack-local marker',
        });
      }
    }
  } catch {
    // Git not available — skip orphan check
  }

  return {
    healthy: issues.length === 0,
    desks: deskNames.length,
    issues,
  };
}
