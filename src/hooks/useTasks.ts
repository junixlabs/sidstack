/**
 * useTasks Hook - View-only task access (hybrid pattern)
 *
 * Combines TanStack Query (server state) with Zustand (UI state).
 * Provides the same interface as before — components don't need to change.
 */

import { useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useTasksQuery, useTaskProgressQuery } from "@/hooks/queries";
import { queryKeys } from "@/lib/query-keys";
import {
  useTaskStore,
  filterTasks,
  buildTaskTree,
  groupTasksByStatus,
  getEpicsWithProgress as computeEpics,
  computeTaskStats,
} from "@/stores/taskStore";

interface UseTasksOptions {
  projectId?: string;
  autoFetch?: boolean;
}

/**
 * Hook for accessing tasks in a view-only manner.
 * Server data via TanStack Query, UI state via Zustand.
 */
export function useTasks(options: UseTasksOptions = {}) {
  const {
    projectId = "default",
    autoFetch = true,
  } = options;

  // --- Server state (TanStack Query) ---
  const { data: tasks = [], isLoading, error: queryError } = useTasksQuery(
    autoFetch ? projectId : ''
  );
  const error = queryError?.message ?? null;

  // --- UI state (Zustand) ---
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const filters = useTaskStore((s) => s.filters);
  const viewMode = useTaskStore((s) => s.viewMode);
  const expandedTasks = useTaskStore((s) => s.expandedTasks);

  // Store actions (stable refs from Zustand)
  const selectTask = useTaskStore((s) => s.selectTask);
  const setStatusFilter = useTaskStore((s) => s.setStatusFilter);
  const setSearchQuery = useTaskStore((s) => s.setSearchQuery);
  const resetFilters = useTaskStore((s) => s.resetFilters);
  const setViewMode = useTaskStore((s) => s.setViewMode);
  const toggleTreeView = useTaskStore((s) => s.toggleTreeView);
  const toggleExpanded = useTaskStore((s) => s.toggleExpanded);
  const expandAllFor = useTaskStore((s) => s.expandAllFor);
  const collapseAll = useTaskStore((s) => s.collapseAll);
  const isExpanded = useTaskStore((s) => s.isExpanded);

  // --- Derived/computed data (memoized) ---
  const filteredTasks = useMemo(
    () => filterTasks(tasks, filters),
    [tasks, filters]
  );

  const taskTree = useMemo(
    () => buildTaskTree(filteredTasks),
    [filteredTasks]
  );

  const tasksByStatus = useMemo(
    () => groupTasksByStatus(filteredTasks),
    [filteredTasks]
  );

  const epicsWithProgress = useMemo(
    () => computeEpics(filteredTasks),
    [filteredTasks]
  );

  const stats = useMemo(
    () => computeTaskStats(tasks),
    [tasks]
  );

  // Legacy compatibility
  const isTreeView = viewMode === 'tree';

  // Selected task from query data
  const selectedTask = useMemo(
    () => selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) ?? null : null,
    [selectedTaskId, tasks]
  );

  // Progress for selected task (TanStack Query)
  const { data: selectedTaskProgress = [] } = useTaskProgressQuery(selectedTaskId);

  // Refresh via query invalidation
  const queryClient = useQueryClient();
  const refresh = useCallback(
    () => { queryClient.invalidateQueries({ queryKey: queryKeys.tasks.list(projectId) }); },
    [queryClient, projectId]
  );

  // Bound expandAll — needs tasks data
  const expandAll = useCallback(
    () => expandAllFor(tasks),
    [expandAllFor, tasks]
  );

  return {
    // Data
    tasks,
    filteredTasks,
    taskTree,
    tasksByStatus,
    epicsWithProgress,
    stats,
    selectedTask,
    selectedTaskProgress,

    // State
    filters,
    isLoading,
    error,
    viewMode,
    isTreeView,
    expandedTasks,

    // Actions
    refresh,
    selectTask,
    setStatusFilter,
    setSearchQuery,
    resetFilters,
    setViewMode,
    toggleTreeView,
    toggleExpanded,
    expandAll,
    collapseAll,
    isExpanded,
  };
}

/**
 * Hook for a single task view
 */
export function useTask(taskId: string | null) {
  // Use current project's tasks from the same TanStack Query cache
  const projectId = useTaskStore((s) => s.filters.projectId);
  const { data: tasks = [] } = useTasksQuery(projectId);
  const { data: progressHistory = [] } = useTaskProgressQuery(taskId);

  const task = useMemo(
    () => taskId ? tasks.find((t) => t.id === taskId) ?? null : null,
    [taskId, tasks]
  );

  const subtasks = useMemo(
    () => taskId ? tasks.filter((t) => t.parentTaskId === taskId) : [],
    [taskId, tasks]
  );

  const parentTask = useMemo(
    () => task?.parentTaskId ? tasks.find((t) => t.id === task.parentTaskId) ?? null : null,
    [task, tasks]
  );

  return {
    task,
    subtasks,
    parentTask,
    progressHistory,
    isLoading: !task && tasks.length === 0,
  };
}
