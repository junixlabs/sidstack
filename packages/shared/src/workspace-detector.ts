/**
 * Workspace Detection Module
 *
 * Detects SidStack workspace/project from any path within it.
 * Supports both legacy projects and new workspace structure with worktrees.
 *
 * Detection markers:
 * - `.sidstack/config.json` → workspace/project root
 * - `.sidstack-local/` → worktree (look up for workspace root)
 * - `desks/` → workspace with agent desk worktrees
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigurationError, WorkspaceNotInitializedError } from './errors';

// ============================================================================
// Types
// ============================================================================

/**
 * Workspace configuration stored in .sidstack/config.json
 */
export interface WorkspaceConfig {
  projectId: string;
  projectName: string;
  projectPath: string;
  version: string;
  createdAt: string;
  // Workspace-specific fields (v2)
  isWorkspace?: boolean;
  worktrees?: string[];
}

/**
 * Result of workspace detection
 */
export interface WorkspaceInfo {
  /** Absolute path to workspace/project root (where .sidstack/ lives) */
  workspaceRoot: string;

  /** Project UUID from config.json */
  projectId: string;

  /** Project name from config.json */
  projectName: string;

  /** True if cwd is inside a worktree subfolder */
  isWorktree: boolean;

  /** Worktree folder name (e.g., "wt-1") if isWorktree is true */
  worktreeName?: string;

  /** Absolute path to worktree folder if isWorktree is true */
  worktreePath?: string;

  /** Original path that was queried */
  queriedPath: string;

  /** True if this workspace has agent desks (desks/ directory exists) */
  isWorkspaceStructure: boolean;

  /** Config version */
  version: string;
}

/**
 * Options for workspace detection
 */
export interface DetectWorkspaceOptions {
  /** If true, throw error when workspace not found. Default: false */
  throwOnNotFound?: boolean;

  /** Maximum directory levels to traverse up. Default: 20 */
  maxDepth?: number;
}

// ============================================================================
// Constants
// ============================================================================

const SIDSTACK_DIR = '.sidstack';
const SIDSTACK_LOCAL_DIR = '.sidstack-local';
const CONFIG_FILE = 'config.json';
const DESKS_DIR = '.desks';
const DEFAULT_MAX_DEPTH = 20;

// In-memory cache for detectWorkspace() results to avoid repeated filesystem walks
const CACHE_TTL_MS = 30_000; // 30 seconds
const workspaceCache = new Map<string, { result: WorkspaceInfo | null; timestamp: number }>();

// ============================================================================
// Git Fallback (Mode B: Normal Repo + Sibling Worktrees)
// ============================================================================

/**
 * Resolve workspace via git for Mode B (normal repo + sibling worktrees).
 *
 * When directory traversal fails to find .sidstack/config.json (because the
 * agent desk is a sibling directory, not a child), we use git to find the
 * main project that owns the .sidstack/ directory.
 *
 * Uses `git rev-parse --git-common-dir` to find the shared git directory,
 * then resolves the main project root from there.
 */
