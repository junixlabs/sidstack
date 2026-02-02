/**
 * KanbanBoard Component
 *
 * Displays tasks in a Kanban-style board with columns for each status.
 * Optimized for PM workflow visibility.
 */

import { Clock, GitBranch, User } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/stores/taskStore";

import { TaskTypeBadge, PriorityDot } from "./badges";

interface KanbanBoardProps {
  tasksByStatus: Record<TaskStatus, Task[]>;
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onContextMenu?: (task: Task, event: React.MouseEvent) => void;
}

// Column configuration - order and display settings
const COLUMN_CONFIG: Array<{
  status: TaskStatus;
  label: string;
  bgVar: string;
  textVar: string;
  borderVar: string;
  emptyMessage: string;
}> = [
  {
    status: "pending",
    label: "Pending",
    bgVar: "var(--kanban-pending)",
    textVar: "var(--kanban-pending-text)",
    borderVar: "var(--kanban-pending-border)",
    emptyMessage: "No pending tasks",
  },
  {
    status: "in_progress",
    label: "In Progress",
    bgVar: "var(--kanban-in-progress)",
    textVar: "var(--kanban-in-progress-text)",
    borderVar: "var(--kanban-in-progress-border)",
    emptyMessage: "No active tasks",
  },
  {
    status: "blocked",
    label: "Blocked",
    bgVar: "var(--kanban-blocked)",
    textVar: "var(--kanban-blocked-text)",
    borderVar: "var(--kanban-blocked-border)",
    emptyMessage: "No blocked tasks",
  },
  {
    status: "completed",
    label: "Completed",
    bgVar: "var(--kanban-completed)",
    textVar: "var(--kanban-completed-text)",
    borderVar: "var(--kanban-completed-border)",
    emptyMessage: "No completed tasks",
  },
];

// Hidden columns (collapsed by default, can be expanded)
const HIDDEN_STATUSES: TaskStatus[] = ["failed", "cancelled"];

export function KanbanBoard({
  tasksByStatus,
  selectedTaskId,
  onSelectTask,
  onContextMenu,
}: KanbanBoardProps) {
  // Count hidden tasks
  const hiddenCount = HIDDEN_STATUSES.reduce(
    (acc, status) => acc + tasksByStatus[status].length,
    0
  );

  return (
    <div className="flex flex-col h-full">
      {/* Main board */}
      <div className="flex-1 flex gap-3 overflow-x-auto pb-2">
        {COLUMN_CONFIG.map((column) => (
          <KanbanColumn
            key={column.status}
            status={column.status}
            label={column.label}
            bgVar={column.bgVar}
            textVar={column.textVar}
            borderVar={column.borderVar}
            emptyMessage={column.emptyMessage}
            tasks={tasksByStatus[column.status]}
            selectedTaskId={selectedTaskId}
            onSelectTask={onSelectTask}
            onContextMenu={onContextMenu}
          />
        ))}
      </div>

      {/* Hidden tasks indicator */}
      {hiddenCount > 0 && (
        <div className="mt-2 pt-2 border-t border-[var(--border-muted)]">
          <span className="text-xs text-[var(--text-muted)]">
            +{hiddenCount} hidden ({HIDDEN_STATUSES.join(", ")})
          </span>
        </div>
      )}
    </div>
  );
}

// Column component
interface KanbanColumnProps {
  status: TaskStatus;
  label: string;
  bgVar: string;
  textVar: string;
  borderVar: string;
  emptyMessage: string;
  tasks: Task[];
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onContextMenu?: (task: Task, event: React.MouseEvent) => void;
}

function KanbanColumn({
  status: _status,
  label,
  bgVar,
  textVar,
  borderVar,
  emptyMessage,
  tasks,
  selectedTaskId,
  onSelectTask,
  onContextMenu,
}: KanbanColumnProps) {
  return (
    <div className="flex-shrink-0 w-72 flex flex-col bg-[var(--surface-0)] rounded-lg border border-[var(--border-muted)]">
      {/* Column header */}
      <div
        className="px-3 py-2 rounded-t-lg border-b flex items-center justify-between"
        style={{
          backgroundColor: bgVar,
          color: textVar,
          borderColor: borderVar,
        }}
      >
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs opacity-70">{tasks.length}</span>
      </div>

      {/* Cards container */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px]">
        {tasks.length === 0 ? (
          <div className="text-xs text-[var(--text-muted)] text-center py-8">
            {emptyMessage}
          </div>
        ) : (
          tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              isSelected={task.id === selectedTaskId}
              onSelect={() => onSelectTask(task.id)}
              onContextMenu={onContextMenu}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Card component
interface KanbanCardProps {
  task: Task;
  isSelected: boolean;
  onSelect: () => void;
  onContextMenu?: (task: Task, event: React.MouseEvent) => void;
}

function KanbanCard({ task, isSelected, onSelect, onContextMenu }: KanbanCardProps) {
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu?.(task, e);
  };

  // Check if epic (has subtasks)
  const isEpic = !task.parentTaskId;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
      onContextMenu={handleContextMenu}
      className={cn(
        "p-2.5 rounded-md cursor-pointer transition-all border",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]",
        isSelected
          ? "bg-[var(--surface-3)] border-[var(--border-emphasis)] ring-1 ring-[var(--border-emphasis)]"
          : "bg-[var(--surface-1)] border-[var(--border-muted)] hover:bg-[var(--surface-2)] hover:border-[var(--border-default)]",
        isEpic && "border-l-2 border-l-[var(--accent-primary)]/50"
      )}
    >
      {/* Top row: Type + Priority */}
      <div className="flex items-center gap-1.5 mb-1.5">
        {task.taskType && <TaskTypeBadge taskType={task.taskType} />}
        <div className="flex-1" />
        <PriorityDot priority={task.priority} />
      </div>

      {/* Title */}
      <div className="text-sm text-[var(--text-primary)] line-clamp-2 mb-2">
        {task.title}
      </div>

      {/* Progress bar (if any) */}
      {task.progress > 0 && (
        <div className="mb-2">
          <div
            className="h-1 bg-[var(--surface-3)] rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={task.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Task progress: ${task.progress}%`}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${task.progress}%`,
                backgroundColor:
                  task.status === "completed"
                    ? "var(--status-completed)"
                    : task.status === "in_progress"
                    ? "var(--status-in-progress)"
                    : "var(--text-muted)",
              }}
            />
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5 text-right">
            {task.progress}%
          </div>
        </div>
      )}

      {/* Bottom row: Agent + Branch + Time */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {task.assignedAgent && (
          <span className="text-[11px] px-1.5 py-0.5 bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] rounded border border-[var(--accent-primary)]/30 flex items-center gap-0.5">
            <User className="w-2.5 h-2.5" />
            {task.assignedAgent}
          </span>
        )}
        {task.branch && (
          <span className="text-[11px] px-1.5 py-0.5 bg-purple-500/15 text-purple-400 rounded border border-purple-500/25 flex items-center gap-0.5" title={`Branch: ${task.branch}`}>
            <GitBranch className="w-2.5 h-2.5" />
            {task.branch.length > 12 ? `${task.branch.substring(0, 12)}...` : task.branch}
          </span>
        )}

        <div className="flex-1" />

        <span
          className="text-[11px] text-[var(--text-muted)] flex items-center gap-0.5"
          title={new Date(task.updatedAt).toLocaleString()}
        >
          <Clock className="w-2.5 h-2.5" />
          {formatTimeAgo(task.updatedAt)}
        </span>
      </div>
    </div>
  );
}

// Simple time ago formatter
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return "now";
}
