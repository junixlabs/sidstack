/**
 * Task Store - UI state only
 *
 * Manages selection, filters, view mode, and expand/collapse state.
 * Server data (tasks, loading, errors) is handled by TanStack Query (see hooks/queries.ts).
 */

import { create } from "zustand";

// ============================================================================
// Types
// ============================================================================

export type TaskStatus = "pending" | "review" | "in_progress" | "completed" | "blocked" | "failed" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";
export type TaskType = "feature" | "bugfix" | "refactor" | "test" | "docs" | "infra" | "security" | "perf" | "debt" | "spike" | "chore";
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
  // Solution plan & review
  solutionPlan?: string;
  planStatus?: 'draft' | 'approved' | 'revision_requested';
  planReviewNotes?: string;
  implementSummary?: string;
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

export interface TaskFilters {
  status: StatusFilter;
  projectId: string;
  searchQuery: string;
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

// ============================================================================
// Pure utility functions — used by useTasks hook with query data
// ============================================================================

/** Filter tasks by status and search query */
export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  let filtered = tasks;

  if (filters.status !== "all") {
    filtered = filtered.filter((t) => t.status === filters.status);
  }

  if (filters.searchQuery.trim()) {
    const query = filters.searchQuery.toLowerCase();

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
}

/** Build task tree from flat filtered list */
export function buildTaskTree(tasks: Task[]): TaskNode[] {
  const taskMap = new Map<string, TaskNode>();
  for (const task of tasks) {
    taskMap.set(task.id, { task, children: [] });
  }

  const roots: TaskNode[] = [];
  for (const task of tasks) {
    const node = taskMap.get(task.id)!;
    if (task.parentTaskId && taskMap.has(task.parentTaskId)) {
      taskMap.get(task.parentTaskId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortByUpdated = (nodes: TaskNode[]) => {
    nodes.sort((a, b) => b.task.updatedAt - a.task.updatedAt);
    for (const node of nodes) {
      sortByUpdated(node.children);
    }
  };
  sortByUpdated(roots);

  return roots;
}

/** Group tasks by status (for Kanban) */
export function groupTasksByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const grouped: Record<TaskStatus, Task[]> = {
    pending: [],
    review: [],
    in_progress: [],
    completed: [],
    blocked: [],
    failed: [],
    cancelled: [],
  };

  for (const task of tasks) {
    grouped[task.status].push(task);
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  for (const status of Object.keys(grouped) as TaskStatus[]) {
    grouped[status].sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return b.updatedAt - a.updatedAt;
    });
  }

  return grouped;
}

/** Get epics with progress (for Timeline) */
export function getEpicsWithProgress(tasks: Task[]): Array<{ task: Task; subtasks: Task[]; progress: number }> {
  const childrenMap = new Map<string, Task[]>();
  for (const task of tasks) {
    if (task.parentTaskId) {
      const children = childrenMap.get(task.parentTaskId) || [];
      children.push(task);
      childrenMap.set(task.parentTaskId, children);
    }
  }

  return tasks
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
}

/** Compute task stats */
export function computeTaskStats(tasks: Task[]): TaskStats {
  return {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    blocked: tasks.filter((t) => t.status === "blocked").length,
    failed: tasks.filter((t) => t.status === "failed").length,
  };
}

// ============================================================================
// localStorage persistence helpers
// ============================================================================

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

const saveExpandedTasks = (expanded: Set<string>) => {
  try {
    localStorage.setItem('sidstack:expandedTasks', JSON.stringify([...expanded]));
  } catch {
    // Ignore errors
  }
};

const loadViewMode = (): ViewMode => {
  try {
    const stored = localStorage.getItem('sidstack:viewMode');
    if (stored && ['list', 'tree', 'kanban', 'timeline'].includes(stored)) {
      return stored as ViewMode;
    }
  } catch {
    // Ignore errors
  }
  return 'tree';
};

const saveViewMode = (mode: ViewMode) => {
  try {
    localStorage.setItem('sidstack:viewMode', mode);
  } catch {
    // Ignore errors
  }
};

// ============================================================================
// Default filters
// ============================================================================

const defaultFilters: TaskFilters = {
  status: "all",
  projectId: "default",
  searchQuery: "",
};

// ============================================================================
// Store — UI state only
// ============================================================================

interface TaskStoreState {
  // UI State
  selectedTaskId: string | null;
  filters: TaskFilters;
  viewMode: ViewMode;
  expandedTasks: Set<string>;

  // Selection
  selectTask: (taskId: string | null) => void;

  // Filters
  setStatusFilter: (status: StatusFilter) => void;
  setProjectId: (projectId: string) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;

  // View Mode
  setViewMode: (mode: ViewMode) => void;
  isTreeView: boolean;
  toggleTreeView: () => void;

  // Expand/Collapse
  toggleExpanded: (taskId: string) => void;
  expandAllFor: (tasks: Task[]) => void;
  collapseAll: () => void;
  isExpanded: (taskId: string) => boolean;
}

export const useTaskStore = create<TaskStoreState>((set, get) => ({
  // Initial state
  selectedTaskId: null,
  filters: { ...defaultFilters },
  viewMode: loadViewMode(),
  expandedTasks: loadExpandedTasks(),

  // Legacy compatibility - computed from viewMode
  get isTreeView() {
    return get().viewMode === 'tree';
  },

  // Selection
  selectTask: (taskId) => {
    set({ selectedTaskId: taskId });
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

  expandAllFor: (tasks: Task[]) => {
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
}));
