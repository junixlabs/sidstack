/**
 * TimelineView Component
 *
 * Displays epics/milestones with their subtasks and progress.
 * Roadmap-style view for PM visibility.
 */

import { CheckCircle2, Circle, Target } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Task } from "@/stores/taskStore";

import { StatusIcon, TaskTypeBadge, PriorityDot, StatusBadge } from "./badges";

interface EpicWithProgress {
  task: Task;
  subtasks: Task[];
  progress: number;
}

interface TimelineViewProps {
  epicsWithProgress: EpicWithProgress[];
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onContextMenu?: (task: Task, event: React.MouseEvent) => void;
}

export function TimelineView({
  epicsWithProgress,
  selectedTaskId,
  onSelectTask,
  onContextMenu,
}: TimelineViewProps) {
  if (epicsWithProgress.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
        <Target className="w-12 h-12 mb-3 opacity-30" />
        <p>No epics found</p>
        <p className="text-xs mt-1">
          Epics are parent tasks with subtasks
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {epicsWithProgress.map((epic) => (
        <EpicCard
          key={epic.task.id}
          epic={epic}
          isSelected={epic.task.id === selectedTaskId}
          selectedSubtaskId={selectedTaskId}
          onSelectTask={onSelectTask}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}

interface EpicCardProps {
  epic: EpicWithProgress;
  isSelected: boolean;
  selectedSubtaskId: string | null;
  onSelectTask: (id: string) => void;
  onContextMenu?: (task: Task, event: React.MouseEvent) => void;
}

function EpicCard({
  epic,
  isSelected,
  selectedSubtaskId,
  onSelectTask,
  onContextMenu,
}: EpicCardProps) {
  const { task, subtasks, progress } = epic;
  const completedCount = subtasks.filter((s) => s.status === "completed").length;
  const inProgressCount = subtasks.filter((s) => s.status === "in_progress").length;
  const blockedCount = subtasks.filter((s) => s.status === "blocked").length;

  const handleContextMenu = (t: Task, e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu?.(t, e);
  };

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden",
        isSelected
          ? "border-[var(--border-emphasis)] ring-1 ring-[var(--border-emphasis)]"
          : "border-[var(--border-muted)]"
      )}
    >
      {/* Epic header */}
      <div
        onClick={() => onSelectTask(task.id)}
        onContextMenu={(e) => handleContextMenu(task, e)}
        className={cn(
          "px-4 py-3 cursor-pointer transition-colors",
          "bg-[var(--surface-1)] border-l-2 border-l-[var(--status-in-progress)]",
          "hover:bg-[var(--surface-2)]"
        )}
      >
        <div className="flex items-center gap-3">
          <StatusIcon status={task.status} className="w-5 h-5" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {task.taskType && <TaskTypeBadge taskType={task.taskType} showIcon />}
              <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                {task.title}
              </h3>
              <PriorityDot priority={task.priority} />
            </div>

            {task.description && (
              <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-1">
                {task.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Progress indicator */}
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {progress}%
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">
                {completedCount}/{subtasks.length} completed
              </span>
            </div>

            {/* Progress ring */}
            <div className="relative w-10 h-10" aria-hidden="true">
              <svg className="w-10 h-10 -rotate-90">
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  strokeWidth="3"
                  fill="none"
                  className="stroke-[var(--surface-3)]"
                />
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  style={{
                    stroke:
                      task.status === "completed"
                        ? "var(--status-completed)"
                        : "var(--status-in-progress)",
                  }}
                  strokeDasharray={`${(progress / 100) * 100.53} 100.53`}
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div
          className="mt-3 h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Epic progress: ${progress}%`}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${progress}%`,
              backgroundColor:
                task.status === "completed"
                  ? "var(--status-completed)"
                  : "var(--status-in-progress)",
            }}
          />
        </div>

        {/* Summary badges */}
        <div className="mt-2 flex items-center gap-2 text-[10px]">
          {inProgressCount > 0 && (
            <span className="px-1.5 py-0.5 bg-[var(--color-info)]/20 text-[var(--color-info)] rounded">
              {inProgressCount} in progress
            </span>
          )}
          {blockedCount > 0 && (
            <span className="px-1.5 py-0.5 bg-[var(--color-warning)]/20 text-[var(--color-warning)] rounded">
              {blockedCount} blocked
            </span>
          )}
        </div>
      </div>

      {/* Subtasks */}
      {subtasks.length > 0 && (
        <div className="border-t border-[var(--border-muted)] bg-[var(--surface-0)]">
          {subtasks.map((subtask, index) => (
            <div
              key={subtask.id}
              onClick={() => onSelectTask(subtask.id)}
              onContextMenu={(e) => handleContextMenu(subtask, e)}
              className={cn(
                "flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors",
                "border-b border-[var(--border-muted)] last:border-b-0",
                selectedSubtaskId === subtask.id
                  ? "bg-[var(--surface-3)]"
                  : "hover:bg-[var(--surface-1)]"
              )}
            >
              {/* Timeline connector */}
              <div className="relative flex items-center justify-center w-4">
                {/* Vertical line */}
                <span
                  className={cn(
                    "absolute left-1/2 -translate-x-1/2 w-px bg-[var(--border-muted)]",
                    index === 0 ? "top-1/2 h-1/2" : index === subtasks.length - 1 ? "bottom-1/2 h-1/2" : "h-full"
                  )}
                />
                {/* Status dot */}
                {subtask.status === "completed" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)] relative z-10 bg-[var(--surface-0)]" />
                ) : subtask.status === "in_progress" ? (
                  <Circle className="w-3.5 h-3.5 text-[var(--color-info)] relative z-10 bg-[var(--surface-0)] fill-[var(--color-info)]" />
                ) : subtask.status === "blocked" ? (
                  <Circle className="w-3.5 h-3.5 text-[var(--color-warning)] relative z-10 bg-[var(--surface-0)]" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-[var(--text-muted)] relative z-10 bg-[var(--surface-0)]" />
                )}
              </div>

              {/* Subtask content */}
              <div className="flex-1 min-w-0 flex items-center gap-2">
                {subtask.taskType && <TaskTypeBadge taskType={subtask.taskType} />}
                <span
                  className={cn(
                    "text-sm truncate",
                    subtask.status === "completed"
                      ? "text-[var(--text-muted)] line-through"
                      : "text-[var(--text-primary)]"
                  )}
                >
                  {subtask.title}
                </span>
              </div>

              {/* Progress */}
              {subtask.progress > 0 && subtask.status !== "completed" && (
                <span className="text-[10px] text-[var(--text-muted)]">
                  {subtask.progress}%
                </span>
              )}

              {/* Assigned */}
              {subtask.assignedAgent && (
                <span className="text-[10px] px-1.5 py-0.5 bg-sky-500/20 text-sky-300 rounded">
                  @{subtask.assignedAgent}
                </span>
              )}

              <PriorityDot priority={subtask.priority} />

              <StatusBadge status={subtask.status} small />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
