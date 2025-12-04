/**
 * useUnifiedContext Hook
 *
 * Convenience hook for using unified context in components.
 * Provides commonly used selectors and actions.
 */

import { useEffect } from "react";

import {
  useUnifiedContextStore,
  TaskSpecLink,
  TaskKnowledgeLink,
  NavigationTarget,
} from "@/stores/unifiedContextStore";

interface UseUnifiedContextOptions {
  taskId?: string;
  autoLoad?: boolean;
}

interface UseUnifiedContextReturn {
  // State
  activeTaskId: string | null;
  specLinks: TaskSpecLink[];
  knowledgeLinks: TaskKnowledgeLink[];
  specCount: number;
  knowledgeCount: number;
  isLoading: boolean;
  error: string | null;

  // Navigation
  navigationTarget: NavigationTarget | null;
  navigateTo: (target: NavigationTarget) => void;
  clearNavigation: () => void;

  // Actions
  setActiveTask: (taskId: string | null) => void;
  linkSpec: (
    specPath: string,
    specType: "change" | "spec" | "module",
    reason?: string
  ) => Promise<TaskSpecLink | null>;
  linkKnowledge: (
    knowledgePath: string,
    reason?: string
  ) => Promise<TaskKnowledgeLink | null>;
  unlinkSpec: (linkId: string) => Promise<boolean>;
  unlinkKnowledge: (linkId: string) => Promise<boolean>;
}

export function useUnifiedContext(
  options: UseUnifiedContextOptions = {}
): UseUnifiedContextReturn {
  const { taskId, autoLoad = true } = options;

  const store = useUnifiedContextStore();

  // Auto-load links when taskId changes
  useEffect(() => {
    if (autoLoad && taskId && taskId !== store.activeTaskId) {
      store.setActiveTask(taskId);
    }
  }, [taskId, autoLoad, store.activeTaskId, store.setActiveTask]);

  // Filter links for the specific task
  const specLinks = taskId
    ? store.specLinks.filter((l) => l.taskId === taskId)
    : store.specLinks;
  const knowledgeLinks = taskId
    ? store.knowledgeLinks.filter((l) => l.taskId === taskId)
    : store.knowledgeLinks;

  // Bound actions with current taskId
  const linkSpec = async (
    specPath: string,
    specType: "change" | "spec" | "module",
    reason?: string
  ) => {
    const targetTaskId = taskId || store.activeTaskId;
    if (!targetTaskId) return null;
    return store.linkSpec(targetTaskId, specPath, specType, reason);
  };

  const linkKnowledge = async (knowledgePath: string, reason?: string) => {
    const targetTaskId = taskId || store.activeTaskId;
    if (!targetTaskId) return null;
    return store.linkKnowledge(targetTaskId, knowledgePath, reason);
  };

  return {
    // State
    activeTaskId: store.activeTaskId,
    specLinks,
    knowledgeLinks,
    specCount: specLinks.length,
    knowledgeCount: knowledgeLinks.length,
    isLoading: store.isLoading,
    error: store.error,

    // Navigation
    navigationTarget: store.navigationTarget,
    navigateTo: store.navigateTo,
    clearNavigation: store.clearNavigation,

    // Actions
    setActiveTask: store.setActiveTask,
    linkSpec,
    linkKnowledge,
    unlinkSpec: store.unlinkSpec,
    unlinkKnowledge: store.unlinkKnowledge,
  };
}

/**
 * Hook for cross-reference badges (specs/knowledge views)
 */
export function useTasksForSpec(specPath: string) {
  const { loadTasksForSpec, specTasksCache } = useUnifiedContextStore();

  useEffect(() => {
    if (specPath && !specTasksCache.has(specPath)) {
      loadTasksForSpec(specPath);
    }
  }, [specPath, specTasksCache, loadTasksForSpec]);

  return specTasksCache.get(specPath) ?? [];
}

export function useTasksForKnowledge(knowledgePath: string) {
  const { loadTasksForKnowledge, knowledgeTasksCache } =
    useUnifiedContextStore();

  useEffect(() => {
    if (knowledgePath && !knowledgeTasksCache.has(knowledgePath)) {
      loadTasksForKnowledge(knowledgePath);
    }
  }, [knowledgePath, knowledgeTasksCache, loadTasksForKnowledge]);

  return knowledgeTasksCache.get(knowledgePath) ?? [];
}

/**
 * Navigation effect hook
 *
 * Use in block views to respond to navigation events.
 */
export function useContextNavigation(
  type: "spec" | "knowledge" | "progress",
  onNavigate: (path?: string) => void
) {
  const { navigationTarget, clearNavigation } = useUnifiedContextStore();

  useEffect(() => {
    if (navigationTarget?.type === type) {
      const path =
        navigationTarget.type === "spec"
          ? navigationTarget.path
          : navigationTarget.type === "knowledge"
          ? navigationTarget.path
          : undefined;
      onNavigate(path);
      clearNavigation();
    }
  }, [navigationTarget, type, onNavigate, clearNavigation]);
}
