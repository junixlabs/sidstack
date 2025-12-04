import { invoke } from "@tauri-apps/api/core";
import {
  GitBranch,
  FileEdit,
  FilePlus,
  FileX,
  CheckCircle2,
  RefreshCw,
  Loader2,
  FolderOpen,
  Code,
  Terminal,
} from "lucide-react";
import { memo, useEffect, useState, useCallback } from "react";

import type { BlockViewProps } from "@/types/block";

import { registerBlockView } from "../BlockRegistry";

// =============================================================================
// Types
// =============================================================================

interface GitStatus {
  branch: string;
  is_clean: boolean;
  staged: string[];
  modified: string[];
  untracked: string[];
}

// =============================================================================
// WorktreeStatusBlockView Component
// =============================================================================

export const WorktreeStatusBlockView = memo(function WorktreeStatusBlockView({
  block,
  onTitleChange,
}: BlockViewProps) {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const worktreePath = block.worktreePath;

  // Load git status
  const loadGitStatus = useCallback(async () => {
    if (!worktreePath) {
      setError("No worktree path specified");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const status = await invoke<GitStatus>("get_repo_status", {
        repoPath: worktreePath,
      });
      setGitStatus(status);

      // Update block title with branch name
      if (onTitleChange && status.branch) {
        onTitleChange(`Git: ${status.branch}`);
      }
    } catch (err) {
      console.error("Failed to load git status:", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [worktreePath, onTitleChange]);

  // Load on mount and when path changes
  useEffect(() => {
    loadGitStatus();
  }, [loadGitStatus]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "r" && !e.ctrlKey && !e.metaKey) {
        loadGitStatus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loadGitStatus]);

  // Open with external app
  const handleOpenWith = useCallback(async (app: string) => {
    if (!worktreePath) return;

    try {
      switch (app) {
        case "code":
          await invoke("run_shell_command", { command: "code", args: [worktreePath] });
          break;
        case "cursor":
          await invoke("run_shell_command", { command: "cursor", args: [worktreePath] });
          break;
        case "terminal":
          await invoke("run_shell_command", { command: "open", args: ["-a", "Terminal", worktreePath] });
          break;
        case "iterm":
          await invoke("run_shell_command", { command: "open", args: ["-a", "iTerm", worktreePath] });
          break;
        case "finder":
          await invoke("run_shell_command", { command: "open", args: [worktreePath] });
          break;
      }
    } catch (err) {
      console.error(`Failed to open with ${app}:`, err);
    }
  }, [worktreePath]);

  const totalChanges = gitStatus
    ? gitStatus.staged.length + gitStatus.modified.length + gitStatus.untracked.length
    : 0;

  if (!worktreePath) {
    return (
      <div className="flex flex-col h-full bg-[var(--surface-0)] text-[var(--text-primary)] items-center justify-center">
        <p className="text-[var(--text-muted)]">No worktree selected</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--surface-0)] text-[var(--text-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-muted)] bg-[var(--surface-1)]">
        <div className="flex items-center gap-3">
          <GitBranch className="w-5 h-5 text-[var(--text-secondary)]" />
          <div>
            <div className="text-sm font-medium">
              {gitStatus?.branch || "Loading..."}
            </div>
            <div className="text-xs text-[var(--text-muted)] font-mono truncate max-w-md">
              {worktreePath}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleOpenWith("code")}
            className="p-2 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            title="Open in VS Code"
          >
            <Code className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleOpenWith("terminal")}
            className="p-2 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            title="Open in Terminal"
          >
            <Terminal className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleOpenWith("finder")}
            className="p-2 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            title="Show in Finder"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-[var(--border-muted)] mx-1" />
          <button
            onClick={loadGitStatus}
            disabled={loading}
            className="p-2 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50"
            title="Refresh (R)"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading && !gitStatus ? (
          <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading git status...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
            <p>Failed to load git status</p>
            <p className="text-xs mt-1">{error}</p>
            <button
              onClick={loadGitStatus}
              className="mt-4 px-3 py-1.5 text-xs bg-[var(--surface-2)] rounded hover:bg-[var(--surface-3)]"
            >
              Retry
            </button>
          </div>
        ) : gitStatus ? (
          <div className="space-y-6">
            {/* Summary card */}
            <div className="p-4 rounded-lg bg-[var(--surface-1)] border border-[var(--border-muted)]">
              {gitStatus.is_clean ? (
                <div className="flex items-center gap-2 text-[var(--color-success)]">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Working tree clean</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-[var(--text-primary)] font-medium">
                      {totalChanges} {totalChanges === 1 ? "change" : "changes"}
                    </span>
                    {gitStatus.staged.length > 0 && (
                      <span className="text-[var(--color-success)]">
                        {gitStatus.staged.length} staged
                      </span>
                    )}
                    {gitStatus.modified.length > 0 && (
                      <span className="text-[var(--color-warning)]">
                        {gitStatus.modified.length} modified
                      </span>
                    )}
                    {gitStatus.untracked.length > 0 && (
                      <span className="text-[var(--text-muted)]">
                        {gitStatus.untracked.length} untracked
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* File lists */}
            {!gitStatus.is_clean && (
              <div className="space-y-6">
                {/* Staged files */}
                {gitStatus.staged.length > 0 && (
                  <FileSection
                    title="Staged Changes"
                    count={gitStatus.staged.length}
                    files={gitStatus.staged}
                    icon={<FilePlus className="w-4 h-4" />}
                    iconColor="text-[var(--color-success)]"
                    textColor="text-[var(--color-success)]"
                  />
                )}

                {/* Modified files */}
                {gitStatus.modified.length > 0 && (
                  <FileSection
                    title="Modified"
                    count={gitStatus.modified.length}
                    files={gitStatus.modified}
                    icon={<FileEdit className="w-4 h-4" />}
                    iconColor="text-[var(--color-warning)]"
                    textColor="text-[var(--color-warning)]"
                  />
                )}

                {/* Untracked files */}
                {gitStatus.untracked.length > 0 && (
                  <FileSection
                    title="Untracked"
                    count={gitStatus.untracked.length}
                    files={gitStatus.untracked}
                    icon={<FileX className="w-4 h-4" />}
                    iconColor="text-[var(--text-muted)]"
                    textColor="text-[var(--text-muted)]"
                  />
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border-muted)] bg-[var(--surface-1)] text-xs text-[var(--text-muted)]">
        <span>Press R to refresh</span>
        <span className="font-mono">{worktreePath}</span>
      </div>
    </div>
  );
});

// =============================================================================
// FileSection Component
// =============================================================================

interface FileSectionProps {
  title: string;
  count: number;
  files: string[];
  icon: React.ReactNode;
  iconColor: string;
  textColor: string;
}

function FileSection({ title, count, files, icon, iconColor, textColor }: FileSectionProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium mb-2 hover:opacity-80"
      >
        <span className={iconColor}>{icon}</span>
        <span className={textColor}>
          {title} ({count})
        </span>
        <span className="text-[var(--text-muted)] text-xs ml-1">
          {expanded ? "▼" : "▶"}
        </span>
      </button>

      {expanded && (
        <div className="space-y-1 pl-6">
          {files.map((file) => (
            <div
              key={file}
              className="text-xs text-[var(--text-secondary)] font-mono py-1 px-2 rounded hover:bg-[var(--surface-1)] cursor-default"
              title={file}
            >
              {file}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Register the view
registerBlockView("worktree-status", WorktreeStatusBlockView);
