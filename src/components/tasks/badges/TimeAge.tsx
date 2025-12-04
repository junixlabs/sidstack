import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";

interface TimeAgeProps {
  timestamp: number;
  className?: string;
  showIcon?: boolean;
}

/**
 * Format a timestamp into a relative time string
 */
function formatTimeAge(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (months > 0) {
    return `${months}mo`;
  }
  if (weeks > 0) {
    return `${weeks}w`;
  }
  if (days > 0) {
    return `${days}d`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return "now";
}

export function TimeAge({ timestamp, className, showIcon = false }: TimeAgeProps) {
  const age = formatTimeAge(timestamp);
  const fullDate = new Date(timestamp).toLocaleString();

  return (
    <span
      className={cn(
        "text-[11px] text-[var(--text-muted)] tabular-nums",
        className
      )}
      title={fullDate}
    >
      {showIcon && <Clock className="w-2.5 h-2.5 inline mr-0.5" />}
      {age}
    </span>
  );
}

// Export utility for use elsewhere
export { formatTimeAge };
