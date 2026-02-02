import { invoke } from "@tauri-apps/api/core";
import {
  GitBranch,
  FileEdit,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { memo, useEffect, useState, useCallback, useMemo } from "react";

import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import { useProjectStore } from "@/stores/projectStore";
import type { Worktree } from "@/types";
import type { BlockViewProps } from "@/types/block";

import { registerBlockView } from "../BlockRegistry";

// =============================================================================
// Types
// =============================================================================

interface WorktreeInfo {
  worktree: Worktree;
  branch: string;
  ahead: number;
  behind: number;
  changeCount: number;
  isClean: boolean;
}

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
// WorktreeOverviewBlockView Component
// =============================================================================

export const WorktreeOverviewBlockView = memo(function WorktreeOverviewBlockView({
  block: _block,
  onTitleChange,
}: BlockViewProps) {
  const { projects } = useProjectStore();
  const { projectPath } = useAppStore();
  const [worktreeInfos, setWorktreeInfos] = useState<WorktreeInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Find the active project
  const activeProject = useMemo(() => {
    if (!projectPath) return null;
    return projects.find((p) =>
      p.worktrees.some((w) => w.path === projectPath)
    ) || null;
  }, [projects, projectPath]);

  // Load git status for all worktrees
  const loadAllStatuses = useCallback(async () => {
    if (!activeProject) return;
    setLoading(true);

    const infos: WorktreeInfo[] = [];

    for (const worktree of activeProject.worktrees) {
      try {
        const status = await invoke<GitStatus>("get_repo_status", {
          repoPath: worktree.path,
        });
        infos.push({
          worktree,
          branch: status.branch,
          ahead: status.ahead,
          behind: status.behind,
          changeCount: status.staged.length + status.modified.length + status.untracked.length,
          isClean: status.is_clean,
        });
      } catch {
        infos.push({
          worktree,
          branch: worktree.branch,
          ahead: 0,
          behind: 0,
          changeCount: 0,
          isClean: true,
        });
      }
    }

    setWorktreeInfos(infos);
    setLoading(false);

    if (onTitleChange) {
      onTitleChange(`Worktrees (${infos.length})`);
    }
  }, [activeProject, onTitleChange]);

  useEffect(() => {
    loadAllStatuses();
  }, [loadAllStatuses]);

  // Auto-refresh every 15s
  useEffect(() => {
    if (!activeProject) return;
    const intervalId = setInterval(loadAllStatuses, 15_000);

    const handleVisibilityChange = () => {
      if (!document.hidden) loadAllStatuses();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeProject, loadAllStatuses]);

  if (!activeProject) {
    return (
      <div className="flex flex-col h-full bg-[var(--surface-0)] text-[var(--text-primary)] items-center justify-center">
        <p className="text-[var(--text-muted)]">No project open</p>
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
              {activeProject.name} - Worktrees
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              {worktreeInfos.length} worktree{worktreeInfos.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
        <button
          onClick={loadAllStatuses}
          disabled={loading}
          className="p-2 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50"
          title="Refresh all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading && worktreeInfos.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading worktrees...
          </div>
        ) : (
          <div className="space-y-2">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-3 py-2 text-[11px] text-[var(--text-muted)] uppercase font-medium border-b border-[var(--border-muted)]">
              <span>Branch</span>
              <span className="text-center w-16">Changes</span>
              <span className="text-center w-16">Ahead</span>
              <span className="text-center w-16">Behind</span>
              <span className="text-center w-16">Status</span>
            </div>

            {/* Worktree rows */}
            {worktreeInfos.map((info) => (
              <div
                key={info.worktree.id}
                className={cn(
                  "grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-3 py-2.5 rounded-md border border-[var(--border-muted)] bg-[var(--surface-1)]",
                  info.worktree.path === projectPath && "border-[var(--accent-primary)]/50 bg-[var(--accent-primary)]/5"
                )}
              >
                {/* Branch name + purpose */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                    <span className="text-sm text-[var(--text-primary)] truncate font-medium">
                      {info.branch}
                    </span>
                    {info.worktree.path === projectPath && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] rounded shrink-0">
                        active
                      </span>
                    )}
                  </div>
                  {info.worktree.purpose && (
                    <div className="text-[11px] text-[var(--text-muted)] ml-5.5 truncate mt-0.5">
                      {info.worktree.purpose}
                    </div>
                  )}
                </div>

                {/* Change count */}
                <div className="flex items-center justify-center w-16">
                  {info.changeCount > 0 ? (
                    <span className="flex items-center gap-1 text-xs text-[var(--color-warning)]">
                      <FileEdit className="w-3 h-3" />
                      {info.changeCount}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">-</span>
                  )}
                </div>

                {/* Ahead */}
                <div className="flex items-center justify-center w-16">
                  {info.ahead > 0 ? (
                    <span className="flex items-center gap-0.5 text-xs text-[var(--color-success)]">
                      <ArrowUp className="w-3 h-3" />
                      {info.ahead}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">-</span>
                  )}
                </div>

                {/* Behind */}
                <div className="flex items-center justify-center w-16">
                  {info.behind > 0 ? (
                    <span className="flex items-center gap-0.5 text-xs text-[var(--color-warning)]">
                      <ArrowDown className="w-3 h-3" />
                      {info.behind}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">-</span>
                  )}
                </div>

                {/* Status */}
                <div className="flex items-center justify-center w-16">
                  <span
                    className={cn(
                      "text-[11px] px-1.5 py-0.5 rounded",
                      info.isClean
                        ? "bg-[var(--color-success)]/15 text-[var(--color-success)]"
                        : "bg-[var(--color-warning)]/15 text-[var(--color-warning)]"
                    )}
                  >
                    {info.isClean ? "Clean" : "Dirty"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[var(--border-muted)] bg-[var(--surface-1)] text-xs text-[var(--text-muted)]">
        Auto-refreshes every 15s
      </div>
    </div>
  );
});

// Register the view
registerBlockView("worktree-overview", WorktreeOverviewBlockView);
