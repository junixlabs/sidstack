/**
 * useTasks Hook - View-only task access
 *
 * Provides convenient access to task store with auto-fetch on mount.
 * This is a VIEW-ONLY hook - no task modifications.
 */

import { useEffect } from "react";

import { useTaskStore } from "@/stores/taskStore";

interface UseTasksOptions {
  projectId?: string;
  autoFetch?: boolean;
  refreshInterval?: number; // ms, 0 to disable
}

/**
 * Hook for accessing tasks in a view-only manner
 */
export function useTasks(options: UseTasksOptions = {}) {
  const {
    projectId = "default",
    autoFetch = true,
    refreshInterval = 30000, // 30 seconds default
  } = options;

  const {
    tasks,
    selectedTaskId,
    selectedTaskProgress,
    filters,
    isLoading,
    error,
    viewMode,
    isTreeView,
    expandedTasks,
    fetchTasks,
    fetchTaskProgress,
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
    getFilteredTasks,
    getTaskTree,
    getTasksByStatus,
    getEpicsWithProgress,
    getStats,
  } = useTaskStore();

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchTasks(projectId);
    }
  }, [autoFetch, projectId, fetchTasks]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const interval = setInterval(() => {
      fetchTasks(projectId);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, projectId, fetchTasks]);

  // Get selected task
  const selectedTask = selectedTaskId
    ? tasks.find((t) => t.id === selectedTaskId)
    : null;

  return {
    // Data
    tasks,
    filteredTasks: getFilteredTasks(),
    taskTree: getTaskTree(),
    tasksByStatus: getTasksByStatus(),
    epicsWithProgress: getEpicsWithProgress(),
    stats: getStats(),
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
    refresh: () => fetchTasks(projectId),
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
    fetchTaskProgress,
  };
}

/**
 * Hook for a single task view
 */
export function useTask(taskId: string | null) {
  const { tasks, fetchTasks, fetchTaskProgress, selectedTaskProgress } =
    useTaskStore();

  // Fetch tasks if not loaded
  useEffect(() => {
    if (tasks.length === 0) {
      fetchTasks();
    }
  }, [tasks.length, fetchTasks]);

  // Note: fetchTaskProgress is called by selectTask() already
  // This useEffect is only needed when useTask is used independently
  // The cache in taskStore prevents duplicate network calls
  useEffect(() => {
    if (taskId) {
      fetchTaskProgress(taskId);
    }
  }, [taskId, fetchTaskProgress]);

  const task = taskId ? tasks.find((t) => t.id === taskId) : null;

  // Get subtasks
  const subtasks = taskId
    ? tasks.filter((t) => t.parentTaskId === taskId)
    : [];

  // Get parent task
  const parentTask = task?.parentTaskId
    ? tasks.find((t) => t.id === task.parentTaskId)
    : null;

  return {
    task,
    subtasks,
    parentTask,
    progressHistory: selectedTaskProgress,
    isLoading: !task && tasks.length === 0,
  };
}
