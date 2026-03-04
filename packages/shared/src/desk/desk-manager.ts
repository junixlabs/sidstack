/**
 * Agent Desk v2 — Main Orchestrator
 *
 * Persistent dev machine model: create once, use forever.
 * No acquire/release — just checkout branches like normal git flow.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ensureSidstackLocal, listWorktrees, getDeskPath, getDesksPath } from '../workspace-detector.js';
import { DeskNotFoundError, DeskAlreadyExistsError, DeskDirtyError, DeskGitError } from './errors.js';
import { createWorktree, removeWorktree, checkoutBranch, createBranch, getGitStatus, pruneWorktrees, getModifiedFiles } from './desk-git.js';
import { readSession, writeSession, updateSession } from './desk-state.js';
import { extractDeskIndex, calculatePorts, writeEnvFile } from './desk-env.js';
import { checkHealth } from './desk-health.js';
import { cleanContext } from './desk-context.js';
import { runHook } from './desk-hooks.js';
import type {
  DeskInfo,
  DeskSession,
  DeskStatus,
  DeskCreateOptions,
  DeskRemoveOptions,
  DeskHealthReport,
  DeskConflictReport,
  DeskFileConflict,
} from './types.js';

export class DeskManager {
  constructor(private workspaceRoot: string) {}

  // ==========================================================================
  // create
  // ==========================================================================

  async create(name: string, opts?: DeskCreateOptions): Promise<DeskInfo> {
    const deskPath = getDeskPath(this.workspaceRoot, name);
    const baseBranch = opts?.baseBranch || 'main';

    // 1. Validate name
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new DeskGitError(`Invalid desk name: ${name}. Use alphanumeric, dash, or underscore.`);
    }

    // 2. Check not exists
    if (fs.existsSync(deskPath)) {
      throw new DeskAlreadyExistsError(name);
    }

    // 3. Ensure desks/ dir + .gitignore
    const desksDir = getDesksPath(this.workspaceRoot);
    if (!fs.existsSync(desksDir)) {
      fs.mkdirSync(desksDir, { recursive: true });
    }
    this.ensureGitignore();

    // 4. Verify base branch exists
    try {
      execSync(`git rev-parse --verify ${baseBranch}`, {
        cwd: this.workspaceRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      throw new DeskGitError(`Base branch "${baseBranch}" not found`);
    }

    // 5. git worktree add
    createWorktree(this.workspaceRoot, deskPath, name, baseBranch);

    // 6. Write session.json
    const index = extractDeskIndex(name);
    const ports = calculatePorts(index);
    const session: DeskSession = {
      name,
      status: 'idle',
      branch: baseBranch,
      ports,
      lastActivity: new Date().toISOString(),
    };
    ensureSidstackLocal(deskPath);
    writeSession(deskPath, session);

    // 7. Generate .env
    writeEnvFile(deskPath, ports);

    // 8. Run bootstrap command if provided
    if (opts?.bootstrap) {
      updateSession(deskPath, { bootstrapStatus: 'running' });
      try {
        execSync(opts.bootstrap, {
          cwd: deskPath,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 300_000, // 5 minutes
        });
        updateSession(deskPath, { bootstrapStatus: 'done' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        updateSession(deskPath, { bootstrapStatus: 'failed', bootstrapError: msg });
      }
    }

    // 9. Run post-create hook (non-fatal)
    runHook(this.workspaceRoot, 'post-create', { DESK_NAME: name, DESK_PATH: deskPath });

    // 10. Return DeskInfo
    const git = getGitStatus(deskPath);
    return this.buildDeskInfo(name, deskPath, session, git);
  }

  // ==========================================================================
  // list
  // ==========================================================================

  list(): DeskInfo[] {
    const deskNames = listWorktrees(this.workspaceRoot);
    const result: DeskInfo[] = [];

    for (const name of deskNames) {
      const deskPath = getDeskPath(this.workspaceRoot, name);
      const session = readSession(deskPath);
      const git = getGitStatus(deskPath);

      const effectiveSession: DeskSession = session || {
        name,
        status: 'idle',
        branch: git.branch,
        ports: calculatePorts(extractDeskIndex(name)),
        lastActivity: new Date().toISOString(),
      };

      result.push(this.buildDeskInfo(name, deskPath, effectiveSession, git));
    }

    return result;
  }

  // ==========================================================================
  // status
  // ==========================================================================

  status(name: string): DeskInfo {
    const deskPath = getDeskPath(this.workspaceRoot, name);

    if (!fs.existsSync(deskPath)) {
      throw new DeskNotFoundError(name);
    }

    const session = readSession(deskPath);
    const git = getGitStatus(deskPath);

    const effectiveSession: DeskSession = session || {
      name,
      status: 'idle',
      branch: git.branch,
      ports: calculatePorts(extractDeskIndex(name)),
      lastActivity: new Date().toISOString(),
    };

    return this.buildDeskInfo(name, deskPath, effectiveSession, git);
  }

  // ==========================================================================
  // checkout (existing branch)
  // ==========================================================================

  checkout(name: string, branch: string): DeskInfo {
    const deskPath = getDeskPath(this.workspaceRoot, name);

    if (!fs.existsSync(deskPath)) {
      throw new DeskNotFoundError(name);
    }

    runHook(this.workspaceRoot, 'pre-checkout', { DESK_NAME: name, DESK_PATH: deskPath });
    checkoutBranch(deskPath, branch);
    updateSession(deskPath, { branch, status: this.computeStatus(branch) });
    runHook(this.workspaceRoot, 'post-checkout', { DESK_NAME: name, DESK_PATH: deskPath });

    const session = readSession(deskPath)!;
    const git = getGitStatus(deskPath);
    return this.buildDeskInfo(name, deskPath, session, git);
  }

  // ==========================================================================
  // checkoutCreate (new branch)
  // ==========================================================================

  checkoutCreate(name: string, newBranch: string, base?: string): DeskInfo {
    const deskPath = getDeskPath(this.workspaceRoot, name);

    if (!fs.existsSync(deskPath)) {
      throw new DeskNotFoundError(name);
    }

    runHook(this.workspaceRoot, 'pre-checkout', { DESK_NAME: name, DESK_PATH: deskPath });
    createBranch(deskPath, newBranch, base);

    // Auto-tag from branch prefix
    const autoTags: string[] = [];
    if (newBranch.startsWith('feat/')) autoTags.push('feature');
    else if (newBranch.startsWith('fix/')) autoTags.push('bugfix');
    else if (newBranch.startsWith('refactor/')) autoTags.push('refactor');

    const session = readSession(deskPath);
    const existingTags = session?.tags || [];
    const mergedTags = Array.from(new Set([...existingTags, ...autoTags]));

    updateSession(deskPath, { branch: newBranch, status: 'working', tags: mergedTags.length > 0 ? mergedTags : undefined });
    runHook(this.workspaceRoot, 'post-checkout', { DESK_NAME: name, DESK_PATH: deskPath });

    const updatedSession = readSession(deskPath)!;
    const git = getGitStatus(deskPath);
    return this.buildDeskInfo(name, deskPath, updatedSession, git);
  }

  // ==========================================================================
  // health
  // ==========================================================================

  async health(): Promise<DeskHealthReport> {
    return checkHealth(this.workspaceRoot);
  }

  // ==========================================================================
  // conflicts
  // ==========================================================================

  conflicts(): DeskConflictReport {
    const deskNames = listWorktrees(this.workspaceRoot);
    const fileMap = new Map<string, string[]>();

    for (const name of deskNames) {
      const deskPath = getDeskPath(this.workspaceRoot, name);
      const git = getGitStatus(deskPath);
      if (git.clean) continue;

      const files = getModifiedFiles(deskPath);
      for (const file of files) {
        const desks = fileMap.get(file) || [];
        desks.push(name);
        fileMap.set(file, desks);
      }
    }

    const conflicts: DeskFileConflict[] = [];
    for (const [file, desks] of fileMap) {
      if (desks.length > 1) {
        conflicts.push({ file, desks });
      }
    }

    return { hasConflicts: conflicts.length > 0, conflicts };
  }

  // ==========================================================================
  // tagging
  // ==========================================================================

  tagDesk(name: string, tags: string[]): DeskInfo {
    const deskPath = getDeskPath(this.workspaceRoot, name);
    if (!fs.existsSync(deskPath)) throw new DeskNotFoundError(name);

    const session = readSession(deskPath);
    const existing = session?.tags || [];
    const merged = Array.from(new Set([...existing, ...tags]));
    updateSession(deskPath, { tags: merged });

    const updatedSession = readSession(deskPath)!;
    const git = getGitStatus(deskPath);
    return this.buildDeskInfo(name, deskPath, updatedSession, git);
  }

  untagDesk(name: string, tags: string[]): DeskInfo {
    const deskPath = getDeskPath(this.workspaceRoot, name);
    if (!fs.existsSync(deskPath)) throw new DeskNotFoundError(name);

    const session = readSession(deskPath);
    const existing = session?.tags || [];
    const filtered = existing.filter(t => !tags.includes(t));
    updateSession(deskPath, { tags: filtered });

    const updatedSession = readSession(deskPath)!;
    const git = getGitStatus(deskPath);
    return this.buildDeskInfo(name, deskPath, updatedSession, git);
  }

  // ==========================================================================
  // rebootstrap
  // ==========================================================================

  async rebootstrap(name: string, command?: string): Promise<DeskInfo> {
    const deskPath = getDeskPath(this.workspaceRoot, name);
    if (!fs.existsSync(deskPath)) throw new DeskNotFoundError(name);

    const bootstrapCmd = command || 'pnpm install';
    updateSession(deskPath, { bootstrapStatus: 'running', bootstrapError: undefined });

    try {
      execSync(bootstrapCmd, {
        cwd: deskPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 300_000,
      });
      updateSession(deskPath, { bootstrapStatus: 'done', bootstrapError: undefined });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateSession(deskPath, { bootstrapStatus: 'failed', bootstrapError: msg });
    }

    const session = readSession(deskPath)!;
    const git = getGitStatus(deskPath);
    return this.buildDeskInfo(name, deskPath, session, git);
  }

  // ==========================================================================
  // remove
  // ==========================================================================

  async remove(name: string, opts?: DeskRemoveOptions): Promise<void> {
    const deskPath = getDeskPath(this.workspaceRoot, name);

    if (!fs.existsSync(deskPath)) {
      throw new DeskNotFoundError(name);
    }

    // Check dirty
    const git = getGitStatus(deskPath);
    if (!git.clean && !opts?.force) {
      throw new DeskDirtyError(name, git.modified, git.untracked);
    }

    // Run pre-remove hook
    runHook(this.workspaceRoot, 'pre-remove', { DESK_NAME: name, DESK_PATH: deskPath });

    // Clean context files
    cleanContext(deskPath);

    // git worktree remove
    try {
      removeWorktree(this.workspaceRoot, deskPath, !!opts?.force);
    } catch {
      if (opts?.force) {
        // Fallback: force remove directory + prune
        fs.rmSync(deskPath, { recursive: true, force: true });
        pruneWorktrees(this.workspaceRoot);
      } else {
        throw new DeskGitError(`Failed to remove worktree for desk '${name}'`);
      }
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private computeStatus(branch: string): DeskStatus {
    // On main/master or agent/* branches = idle
    if (branch === 'main' || branch === 'master' || branch.startsWith('agent/')) {
      return 'idle';
    }
    return 'working';
  }

  private buildDeskInfo(
    name: string,
    deskPath: string,
    session: DeskSession,
    git: import('./types.js').DeskGitStatus
  ): DeskInfo {
    // Compute actual status from git state
    const status = this.computeStatus(git.branch);

    return {
      name,
      path: deskPath,
      status,
      branch: git.branch,
      ports: session.ports,
      lastActivity: session.lastActivity,
      git,
      tags: session.tags,
      bootstrapStatus: session.bootstrapStatus,
      bootstrapError: session.bootstrapError,
    };
  }

  private ensureGitignore(): void {
    const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      if (!content.includes('.desks/')) {
        fs.appendFileSync(gitignorePath, '\n# Agent Desk worktrees\n.desks/\n');
      }
    }
  }
}
