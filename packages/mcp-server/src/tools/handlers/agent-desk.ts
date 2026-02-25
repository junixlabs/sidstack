/**
 * Agent Desk MCP Tool Handlers
 *
 * Tools for managing the Agent Desk pool:
 * - desk_list: List all desks with status
 * - desk_status: Get detailed desk info + git status
 * - desk_acquire: Claim idle desk, create branch
 * - desk_release: Free desk, reset to main
 * - desk_pool_init: Initialize desk pool
 *
 * Uses workspace-detector from @sidstack/shared for resolution.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  detectWorkspace,
  listAgentDesks,
  getWorktreeStatus,
  updateWorktreeStatus,
  ensureSidstackLocal,
  getDeskPath,
  getDesksPath,
} from '@sidstack/shared';

// =============================================================================
// Types
// =============================================================================

interface DeskPoolConfig {
  version: number;
  poolSize: number;
  desks: Array<{
    name: string;
    role: 'worker' | 'reviewer';
    affinity: string[];
  }>;
  branchPattern: string;
  resetStrategy: string;
  bootstrap: {
    command: string;
    runOnCreate: boolean;
    runOnReset: boolean;
  };
}

interface GitStatus {
  branch: string;
  clean: boolean;
  staged: number;
  modified: number;
  untracked: number;
}

// =============================================================================
// Tool Definitions
// =============================================================================

export const agentDeskTools = [
  {
    name: 'desk_list',
    description:
      'List all agent desks in the workspace with their current status, branch, role, and task assignment.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description:
            'Path to any directory within the workspace (auto-resolves workspace root)',
        },
      },
      required: ['projectPath'],
    },
  },
  {
    name: 'desk_status',
    description:
      'Get detailed status of a specific agent desk including git status, session state, and task info.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to any directory within the workspace',
        },
        deskName: {
          type: 'string',
          description: 'Name of the desk (e.g., "desk-1", "desk-review")',
        },
      },
      required: ['projectPath', 'deskName'],
    },
  },
  {
    name: 'desk_acquire',
    description:
      'Acquire an idle desk for a task. Creates a feature branch from main and marks the desk as working. Branch name should describe the work, not the desk.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to any directory within the workspace',
        },
        taskId: {
          type: 'string',
          description: 'Task ID to assign to the desk',
        },
        branchName: {
          type: 'string',
          description:
            'Branch name to create (e.g., "feat/auth-module", "fix/login-timeout")',
        },
        deskName: {
          type: 'string',
          description:
            'Specific desk to acquire. If omitted, auto-selects first idle worker desk.',
        },
      },
      required: ['projectPath', 'taskId', 'branchName'],
    },
  },
  {
    name: 'desk_release',
    description:
      'Release a desk after task completion. Resets to main branch, deletes the feature branch locally, and clears task assignment.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to any directory within the workspace',
        },
        deskName: {
          type: 'string',
          description: 'Name of the desk to release',
        },
        force: {
          type: 'boolean',
          description:
            'Force release even with uncommitted changes (default: false)',
        },
      },
      required: ['projectPath', 'deskName'],
    },
  },
  {
    name: 'desk_pool_init',
    description:
      'Initialize a desk pool for the workspace. Creates git worktrees in desks/ subdirectory and desk-pool.json config.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description:
            'Path to the workspace root (must contain .sidstack/)',
        },
        poolSize: {
          type: 'number',
          description: 'Total number of desks to create (1-10)',
          minimum: 1,
          maximum: 10,
        },
        workers: {
          type: 'number',
          description: 'Number of worker desks (default: poolSize - 1)',
        },
        reviewers: {
          type: 'number',
          description: 'Number of reviewer desks (default: 1)',
        },
        bootstrap: {
          type: 'string',
          description:
            'Bootstrap command to run in each desk (e.g., "pnpm install")',
        },
      },
      required: ['projectPath', 'poolSize'],
    },
  },
];

// =============================================================================
// Helpers
// =============================================================================

function resolveWorkspace(projectPath: string) {
  const info = detectWorkspace(projectPath);
  if (!info) {
    throw new Error(`Not inside a SidStack workspace: ${projectPath}`);
  }
  return info;
}

function readDeskPoolConfig(workspaceRoot: string): DeskPoolConfig | null {
  const poolPath = path.join(workspaceRoot, '.sidstack', 'desk-pool.json');
  if (!fs.existsSync(poolPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(poolPath, 'utf-8'));
  } catch {
    return null;
  }
}

function writeDeskPoolConfig(
  workspaceRoot: string,
  config: DeskPoolConfig
): void {
  const poolPath = path.join(workspaceRoot, '.sidstack', 'desk-pool.json');
  fs.writeFileSync(poolPath, JSON.stringify(config, null, 2), 'utf-8');
}

function getGitStatus(deskPath: string): GitStatus {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: deskPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const status = execSync('git status --porcelain', {
      cwd: deskPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const lines = status ? status.split('\n') : [];
    let staged = 0;
    let modified = 0;
    let untracked = 0;
    for (const line of lines) {
      if (line.startsWith('??')) untracked++;
      else if (line[0] !== ' ' && line[0] !== '?') staged++;
      if (line[1] !== ' ' && line[1] !== '?' && !line.startsWith('??'))
        modified++;
    }

    return { branch, clean: lines.length === 0, staged, modified, untracked };
  } catch {
    return {
      branch: 'unknown',
      clean: true,
      staged: 0,
      modified: 0,
      untracked: 0,
    };
  }
}

function gitExec(cmd: string, cwd: string): string {
  return execSync(cmd, {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

// =============================================================================
// Desk CLAUDE.md Management
// =============================================================================

function writeDeskClaudeMd(
  deskPath: string,
  context: { deskName: string; taskId: string; branch: string }
): void {
  const claudeMd = `# Agent Desk: ${context.deskName}

## MANDATORY: Desk Context

You are working in an **Agent Desk worktree**. Follow these rules strictly:

1. **Task:** \`${context.taskId}\` — Use \`mcp__sidstack__task_get({ taskId: "${context.taskId}" })\` to load full context
2. **Branch:** \`${context.branch}\` — All commits MUST be on this branch
3. **DO NOT** switch to \`main\` or any other branch
4. **DO NOT** modify files outside this worktree
5. **Use \`/sidstack-dev feature ${context.taskId}\`** to follow the structured workflow

## Workflow

1. Load task details: \`task_get\`
2. If \`solutionPlan\` exists and \`planStatus=approved\`: implement according to plan
3. If no plan: run \`/sidstack-dev feature ${context.taskId}\` for full workflow
4. Commit to \`${context.branch}\` only
5. When done: \`task_complete\` then inform lead/user
`;

  fs.writeFileSync(path.join(deskPath, 'CLAUDE.md'), claudeMd, 'utf-8');
}

function removeDeskClaudeMd(deskPath: string): void {
  const claudeMdPath = path.join(deskPath, 'CLAUDE.md');
  if (fs.existsSync(claudeMdPath)) {
    fs.unlinkSync(claudeMdPath);
  }
}

// =============================================================================
// Handlers
// =============================================================================

export async function handleDeskList(args: {
  projectPath: string;
}): Promise<Record<string, unknown>> {
  const workspace = resolveWorkspace(args.projectPath);
  const desks = listAgentDesks(workspace.workspaceRoot);
  const poolConfig = readDeskPoolConfig(workspace.workspaceRoot);

  const deskInfos = desks.map((desk) => ({
    name: desk.name,
    role: desk.agentRole || 'worker',
    status: desk.status,
    branch: desk.branch,
    taskId: desk.taskId,
    path: desk.path,
    lastActivity: desk.lastActivity,
  }));

  const statusCounts: Record<string, number> = {};
  const roleCounts: Record<string, number> = {};
  for (const d of deskInfos) {
    statusCounts[d.status] = (statusCounts[d.status] || 0) + 1;
    roleCounts[d.role] = (roleCounts[d.role] || 0) + 1;
  }

  return {
    success: true,
    workspace: workspace.workspaceRoot,
    projectId: workspace.projectId,
    poolConfig: poolConfig
      ? {
          poolSize: poolConfig.poolSize,
          branchPattern: poolConfig.branchPattern,
        }
      : null,
    desks: deskInfos,
    summary: {
      total: deskInfos.length,
      byStatus: statusCounts,
      byRole: roleCounts,
    },
  };
}

export async function handleDeskStatus(args: {
  projectPath: string;
  deskName: string;
}): Promise<Record<string, unknown>> {
  const workspace = resolveWorkspace(args.projectPath);
  const deskPath = getDeskPath(workspace.workspaceRoot, args.deskName);

  if (!fs.existsSync(deskPath)) {
    throw new Error(`Desk not found: ${args.deskName}`);
  }

  const session = getWorktreeStatus(deskPath);
  const git = getGitStatus(deskPath);
  const poolConfig = readDeskPoolConfig(workspace.workspaceRoot);

  // Find desk config from pool
  const deskConfig = poolConfig?.desks.find((d) => d.name === args.deskName);

  return {
    success: true,
    desk: {
      name: session.name,
      path: deskPath,
      role: session.agentRole || deskConfig?.role || 'worker',
      status: session.status,
      taskId: session.taskId,
      branch: session.branch || git.branch,
      lastActivity: session.lastActivity,
      affinity: deskConfig?.affinity || [],
    },
    git: {
      branch: git.branch,
      clean: git.clean,
      staged: git.staged,
      modified: git.modified,
      untracked: git.untracked,
    },
  };
}

export async function handleDeskAcquire(args: {
  projectPath: string;
  taskId: string;
  branchName: string;
  deskName?: string;
}): Promise<Record<string, unknown>> {
  const workspace = resolveWorkspace(args.projectPath);
  const desks = listAgentDesks(workspace.workspaceRoot);

  // Find desk to acquire
  let targetDesk;
  if (args.deskName) {
    targetDesk = desks.find((d) => d.name === args.deskName);
    if (!targetDesk) throw new Error(`Desk not found: ${args.deskName}`);
    if (targetDesk.status !== 'idle')
      throw new Error(
        `Desk ${args.deskName} is not idle (status: ${targetDesk.status})`
      );
  } else {
    // Auto-select first idle worker desk
    targetDesk = desks.find(
      (d) => d.status === 'idle' && d.agentRole !== 'reviewer'
    );
    if (!targetDesk) {
      // Fallback: any idle desk
      targetDesk = desks.find((d) => d.status === 'idle');
    }
    if (!targetDesk) throw new Error('No idle desks available');
  }

  const deskPath = targetDesk.path;

  // Fetch latest and create feature branch from main
  try {
    // Fetch latest main (don't checkout — main may be checked out in another worktree)
    try {
      gitExec('git fetch origin main', deskPath);
    } catch {
      // No remote or network issue — proceed with local main
    }
    // Create feature branch directly from main (avoids "already checked out" error)
    gitExec(`git checkout -b ${args.branchName} main`, deskPath);
  } catch (err) {
    throw new Error(
      `Git error: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Update session
  updateWorktreeStatus(deskPath, {
    status: 'working',
    taskId: args.taskId,
    branch: args.branchName,
  });

  // Auto-generate CLAUDE.md with desk context so any Claude Code session
  // opened in this directory knows what task/branch to work on
  writeDeskClaudeMd(deskPath, {
    deskName: targetDesk.name,
    taskId: args.taskId,
    branch: args.branchName,
  });

  return {
    success: true,
    desk: targetDesk.name,
    deskPath,
    branch: args.branchName,
    taskId: args.taskId,
  };
}

export async function handleDeskRelease(args: {
  projectPath: string;
  deskName: string;
  force?: boolean;
}): Promise<Record<string, unknown>> {
  const workspace = resolveWorkspace(args.projectPath);
  const deskPath = getDeskPath(workspace.workspaceRoot, args.deskName);

  if (!fs.existsSync(deskPath)) {
    throw new Error(`Desk not found: ${args.deskName}`);
  }

  const session = getWorktreeStatus(deskPath);
  if (session.status === 'idle') {
    throw new Error(`Desk ${args.deskName} is already idle`);
  }

  // Check for uncommitted changes
  const git = getGitStatus(deskPath);
  if (!git.clean && !args.force) {
    return {
      success: false,
      error: `Desk has uncommitted changes (${git.modified} modified, ${git.untracked} untracked). Use force=true to override.`,
      git,
    };
  }

  const previousBranch = git.branch;

  // Reset working tree and delete feature branch
  try {
    if (!git.clean) {
      gitExec('git checkout -- .', deskPath);
      gitExec('git clean -fd', deskPath);
    }
    // Reset to main commit without checking out main (avoids "already checked out" conflict)
    gitExec('git reset --hard main', deskPath);
    // Fetch latest (ignore errors if no remote)
    try {
      gitExec('git fetch origin main', deskPath);
      gitExec('git reset --hard origin/main', deskPath);
    } catch {
      // No remote — proceed with local main
    }
    // Delete the feature branch locally (from main worktree to avoid "checked out" issues)
    if (previousBranch && previousBranch !== 'main') {
      try {
        gitExec(`git branch -D ${previousBranch}`, deskPath);
      } catch {
        // Branch might already be deleted
      }
    }
  } catch (err) {
    throw new Error(
      `Git error: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Remove auto-generated CLAUDE.md (cleanup)
  removeDeskClaudeMd(deskPath);

  // Update session
  updateWorktreeStatus(deskPath, {
    status: 'idle',
    taskId: undefined,
    branch: git.branch, // Keep current branch name (worktree stays on its branch)
  });

  return {
    success: true,
    desk: args.deskName,
    previousBranch,
    status: 'idle',
  };
}

export async function handleDeskPoolInit(args: {
  projectPath: string;
  poolSize: number;
  workers?: number;
  reviewers?: number;
  bootstrap?: string;
}): Promise<Record<string, unknown>> {
  const workspace = resolveWorkspace(args.projectPath);
  const workspaceRoot = workspace.workspaceRoot;

  // Check if pool already exists
  const existingPool = readDeskPoolConfig(workspaceRoot);
  if (existingPool) {
    throw new Error(
      'Desk pool already initialized. Use desk_list to see existing desks.'
    );
  }

  // Calculate worker/reviewer split
  const reviewerCount = args.reviewers ?? 1;
  const workerCount = args.workers ?? args.poolSize - reviewerCount;

  if (workerCount + reviewerCount !== args.poolSize) {
    throw new Error(
      `Worker (${workerCount}) + reviewer (${reviewerCount}) count must equal poolSize (${args.poolSize})`
    );
  }
  if (workerCount < 0 || reviewerCount < 0) {
    throw new Error('Worker and reviewer counts must be non-negative');
  }

  // Ensure desks/ directory exists
  const desksDir = getDesksPath(workspaceRoot);
  if (!fs.existsSync(desksDir)) {
    fs.mkdirSync(desksDir, { recursive: true });
  }

  // Add desks/ to .gitignore if not already there
  const gitignorePath = path.join(workspaceRoot, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
    if (!gitignore.includes('desks/')) {
      fs.appendFileSync(gitignorePath, '\n# Agent Desk worktrees\ndesks/\n');
    }
  } else {
    fs.writeFileSync(gitignorePath, '# Agent Desk worktrees\ndesks/\n', 'utf-8');
  }

  // Build desk list
  const desks: Array<{
    name: string;
    role: 'worker' | 'reviewer';
    affinity: string[];
  }> = [];

  for (let i = 1; i <= workerCount; i++) {
    desks.push({ name: `desk-${i}`, role: 'worker', affinity: [] });
  }
  for (let i = 1; i <= reviewerCount; i++) {
    const name = reviewerCount === 1 ? 'desk-review' : `desk-review-${i}`;
    desks.push({ name, role: 'reviewer', affinity: [] });
  }

  // Create worktrees using standard git worktree add
  const created: string[] = [];
  const errors: string[] = [];

  for (const desk of desks) {
    const deskPath = getDeskPath(workspaceRoot, desk.name);

    if (fs.existsSync(deskPath)) {
      errors.push(`${desk.name}: directory already exists`);
      continue;
    }

    try {
      // Create worktree branching from main
      const tempBranch = `agent/${desk.name}`;
      execSync(
        `git worktree add -b "${tempBranch}" "${deskPath}" main`,
        { cwd: workspaceRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      );

      // Create .sidstack-local with session.json
      const localDir = ensureSidstackLocal(deskPath);
      const agentName =
        desk.role === 'reviewer'
          ? reviewerCount === 1
            ? 'Reviewer'
            : `Reviewer ${desk.name.replace('desk-review-', '')}`
          : `Worker ${desk.name.replace('desk-', '')}`;

      fs.writeFileSync(
        path.join(localDir, 'session.json'),
        JSON.stringify(
          {
            name: desk.name,
            status: 'idle',
            branch: 'main',
            agentRole: desk.role,
            agentName,
            lastActivity: new Date().toISOString(),
            ports: { dev: 0, api: 0, preview: 0 },
          },
          null,
          2
        ),
        'utf-8'
      );

      created.push(desk.name);
    } catch (err) {
      errors.push(
        `${desk.name}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Write pool config
  const poolConfig: DeskPoolConfig = {
    version: 1,
    poolSize: args.poolSize,
    desks,
    branchPattern: '{type}/{taskSlug}',
    resetStrategy: 'hard-reset-to-main',
    bootstrap: {
      command: args.bootstrap || 'pnpm install',
      runOnCreate: true,
      runOnReset: false,
    },
  };

  writeDeskPoolConfig(workspaceRoot, poolConfig);

  return {
    success: errors.length === 0,
    workspace: workspaceRoot,
    poolSize: args.poolSize,
    created,
    errors: errors.length > 0 ? errors : undefined,
    poolConfig,
  };
}
