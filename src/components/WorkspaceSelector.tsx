import { GitBranch, BookOpen, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import type { WorkspaceStats } from "@/types";

interface WorkspaceSelectorProps {
  className?: string;
}

export function WorkspaceSelector({ className }: WorkspaceSelectorProps) {
  const { projectPath, workspaces, setWorkspaces, activeWorkspace, setActiveWorkspace, theme } = useAppStore();
  const { listWorkspaces, getWorkspaceStatus, loading, error } = useWorkspace();
  const [workspaceStats, setWorkspaceStats] = useState<Record<string, WorkspaceStats>>({});
  const isDark = theme === "dark";

  useEffect(() => {
    if (projectPath) {
      listWorkspaces(projectPath)
        .then((ws) => {
          setWorkspaces(ws);
          // Load stats for each workspace
          ws.forEach((w) => {
            getWorkspaceStatus(w.worktree_path)
              .then((stats) => {
                setWorkspaceStats((prev) => ({ ...prev, [w.task_id]: stats }));
              })
              .catch(console.error);
          });
        })
        .catch(console.error);
    }
  }, [projectPath, listWorkspaces, setWorkspaces, getWorkspaceStatus]);

  if (!projectPath) {
    return (
      <div className={cn(
        "flex items-center gap-2 py-2 text-xs",
        isDark ? "text-[var(--text-muted)]" : "text-gray-500",
        className
      )}>
        <AlertCircle className="w-3.5 h-3.5" />
        Open a project to see workspaces
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {loading && workspaces.length === 0 && (
        <div className={cn(
          "text-xs py-2",
          isDark ? "text-[var(--text-muted)]" : "text-gray-500"
        )}>
          Loading...
        </div>
      )}

      {error && (
        <div className={cn(
          "text-xs py-2 flex items-center gap-2",
          isDark ? "text-[var(--text-secondary)]" : "text-red-600"
        )}>
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      {/* Main branch option */}
      <WorkspaceItem
        label="main"
        sublabel="Main branch"
        isActive={!activeWorkspace}
        onClick={() => setActiveWorkspace(null)}
        isDark={isDark}
        icon={<GitBranch className={cn(
          "w-3.5 h-3.5",
          isDark ? "text-[var(--text-muted)]" : "text-gray-500"
        )} />}
      />

      {workspaces.length === 0 && !loading && (
        <div className={cn(
          "text-xs py-2 pl-6",
          isDark ? "text-[var(--text-muted)]" : "text-gray-500"
        )}>
          No task workspaces yet
        </div>
      )}

      {/* Task workspaces */}
      {workspaces.map((ws) => (
        <WorkspaceItem
          key={ws.task_id}
          label={ws.task_id}
          sublabel={ws.branch_name}
          stats={workspaceStats[ws.task_id]}
          isActive={activeWorkspace?.task_id === ws.task_id}
          onClick={() => setActiveWorkspace(ws)}
          isDark={isDark}
          icon={<BookOpen className={cn(
            "w-3.5 h-3.5",
            isDark ? "text-[var(--text-secondary)]" : "text-blue-600"
          )} />}
        />
      ))}
    </div>
  );
}

interface WorkspaceItemProps {
  label: string;
  sublabel: string;
  stats?: WorkspaceStats;
  isActive: boolean;
  onClick: () => void;
  isDark: boolean;
  icon?: React.ReactNode;
}

function WorkspaceItem({ label, sublabel, stats, isActive, onClick, isDark, icon }: WorkspaceItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-2.5 py-2 rounded-md transition-all duration-150",
        "border focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        isActive
          ? isDark
            ? "bg-[var(--surface-3)] border-[var(--border-default)] text-[var(--text-secondary)] focus-visible:ring-[var(--border-default)]"
            : "bg-blue-50 border-blue-200 text-blue-700 focus-visible:ring-blue-500"
          : isDark
            ? "border-transparent hover:bg-[var(--surface-2)] text-[var(--text-secondary)] focus-visible:ring-[var(--border-muted)]"
            : "border-transparent hover:bg-gray-100 text-gray-700 focus-visible:ring-gray-400"
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={cn(
              "text-[13px] font-medium truncate",
              isActive
                ? isDark ? "text-[var(--text-secondary)]" : "text-blue-700"
                : isDark ? "text-[var(--text-primary)]" : "text-gray-800"
            )}>
              {label}
            </span>
            {stats && (
              <span className="text-[11px] font-mono tabular-nums flex items-center gap-1 shrink-0">
                <span className={isDark ? "text-[var(--text-secondary)]" : "text-green-600"}>
                  +{stats.additions}
                </span>
                <span className={isDark ? "text-[var(--text-muted)]" : "text-gray-400"}>/</span>
                <span className={isDark ? "text-[var(--text-secondary)]" : "text-red-600"}>
                  -{stats.deletions}
                </span>
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <span className={cn(
              "text-[11px] truncate",
              isDark ? "text-[var(--text-muted)]" : "text-gray-500"
            )}>
              {sublabel}
            </span>
            {stats && stats.commits_ahead > 0 && (
              <span className={cn(
                "text-[11px] font-medium shrink-0",
                isDark ? "text-[var(--text-muted)]" : "text-gray-500"
              )}>
                {stats.commits_ahead} ahead
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
