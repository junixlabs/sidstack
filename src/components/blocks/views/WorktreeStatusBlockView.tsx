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
  ArrowUp,
  ArrowDown,
  History,
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  PackageMinus,
  X,
} from "lucide-react";
import { memo, useEffect, useState, useCallback, useMemo } from "react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";

import { cn } from "@/lib/utils";
import type { CommitInfo, FileDiff } from "@/types";
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
  ahead: number;
  behind: number;
}

// =============================================================================
// Constants
// =============================================================================

const AUTO_REFRESH_INTERVAL = 10_000; // 10 seconds

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
  const [recentCommits, setRecentCommits] = useState<CommitInfo[]>([]);
  const [gitActionLoading, setGitActionLoading] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const worktreePath = block.worktreePath;

  // Collect all changed files for keyboard navigation
  const allFiles = useMemo(() => {
    if (!gitStatus) return [];
    return [
      ...gitStatus.staged,
      ...gitStatus.modified,
      ...gitStatus.untracked,
    ];
  }, [gitStatus]);

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

  // Load recent commits
  const loadRecentCommits = useCallback(async () => {
    if (!worktreePath) return;
    try {
      const commits = await invoke<CommitInfo[]>("get_commit_log", {
        repoPath: worktreePath,
        branch: null,
        limit: 5,
      });
      setRecentCommits(commits);
    } catch {
      // Non-critical, ignore
    }
  }, [worktreePath]);

  // Load on mount and when path changes
  useEffect(() => {
    loadGitStatus();
    loadRecentCommits();
  }, [loadGitStatus, loadRecentCommits]);

  // Auto-refresh with visibility awareness
  useEffect(() => {
    if (!worktreePath) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startInterval = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        loadGitStatus();
        loadRecentCommits();
      }, AUTO_REFRESH_INTERVAL);
    };

    const stopInterval = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopInterval();
      } else {
        // Refresh immediately when becoming visible again
        loadGitStatus();
        loadRecentCommits();
        startInterval();
      }
    };

    startInterval();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopInterval();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [worktreePath, loadGitStatus, loadRecentCommits]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Escape" && selectedFile) {
        setSelectedFile(null);
        return;
      }

      if (e.key === "r" && !e.ctrlKey && !e.metaKey && !selectedFile) {
        loadGitStatus();
        loadRecentCommits();
        return;
      }

      // Arrow key navigation when diff is open
      if (selectedFile && allFiles.length > 0) {
        const currentIdx = allFiles.indexOf(selectedFile);
        if (e.key === "ArrowDown" || (e.key === "j" && !e.ctrlKey && !e.metaKey)) {
          e.preventDefault();
          const nextIdx = currentIdx < allFiles.length - 1 ? currentIdx + 1 : 0;
          setSelectedFile(allFiles[nextIdx]);
        } else if (e.key === "ArrowUp" || (e.key === "k" && !e.ctrlKey && !e.metaKey)) {
          e.preventDefault();
          const prevIdx = currentIdx > 0 ? currentIdx - 1 : allFiles.length - 1;
          setSelectedFile(allFiles[prevIdx]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loadGitStatus, loadRecentCommits, selectedFile, allFiles]);

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

  // Quick git actions
  const runGitAction = useCallback(async (action: string) => {
    if (!worktreePath || gitActionLoading) return;
    setGitActionLoading(action);
    try {
      let args: string[];
      switch (action) {
        case "pull":
          args = ["pull"];
          break;
        case "push":
          args = ["push"];
          break;
        case "stash":
          args = ["stash"];
          break;
        case "stash-pop":
          args = ["stash", "pop"];
          break;
        default:
          return;
      }
      await invoke<string>("run_git_command", { cwd: worktreePath, args });
      // Refresh after action
      await loadGitStatus();
      await loadRecentCommits();
    } catch (err) {
      console.error(`Git ${action} failed:`, err);
      alert(`Git ${action} failed: ${err}`);
    } finally {
      setGitActionLoading(null);
    }
  }, [worktreePath, gitActionLoading, loadGitStatus, loadRecentCommits]);

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
            <div className="text-sm font-medium flex items-center gap-2">
              {gitStatus?.branch || "Loading..."}
              {/* Ahead/Behind indicators */}
              {gitStatus && (gitStatus.ahead > 0 || gitStatus.behind > 0) && (
                <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  {gitStatus.ahead > 0 && (
                    <span className="flex items-center gap-0.5 text-[var(--color-success)]" title={`${gitStatus.ahead} commit(s) ahead of upstream`}>
                      <ArrowUp className="w-3 h-3" />
                      {gitStatus.ahead}
                    </span>
                  )}
                  {gitStatus.behind > 0 && (
                    <span className="flex items-center gap-0.5 text-[var(--color-warning)]" title={`${gitStatus.behind} commit(s) behind upstream`}>
                      <ArrowDown className="w-3 h-3" />
                      {gitStatus.behind}
                    </span>
                  )}
                </span>
              )}
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
      <div className="flex-1 min-h-0">
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
          selectedFile && worktreePath ? (
            // Split layout: status panel + diff viewer
            <PanelGroup direction="horizontal">
              <Panel defaultSize={35} minSize={20} maxSize={50}>
                <StatusContent
                  gitStatus={gitStatus}
                  totalChanges={totalChanges}
                  gitActionLoading={gitActionLoading}
                  runGitAction={runGitAction}
                  recentCommits={recentCommits}
                  selectedFile={selectedFile}
                  onFileClick={setSelectedFile}
                />
              </Panel>
              <PanelResizeHandle className="w-1 bg-[var(--border-muted)] hover:bg-[var(--accent-primary)]/50 transition-colors cursor-col-resize" />
              <Panel defaultSize={65} minSize={30}>
                <InlineDiffViewer
                  workspacePath={worktreePath}
                  filePath={selectedFile}
                  onClose={() => setSelectedFile(null)}
                />
              </Panel>
            </PanelGroup>
          ) : (
            // Full-width status view
            <StatusContent
              gitStatus={gitStatus}
              totalChanges={totalChanges}
              gitActionLoading={gitActionLoading}
              runGitAction={runGitAction}
              recentCommits={recentCommits}
              selectedFile={null}
              onFileClick={setSelectedFile}
            />
          )
        ) : null}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border-muted)] bg-[var(--surface-1)] text-xs text-[var(--text-muted)]">
        <span>
          {selectedFile
            ? "Esc close | j/k navigate files"
            : "Click file to review | R refresh"}
        </span>
        <span className="font-mono">{worktreePath}</span>
      </div>
    </div>
  );
});

