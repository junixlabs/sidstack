// Git types
export interface FileDiff {
  path: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  origin: string;
  content: string;
  old_lineno: number | null;
  new_lineno: number | null;
}

export type FileStatus = "added" | "modified" | "deleted" | "renamed" | "untracked";

export interface BranchInfo {
  name: string;
  is_head: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
}

export interface CommitInfo {
  id: string;
  message: string;
  author: string;
  time: number;
}

export interface RepoStatus {
  branch: string;
  is_clean: boolean;
  staged: string[];
  modified: string[];
  untracked: string[];
}

// Workspace types
export interface Workspace {
  task_id: string;
  branch_name: string;
  worktree_path: string;
  status: WorkspaceStatus;
  created_at: number;
  last_activity: number;
}

export type WorkspaceStatus = "active" | "reviewing" | "merged" | "archived";

export interface WorkspaceStats {
  files_changed: number;
  additions: number;
  deletions: number;
  commits_ahead: number;
  commits_behind: number;
}

// File types
export interface FileContent {
  path: string;
  content: string;
  language: string;
  line_count: number;
  size_bytes: number;
}

export interface FileTreeNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileTreeNode[] | null;
  status: string | null;
}

// Task types
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  workspace?: Workspace;
  agent_id?: string;
}

export type TaskStatus = "pending" | "in_progress" | "reviewing" | "completed" | "blocked";

// Agent types
export interface Agent {
  id: string;
  role: string;
  status: AgentStatus;
  current_task?: string;
  progress?: number;
  current_step?: string;
}

export type AgentStatus = "idle" | "working" | "waiting" | "error";

// UI State
export interface Tab {
  id: string;
  type: "task" | "file" | "diff";
  title: string;
  data: unknown;
  pinned?: boolean;
}

// =============================================================================
// Project-Based Workspace Types (Multi-Worktree Support)
// =============================================================================

/**
 * Port allocation for a worktree.
 * Each worktree gets unique ports to avoid conflicts.
 */
export interface PortAllocation {
  dev: number;      // Development server (3000-3099)
  api: number;      // API server (19432-19531)
  preview: number;  // Preview server (4000-4099)
}

/**
 * A git worktree within a project.
 * Multiple worktrees can exist for the same project (same git remote).
 */
export interface Worktree {
  id: string;                    // Unique ID derived from branch name (e.g., "main", "feature-auth")
  path: string;                  // Absolute filesystem path (e.g., "/Users/x/sidstack-feature-auth")
  branch: string;                // Git branch name (e.g., "feature/auth")
  purpose?: string;              // Optional description of what this worktree is for
  ports: PortAllocation;         // Allocated ports for dev servers
  isActive: boolean;             // Whether this worktree is currently selected
  lastActive: string;            // ISO timestamp of last activity
}

/**
 * A project identified by git remote URL.
 * Contains multiple worktrees sharing the same codebase.
 */
export interface Project {
  id: string;                    // Hash from git remote URL (unique identifier)
  name: string;                  // Human-readable project name (e.g., "sidstack")
  gitRemote: string;             // Git remote URL (e.g., "github.com/user/sidstack")
  worktrees: Worktree[];         // All worktrees for this project
  activeWorktreeId: string;      // Currently active worktree
  sharedContextPath: string;     // Path to shared context (e.g., ~/.sidstack/projects/<hash>/)
}

/**
 * Port range configuration for allocation.
 */
export interface PortRange {
  start: number;
  end: number;
}

/**
 * Port ranges for different server types.
 */
export interface PortRanges {
  dev: PortRange;
  api: PortRange;
  preview: PortRange;
}

