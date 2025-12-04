import { invoke } from "@tauri-apps/api/core";
import { useState, useCallback } from "react";

// =============================================================================
// Git Worktree Hook
// =============================================================================

export interface GitWorktreeInfo {
  path: string;
  branch: string;
  head: string;
  isBareLocked: boolean;
}

export interface UseGitWorktreeReturn {
  // State
  loading: boolean;
  error: string | null;

  // Actions
  getGitRemote: (folderPath: string) => Promise<string | null>;
  listWorktrees: (folderPath: string) => Promise<GitWorktreeInfo[]>;
  getCurrentBranch: (folderPath: string) => Promise<string>;
  isGitRepo: (folderPath: string) => Promise<boolean>;
  hashGitRemote: (url: string) => string;
}

/**
 * Hook for git worktree operations.
 * Provides utilities for discovering and managing git worktrees.
 */
export function useGitWorktree(): UseGitWorktreeReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Get the git remote origin URL for a repository.
   */
  const getGitRemote = useCallback(async (folderPath: string): Promise<string | null> => {
    try {
      setLoading(true);
      setError(null);

      const result = await invoke<string>("run_git_command", {
        cwd: folderPath,
        args: ["config", "--get", "remote.origin.url"],
      });

      return result.trim() || null;
    } catch (e) {
      // Not a git repo or no remote configured
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * List all worktrees for a git repository.
   * Uses `git worktree list --porcelain` for machine-readable output.
   */
  const listWorktrees = useCallback(async (folderPath: string): Promise<GitWorktreeInfo[]> => {
    try {
      setLoading(true);
      setError(null);

      const output = await invoke<string>("run_git_command", {
        cwd: folderPath,
        args: ["worktree", "list", "--porcelain"],
      });

      const worktrees: GitWorktreeInfo[] = [];
      const blocks = output.split("\n\n").filter(Boolean);

      for (const block of blocks) {
        const lines = block.trim().split("\n");
        const info: GitWorktreeInfo = {
          path: "",
          branch: "",
          head: "",
          isBareLocked: false,
        };

        for (const line of lines) {
          if (line.startsWith("worktree ")) {
            info.path = line.replace("worktree ", "");
          } else if (line.startsWith("HEAD ")) {
            info.head = line.replace("HEAD ", "");
          } else if (line.startsWith("branch refs/heads/")) {
            info.branch = line.replace("branch refs/heads/", "");
          } else if (line === "bare" || line === "locked") {
            info.isBareLocked = true;
          }
        }

        if (info.path && !info.isBareLocked) {
          worktrees.push(info);
        }
      }

      return worktrees;
    } catch (e) {
      setError(`Failed to list worktrees: ${e}`);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get the current branch name for a git repository.
   */
  const getCurrentBranch = useCallback(async (folderPath: string): Promise<string> => {
    try {
      setLoading(true);
      setError(null);

      const result = await invoke<string>("run_git_command", {
        cwd: folderPath,
        args: ["rev-parse", "--abbrev-ref", "HEAD"],
      });

      return result.trim();
    } catch (e) {
      setError(`Failed to get current branch: ${e}`);
      return "main"; // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Check if a folder is a git repository.
   */
  const isGitRepo = useCallback(async (folderPath: string): Promise<boolean> => {
    try {
      await invoke<string>("run_git_command", {
        cwd: folderPath,
        args: ["rev-parse", "--is-inside-work-tree"],
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  /**
   * Generate a hash from a git remote URL for use as project ID.
   * This ensures the same project is identified regardless of which worktree is opened.
   */
  const hashGitRemote = useCallback((url: string): string => {
    // Normalize the URL first
    // - Remove .git suffix
    // - Convert SSH to HTTPS format for consistency
    // - Remove trailing slashes
    let normalized = url
      .replace(/\.git$/, "")
      .replace(/\/$/, "");

    // Convert git@github.com:user/repo to github.com/user/repo
    const sshMatch = normalized.match(/^git@([^:]+):(.+)$/);
    if (sshMatch) {
      normalized = `${sshMatch[1]}/${sshMatch[2]}`;
    }

    // Remove protocol prefix
    normalized = normalized.replace(/^(https?:\/\/|git:\/\/)/, "");

    // Generate hash
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(16).padStart(8, "0");
  }, []);

  return {
    loading,
    error,
    getGitRemote,
    listWorktrees,
    getCurrentBranch,
    isGitRepo,
    hashGitRemote,
  };
}

// =============================================================================
// Utility Functions (non-hook versions for use outside components)
// =============================================================================

/**
 * Generate worktree ID from branch name.
 * "main" -> "main"
 * "feature/auth" -> "feature-auth"
 * "bugfix/ABC-123" -> "bugfix-abc-123"
 */
export function generateWorktreeId(branch: string): string {
  return branch
    .replace(/\//g, "-")
    .replace(/[^a-z0-9-]/gi, "-")
    .toLowerCase();
}

/**
 * Extract project name from git remote URL or folder path.
 */
export function extractProjectName(remoteOrPath: string): string {
  // Try git remote URL patterns
  const gitMatch = remoteOrPath.match(/[/:]([^/:]+?)(\.git)?$/);
  if (gitMatch) {
    return gitMatch[1];
  }
  // Fall back to folder name
  const parts = remoteOrPath.split("/").filter(Boolean);
  return parts[parts.length - 1] || "unknown";
}

/**
 * Hash a string for use as a unique identifier.
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}