// =============================================================================
// StatusContent Component (extracted for reuse in both layouts)
// =============================================================================

interface StatusContentProps {
  gitStatus: GitStatus;
  totalChanges: number;
  gitActionLoading: string | null;
  runGitAction: (action: string) => void;
  recentCommits: CommitInfo[];
  selectedFile: string | null;
  onFileClick: (file: string) => void;
}

function StatusContent({
  gitStatus,
  totalChanges,
  gitActionLoading,
  runGitAction,
  recentCommits,
  selectedFile,
  onFileClick,
}: StatusContentProps) {
  return (
    <div className="h-full overflow-auto p-4">
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

        {/* Quick git actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => runGitAction("pull")}
            disabled={!!gitActionLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--surface-1)] border border-[var(--border-muted)] rounded-md hover:bg-[var(--surface-2)] disabled:opacity-50 transition-colors"
            title="Pull from remote"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            {gitActionLoading === "pull" ? "Pulling..." : "Pull"}
          </button>
          <button
            onClick={() => runGitAction("push")}
            disabled={!!gitActionLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--surface-1)] border border-[var(--border-muted)] rounded-md hover:bg-[var(--surface-2)] disabled:opacity-50 transition-colors"
            title="Push to remote"
          >
            <ArrowUpFromLine className="w-3.5 h-3.5" />
            {gitActionLoading === "push" ? "Pushing..." : "Push"}
          </button>
          <button
            onClick={() => runGitAction("stash")}
            disabled={!!gitActionLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--surface-1)] border border-[var(--border-muted)] rounded-md hover:bg-[var(--surface-2)] disabled:opacity-50 transition-colors"
            title="Stash changes"
          >
            <Package className="w-3.5 h-3.5" />
            {gitActionLoading === "stash" ? "Stashing..." : "Stash"}
          </button>
          <button
            onClick={() => runGitAction("stash-pop")}
            disabled={!!gitActionLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--surface-1)] border border-[var(--border-muted)] rounded-md hover:bg-[var(--surface-2)] disabled:opacity-50 transition-colors"
            title="Pop stashed changes"
          >
            <PackageMinus className="w-3.5 h-3.5" />
            {gitActionLoading === "stash-pop" ? "Popping..." : "Stash Pop"}
          </button>
        </div>

        {/* File lists */}
        {!gitStatus.is_clean && (
          <div className="space-y-6">
            {gitStatus.staged.length > 0 && (
              <FileSection
                title="Staged Changes"
                count={gitStatus.staged.length}
                files={gitStatus.staged}
                icon={<FilePlus className="w-4 h-4" />}
                iconColor="text-[var(--color-success)]"
                textColor="text-[var(--color-success)]"
                selectedFile={selectedFile}
                onFileClick={onFileClick}
              />
            )}
            {gitStatus.modified.length > 0 && (
              <FileSection
                title="Modified"
                count={gitStatus.modified.length}
                files={gitStatus.modified}
                icon={<FileEdit className="w-4 h-4" />}
                iconColor="text-[var(--color-warning)]"
                textColor="text-[var(--color-warning)]"
                selectedFile={selectedFile}
                onFileClick={onFileClick}
              />
            )}
            {gitStatus.untracked.length > 0 && (
              <FileSection
                title="Untracked"
                count={gitStatus.untracked.length}
                files={gitStatus.untracked}
                icon={<FileX className="w-4 h-4" />}
                iconColor="text-[var(--text-muted)]"
                textColor="text-[var(--text-muted)]"
                selectedFile={selectedFile}
                onFileClick={onFileClick}
              />
            )}
          </div>
        )}

        {/* Recent commits */}
        {recentCommits.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <History className="w-4 h-4 text-[var(--text-secondary)]" />
              <span className="text-[var(--text-secondary)]">Recent Commits</span>
            </div>
            <div className="space-y-2">
              {recentCommits.map((commit) => (
                <div
                  key={commit.id}
                  className="flex items-start gap-3 px-3 py-2 rounded-md bg-[var(--surface-1)] border border-[var(--border-muted)]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[var(--text-primary)] truncate">
                      {commit.message.split("\n")[0]}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5 flex items-center gap-2">
                      <span>{commit.author}</span>
                      <span>{formatTimeAgo(commit.time * 1000)}</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-[var(--text-muted)] shrink-0">
                    {commit.id.substring(0, 7)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
  selectedFile: string | null;
  onFileClick: (file: string) => void;
}

function FileSection({
  title,
  count,
  files,
  icon,
  iconColor,
  textColor,
  selectedFile,
  onFileClick,
}: FileSectionProps) {
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
        <div className="space-y-0.5 pl-6">
          {files.map((file) => {
            const fileName = file.split("/").pop() || file;
            const dirPath = file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : "";
            const isSelected = file === selectedFile;

            return (
              <button
                key={file}
                onClick={() => onFileClick(file)}
                className={cn(
                  "w-full flex items-center gap-2 text-xs font-mono py-1.5 px-2 rounded text-left transition-colors",
                  isSelected
                    ? "bg-[var(--accent-primary)]/15 text-[var(--text-primary)] border-l-2 border-[var(--accent-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
                )}
                title={file}
              >
                <span className="truncate">{fileName}</span>
                {dirPath && (
                  <span className="text-[10px] text-[var(--text-muted)] truncate shrink-0 ml-auto">
                    {dirPath.length > 30 ? "..." + dirPath.slice(-27) : dirPath}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// InlineDiffViewer Component
// =============================================================================

function InlineDiffViewer({
  workspacePath,
  filePath,
  onClose,
}: {
  workspacePath: string;
  filePath: string;
  onClose: () => void;
}) {
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDiff(null);

    invoke<FileDiff>("get_file_diff", {
      workspacePath,
      filePath,
      baseBranch: null,
    })
      .then((data) => {
        if (!cancelled) {
          setDiff(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [workspacePath, filePath]);

  const fileName = filePath.split("/").pop() || filePath;
  const dirPath = filePath.includes("/")
    ? filePath.slice(0, filePath.lastIndexOf("/"))
    : "";

  return (
    <div className="flex flex-col h-full bg-[var(--surface-0)]">
      {/* Diff header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-muted)] bg-[var(--surface-1)] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileEdit className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
            {fileName}
          </span>
          {dirPath && (
            <span className="text-xs text-[var(--text-muted)] truncate">
              {dirPath}
            </span>
          )}
          {diff && (
            <span className="flex items-center gap-2 text-xs shrink-0 ml-2">
              <span className="text-green-400">+{diff.additions}</span>
              <span className="text-red-400">-{diff.deletions}</span>
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0"
          title="Close diff (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Diff content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading diff...
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm">
          Failed to load diff: {error}
        </div>
      ) : !diff || diff.hunks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm">
          No changes to display
        </div>
      ) : (
        <div className="flex-1 overflow-auto font-mono text-[13px] leading-5">
          {diff.hunks.map((hunk, hunkIdx) => (
            <div key={hunkIdx}>
              {/* Hunk header */}
              <div className="px-4 py-1 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] text-xs border-y border-[var(--border-muted)] sticky top-0 z-10">
                @@ -{hunk.old_start},{hunk.old_lines} +{hunk.new_start},{hunk.new_lines} @@
              </div>
              {/* Lines */}
              {hunk.lines.map((line, lineIdx) => (
                <div
                  key={lineIdx}
                  className={cn(
                    "flex hover:brightness-110",
                    line.origin === "+"
                      ? "bg-green-500/10"
                      : line.origin === "-"
                        ? "bg-red-500/10"
                        : ""
                  )}
                >
                  {/* Old line number */}
                  <span
                    className={cn(
                      "w-12 shrink-0 text-right pr-2 select-none text-[11px] leading-5 border-r border-[var(--border-muted)]",
                      line.origin === "+"
                        ? "text-transparent"
                        : line.origin === "-"
                          ? "bg-red-500/15 text-red-400/70"
                          : "text-[var(--text-muted)]"
                    )}
                  >
                    {line.old_lineno ?? ""}
                  </span>
                  {/* New line number */}
                  <span
                    className={cn(
                      "w-12 shrink-0 text-right pr-2 select-none text-[11px] leading-5 border-r border-[var(--border-muted)]",
                      line.origin === "-"
                        ? "text-transparent"
                        : line.origin === "+"
                          ? "bg-green-500/15 text-green-400/70"
                          : "text-[var(--text-muted)]"
                    )}
                  >
                    {line.new_lineno ?? ""}
                  </span>
                  {/* Origin indicator */}
                  <span
                    className={cn(
                      "w-5 shrink-0 text-center select-none",
                      line.origin === "+"
                        ? "text-green-400"
                        : line.origin === "-"
                          ? "text-red-400"
                          : "text-[var(--text-muted)]"
                    )}
                  >
                    {line.origin}
                  </span>
                  {/* Content */}
                  <span className="flex-1 whitespace-pre overflow-x-auto pr-4">
                    {line.content}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

// Register the view
registerBlockView("worktree-status", WorktreeStatusBlockView);
