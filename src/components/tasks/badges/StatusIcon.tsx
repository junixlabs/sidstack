import {
  Circle,
  PlayCircle,
  CheckCircle2,
  PauseCircle,
  XCircle,
  MinusCircle,
} from "lucide-react";
import { type ReactNode } from "react";

import type { TaskStatus } from "@/stores/taskStore";

interface StatusIconProps {
  status: TaskStatus;
  className?: string;
}

const STATUS_ICON_MAP: Record<TaskStatus, { icon: (className: string) => ReactNode; colorVar: string }> = {
  pending:     { icon: (c) => <Circle className={c} />, colorVar: "var(--status-pending)" },
  in_progress: { icon: (c) => <PlayCircle className={c} />, colorVar: "var(--status-in-progress)" },
  completed:   { icon: (c) => <CheckCircle2 className={c} />, colorVar: "var(--status-completed)" },
  blocked:     { icon: (c) => <PauseCircle className={c} />, colorVar: "var(--status-blocked)" },
  failed:      { icon: (c) => <XCircle className={c} />, colorVar: "var(--status-failed)" },
  cancelled:   { icon: (c) => <MinusCircle className={c} />, colorVar: "var(--status-cancelled)" },
};

export function StatusIcon({ status, className = "w-4 h-4" }: StatusIconProps) {
  const { icon, colorVar } = STATUS_ICON_MAP[status];
  return (
    <span className="flex-shrink-0" style={{ color: colorVar }}>
      {icon(className)}
    </span>
  );
}
