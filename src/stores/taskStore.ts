/**
 * Task Store - View-only task management
 *
 * Fetches tasks from API server and provides filtering/selection.
 * This is a VIEW-ONLY store - no modifications, only reads.
 */

import { create } from "zustand";

// ============================================================================
// Types
// ============================================================================

export type TaskStatus = "pending" | "in_progress" | "completed" | "blocked" | "failed" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";
export type TaskType = "feature" | "bugfix" | "refactor" | "test" | "docs" | "infra" | "security" | "perf" | "debt" | "spike";
export type ViewMode = "list" | "tree" | "kanban" | "timeline";

export interface AcceptanceCriterion {
  id: string;
  description: string;
  completed: boolean;
  completedAt?: number;
}

export interface TaskValidation {
  progressHistoryCount: number;
  titleFormatValid: boolean;
  qualityGatesPassed: boolean;
  acceptanceCriteriaValid: boolean;
  lastValidatedAt?: number;
  legacy?: boolean;
}

export interface TaskGovernance {
  principles: string[];
  skills: string[];
  qualityGates: Array<{ id: string; command: string; required: boolean; passedAt?: number }>;
  requiredCriteria: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  parentTaskId?: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedAgent?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  progress: number;
  notes?: string;
  branch?: string;
  // Governance fields
  taskType?: TaskType;
  moduleId?: string;
  governance?: TaskGovernance;
  acceptanceCriteria?: AcceptanceCriterion[];
  validation?: TaskValidation;
}

export interface TaskProgressLog {
  id: string;
  taskId: string;
  sessionId: string;
  progress: number;
  status: TaskStatus;
  currentStep?: string;
  notes?: string;
  artifacts: string[];
  createdAt: number;
}

export type StatusFilter = "all" | TaskStatus;

interface TaskFilters {
  status: StatusFilter;
  projectId: string;
  searchQuery: string;
}

interface TaskStoreState {
  // Data
  tasks: Task[];
  selectedTaskId: string | null;
  selectedTaskProgress: TaskProgressLog[];

  // Progress cache: taskId -> { data, fetchedAt }
  progressCache: Map<string, { data: TaskProgressLog[]; fetchedAt: number }>;

  // UI State
  filters: TaskFilters;
  isLoading: boolean;
  error: string | null;
  viewMode: ViewMode;
  expandedTasks: Set<string>;

  // Actions (read-only)
  fetchTasks: (projectId?: string) => Promise<void>;
  fetchTaskProgress: (taskId: string) => Promise<void>;

  // Selection
  selectTask: (taskId: string | null) => void;

  // Filters
  setStatusFilter: (status: StatusFilter) => void;
  setProjectId: (projectId: string) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;

  // View Mode
  setViewMode: (mode: ViewMode) => void;
  // Legacy compatibility
  isTreeView: boolean;
  toggleTreeView: () => void;

  // Expand/Collapse
  toggleExpanded: (taskId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  isExpanded: (taskId: string) => boolean;

  // Computed
  getFilteredTasks: () => Task[];
  getTaskTree: () => TaskNode[];
  getTasksByStatus: () => Record<TaskStatus, Task[]>;
  getEpicsWithProgress: () => Array<{ task: Task; subtasks: Task[]; progress: number }>;
  getStats: () => TaskStats;
}

export interface TaskNode {
  task: Task;
  children: TaskNode[];
}

export interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  blocked: number;
  failed: number;
}

const API_BASE = "http://localhost:19432";

const defaultFilters: TaskFilters = {
  status: "all",
  projectId: "default",
  searchQuery: "",
};

