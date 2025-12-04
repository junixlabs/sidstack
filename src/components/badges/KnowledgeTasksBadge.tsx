/**
 * KnowledgeTasksBadge
 *
 * Badge showing task count for a knowledge document.
 * Click to navigate to progress view filtered by knowledge.
 */

import { Pin } from "lucide-react";
import { useState, useEffect } from "react";

import { cn } from "@/lib/utils";
import { useUnifiedContextStore } from "@/stores/unifiedContextStore";

interface KnowledgeTasksBadgeProps {
  knowledgePath: string;
  className?: string;
}

export function KnowledgeTasksBadge({
  knowledgePath,
  className,
}: KnowledgeTasksBadgeProps) {
  const { loadTasksForKnowledge, navigateTo, knowledgeTasksCache } =
    useUnifiedContextStore();
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check cache first
    if (knowledgeTasksCache.has(knowledgePath)) {
      setTaskIds(knowledgeTasksCache.get(knowledgePath)!);
      return;
    }

    // Load from API
    setLoading(true);
    loadTasksForKnowledge(knowledgePath)
      .then(setTaskIds)
      .finally(() => setLoading(false));
  }, [knowledgePath, loadTasksForKnowledge, knowledgeTasksCache]);

  if (loading) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-muted animate-pulse",
          className
        )}
      >
        <Pin className="w-3 h-3" />
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
        "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors",
        className
      )}
      title={`${taskIds.length} task(s) reference this document`}
    >
      <Pin className="w-3 h-3" />
      {taskIds.length} task{taskIds.length !== 1 ? "s" : ""}
    </button>
  );
}

export default KnowledgeTasksBadge;
