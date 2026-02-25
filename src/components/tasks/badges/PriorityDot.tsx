import { cn } from "@/lib/utils";
import type { TaskPriority } from "@/stores/taskStore";

interface PriorityDotProps {
  priority: TaskPriority;
  showLow?: boolean;
  className?: string;
}

const PRIORITY_CONFIG: Record<TaskPriority, { colorVar: string; label: string }> = {
  high:   { colorVar: "var(--priority-high)",   label: "High priority" },
  medium: { colorVar: "var(--priority-medium)", label: "Medium priority" },
  low:    { colorVar: "var(--priority-low)",    label: "Low priority" },
};

export function PriorityDot({ priority, showLow = true, className }: PriorityDotProps) {
  if (priority === "low" && !showLow) return null;

  const config = PRIORITY_CONFIG[priority];

  return (
    <span
      className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", className)}
      style={{ backgroundColor: config.colorVar }}
      title={config.label}
      aria-label={config.label}
    />
  );
}