function resolveViaGit(startPath: string): WorkspaceInfo | null {
  try {
    // Get the common git dir (shared across worktrees)
    const gitCommonDir = execSync('git rev-parse --git-common-dir', {
      cwd: startPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (!gitCommonDir || gitCommonDir === '.git') {
      // Not a worktree — this is the main repo itself, traversal should have found it
      return null;
    }

    // Resolve the absolute path of the common git dir
    const absoluteGitDir = path.resolve(startPath, gitCommonDir);

    // The main project root is the parent of the .git directory
    // e.g., /tools/my-project/.git → /tools/my-project
    const mainProjectRoot = path.dirname(absoluteGitDir);

    // Check if .sidstack/config.json exists at the main project root
    const configPath = path.join(mainProjectRoot, SIDSTACK_DIR, CONFIG_FILE);
    if (!fs.existsSync(configPath)) {
      return null;
    }

    const config = loadConfig(configPath);

    // Get the current worktree's root
    const worktreeRoot = execSync('git rev-parse --show-toplevel', {
      cwd: startPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const isWorkspaceStructure = fs.existsSync(path.join(mainProjectRoot, DESKS_DIR));
    const isInWorktree = worktreeRoot !== mainProjectRoot;

    return {
      workspaceRoot: mainProjectRoot,
      projectId: config.projectId,
      projectName: config.projectName,
      isWorktree: isInWorktree,
      worktreeName: isInWorktree ? path.basename(worktreeRoot) : undefined,
      worktreePath: isInWorktree ? worktreeRoot : undefined,
      queriedPath: startPath,
      isWorkspaceStructure,
      version: config.version,
    };
  } catch {
    // Not a git repo or git not available
    return null;
  }
}

// ============================================================================
// Core Detection Functions
// ============================================================================

/**
 * Detect workspace from any path within it.
 *
 * @param startPath - Starting path to search from. Defaults to process.cwd()
 * @param options - Detection options
 * @returns WorkspaceInfo if found, null otherwise (unless throwOnNotFound)
 *
 * @example
 * // From worktree
 * detectWorkspace('/workspace/wt-1/src/components')
 * // Returns: { workspaceRoot: '/workspace', isWorktree: true, worktreeName: 'wt-1', ... }
 *
 * // From workspace root
 * detectWorkspace('/workspace')
 * // Returns: { workspaceRoot: '/workspace', isWorktree: false, ... }
 *
 * // From legacy project
 * detectWorkspace('/old-project/src')
 * // Returns: { workspaceRoot: '/old-project', isWorktree: false, isWorkspaceStructure: false, ... }
 */
export function detectWorkspace(
  startPath?: string,
  options: DetectWorkspaceOptions = {}
): WorkspaceInfo | null {
  const { throwOnNotFound = false, maxDepth = DEFAULT_MAX_DEPTH } = options;

  const resolvedPath = path.resolve(startPath || process.cwd());

  // Check cache first
  const cached = workspaceCache.get(resolvedPath);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    if (cached.result === null && throwOnNotFound) {
      throw new WorkspaceNotInitializedError(resolvedPath);
    }
    return cached.result;
  }

  // Track if we passed through a worktree marker
  let worktreeInfo: { name: string; path: string } | null = null;

  let currentPath = resolvedPath;
  let depth = 0;

  while (currentPath !== '/' && depth < maxDepth) {
    // Check for worktree marker (.sidstack-local/)
    const localMarker = path.join(currentPath, SIDSTACK_LOCAL_DIR);
    if (fs.existsSync(localMarker) && fs.statSync(localMarker).isDirectory()) {
      // This is a worktree folder
      worktreeInfo = {
        name: path.basename(currentPath),
        path: currentPath,
      };
    }

    // Check for workspace/project root (.sidstack/config.json)
    const configPath = path.join(currentPath, SIDSTACK_DIR, CONFIG_FILE);
    if (fs.existsSync(configPath)) {
      try {
        const config = loadConfig(configPath);
        const isWorkspaceStructure = fs.existsSync(path.join(currentPath, DESKS_DIR));

        const result: WorkspaceInfo = {
          workspaceRoot: currentPath,
          projectId: config.projectId,
          projectName: config.projectName,
          isWorktree: worktreeInfo !== null,
          worktreeName: worktreeInfo?.name,
          worktreePath: worktreeInfo?.path,
          queriedPath: resolvedPath,
          isWorkspaceStructure,
          version: config.version,
        };
        workspaceCache.set(resolvedPath, { result, timestamp: Date.now() });
        return result;
      } catch (error) {
        // Config exists but is invalid
        if (throwOnNotFound) {
          throw new ConfigurationError(
            `Invalid config at ${configPath}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        workspaceCache.set(resolvedPath, { result: null, timestamp: Date.now() });
        return null;
      }
    }

    // Move up one directory
    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      // Reached root
      break;
    }
    currentPath = parentPath;
    depth++;
  }

  // Git fallback for Mode B (normal repo + sibling worktrees)
  const gitResult = resolveViaGit(resolvedPath);
  if (gitResult) {
    workspaceCache.set(resolvedPath, { result: gitResult, timestamp: Date.now() });
    return gitResult;
  }

  // Not found - cache the negative result too
  workspaceCache.set(resolvedPath, { result: null, timestamp: Date.now() });

  if (throwOnNotFound) {
    throw new WorkspaceNotInitializedError(resolvedPath);
  }

  return null;
}

/**
 * Check if a path is inside a SidStack workspace/project
 */
export function isInsideWorkspace(targetPath?: string): boolean {
  return detectWorkspace(targetPath) !== null;
}

/**
 * Get workspace root from any path within it.
 * Convenience function that returns just the root path.
 *
 * @throws WorkspaceNotInitializedError if not inside a workspace
 */
export function getWorkspaceRoot(startPath?: string): string {
  const info = detectWorkspace(startPath, { throwOnNotFound: true });
  return info!.workspaceRoot;
}

/**
 * Get projectId from any path within workspace.
 * Convenience function for hooks and MCP tools.
 *
 * @throws WorkspaceNotInitializedError if not inside a workspace
 */
export function getProjectId(startPath?: string): string {
  const info = detectWorkspace(startPath, { throwOnNotFound: true });
  return info!.projectId;
}

/**
 * Get projectId if available, otherwise return null.
 * Non-throwing version for graceful degradation.
 */
export function getProjectIdSafe(startPath?: string): string | null {
  const info = detectWorkspace(startPath);
  return info?.projectId ?? null;
}

// ============================================================================
// Config Loading
// ============================================================================

/**
 * Load and validate workspace config from path
 */
function loadConfig(configPath: string): WorkspaceConfig {
  const content = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(content) as Partial<WorkspaceConfig>;

  // Validate required fields
  if (!config.projectId) {
    throw new ConfigurationError('Missing projectId in config.json');
  }
  if (!config.projectName) {
    throw new ConfigurationError('Missing projectName in config.json');
  }

  return {
    projectId: config.projectId,
    projectName: config.projectName,
    projectPath: config.projectPath || '.',
    version: config.version || '0.0.0',
    createdAt: config.createdAt || new Date().toISOString(),
    isWorkspace: config.isWorkspace,
    worktrees: config.worktrees,
  };
}

/**
 * Load workspace config from workspace root
 *
 * @throws ConfigurationError if config is missing or invalid
 */
export function loadWorkspaceConfig(workspaceRoot: string): WorkspaceConfig {
  const configPath = path.join(workspaceRoot, SIDSTACK_DIR, CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    throw new WorkspaceNotInitializedError(workspaceRoot);
  }

  return loadConfig(configPath);
}

/**
 * Save workspace config to workspace root
 */
export function saveWorkspaceConfig(
  workspaceRoot: string,
  config: WorkspaceConfig
): void {
  const sidstackDir = path.join(workspaceRoot, SIDSTACK_DIR);
  const configPath = path.join(sidstackDir, CONFIG_FILE);

  // Ensure .sidstack directory exists
  if (!fs.existsSync(sidstackDir)) {
    fs.mkdirSync(sidstackDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

// ============================================================================
// Path Utilities
// ============================================================================

/**
 * Get path to .sidstack directory for a workspace
 */
export function getSidstackPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, SIDSTACK_DIR);
}

/**
 * Get path to .sidstack-local directory for a worktree
 */
export function getSidstackLocalPath(worktreePath: string): string {
  return path.join(worktreePath, SIDSTACK_LOCAL_DIR);
}

/**
 * Ensure .sidstack-local directory exists for a worktree
 */
export function ensureSidstackLocal(worktreePath: string): string {
  const localPath = getSidstackLocalPath(worktreePath);
  if (!fs.existsSync(localPath)) {
    fs.mkdirSync(localPath, { recursive: true });
  }
  return localPath;
}

/**
 * Get config.json path for a workspace
 */
export function getConfigPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, SIDSTACK_DIR, CONFIG_FILE);
}

// ============================================================================
// Worktree Utilities
// ============================================================================

/**
 * List all worktrees in a workspace
 */
export function listWorktrees(workspaceRoot: string): string[] {
  const worktrees: string[] = [];
  const desksDir = path.join(workspaceRoot, DESKS_DIR);

  if (!fs.existsSync(desksDir)) return worktrees;

  const entries = fs.readdirSync(desksDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue; // Skip hidden dirs

    const entryPath = path.join(desksDir, entry.name);
    const localMarker = path.join(entryPath, SIDSTACK_LOCAL_DIR);

    if (fs.existsSync(localMarker)) {
      worktrees.push(entry.name);
    }
  }

  return worktrees;
}

/** Path to desks directory */
export const DESKS_DIR_NAME = DESKS_DIR;

/** Get absolute path to desks directory */
export function getDesksPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, DESKS_DIR);
}

/** Get absolute path to a specific desk */
export function getDeskPath(workspaceRoot: string, deskName: string): string {
  return path.join(workspaceRoot, DESKS_DIR, deskName);
}

/**
 * Check if a directory is a worktree (has .sidstack-local/)
 */
export function isWorktree(dirPath: string): boolean {
  const localMarker = path.join(dirPath, SIDSTACK_LOCAL_DIR);
  return fs.existsSync(localMarker) && fs.statSync(localMarker).isDirectory();
}

/**
 * Get worktree status from .sidstack-local/session.json
 */
export interface WorktreeStatus {
  name: string;
  path: string;
  status: 'idle' | 'assigned' | 'working' | 'review';
  branch?: string;
  taskId?: string;
  agentRole?: string;
  lastActivity?: string;
}

export function getWorktreeStatus(worktreePath: string): WorktreeStatus {
  const name = path.basename(worktreePath);
  const sessionPath = path.join(worktreePath, SIDSTACK_LOCAL_DIR, 'session.json');

  const baseStatus: WorktreeStatus = {
    name,
    path: worktreePath,
    status: 'idle',
  };

  if (!fs.existsSync(sessionPath)) {
    return baseStatus;
  }

  try {
    const session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    return {
      ...baseStatus,
      status: session.status || 'idle',
      branch: session.branch,
      taskId: session.taskId,
      agentRole: session.agentRole,
      lastActivity: session.lastActivity,
    };
  } catch {
    return baseStatus;
  }
}

/**
 * Update worktree session status
 */
export function updateWorktreeStatus(
  worktreePath: string,
  updates: Partial<Omit<WorktreeStatus, 'name' | 'path'>>
): void {
  const localDir = ensureSidstackLocal(worktreePath);
  const sessionPath = path.join(localDir, 'session.json');

  let session: Record<string, unknown> = {};

  if (fs.existsSync(sessionPath)) {
    try {
      session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    } catch {
      // Start fresh if corrupted
    }
  }

  const updated = {
    ...session,
    ...updates,
    lastActivity: new Date().toISOString(),
  };

  fs.writeFileSync(sessionPath, JSON.stringify(updated, null, 2), 'utf-8');
}

// ============================================================================
// Agent Desk Aliases (backward-compatible wrappers)
// ============================================================================

/** Agent Desk status — alias for WorktreeStatus */
export type AgentDeskInfo = WorktreeStatus;

/**
 * List all agent desks in a workspace.
 * Uses `git worktree list --porcelain` for accurate discovery across both modes.
 */
export function listAgentDesks(workspaceRoot: string): AgentDeskInfo[] {
  const desks: AgentDeskInfo[] = [];

  try {
    const output = execSync('git worktree list --porcelain', {
      cwd: workspaceRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const blocks = output.split('\n\n').filter(Boolean);

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      const worktreeLine = lines.find((l) => l.startsWith('worktree '));

      if (worktreeLine) {
        const wtPath = worktreeLine.replace('worktree ', '');
        // Only include worktrees with .sidstack-local marker
        const localMarker = path.join(wtPath, SIDSTACK_LOCAL_DIR);
        if (fs.existsSync(localMarker)) {
          desks.push(getWorktreeStatus(wtPath));
        }
      }
    }
  } catch {
    // Git not available or not a git repo — fall back to directory scan
    const names = listWorktrees(workspaceRoot);
    for (const name of names) {
      const wtPath = getDeskPath(workspaceRoot, name);
      desks.push(getWorktreeStatus(wtPath));
    }
  }

  return desks;
}

/** Get agent desk status — alias for getWorktreeStatus */
export const getAgentDeskStatus = getWorktreeStatus;

/** Update agent desk status — alias for updateWorktreeStatus */
export const updateAgentDeskStatus = updateWorktreeStatus;
