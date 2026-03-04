/**
 * TanStack Query hooks for Tauri app
 *
 * Server data fetching for tasks and knowledge.
 * Replaces async fetch actions previously in Zustand stores.
 */

import { useQuery } from '@tanstack/react-query';
import { getApiBaseUrl, apiFetch } from '@/lib/api-config';
import { queryKeys } from '@/lib/query-keys';
import type { Task, TaskProgressLog } from '@/stores/taskStore';

const API_BASE = getApiBaseUrl();

// ============================================================================
// Parse helpers
// ============================================================================

/** Safely parse a JSON field that may be a string or already parsed */
function safeParse(val: unknown) {
  if (!val) return undefined;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return undefined; }
  }
  return val;
}

// ============================================================================
// Task queries
// ============================================================================

/** Fetch task list for a project */
export function useTasksQuery(projectId: string) {
  return useQuery({
    queryKey: queryKeys.tasks.list(projectId),
    queryFn: async (): Promise<Task[]> => {
      const response = await apiFetch(`${API_BASE}/api/tasks?projectId=${projectId}&fields=standard`);
      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.statusText}`);
      }
      const data = await response.json();
      return (data.tasks || []) as Task[];
    },
    staleTime: 15_000,
    enabled: !!projectId,
  });
}

/** Fetch full task detail (governance, acceptanceCriteria, validation) */
export function useTaskDetailQuery(taskId: string | null) {
  return useQuery({
    queryKey: queryKeys.tasks.detail('_', taskId || ''),
    queryFn: async (): Promise<Task> => {
      const response = await apiFetch(`${API_BASE}/api/tasks/${taskId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch task detail: ${response.statusText}`);
      }
      const data = await response.json();
      const task = data.task;
      return {
        ...task,
        governance: safeParse(task.governance),
        acceptanceCriteria: safeParse(task.acceptanceCriteria),
        validation: safeParse(task.validation),
      } as Task;
    },
    staleTime: 15_000,
    enabled: !!taskId,
  });
}

/** Fetch task progress history */
export function useTaskProgressQuery(taskId: string | null) {
  return useQuery({
    queryKey: queryKeys.tasks.progress('_', taskId || ''),
    queryFn: async (): Promise<TaskProgressLog[]> => {
      const response = await apiFetch(`${API_BASE}/api/tasks/${taskId}/progress`);
      if (!response.ok) {
        throw new Error(`Failed to fetch progress: ${response.statusText}`);
      }
      const data = await response.json();
      return (data.progressHistory || []).map((p: any) => ({
        ...p,
        artifacts: p.artifacts ? JSON.parse(p.artifacts) : [],
      }));
    },
    staleTime: 30_000,
    enabled: !!taskId,
  });
}
