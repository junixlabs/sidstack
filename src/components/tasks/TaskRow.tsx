import { ChevronRight, ChevronDown, MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Task } from "@/stores/taskStore";

import { StatusIcon, TaskTypeBadge, PriorityDot, TimeAge } from "./badges";

interface TaskRowProps {
  task: Task;
  isSelected: boolean;
  onSelect: () => void;
  depth: number;
  hasChildren: boolean;
  isExpanded?: boolean;
  isEpic?: boolean;
  childCount?: number;
  isLast?: boolean;
  onToggleExpand?: () => void;
  onContextMenu?: (task: Task, event: React.MouseEvent) => void;
}

export function TaskRow({
  task,
  isSelected,
  onSelect,
  depth,
  hasChildren,
  isExpanded = false,
  isEpic = false,
  childCount = 0,
  isLast = false,
  onToggleExpand,
  onContextMenu,
}: TaskRowProps) {
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu?.(task, e);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
      onContextMenu={handleContextMenu}
      className={cn(
        "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors",
        isEpic && "bg-blue-500/5 border-l-2 border-blue-500/50",
        isSelected
          ? "bg-[var(--surface-3)] border-l-2 border-[var(--border-emphasis)]"
          : "hover:bg-[var(--surface-2)]"
      )}
      style={{ paddingLeft: `${12 + depth * 24}px` }}
    >
      {/* Expand/Collapse button */}
      {hasChildren ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand?.();
          }}
          className="w-4 h-4 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
      ) : depth > 0 ? (
        // Tree line connector for subtasks - CSS based
        <span className="w-4 h-4 relative flex items-center justify-center">
          {/* Vertical line */}
          <span
            className="absolute left-1/2 -translate-x-1/2 w-px bg-[var(--border-muted)]"
            style={{ top: '-8px', height: isLast ? '12px' : '20px' }}
          />
          {/* Horizontal line */}
          <span className="absolute top-1/2 -translate-y-1/2 right-0 w-2 h-px bg-[var(--border-muted)]" />
        </span>
      ) : (
        <span className="w-4" />
      )}

      {/* Status icon */}
      <StatusIcon status={task.status} />

      {/* Task type badge (with icon for epics) */}
      {task.taskType && (
        <TaskTypeBadge taskType={task.taskType} showIcon={isEpic} />
      )}

      {/* Title */}
      <span
        className={cn(
          "flex-1 truncate text-sm text-[var(--text-primary)]",
          isEpic && "font-semibold"
        )}
      >
        {task.title}
      </span>

      {/* Collapsed child count */}
      {hasChildren && !isExpanded && childCount > 0 && (
        <span className="text-xs text-[var(--text-muted)] flex-shrink-0">
          ({childCount})
        </span>
      )}

      {/* Progress bar - show for all tasks with progress */}
      {task.progress > 0 && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div
            className="w-12 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={task.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Task progress: ${task.progress}%`}
          >
            <div
              className="h-full transition-all rounded-full"
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
          <span className="text-[10px] text-[var(--text-muted)] w-7 text-right tabular-nums">
            {task.progress}%
          </span>
        </div>
      )}

      {/* Assigned agent */}
      {task.assignedAgent && (
        <span className="text-[10px] px-1.5 py-0.5 bg-sky-500/20 text-sky-300 rounded border border-sky-500/30 flex-shrink-0">
          @{task.assignedAgent}
        </span>
      )}

      {/* Priority dot */}
      <PriorityDot priority={task.priority} />

      {/* Time age */}
      <TimeAge timestamp={task.createdAt} className="flex-shrink-0 w-8 text-right" />

      {/* Context menu trigger (visible on hover) */}
      {onContextMenu && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(task, e);
          }}
          className="w-5 h-5 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)] flex-shrink-0"
          title="More actions"
          aria-label="More actions"
          aria-haspopup="menu"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
