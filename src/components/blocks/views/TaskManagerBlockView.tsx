import {
  ChevronsDown,
  ChevronsUp,
  CheckSquare,
  Inbox,
} from "lucide-react";
import { memo, useEffect, useCallback, useState, useRef } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import {
  TaskTreeView,
  TaskListView,
  KanbanBoard,
  TimelineView,
  TaskDetailPanel,
  TaskContextMenu,
  useContextMenu,
  ViewSwitcher,
} from "@/components/tasks";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useBlockNavigation } from "@/hooks/useBlockNavigation";
import { useTasks } from "@/hooks/useTasks";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import type { StatusFilter, ViewMode } from "@/stores/taskStore";
import type { BlockViewProps } from "@/types/block";

import { registerBlockView } from "../BlockRegistry";

/**
 * Task Manager Block View
 *
 * VIEW-ONLY display of tasks with tree structure, filtering, and detail panel.
 * No edit functionality - tasks are managed via CLI/agents.
 */
export const TaskManagerBlockView = memo(function TaskManagerBlockView(
  props: BlockViewProps
) {
  // Get cross-feature navigation params from block data
  const { selectedTaskId: navTaskId, filterByModule } = props.block;

  // Get projectId from current workspace (prefer config.json value, wait for init)
  const { projectPath } = useAppStore();
  const { isActive, isWorkspaceReady, sidstackProjectId } = useWorkspaceContext();
  const fallbackId = projectPath?.split("/").pop() || "default";
  const projectId = isWorkspaceReady ? (sidstackProjectId || fallbackId) : fallbackId;


  const {
    filteredTasks,
    taskTree,
    tasksByStatus,
    epicsWithProgress,
    stats,
    selectedTask,
    selectedTaskProgress,
    filters,
    isLoading,
    error,
    viewMode,
    expandedTasks,
    refresh,
    selectTask,
    setStatusFilter,
    setSearchQuery,
    setViewMode,
    toggleExpanded,
    expandAll,
    collapseAll,
  } = useTasks({ projectId, autoFetch: true });

  // Auto-refresh based on project settings (pauses when workspace is inactive)
  useAutoRefresh({ onRefresh: refresh, enabled: isActive });

  // Apply cross-feature navigation params when they change
  useEffect(() => {
    if (navTaskId) {
      selectTask(navTaskId);
    }
  }, [navTaskId, selectTask]);

  useEffect(() => {
    if (filterByModule) {
      // Filter tasks by module - use search query as simple filter
      setSearchQuery(`module:${filterByModule}`);
    }
  }, [filterByModule, setSearchQuery]);

  // Context menu state
  const { contextMenu, openContextMenu, closeContextMenu } = useContextMenu();

  // Block navigation
  const {
    navigateToBlockView,
    navigateToSpecsBrowser,
    navigateToKnowledgeBrowser,
  } = useBlockNavigation();

  // Navigation handlers
  const handleViewProgressHistory = useCallback((taskId: string) => {
    // Select task in detail panel
    selectTask(taskId);
  }, [selectTask]);

  const handleViewSpec = useCallback((specPath: string) => {
    navigateToSpecsBrowser(specPath);
  }, [navigateToSpecsBrowser]);

  const handleViewKnowledge = useCallback((knowledgePath: string) => {
    navigateToKnowledgeBrowser(knowledgePath);
  }, [navigateToKnowledgeBrowser]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if ((e.target as HTMLElement).tagName === "INPUT") return;

      // Escape - deselect
      if (e.key === "Escape") {
        selectTask(null);
        return;
      }

      // 1-4 - view mode shortcuts
      const viewModeMap: Record<string, ViewMode> = {
        "1": "list",
        "2": "tree",
        "3": "kanban",
        "4": "timeline",
      };
      if (viewModeMap[e.key]) {
        setViewMode(viewModeMap[e.key]);
        return;
      }

      // O (Shift+o) - expand all (tree view only)
      if (e.key === "O" && e.shiftKey && viewMode === "tree") {
        expandAll();
        return;
      }

      // C (Shift+c) - collapse all (tree view only)
      if (e.key === "C" && e.shiftKey && viewMode === "tree") {
        collapseAll();
        return;
      }

      // Alt+1-5 - quick status filter
      if (e.altKey) {
        const statusMap: Record<string, StatusFilter> = {
          "1": "all",
          "2": "pending",
          "3": "in_progress",
          "4": "completed",
          "5": "blocked",
        };
        if (statusMap[e.key]) {
          setStatusFilter(statusMap[e.key]);
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectTask, refresh, setViewMode, viewMode, setStatusFilter, expandAll, collapseAll]);

  // Resizable detail panel
  const [panelWidth, setPanelWidth] = useState(380);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;

    const handleDragMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartX.current - ev.clientX;
      const newWidth = Math.min(Math.max(dragStartWidth.current + delta, 300), 700);
      setPanelWidth(newWidth);
    };

    const handleDragEnd = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", handleDragMove);
      document.removeEventListener("mouseup", handleDragEnd);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleDragMove);
    document.addEventListener("mouseup", handleDragEnd);
  }, [panelWidth]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
    },
    [setSearchQuery]
  );

  const statusFilters: { label: string; value: StatusFilter }[] = [
    { label: "All", value: "all" },
    { label: "Pending", value: "pending" },
    { label: "In Progress", value: "in_progress" },
    { label: "Completed", value: "completed" },
    { label: "Blocked", value: "blocked" },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--surface-0)] text-[var(--text-primary)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-muted)] bg-[var(--surface-1)]">
        {/* Status filter tabs */}
        <div className="flex items-center gap-1">
          {statusFilters.map((sf) => (
            <button
              key={sf.value}
              onClick={() => setStatusFilter(sf.value)}
              className={cn(
                "px-2.5 py-1 text-xs rounded transition-colors",
                filters.status === sf.value
                  ? "bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border-emphasis)]"
                  : "bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)]"
              )}
            >
              {sf.label}
              {sf.value !== "all" && (
                <span className="ml-1 text-[var(--text-muted)]">
                  {sf.value === "pending"
                    ? stats.pending
                    : sf.value === "in_progress"
                    ? stats.inProgress
                    : sf.value === "completed"
                    ? stats.completed
                    : sf.value === "blocked"
                    ? stats.blocked
                    : 0}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search and controls */}
        <div className="flex items-center gap-2">
          <label htmlFor="task-search" className="sr-only">Search tasks</label>
          <input
            id="task-search"
            type="text"
            placeholder="Search tasks..."
            value={filters.searchQuery}
            onChange={handleSearchChange}
            className="px-2 py-1 text-xs bg-[var(--surface-2)] text-[var(--text-primary)] border border-[var(--border-muted)] rounded w-40 placeholder-[var(--text-muted)]"
          />

          {viewMode === "tree" && (
            <button
              onClick={expandedTasks.size > 0 ? collapseAll : expandAll}
              title={expandedTasks.size > 0 ? "Collapse all (Shift+C)" : "Expand all (Shift+O)"}
              className="px-2 py-1 text-xs bg-[var(--surface-2)] text-[var(--text-secondary)] rounded hover:bg-[var(--surface-3)] flex items-center gap-1"
            >
              {expandedTasks.size > 0 ? (
                <>
                  <ChevronsUp className="w-3 h-3" />
                  <span>Collapse</span>
                </>
              ) : (
                <>
                  <ChevronsDown className="w-3 h-3" />
                  <span>Expand</span>
                </>
              )}
            </button>
          )}

          <ViewSwitcher
            currentView={viewMode}
            onViewChange={setViewMode}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Task view area */}
        <div className="flex-1 min-w-0 overflow-auto p-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
              Loading tasks...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
              Error: {error}
            </div>
          ) : filteredTasks.length === 0 ? (
            <EmptyState
              icon={<CheckSquare className="w-full h-full" />}
              title="No tasks yet"
              description="Create tasks to track your work, or import from the Ticket Queue."
              actions={[
                {
                  label: "Import from Tickets",
                  onClick: () => {
                    navigateToBlockView("ticket-queue");
                  },
                  icon: <Inbox className="w-4 h-4" />,
                },
              ]}
              tips={[
                "Use Claude Code teammates for parallel task execution",
                "Tasks can be linked to modules for better organization",
              ]}
            />
          ) : viewMode === "list" ? (
            <TaskListView
              tasks={filteredTasks}
              selectedTaskId={selectedTask?.id ?? null}
              onSelectTask={selectTask}
              onContextMenu={openContextMenu}
            />
          ) : viewMode === "tree" ? (
            <TaskTreeView
              nodes={taskTree}
              selectedTaskId={selectedTask?.id ?? null}
              onSelectTask={selectTask}
              expandedTasks={expandedTasks}
              onToggleExpand={toggleExpanded}
              onContextMenu={openContextMenu}
            />
          ) : viewMode === "kanban" ? (
            <KanbanBoard
              tasksByStatus={tasksByStatus}
              selectedTaskId={selectedTask?.id ?? null}
              onSelectTask={selectTask}
              onContextMenu={openContextMenu}
            />
          ) : viewMode === "timeline" ? (
            <TimelineView
              epicsWithProgress={epicsWithProgress}
              selectedTaskId={selectedTask?.id ?? null}
              onSelectTask={selectTask}
              onContextMenu={openContextMenu}
            />
          ) : null}
        </div>

        {/* Task detail panel — pushes content, resizable via drag */}
        {selectedTask && (
          <div className="shrink-0 flex" style={{ width: panelWidth }}>
            {/* Drag handle */}
            <div
              className="w-1 cursor-col-resize hover:bg-[var(--accent-primary)]/40 active:bg-[var(--accent-primary)]/60 transition-colors"
              onMouseDown={handleDragStart}
              title="Drag to resize"
            />
            <div className="flex-1 min-w-0 overflow-y-auto bg-[var(--surface-1)] border-l border-[var(--border-muted)]">
              <TaskDetailPanel
                task={selectedTask}
                progressHistory={selectedTaskProgress}
                onClose={() => selectTask(null)}
                onNavigateToProgressTracker={handleViewProgressHistory}
                onNavigateToSpec={handleViewSpec}
                onNavigateToKnowledge={handleViewKnowledge}
              />
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--border-muted)] bg-[var(--surface-1)] text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-4">
          <span>{stats.total} total</span>
          <span className="text-[var(--text-muted)]">
            {stats.inProgress} in progress
          </span>
          <span className="text-[var(--text-muted)]">
            {stats.completed} completed
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>⌘R: refresh | 1-4: view | Alt+1-5: filter | Esc: close</span>
          <ViewOnlyBadge />
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <TaskContextMenu
          task={contextMenu.task}
          position={contextMenu.position}
          onClose={closeContextMenu}
          onViewProgressHistory={handleViewProgressHistory}
        />
      )}
    </div>
  );
});

/**
 * View-only badge component
 */
function ViewOnlyBadge() {
  return (
    <span
      className="px-1.5 py-0.5 bg-[var(--surface-2)] text-[var(--text-muted)] rounded text-xs"
      title="Tasks are managed via CLI or agents. This view is read-only."
    >
      View Only
    </span>
  );
}

// Register the view
registerBlockView("task-manager", TaskManagerBlockView);
