/**
 * SpecTasksBadge
 *
 * Badge showing task count for a spec.
 * Click to navigate to progress view filtered by spec.
 */

import { Users } from "lucide-react";
import { useState, useEffect } from "react";

import { cn } from "@/lib/utils";
import { useUnifiedContextStore } from "@/stores/unifiedContextStore";

interface SpecTasksBadgeProps {
  specPath: string;
  className?: string;
}

export function SpecTasksBadge({ specPath, className }: SpecTasksBadgeProps) {
  const { loadTasksForSpec, navigateTo, specTasksCache } =
    useUnifiedContextStore();
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check cache first
    if (specTasksCache.has(specPath)) {
      setTaskIds(specTasksCache.get(specPath)!);
      return;
    }

    // Load from API
    setLoading(true);
    loadTasksForSpec(specPath)
      .then(setTaskIds)
      .finally(() => setLoading(false));
  }, [specPath, loadTasksForSpec, specTasksCache]);

  if (loading) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-muted animate-pulse",
          className
        )}
      >
        <Users className="w-3 h-3" />
        ...
      </span>
    );
  }

  if (taskIds.length === 0) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigateTo({ type: "progress", taskId: taskIds[0] });
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded",
        "bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)] transition-colors",
        className
      )}
      title={`${taskIds.length} task(s) linked to this spec`}
    >
      <Users className="w-3 h-3" />
      {taskIds.length} active
    </button>
  );
}

export default SpecTasksBadge;
