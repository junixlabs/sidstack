import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, X, Plus, Clock, Folder, Box } from "lucide-react";
import { useCallback, useMemo } from "react";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import { useProjectStore } from "@/stores/projectStore";



interface WorkspaceTabsProps {
  className?: string;
}

export function WorkspaceTabs({ className }: WorkspaceTabsProps) {
  const {
    projectPath,
    openWorkspaces,
    addWorkspace,
    removeWorkspace,
    switchWorkspace,
    recentProjects,
  } = useAppStore();

  const {
    projects,
    openProject,
    closeProject,
  } = useProjectStore();

  // Filter recent projects to exclude currently open workspaces
  const availableRecent = useMemo(() => {
    return recentProjects.filter((path) => !openWorkspaces.includes(path)).slice(0, 10);
  }, [recentProjects, openWorkspaces]);

  const handleBrowseWorkspace = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Open Project",
      });
      if (selected) {
        // Use new project-based model
        await openProject(selected as string);
        // Also add to old model for compatibility during migration
        addWorkspace(selected as string);
      }
    } catch (e) {
      console.error("Failed to open project:", e);
    }
  }, [addWorkspace, openProject]);

  const handleOpenRecent = useCallback(async (path: string) => {
    await openProject(path);
    addWorkspace(path);
  }, [addWorkspace, openProject]);

  const getWorkspaceName = (path: string) => {
    return path.split("/").pop() || path;
  };

  // Get project name from project store if available
  const getProjectName = useCallback((path: string) => {
    const project = projects.find(p =>
      p.worktrees.some(w => w.path === path)
    );
    return project?.name || path.split("/").pop() || path;
  }, [projects]);

  const handleCloseWorkspace = useCallback(
    (e: React.MouseEvent, path: string) => {
      e.stopPropagation();

      // Find project for this workspace
      const project = projects.find(p =>
        p.worktrees.some(w => w.path === path)
      );

      // Confirm before closing last worktree of a project
      if (project && project.worktrees.length === 1) {
        if (!window.confirm(`Close project "${project.name}"? This will remove the workspace.`)) {
          return;
        }
        removeWorkspace(path);
        closeProject(project.id);
      } else {
        removeWorkspace(path);
      }
    },
    [removeWorkspace, projects, closeProject]
  );

  return (
    <div role="tablist" aria-label="Open workspaces" className={cn("flex items-center gap-1", className)}>
      {openWorkspaces.map((path, index) => {
        const isActive = path === projectPath;
        const name = getWorkspaceName(path);
        const shortcutKey = index < 9 ? index + 1 : null;

        return (
          <Tooltip key={path}>
            <TooltipTrigger asChild>
              <div
                role="tab"
                aria-selected={isActive}
                tabIndex={0}
                onClick={() => switchWorkspace(path)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); switchWorkspace(path); } }}
                className={cn(
                  "group flex items-center gap-1.5 px-2 py-1 rounded text-[13px] cursor-pointer",
                  "transition-colors duration-100 max-w-[180px]",
                  isActive
                    ? "bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border-emphasis)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
                )}
              >
                {/* Position indicator for keyboard shortcut */}
                {shortcutKey && (
                  <span
                    className={cn(
                      "text-[11px] font-mono min-w-[12px] text-center",
                      isActive
                        ? "text-[var(--text-secondary)]"
                        : "opacity-50"
                    )}
                  >
                    {shortcutKey}
                  </span>
                )}
                <Box
                  className={cn(
                    "w-3.5 h-3.5 flex-shrink-0",
                    isActive
                      ? "text-[var(--text-secondary)]"
                      : "opacity-50"
                  )}
                />
                <span className="truncate font-medium">{getProjectName(path)}</span>
                {/* Close button - only show on hover for non-active or always for active */}
                <button
                  onClick={(e) => handleCloseWorkspace(e, path)}
                  aria-label="Close workspace"
                  className={cn(
                    "ml-1 p-1 rounded opacity-0 group-hover:opacity-70 focus-visible:opacity-100",
                    "transition-opacity duration-100",
                    "hover:bg-[var(--surface-4)] hover:opacity-100",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]"
                  )}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div className="text-[11px]">
                <div className="font-medium">{name}</div>
                <div className="text-[11px] opacity-60 mt-0.5">{path}</div>
                {shortcutKey && (
                  <div className="text-[11px] opacity-50 mt-1">⌘⌥{shortcutKey} to switch</div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}

      {/* Add workspace dropdown */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Add workspace"
                className={cn(
                  "flex items-center justify-center w-6 h-6 rounded",
                  "transition-colors duration-100",
                  "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]"
                )}
              >
                <Plus className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Open Workspace (⌘O)</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" className="w-64">
          {availableRecent.length > 0 && (
            <>
              <DropdownMenuLabel className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <Clock className="w-3 h-3" />
                Recent Workspaces
              </DropdownMenuLabel>
              {availableRecent.map((path) => (
                <DropdownMenuItem
                  key={path}
                  onClick={() => handleOpenRecent(path)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Folder className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate font-medium">{getWorkspaceName(path)}</span>
                    <span className="text-[11px] text-[var(--text-muted)] truncate">{path}</span>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            onClick={handleBrowseWorkspace}
            className="flex items-center gap-2 cursor-pointer"
          >
            <FolderOpen className="w-4 h-4 flex-shrink-0" />
            <span>Browse...</span>
            <span className="ml-auto text-[11px] text-[var(--text-muted)]">⌘O</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
