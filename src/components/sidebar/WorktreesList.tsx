import { invoke } from "@tauri-apps/api/core";
import {
  Code,
  Terminal,
  FolderOpen,
  Copy,
  Trash2,
  Plus,
  Unlink,
  Zap,
} from "lucide-react";
import { memo, useMemo, useState, useCallback } from "react";

import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import { useProjectStore } from "@/stores/projectStore";
import type { Worktree } from "@/types";

import { AddWorktreeDialog } from "./AddWorktreeDialog";

// =============================================================================
// Types
// =============================================================================

interface WorktreeItemProps {
  worktree: Worktree;
  isActive: boolean;
  isMainWorktree: boolean;
  onClick: () => void;
  onOpenWith: (app: string) => void;
  onCopyPath: () => void;
  onShowInFinder: () => void;
  onUntrack: () => void;
  onRemoveFromDisk: () => void;
  onLaunchSession?: () => void;
}

// =============================================================================
// WorktreeItem Component
// =============================================================================

const WorktreeItem = memo(function WorktreeItem({
  worktree,
  isActive,
  isMainWorktree,
  onClick,
  onOpenWith,
  onCopyPath,
  onShowInFinder,
  onUntrack,
  onRemoveFromDisk,
  onLaunchSession,
}: WorktreeItemProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs",
            "transition-colors duration-150",
            isActive
              ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-1)] hover:text-[var(--text-primary)]"
          )}
        >
          {/* Active indicator */}
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              isActive
                ? "bg-[var(--accent-primary)]"
                : "bg-[var(--text-muted)]"
            )}
          />

          {/* Worktree name + purpose */}
          <div className="flex-1 min-w-0 text-left">
            <span className="block truncate">{worktree.id}</span>
            {worktree.purpose && (
              <span className="block truncate text-[10px] text-[var(--text-muted)]">
                {worktree.purpose}
              </span>
            )}
          </div>

          {/* Port number */}
          <span
            className="text-[11px] text-[var(--text-muted)] tabular-nums shrink-0"
            title={`Dev server port: ${worktree.ports.dev}`}
          >
            :{worktree.ports.dev}
          </span>
        </button>
      </ContextMenuTrigger>

      {/* Context Menu */}
      <ContextMenuContent>
        <ContextMenuLabel>{worktree.branch}</ContextMenuLabel>
        <ContextMenuSeparator />

        {/* Open with submenu */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <FolderOpen className="w-4 h-4 mr-2" />
            Open with
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={() => onOpenWith("code")}>
              <Code className="w-4 h-4 mr-2" />
              VS Code
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onOpenWith("cursor")}>
              <Code className="w-4 h-4 mr-2" />
              Cursor
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onOpenWith("terminal")}>
              <Terminal className="w-4 h-4 mr-2" />
              Terminal
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onOpenWith("iterm")}>
              <Terminal className="w-4 h-4 mr-2" />
              iTerm
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuItem onClick={onShowInFinder}>
          <FolderOpen className="w-4 h-4 mr-2" />
          Show in Finder
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onCopyPath}>
          <Copy className="w-4 h-4 mr-2" />
          Copy Path
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Launch Claude Session */}
        {onLaunchSession && (
          <>
            <ContextMenuItem onClick={onLaunchSession}>
              <Zap className="w-4 h-4 mr-2" />
              Launch Claude Session
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}

        {/* Remove submenu */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Trash2 className="w-4 h-4 mr-2" />
            Remove
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={onUntrack}>
              <Unlink className="w-4 h-4 mr-2" />
              Untrack from SidStack
            </ContextMenuItem>
            {!isMainWorktree && (
              <ContextMenuItem onClick={onRemoveFromDisk} destructive>
                <Trash2 className="w-4 h-4 mr-2" />
                Remove from Disk
              </ContextMenuItem>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  );
});

// =============================================================================
// WorktreesList Component
// =============================================================================

interface WorktreesListProps {
  className?: string;
  onWorktreeClick?: (worktreePath: string, branch: string) => void;
  onLaunchSession?: (worktreePath: string) => void;
  activeViewId?: string; // Current active view in sidebar (e.g., "worktree-main")
}

export const WorktreesList = memo(function WorktreesList({
  className,
  onWorktreeClick,
  onLaunchSession,
  activeViewId,
}: WorktreesListProps) {
  const { projects, removeWorktree, removeWorktreeFromDisk } = useProjectStore();
  const { projectPath } = useAppStore();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Find the project that contains the current workspace path
  const activeProject = useMemo(() => {
    if (!projectPath) return null;
    return projects.find((p) =>
      p.worktrees.some((w) => w.path === projectPath)
    ) || null;
  }, [projects, projectPath]);

  // Handler for clicking a worktree - call parent callback
  const handleWorktreeClick = useCallback((worktree: Worktree) => {
    if (onWorktreeClick) {
      onWorktreeClick(worktree.path, worktree.branch);
    }
  }, [onWorktreeClick]);

  // Handler for "Open with" actions
  const handleOpenWith = useCallback(async (path: string, app: string) => {
    try {
      switch (app) {
        case "code":
          await invoke("run_shell_command", { command: "code", args: [path] });
          break;
        case "cursor":
          await invoke("run_shell_command", { command: "cursor", args: [path] });
          break;
        case "terminal":
          await invoke("run_shell_command", { command: "open", args: ["-a", "Terminal", path] });
          break;
        case "iterm":
          await invoke("run_shell_command", { command: "open", args: ["-a", "iTerm", path] });
          break;
      }
    } catch (error) {
      console.error(`Failed to open with ${app}:`, error);
    }
  }, []);

  const handleShowInFinder = useCallback(async (path: string) => {
    try {
      await invoke("run_shell_command", { command: "open", args: [path] });
    } catch (error) {
      console.error("Failed to show in Finder:", error);
    }
  }, []);

  const handleCopyPath = useCallback(async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
    } catch (error) {
      console.error("Failed to copy path:", error);
    }
  }, []);

  const handleUntrackWorktree = useCallback((projectId: string, worktreeId: string) => {
    if (confirm(`Untrack worktree "${worktreeId}"? This only removes it from SidStack, not from disk.`)) {
      removeWorktree(projectId, worktreeId);
    }
  }, [removeWorktree]);

  const handleRemoveFromDisk = useCallback(async (projectId: string, worktreeId: string) => {
    if (confirm(`Remove worktree "${worktreeId}" from disk? This will delete the directory and cannot be undone.`)) {
      try {
        await removeWorktreeFromDisk(projectId, worktreeId);
      } catch (error) {
        console.error("Failed to remove worktree from disk:", error);
        alert(`Failed to remove worktree: ${error}`);
      }
    }
  }, [removeWorktreeFromDisk]);

  if (!activeProject) {
    return null;
  }

  return (
    <div className={cn("space-y-1", className)}>
      {/* Section header */}
      <div className="flex items-center justify-between px-2 py-1">
        <span
          className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider"
          title="Git worktrees let you work on multiple branches simultaneously in separate directories"
        >
          Worktrees
        </span>
        <button
          onClick={() => setAddDialogOpen(true)}
          className="p-0.5 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          title="Add Worktree"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Hint for single-worktree users */}
      {activeProject.worktrees.length === 1 && (
        <p className="px-2 text-[10px] text-[var(--text-muted)] italic">
          Right-click for options, + to add
        </p>
      )}

      {/* Worktree list */}
      <div className="space-y-0.5">
        {activeProject.worktrees.map((worktree, index) => {
          // Check if this worktree's status view is currently active
          const isViewActive = activeViewId === `worktree-${worktree.branch}`;
          const isMainWorktree = index === 0;
          return (
            <WorktreeItem
              key={worktree.id}
              worktree={worktree}
              isActive={isViewActive}
              isMainWorktree={isMainWorktree}
              onClick={() => handleWorktreeClick(worktree)}
              onOpenWith={(app) => handleOpenWith(worktree.path, app)}
              onCopyPath={() => handleCopyPath(worktree.path)}
              onShowInFinder={() => handleShowInFinder(worktree.path)}
              onUntrack={() => handleUntrackWorktree(activeProject.id, worktree.id)}
              onRemoveFromDisk={() => handleRemoveFromDisk(activeProject.id, worktree.id)}
              onLaunchSession={onLaunchSession ? () => onLaunchSession(worktree.path) : undefined}
            />
          );
        })}
      </div>

      {/* Add Worktree Dialog */}
      <AddWorktreeDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        projectId={activeProject.id}
        projectPath={activeProject.worktrees[0]?.path || ""}
      />
    </div>
  );
});

export default WorktreesList;
