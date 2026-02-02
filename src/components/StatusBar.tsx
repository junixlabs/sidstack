import { GitBranch, Circle, Box, Server } from "lucide-react";

import { LAYOUT } from "@/constants/layout";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import { useProjectStore } from "@/stores/projectStore";

interface StatusBarProps {
  className?: string;
  statusMessage?: string;
}

export function StatusBar({ className, statusMessage = "Ready" }: StatusBarProps) {
  const { workspaces, activeWorkspace, projectPath } = useAppStore();
  const { projects } = useProjectStore();

  // Find project and worktree based on current projectPath
  const activeProject = projectPath
    ? projects.find((p) => p.worktrees.some((w) => w.path === projectPath)) || null
    : null;
  const activeWorktree = activeProject
    ? activeProject.worktrees.find((w) => w.path === projectPath) || null
    : null;

  // Count active workspaces
  const activeCount = workspaces.filter(w => w.status === "active").length;

  return (
    <footer
      role="status"
      aria-live="polite"
      style={{ height: LAYOUT.STATUS_HEIGHT }}
      className={cn(
        "flex-none flex items-center justify-between px-3 text-[11px] border-t",
        "bg-[var(--surface-1)] border-[var(--border-muted)] text-[var(--text-muted)]",
        className
      )}
    >
      {/* ===== LEFT: Status indicators ===== */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Status message */}
        <span className="flex items-center gap-1.5">
          <Circle className={cn(
            "w-1.5 h-1.5 fill-current",
            activeCount > 0 ? "text-[var(--color-success)] animate-pulse" : "text-[var(--text-muted)]"
          )} />
          <span>{statusMessage}</span>
        </span>

        {/* Active agent indicator */}
        {activeCount > 0 && (
          <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--color-success)]/15 text-[var(--color-success)]">
            {activeCount} working
          </span>
        )}
      </div>

      {/* ===== CENTER: Project & Worktree info ===== */}
      {activeProject && (
        <div className="flex items-center gap-2 text-[var(--text-secondary)] min-w-0">
          {/* Project name */}
          <span className="flex items-center gap-1 min-w-0">
            <Box className="w-3 h-3 flex-shrink-0" />
            <span className="font-medium truncate max-w-[160px]">{activeProject.name}</span>
          </span>

          {/* Worktree info */}
          {activeWorktree && (
            <>
              <span className="border-l border-[var(--border-muted)] h-3 flex-shrink-0" aria-hidden="true" />
              <span className="flex items-center gap-1">
                <GitBranch className="w-3 h-3" />
                <span className="font-mono">{activeWorktree.id}</span>
              </span>

              {/* Port info */}
              <span className="flex items-center gap-1 text-[var(--text-muted)]">
                <Server className="w-3 h-3" />
                <span className="tabular-nums">:{activeWorktree.ports.dev}</span>
              </span>
            </>
          )}
        </div>
      )}

      {/* ===== RIGHT: Branch info ===== */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Current workspace branch (fallback to old model) */}
        {!activeProject && activeWorkspace && (
          <span className="flex items-center gap-1 text-[var(--text-secondary)]">
            <GitBranch className="w-3 h-3" />
            <span className="font-mono text-[11px]">{activeWorkspace.branch_name}</span>
          </span>
        )}

        {/* Worktree count for active project */}
        {activeProject && activeProject.worktrees.length > 1 && (
          <span className="flex items-center gap-1">
            {activeProject.worktrees.length} worktrees
          </span>
        )}

        {/* Workspace count (old model fallback) */}
        {!activeProject && workspaces.length > 0 && (
          <span className="flex items-center gap-1">
            <GitBranch className="w-3 h-3" />
            {workspaces.length} ws
          </span>
        )}
      </div>
    </footer>
  );
}