// Load persisted expanded state
const loadExpandedTasks = (): Set<string> => {
  try {
    const stored = localStorage.getItem('sidstack:expandedTasks');
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch {
    // Ignore errors
  }
  return new Set();
};

// Save expanded state
const saveExpandedTasks = (expanded: Set<string>) => {
  try {
    localStorage.setItem('sidstack:expandedTasks', JSON.stringify([...expanded]));
  } catch {
    // Ignore errors
  }
};

// Load persisted view mode
const loadViewMode = (): ViewMode => {
  try {
    const stored = localStorage.getItem('sidstack:viewMode');
    if (stored && ['list', 'tree', 'kanban', 'timeline'].includes(stored)) {
      return stored as ViewMode;
    }
  } catch {
    // Ignore errors
  }
  return 'tree'; // Default to tree view
};

// Save view mode
const saveViewMode = (mode: ViewMode) => {
  try {
    localStorage.setItem('sidstack:viewMode', mode);
  } catch {
    // Ignore errors
  }
};

// ============================================================================
// Store
// ============================================================================

// ============================================================================
// Selectors (per Design Guidelines - avoid store destructuring)
// ============================================================================

export const useTaskTasks = () => useTaskStore((s) => s.tasks);
export const useTaskSelectedId = () => useTaskStore((s) => s.selectedTaskId);
export const useTaskSelectedProgress = () => useTaskStore((s) => s.selectedTaskProgress);
export const useTaskFilters = () => useTaskStore((s) => s.filters);
export const useTaskIsLoading = () => useTaskStore((s) => s.isLoading);
export const useTaskError = () => useTaskStore((s) => s.error);
export const useTaskViewMode = () => useTaskStore((s) => s.viewMode);
export const useTaskExpandedTasks = () => useTaskStore((s) => s.expandedTasks);

// Action selectors (stable references)
export const useTaskActions = () => useTaskStore((s) => ({
  fetchTasks: s.fetchTasks,
  fetchTaskProgress: s.fetchTaskProgress,
  selectTask: s.selectTask,
  setStatusFilter: s.setStatusFilter,
  setProjectId: s.setProjectId,
  setSearchQuery: s.setSearchQuery,
  resetFilters: s.resetFilters,
  setViewMode: s.setViewMode,
  toggleTreeView: s.toggleTreeView,
  toggleExpanded: s.toggleExpanded,
  expandAll: s.expandAll,
  collapseAll: s.collapseAll,
  isExpanded: s.isExpanded,
  getFilteredTasks: s.getFilteredTasks,
  getTaskTree: s.getTaskTree,
  getTasksByStatus: s.getTasksByStatus,
  getEpicsWithProgress: s.getEpicsWithProgress,
  getStats: s.getStats,
}));

// ============================================================================
// Store Implementation
// ============================================================================

// Cache TTL in milliseconds (30 seconds)
const PROGRESS_CACHE_TTL = 30000;

export const useTaskStore = create<TaskStoreState>((set, get) => ({
  // Initial state
  tasks: [],
  selectedTaskId: null,
  selectedTaskProgress: [],
  progressCache: new Map(),
  filters: { ...defaultFilters },
  isLoading: false,
  error: null,
  viewMode: loadViewMode(),
  expandedTasks: loadExpandedTasks(),

  // Legacy compatibility - computed from viewMode
  get isTreeView() {
    return get().viewMode === 'tree';
  },

  // Fetch tasks from API
  fetchTasks: async (projectId?: string) => {
    const pid = projectId || get().filters.projectId;
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${API_BASE}/api/tasks?projectId=${pid}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.statusText}`);
      }

      const data = await response.json();
      // Parse JSON fields from database
      const tasks = (data.tasks || []).map((t: any) => ({
        ...t,
        governance: t.governance ? JSON.parse(t.governance) : undefined,
        acceptanceCriteria: t.acceptanceCriteria ? JSON.parse(t.acceptanceCriteria) : undefined,
        validation: t.validation ? JSON.parse(t.validation) : undefined,
      }));
      set({ tasks, isLoading: false });
    } catch (error) {
      console.error("[taskStore] Failed to fetch tasks:", error);
      set({
        error: error instanceof Error ? error.message : "Failed to fetch tasks",
        isLoading: false,
      });
    }
  },

  // Fetch task progress history (with caching)
  fetchTaskProgress: async (taskId: string) => {
    const { progressCache } = get();
    const cached = progressCache.get(taskId);
    const now = Date.now();

    // Use cache if valid (not stale)
    if (cached && (now - cached.fetchedAt) < PROGRESS_CACHE_TTL) {
      set({ selectedTaskProgress: cached.data });
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/tasks/${taskId}/progress`);
      if (!response.ok) {
        throw new Error(`Failed to fetch progress: ${response.statusText}`);
      }

      const data = await response.json();
      const progressHistory = (data.progressHistory || []).map((p: any) => ({
        ...p,
        artifacts: p.artifacts ? JSON.parse(p.artifacts) : [],
      }));

      // Update cache
      const newCache = new Map(progressCache);
      newCache.set(taskId, { data: progressHistory, fetchedAt: now });

      set({ selectedTaskProgress: progressHistory, progressCache: newCache });
    } catch (error) {
      console.error("[taskStore] Failed to fetch task progress:", error);
      set({ selectedTaskProgress: [] });
    }
  },

  // Selection - use cached progress immediately, fetch in background if stale
  selectTask: (taskId) => {
    const { progressCache } = get();

    // Use cached progress immediately (no flash)
    const cached = taskId ? progressCache.get(taskId) : null;
    const cachedData = cached?.data ?? [];

    set({ selectedTaskId: taskId, selectedTaskProgress: cachedData });

    // Fetch in background (will update if stale or not cached)
    if (taskId) {
      get().fetchTaskProgress(taskId);
    }
  },

  // Filters
  setStatusFilter: (status) => {
    set((state) => ({
      filters: { ...state.filters, status },
    }));
  },

  setProjectId: (projectId) => {
    set((state) => ({
      filters: { ...state.filters, projectId },
    }));
    get().fetchTasks(projectId);
  },

  setSearchQuery: (searchQuery) => {
    set((state) => ({
      filters: { ...state.filters, searchQuery },
    }));
  },

  resetFilters: () => {
    set({ filters: { ...defaultFilters } });
  },

  // View Mode
  setViewMode: (mode: ViewMode) => {
    saveViewMode(mode);
    set({ viewMode: mode });
  },

  // Legacy compatibility
  toggleTreeView: () => {
    const current = get().viewMode;
    const next = current === 'tree' ? 'list' : 'tree';
    saveViewMode(next);
    set({ viewMode: next });
  },

  // Expand/Collapse
  toggleExpanded: (taskId: string) => {
    const { expandedTasks } = get();
    const next = new Set(expandedTasks);
    if (next.has(taskId)) {
      next.delete(taskId);
    } else {
      next.add(taskId);
    }
    saveExpandedTasks(next);
    set({ expandedTasks: next });
  },

  expandAll: () => {
    const { tasks } = get();
    // Expand all parent tasks (tasks without parentTaskId that have children)
    const parentIds = tasks.filter(t => !t.parentTaskId).map(t => t.id);
    const all = new Set(parentIds);
    saveExpandedTasks(all);
    set({ expandedTasks: all });
  },

  collapseAll: () => {
    const empty = new Set<string>();
    saveExpandedTasks(empty);
    set({ expandedTasks: empty });
  },

  isExpanded: (taskId: string) => {
    return get().expandedTasks.has(taskId);
  },

  // Computed: filter tasks
  getFilteredTasks: () => {
    const { tasks, filters } = get();
    let filtered = tasks;

    // Filter by status
    if (filters.status !== "all") {
      filtered = filtered.filter((t) => t.status === filters.status);
    }

    // Filter by search
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();

      // Special filter: module:<moduleId>
      if (query.startsWith('module:')) {
        const moduleId = query.slice(7).trim();
        filtered = filtered.filter((t) => t.moduleId === moduleId);
      } else {
        filtered = filtered.filter(
          (t) =>
            t.title.toLowerCase().includes(query) ||
            t.description.toLowerCase().includes(query) ||
            t.assignedAgent?.toLowerCase().includes(query) ||
            t.moduleId?.toLowerCase().includes(query)
        );
      }
    }

    return filtered;
  },

  // Computed: build task tree
  getTaskTree: () => {
    const tasks = get().getFilteredTasks();

    // Build map
    const taskMap = new Map<string, TaskNode>();
    for (const task of tasks) {
      taskMap.set(task.id, { task, children: [] });
    }

    // Build tree
    const roots: TaskNode[] = [];
    for (const task of tasks) {
      const node = taskMap.get(task.id)!;

      if (task.parentTaskId && taskMap.has(task.parentTaskId)) {
        // Add as child
        taskMap.get(task.parentTaskId)!.children.push(node);
      } else {
        // Root task
        roots.push(node);
      }
    }

    // Sort by updatedAt descending
    const sortByUpdated = (nodes: TaskNode[]) => {
      nodes.sort((a, b) => b.task.updatedAt - a.task.updatedAt);
      for (const node of nodes) {
        sortByUpdated(node.children);
      }
    };
    sortByUpdated(roots);

    return roots;
  },

  // Computed: group tasks by status (for Kanban)
  getTasksByStatus: () => {
    const tasks = get().getFilteredTasks();
    const grouped: Record<TaskStatus, Task[]> = {
      pending: [],
      in_progress: [],
      completed: [],
      blocked: [],
      failed: [],
      cancelled: [],
    };

    for (const task of tasks) {
      grouped[task.status].push(task);
    }

    // Sort each column by priority (high first) then by updatedAt
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    for (const status of Object.keys(grouped) as TaskStatus[]) {
      grouped[status].sort((a, b) => {
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        return b.updatedAt - a.updatedAt;
      });
    }

    return grouped;
  },

  // Computed: get epics with progress (for Timeline)
  getEpicsWithProgress: () => {
    const tasks = get().getFilteredTasks();

    // Find epics (tasks without parent that have children)
    const childrenMap = new Map<string, Task[]>();
    for (const task of tasks) {
      if (task.parentTaskId) {
        const children = childrenMap.get(task.parentTaskId) || [];
        children.push(task);
        childrenMap.set(task.parentTaskId, children);
      }
    }

    const epics = tasks
      .filter(t => !t.parentTaskId && childrenMap.has(t.id))
      .map(epic => {
        const subtasks = childrenMap.get(epic.id) || [];
        const completedCount = subtasks.filter(s => s.status === 'completed').length;
        const progress = subtasks.length > 0
          ? Math.round((completedCount / subtasks.length) * 100)
          : epic.progress;

        return {
          task: epic,
          subtasks: subtasks.sort((a, b) => a.createdAt - b.createdAt),
          progress,
        };
      })
      .sort((a, b) => b.task.updatedAt - a.task.updatedAt);

    return epics;
  },

  // Computed: stats
  getStats: () => {
    const tasks = get().tasks;
    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "pending").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      blocked: tasks.filter((t) => t.status === "blocked").length,
      failed: tasks.filter((t) => t.status === "failed").length,
    };
  },
}));
