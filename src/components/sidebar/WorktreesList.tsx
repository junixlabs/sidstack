import { invoke } from "@tauri-apps/api/core";
import {
  Code,
  Terminal,
  FolderOpen,
  Copy,
  Trash2,
  Plus,
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
  onClick: () => void;
  onOpenWith: (app: string) => void;
  onCopyPath: () => void;
  onShowInFinder: () => void;
  onRemove: () => void;
}

// =============================================================================
// WorktreeItem Component
// =============================================================================

const WorktreeItem = memo(function WorktreeItem({
  worktree,
  isActive,
  onClick,
  onOpenWith,
  onCopyPath,
  onShowInFinder,
  onRemove,
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

          {/* Worktree name */}
          <span className="flex-1 truncate text-left">{worktree.id}</span>

          {/* Port number */}
          <span className="text-[10px] text-[var(--text-muted)] tabular-nums shrink-0">
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

        <ContextMenuItem onClick={onRemove} destructive>
          <Trash2 className="w-4 h-4 mr-2" />
          Remove
        </ContextMenuItem>
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
  activeViewId?: string; // Current active view in sidebar (e.g., "worktree-main")
}

export const WorktreesList = memo(function WorktreesList({
  className,
  onWorktreeClick,
  activeViewId,
}: WorktreesListProps) {
  const { projects, removeWorktree } = useProjectStore();
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

  const handleRemoveWorktree = useCallback((projectId: string, worktreeId: string) => {
    if (confirm(`Remove worktree "${worktreeId}"? This only removes it from SidStack, not from disk.`)) {
      removeWorktree(projectId, worktreeId);
    }
  }, [removeWorktree]);

  if (!activeProject) {
    return null;
  }

  return (
    <div className={cn("space-y-1", className)}>
      {/* Section header */}
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
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

      {/* Worktree list */}
      <div className="space-y-0.5">
        {activeProject.worktrees.map((worktree) => {
          // Check if this worktree's status view is currently active
          const isViewActive = activeViewId === `worktree-${worktree.branch}`;
          return (
            <WorktreeItem
              key={worktree.id}
              worktree={worktree}
              isActive={isViewActive}
              onClick={() => handleWorktreeClick(worktree)}
              onOpenWith={(app) => handleOpenWith(worktree.path, app)}
              onCopyPath={() => handleCopyPath(worktree.path)}
              onShowInFinder={() => handleShowInFinder(worktree.path)}
              onRemove={() => handleRemoveWorktree(activeProject.id, worktree.id)}
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
