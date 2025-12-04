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

export function PriorityDot({ priority, showLow = false, className }: PriorityDotProps) {
  // Don't show for low priority unless explicitly requested
  if (priority === "low" && !showLow) return null;

  const config = PRIORITY_CONFIG[priority];

  return (
    <span
      className={cn("w-2 h-2 rounded-full ring-2 flex-shrink-0", className)}
      style={{
        backgroundColor: config.colorVar,
        boxShadow: `0 0 0 2px color-mix(in srgb, ${config.colorVar} 30%, transparent)`,
      }}
      title={config.label}
      aria-label={config.label}
    />
  );
}
