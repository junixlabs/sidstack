/**
 * LocalTaskBrowser (⌘2) - SidStack Task Management
 * Orchestrator tasks with hierarchy, priority, agent assignment
 */

import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Filter,
  LayoutGrid,
  Loader2,
  PauseCircle,
  RefreshCw,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";

// =============================================================================
// TYPES
// =============================================================================

interface SidStackTask {
  id: string;
  projectId: string;
  parentTaskId?: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "blocked" | "failed" | "cancelled";
  priority: "low" | "medium" | "high";
  assignedAgent?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  progress: number;
  notes?: string;
  subtasks?: SidStackTask[];
}

interface LocalTaskBrowserProps {
  isDark?: boolean;
  className?: string;
}

type StatusFilter = "all" | "pending" | "in_progress" | "completed" | "blocked";
type PriorityFilter = "all" | "high" | "medium" | "low";

// =============================================================================
// API HELPERS
// =============================================================================

const API_BASE = "http://127.0.0.1:19432";

async function fetchTasks(projectId: string = "default"): Promise<SidStackTask[]> {
  const url = `${API_BASE}/api/tasks?projectId=${projectId}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch tasks");
    const data = await res.json();
    return data.tasks || [];
  } catch (err) {
    console.error("[fetchTasks] Error:", err);
    return [];
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function LocalTaskBrowser({ isDark = true, className }: LocalTaskBrowserProps) {
  const { projectPath } = useAppStore();
  const [activeTab, setActiveTabLocal] = useState<"tasks" | "sessions">("tasks");

  // SidStack Tasks state
  const [tasks, setTasks] = useState<SidStackTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Fetch SidStack tasks
  const fetchTasksData = useCallback(async () => {
    setTasksLoading(true);
    try {
      const projectId = projectPath?.split("/").pop() || "default";
      const result = await fetchTasks(projectId);
      setTasks(result);
    } catch (err) {
      console.error("[TaskBrowser] Failed to fetch tasks:", err);
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    fetchTasksData();
  }, [fetchTasksData]);

  const handleRefresh = () => {
    fetchTasksData();
  };

  // Build task hierarchy
  const buildTaskHierarchy = (tasks: SidStackTask[]): SidStackTask[] => {
    const taskMap = new Map<string, SidStackTask>();
    const rootTasks: SidStackTask[] = [];

    tasks.forEach((task) => taskMap.set(task.id, { ...task, subtasks: [] }));

    tasks.forEach((task) => {
      const taskWithSubtasks = taskMap.get(task.id)!;
      if (task.parentTaskId && taskMap.has(task.parentTaskId)) {
        taskMap.get(task.parentTaskId)!.subtasks!.push(taskWithSubtasks);
      } else {
        rootTasks.push(taskWithSubtasks);
      }
    });

    return rootTasks;
  };

  // Filter tasks
  const filteredTasks = buildTaskHierarchy(
    tasks.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      return true;
    })
  );

  // Calculate stats
  const taskStats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    blocked: tasks.filter((t) => t.status === "blocked").length,
  };

  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  // ==========================================================================
  // EMPTY STATE
  // ==========================================================================
  if (!projectPath) {
    return (
      <div className={cn("flex-1 flex items-center justify-center", isDark ? "bg-[var(--surface-0)]" : "bg-gray-50", className)}>
        <div className="text-center">
          <LayoutGrid className={cn("w-12 h-12 mx-auto mb-4", isDark ? "text-[var(--text-muted)]" : "text-[var(--text-muted)]")} strokeWidth={1} />
          <p className={cn("text-[13px]", isDark ? "text-[var(--text-muted)]" : "text-gray-500")}>Open a project to view tasks</p>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // MAIN VIEW
  // ==========================================================================
  return (
    <div className={cn("flex flex-col h-full", isDark ? "bg-[var(--surface-0)]" : "bg-gray-50", className)}>
      {/* Header */}
      <header className={cn("flex-none flex items-center justify-between px-4 py-3 border-b", isDark ? "border-[var(--border-muted)]" : "border-gray-200")}>
        <div className="flex items-center gap-3">
          <LayoutGrid className={cn("w-5 h-5", isDark ? "text-[var(--text-secondary)]" : "text-[var(--accent-primary)]")} />
          <h1 className={cn("text-[15px] font-semibold", isDark ? "text-[var(--text-primary)]" : "text-gray-900")}>Tasks</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={handleRefresh} disabled={tasksLoading}>
            <RefreshCw className={cn("w-4 h-4", tasksLoading && "animate-spin")} />
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTabLocal(v as "tasks" | "sessions")} className="flex-1 flex flex-col min-h-0">
        <div className={cn("flex-none px-4 border-b", isDark ? "border-[var(--border-default)]" : "border-gray-200")}>
          <TabsList className="h-10 bg-transparent p-0 gap-4">
            <TabsTrigger
              value="tasks"
              className={cn(
                "h-10 px-0 pb-0 rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--accent-primary-hover)] data-[state=active]:bg-transparent",
                isDark ? "text-[var(--text-muted)] data-[state=active]:text-[var(--text-primary)]" : "text-gray-500 data-[state=active]:text-gray-900"
              )}
            >
              <span className="flex items-center gap-2">
                Orchestrator
                <Badge variant="secondary" className="text-[11px] px-1.5">{taskStats.total}</Badge>
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="flex-1 flex flex-col min-h-0 m-0">
          {/* Stats bar */}
          <div className={cn("flex-none grid grid-cols-5 gap-2 p-3 border-b", isDark ? "border-[var(--border-default)]" : "border-gray-200")}>
            <MiniStat isDark={isDark} label="Total" value={taskStats.total} />
            <MiniStat isDark={isDark} label="Pending" value={taskStats.pending} color="gray" />
            <MiniStat isDark={isDark} label="In Progress" value={taskStats.inProgress} color="blue" />
            <MiniStat isDark={isDark} label="Completed" value={taskStats.completed} color="green" />
            <MiniStat isDark={isDark} label="Blocked" value={taskStats.blocked} color="red" />
          </div>

          {/* Filters */}
          <div className={cn("flex-none flex items-center gap-2 px-4 py-2 border-b", isDark ? "border-[var(--border-default)]" : "border-gray-200")}>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-[130px] h-7 text-[11px]">
                <Filter className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}>
              <SelectTrigger className="w-[120px] h-7 text-[11px]">
                <Zap className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Task List */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {tasksLoading ? (
                <LoadingState isDark={isDark} message="Loading tasks..." />
              ) : filteredTasks.length === 0 ? (
                <EmptyTasksState isDark={isDark} hasFilters={statusFilter !== "all" || priorityFilter !== "all"} />
              ) : (
                filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isDark={isDark}
                    isExpanded={expandedTasks.has(task.id)}
                    onToggle={() => toggleTaskExpanded(task.id)}
                    level={0}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

      </Tabs>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const MiniStat = memo(function MiniStat({ isDark, label, value, color }: { isDark: boolean; label: string; value: number; color?: string }) {
  const colorClasses = {
    gray: isDark ? "text-[var(--text-muted)]" : "text-gray-600",
    blue: "text-[var(--accent-primary)]",
    green: "text-[var(--color-success)]",
    red: "text-[var(--color-error)]",
  };

  return (
    <div className={cn("text-center px-2 py-1.5 rounded", isDark ? "bg-[var(--surface-1)]" : "bg-white")}>
      <div className={cn("text-lg font-bold tabular-nums", color ? colorClasses[color as keyof typeof colorClasses] : (isDark ? "text-[var(--text-primary)]" : "text-gray-900"))}>
        {value}
      </div>
      <div className={cn("text-[11px] uppercase tracking-wider", isDark ? "text-[var(--text-muted)]" : "text-gray-500")}>{label}</div>
    </div>
  );
});

const LoadingState = memo(function LoadingState({ isDark, message }: { isDark: boolean; message: string }) {
  return (
    <div className={cn("flex items-center justify-center py-12 text-[13px]", isDark ? "text-[var(--text-muted)]" : "text-gray-500")}>
      <Loader2 className="w-4 h-4 animate-spin mr-2" />
      {message}
    </div>
  );
});

const EmptyTasksState = memo(function EmptyTasksState({ isDark, hasFilters }: { isDark: boolean; hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <LayoutGrid className={cn("w-12 h-12 mb-4", isDark ? "text-[var(--text-muted)]" : "text-[var(--text-muted)]")} strokeWidth={1} />
      <p className={cn("text-[13px] font-medium mb-1", isDark ? "text-[var(--text-primary)]" : "text-gray-900")}>
        {hasFilters ? "No Matching Tasks" : "No Tasks Yet"}
      </p>
      <p className={cn("text-[12px] text-center max-w-xs", isDark ? "text-[var(--text-muted)]" : "text-gray-500")}>
        {hasFilters ? "Try adjusting your filters" : "Create tasks via orchestrator or MCP tools"}
      </p>
    </div>
  );
});

interface TaskCardProps {
  task: SidStackTask;
  isDark: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  level: number;
}

const TaskCard = memo(function TaskCard({ task, isDark, isExpanded, onToggle, level }: TaskCardProps) {
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const StatusIcon = getStatusIcon(task.status);
  const statusColor = getStatusColor(task.status);
  const priorityColor = getPriorityColor(task.priority);

  return (
    <div style={{ marginLeft: level * 16 }}>
      <Card className={cn("overflow-hidden", isDark ? "bg-[var(--surface-1)] border-[var(--border-muted)]" : "bg-white border-gray-200")}>
        <button
          onClick={hasSubtasks ? onToggle : undefined}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
            hasSubtasks && (isDark ? "hover:bg-[var(--surface-2)]" : "hover:bg-gray-50"),
            !hasSubtasks && "cursor-default"
          )}
        >
          {/* Expand icon */}
          <div className="w-4 flex-shrink-0">
            {hasSubtasks ? (
              isExpanded ? (
                <ChevronDown className={cn("w-4 h-4", isDark ? "text-[var(--text-muted)]" : "text-gray-500")} />
              ) : (
                <ChevronRight className={cn("w-4 h-4", isDark ? "text-[var(--text-muted)]" : "text-gray-500")} />
              )
            ) : null}
          </div>

          {/* Status icon */}
          <StatusIcon className={cn("w-4 h-4 flex-shrink-0", statusColor, task.status === "in_progress" && "animate-spin")} />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn("text-[13px] font-medium truncate", isDark ? "text-[var(--text-primary)]" : "text-gray-900")}>{task.title}</span>
              <Badge variant={task.status === "completed" ? "success" : task.status === "in_progress" ? "primary" : task.status === "blocked" ? "destructive" : "secondary"} className="text-[11px] px-1.5">
                {task.status.replace("_", " ")}
              </Badge>
            </div>
            {task.description && (
              <p className={cn("text-[11px] truncate mt-0.5", isDark ? "text-[var(--text-muted)]" : "text-gray-500")}>{task.description}</p>
            )}
          </div>

          {/* Meta */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {task.assignedAgent && (
              <Badge variant="outline" className="text-[11px]">
                <Users className="w-2.5 h-2.5 mr-1" />
                {task.assignedAgent}
              </Badge>
            )}
            <Badge variant="outline" className={cn("text-[11px]", priorityColor)}>
              {task.priority}
            </Badge>
            {task.progress > 0 && task.progress < 100 && (
              <span className={cn("text-[11px]", isDark ? "text-[var(--text-muted)]" : "text-gray-500")}>{task.progress}%</span>
            )}
          </div>
        </button>

        {/* Subtasks */}
        {hasSubtasks && isExpanded && (
          <div className={cn("border-t px-2 py-2", isDark ? "border-[var(--border-default)] bg-[var(--surface-0)]/50" : "border-gray-100 bg-gray-50/50")}>
            {task.subtasks!.map((subtask) => (
              <TaskCard key={subtask.id} task={subtask} isDark={isDark} isExpanded={false} onToggle={() => {}} level={0} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
});

// =============================================================================
// HELPERS
// =============================================================================

function getStatusIcon(status: SidStackTask["status"]) {
  switch (status) {
    case "completed": return CheckCircle2;
    case "in_progress": return Loader2;
    case "blocked": return PauseCircle;
    case "failed": return XCircle;
    case "cancelled": return XCircle;
    default: return Circle;
  }
}

function getStatusColor(status: SidStackTask["status"]) {
  switch (status) {
    case "completed": return "text-[var(--text-secondary)]";
    case "in_progress": return "text-[var(--text-secondary)]";
    case "blocked": return "text-[var(--text-secondary)]";
    case "failed": return "text-[var(--text-secondary)]";
    case "cancelled": return "text-[var(--text-muted)]";
    default: return "text-[var(--text-muted)]";
  }
}

function getPriorityColor(priority: SidStackTask["priority"]) {
  switch (priority) {
    case "high": return "text-[var(--text-secondary)] border-[var(--border-default)]";
    case "medium": return "text-[var(--text-secondary)] border-[var(--border-default)]";
    case "low": return "text-[var(--text-muted)] border-[var(--border-default)]";
  }
}

export default LocalTaskBrowser;
