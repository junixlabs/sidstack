/**
 * Agent Desk v2 — Git Worktree Operations
 */

import { execSync } from 'child_process';
import type { DeskGitStatus } from './types.js';
import { DeskGitError, BranchNotFoundError, BranchExistsError } from './errors.js';

// ============================================================================
// Helper
// ============================================================================

function gitExec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    throw new DeskGitError(cmd, err instanceof Error ? err : undefined);
  }
}

// ============================================================================
// Worktree Management
// ============================================================================

export function createWorktree(
  workspaceRoot: string,
  deskPath: string,
  deskName: string,
  baseBranch: string
): void {
  const tempBranch = `agent/${deskName}`;
  gitExec(
    `git worktree add -b "${tempBranch}" "${deskPath}" ${baseBranch}`,
    workspaceRoot
  );
}

export function removeWorktree(
  workspaceRoot: string,
  deskPath: string,
  force: boolean
): void {
  const flag = force ? '--force' : '';
  gitExec(`git worktree remove ${flag} "${deskPath}"`, workspaceRoot);
}

export function pruneWorktrees(workspaceRoot: string): void {
  gitExec('git worktree prune', workspaceRoot);
}

// ============================================================================
// Branch Operations
// ============================================================================

export function checkoutBranch(deskPath: string, branch: string): void {
  // Verify branch exists first
  try {
    gitExec(`git rev-parse --verify ${branch}`, deskPath);
  } catch {
    throw new BranchNotFoundError(branch);
  }
  gitExec(`git checkout ${branch}`, deskPath);
}

export function createBranch(deskPath: string, name: string, base?: string): void {
  // Check branch does NOT exist
  try {
    gitExec(`git rev-parse --verify ${name}`, deskPath);
    throw new BranchExistsError(name);
  } catch (err) {
    if (err instanceof BranchExistsError) throw err;
    // Branch doesn't exist — good, continue
  }

  const cmd = base ? `git checkout -b ${name} ${base}` : `git checkout -b ${name}`;
  gitExec(cmd, deskPath);
}

// ============================================================================
// Status
// ============================================================================

export function getGitStatus(deskPath: string): DeskGitStatus {
  try {
    const branch = gitExec('git rev-parse --abbrev-ref HEAD', deskPath);
    const status = gitExec('git status --porcelain', deskPath);

    const lines = status ? status.split('\n') : [];
    let staged = 0;
    let modified = 0;
    let untracked = 0;

    for (const line of lines) {
      if (line.startsWith('??')) {
        untracked++;
      } else {
        if (line[0] !== ' ' && line[0] !== '?') staged++;
        if (line[1] !== ' ' && line[1] !== '?') modified++;
      }
    }

    return { branch, clean: lines.length === 0, staged, modified, untracked };
  } catch {
    return { branch: 'unknown', clean: true, staged: 0, modified: 0, untracked: 0 };
  }
}

export function getCurrentBranch(deskPath: string): string {
  try {
    return gitExec('git rev-parse --abbrev-ref HEAD', deskPath);
  } catch {
    return 'unknown';
  }
}

/**
 * Get list of modified files (staged + unstaged) relative to HEAD.
 */
export function getModifiedFiles(deskPath: string): string[] {
  try {
    const unstaged = gitExec('git diff --name-only HEAD', deskPath);
    const staged = gitExec('git diff --name-only --cached', deskPath);

    const files = new Set<string>();
    for (const line of unstaged.split('\n').filter(Boolean)) files.add(line);
    for (const line of staged.split('\n').filter(Boolean)) files.add(line);
    return Array.from(files);
  } catch {
    return [];
  }
}
