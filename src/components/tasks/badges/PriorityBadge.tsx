import { cn } from "@/lib/utils";
import type { TaskPriority } from "@/stores/taskStore";

interface PriorityBadgeProps {
  priority: TaskPriority;
  showLow?: boolean;
}

const PRIORITY_CONFIG: Record<TaskPriority, { bgVar: string; textVar: string; label: string }> = {
  high:   { bgVar: "var(--priority-high-bg)",   textVar: "var(--priority-high)",   label: "HIGH" },
  medium: { bgVar: "var(--priority-medium-bg)", textVar: "var(--priority-medium)", label: "MED" },
  low:    { bgVar: "var(--priority-low-bg)",    textVar: "var(--priority-low)",    label: "LOW" },
};

export function PriorityBadge({ priority, showLow = false }: PriorityBadgeProps) {
  // Don't show badge for low priority unless explicitly requested
  if (priority === "low" && !showLow) return null;

  const config = PRIORITY_CONFIG[priority];

  return (
    <span
      className={cn("text-[11px] px-1 py-0.5 rounded font-medium flex-shrink-0")}
      style={{ backgroundColor: config.bgVar, color: config.textVar }}
    >
      {config.label}
    </span>
  );
}
