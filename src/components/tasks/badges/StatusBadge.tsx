import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/stores/taskStore";

interface StatusBadgeProps {
  status: TaskStatus;
  small?: boolean;
}

const STATUS_CONFIG: Record<TaskStatus, { bgVar: string; textVar: string; label: string }> = {
  pending:     { bgVar: "var(--surface-2)", textVar: "var(--status-pending)",     label: "Pending" },
  in_progress: { bgVar: "var(--surface-3)", textVar: "var(--status-in-progress)", label: "In Progress" },
  completed:   { bgVar: "var(--surface-2)", textVar: "var(--status-completed)",   label: "Completed" },
  blocked:     { bgVar: "var(--surface-3)", textVar: "var(--status-blocked)",     label: "Blocked" },
  failed:      { bgVar: "var(--surface-3)", textVar: "var(--status-failed)",      label: "Failed" },
  cancelled:   { bgVar: "var(--surface-2)", textVar: "var(--status-cancelled)",   label: "Cancelled" },
};

export function StatusBadge({ status, small = false }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "rounded",
        small ? "text-[11px] px-1 py-0.5" : "text-xs px-1.5 py-0.5"
      )}
      style={{
        backgroundColor: config.bgVar,
        color: config.textVar,
      }}
    >
      {config.label}
    </span>
  );
}
