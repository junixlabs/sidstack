import {
  RotateCw,
  ChevronsDown,
  ChevronsUp,
  CheckSquare,
  Inbox,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { memo, useEffect, useCallback, useState } from "react";

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
import { useOptionalWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useBlockNavigation } from "@/hooks/useBlockNavigation";
import { useTasks } from "@/hooks/useTasks";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import { useClaudeSessionStore } from "@/stores/claudeSessionStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import type { StatusFilter, ViewMode } from "@/stores/taskStore";
import type { BlockViewProps } from "@/types/block";

import { registerBlockView } from "../BlockRegistry";

// Analysis prompt for task suggestions
const TASK_ANALYSIS_PROMPT = `# Analyze Codebase for Task Suggestions

Your goal: Scan this codebase and suggest actionable tasks that would improve code quality, maintainability, and completeness.

## What to Look For

### 1. Code Markers
Search for explicit markers in the code:
\`\`\`bash
# Find TODOs, FIXMEs, HACKs, XXX
grep -rn "TODO\\|FIXME\\|HACK\\|XXX" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.py" --include="*.go" --include="*.rs" . 2>/dev/null | head -30
\`\`\`

### 2. Test Coverage Gaps
Look for files/functions without tests:
- Check if test files exist for main modules
- Look for complex functions without test coverage
- Identify untested edge cases

### 3. Documentation Gaps
- Missing or outdated README sections
- Functions without JSDoc/docstrings
- Missing API documentation
- Undocumented configuration options

### 4. Code Quality Issues
- Large files that should be split (>500 lines)
- Complex functions (high cyclomatic complexity)
- Duplicated code patterns
- Inconsistent error handling
- Missing type annotations

### 5. Security & Performance
- Hardcoded secrets or credentials
- N+1 query patterns
- Missing input validation
- Unhandled promise rejections

## Output Format

For each finding, suggest a task:

| Priority | Task | Module | Type | Effort |
|----------|------|--------|------|--------|
| High | Fix security issue in auth.ts:45 | auth | bugfix | 1h |
| Medium | Add tests for payment service | payments | test | 2h |
| Low | Document API endpoints | api | docs | 1h |

## Create Tasks

Ask user: "I found X potential tasks. Would you like me to create them in SidStack?"

If yes, use MCP tool \`task_create\` for each task:
\`\`\`
task_create({
  title: "Task title",
  description: "Detailed description with file:line references",
  taskType: "bugfix|feature|test|docs|refactor",
  priority: "high|medium|low",
  moduleId: "module-id"  // if modules exist
})
\`\`\`

## Quality Guidelines

- **Be specific**: Include file paths and line numbers
- **Be actionable**: Each task should be completable in one session
- **Prioritize**: Focus on high-impact, low-effort tasks first
- **Group related**: Suggest if tasks should be grouped as subtasks

---

Begin by scanning for code markers.`;

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

  // Get projectId from current workspace
  const { projectPath } = useAppStore();
  const projectId = projectPath?.split("/").pop() || "default";

  // Workspace context for session launching
  const workspaceContext = useOptionalWorkspaceContext();
  const workspacePath = workspaceContext?.workspacePath || projectPath || null;

  // Session launching state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const launchSession = useClaudeSessionStore((s) => s.launchSession);
  const completeMilestone = useOnboardingStore((s) => s.completeMilestone);

  // Handle analyze with Claude
  const handleAnalyzeWithClaude = useCallback(async () => {
    if (!workspacePath || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalyzeError(null);

    try {
      const result = await launchSession({
        projectDir: workspacePath,
        prompt: TASK_ANALYSIS_PROMPT,
      });

      if (result.success) {
        completeMilestone("sessionLaunched");
      } else {
        setAnalyzeError(result.error || "Failed to launch analysis session");
      }
    } catch (err) {
      console.error("Failed to launch analysis session:", err);
      setAnalyzeError("Failed to connect to API server");
    } finally {
      setIsAnalyzing(false);
    }
  }, [workspacePath, isAnalyzing, launchSession, completeMilestone]);

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

  // Auto-refresh based on settings
  const { isActive: autoRefreshActive } = useAutoRefresh({
    onRefresh: refresh,
  });

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

      // R - refresh
      if (e.key === "r" && !e.ctrlKey && !e.metaKey) {
        refresh();
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

          <button
            onClick={refresh}
            className="px-2 py-1 text-xs bg-[var(--surface-2)] text-[var(--text-secondary)] rounded hover:bg-[var(--surface-3)] flex items-center gap-1"
            title={autoRefreshActive ? "Auto-refresh enabled" : "Refresh (R)"}
          >
            <RotateCw className={cn("w-3 h-3", autoRefreshActive && "animate-spin")} />
            <span>{autoRefreshActive ? "Auto" : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Task view area */}
        <div className={cn(
          "flex-1 overflow-auto p-3",
          viewMode === "kanban" && "overflow-x-auto"
        )}>
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
              Loading tasks...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
              Error: {error}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center">
              <EmptyState
                icon={<CheckSquare className="w-full h-full" />}
                title="No tasks yet"
                description="Let Claude analyze your codebase to suggest tasks based on TODOs, code quality issues, missing tests, and more."
                actions={[
                  {
                    label: isAnalyzing ? "Analyzing..." : "Analyze with Claude",
                    onClick: handleAnalyzeWithClaude,
                    icon: isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />,
                    disabled: isAnalyzing || !workspacePath,
                  },
                  {
                    label: "Import from Tickets",
                    onClick: () => {
                      // Navigate to ticket queue - use keyboard shortcut simulation
                      const event = new KeyboardEvent("keydown", {
                        key: "4",
                        metaKey: true,
                        bubbles: true,
                      });
                      window.dispatchEvent(event);
                    },
                    icon: <Inbox className="w-4 h-4" />,
                    variant: "outline",
                  },
                ]}
                tips={analyzeError ? [] : [
                  "Claude will scan for TODOs, FIXMEs, and code quality issues",
                  "Tasks can be linked to modules for better organization",
                ]}
              />
              {analyzeError && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-center max-w-md">
                  <p className="text-xs text-red-400">{analyzeError}</p>
                </div>
              )}
            </div>
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

        {/* Task detail panel */}
        {selectedTask && (
          <div className="w-80 shrink-0 border-l border-[var(--border-muted)] overflow-y-auto bg-[var(--surface-1)]">
            <TaskDetailPanel
              task={selectedTask}
              progressHistory={selectedTaskProgress}
              onClose={() => selectTask(null)}
              onNavigateToProgressTracker={handleViewProgressHistory}
              onNavigateToSpec={handleViewSpec}
              onNavigateToKnowledge={handleViewKnowledge}
            />
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
          <span>R: refresh | 1-4: view | Alt+1-5: filter | Esc: close</span>
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
