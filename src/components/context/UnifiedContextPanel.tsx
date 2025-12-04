/**
 * UnifiedContextPanel
 *
 * Main panel showing all context for the active task:
 * - Task progress
 * - Linked specs
 * - Linked knowledge
 * - Auto-link suggestions
 * - Recent activity
 */

import {
  ChevronDown,
  ChevronRight,
  Target,
  Clock,
  Activity,
} from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/utils";
import { useUnifiedContextStore } from "@/stores/unifiedContextStore";

import { LinkedKnowledgeSection } from "./LinkedKnowledgeSection";
import { LinkedSpecsSection } from "./LinkedSpecsSection";
import { SuggestionsSection } from "./SuggestionsSection";


interface Task {
  id: string;
  title: string;
  status: string;
  progress: number;
}

interface UnifiedContextPanelProps {
  task?: Task | null;
  className?: string;
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  onAddSpec?: () => void;
  onAddKnowledge?: () => void;
}

export function UnifiedContextPanel({
  task,
  className,
  collapsed = false,
  onCollapse,
  onAddSpec,
  onAddKnowledge,
}: UnifiedContextPanelProps) {
  const {
    specLinks,
    knowledgeLinks,
    setActiveTask,
    isLoading,
    error,
  } = useUnifiedContextStore();

  // Sync active task with store
  useEffect(() => {
    if (task?.id) {
      setActiveTask(task.id);
    }
  }, [task?.id, setActiveTask]);

  // Collapsed view
  if (collapsed) {
    return (
      <button
        onClick={() => onCollapse?.(false)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 bg-surface-1 border rounded-lg hover:bg-accent/50 transition-colors",
          className
        )}
      >
        <ChevronRight className="w-4 h-4" />
        {task ? (
          <>
            <span className="text-sm font-medium truncate max-w-[150px]">
              {task.title}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                {specLinks.length}
              </span>
              <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-500 rounded">
                {knowledgeLinks.length}
              </span>
            </span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">No active task</span>
        )}
      </button>
    );
  }

  // No task selected
  if (!task) {
    return (
      <div
        className={cn(
          "flex flex-col h-full bg-surface-1 border rounded-lg p-4",
          className
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Target className="w-4 h-4" />
            Context
          </h3>
          {onCollapse && (
            <button
              onClick={() => onCollapse(true)}
              className="p-1 rounded hover:bg-accent transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground text-center py-8">
          Select a task to view context
        </p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-500";
      case "in_progress":
        return "text-blue-500";
      case "blocked":
        return "text-red-500";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-surface-1 border rounded-lg overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-accent/20">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold truncate">{task.title}</h3>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={cn(
                "text-xs font-medium capitalize",
                getStatusColor(task.status)
              )}
            >
              {task.status.replace("_", " ")}
            </span>
          </div>
        </div>
        {onCollapse && (
          <button
            onClick={() => onCollapse(true)}
            className="p-1 rounded hover:bg-accent transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2 border-b">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{task.progress}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${task.progress}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Error */}
        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
            {error}
          </div>
        )}

        {/* Linked Specs */}
        <LinkedSpecsSection taskId={task.id} onAddSpec={onAddSpec} />

        {/* Linked Knowledge */}
        <LinkedKnowledgeSection
          taskId={task.id}
          onAddKnowledge={onAddKnowledge}
        />

        {/* Suggestions */}
        <SuggestionsSection />
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t bg-accent/10 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Updated just now
          </span>
          {isLoading && (
            <span className="flex items-center gap-1 animate-pulse">
              <Activity className="w-3 h-3" />
              Syncing...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default UnifiedContextPanel;
