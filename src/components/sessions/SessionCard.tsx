/**
 * Session Card Component
 *
 * Displays a single Claude session with status, metadata, and actions.
 */

import {
  Circle,
  CheckCircle,
  XCircle,
  StopCircle,
  Loader2,
  RotateCcw,
  ExternalLink,
  ListTodo,
  Box,
  Terminal,
  Trash2,
} from "lucide-react";
import React, { memo, useCallback, useMemo, useState, useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDuration, formatRelativeTime } from "@/lib/utils";
import type { ClaudeSession } from "@sidstack/shared";

interface SessionCardProps {
  session: ClaudeSession;
  compact?: boolean;
  selected?: boolean;
  onSelect: () => void;
  onResume: () => void;
  onTerminate: () => void;
  onDelete?: () => void;
  onViewDetails?: () => void;
  onNavigateToTask?: (taskId: string) => void;
}

// Uses CSS variables from index.css: --color-success, --color-warning, --color-error, --color-info
const statusIcons: Record<string, React.ReactNode> = {
  launching: <Loader2 className="w-4 h-4 animate-spin text-[var(--color-info)]" />,
  active: <Circle className="w-4 h-4 fill-[var(--color-success)] text-[var(--color-success)]" />,
  completed: <CheckCircle className="w-4 h-4 text-[var(--text-muted)]" />,
  error: <XCircle className="w-4 h-4 text-[var(--color-error)]" />,
  terminated: <StopCircle className="w-4 h-4 text-[var(--color-warning)]" />,
};

// formatDuration and formatRelativeTime imported from @/lib/utils

// rerender-memo: Memoize component to prevent unnecessary re-renders
export const SessionCard: React.FC<SessionCardProps> = memo(function SessionCard({
  session,
  compact = false,
  selected = false,
  onSelect,
  onResume,
  onTerminate,
  onDelete,
  onViewDetails,
  onNavigateToTask,
}) {
  // For active sessions, update duration every 30 seconds instead of every render
  const [now, setNow] = useState(() => Date.now());
  const isActive = session.status === "active" || session.status === "launching";

  useEffect(() => {
    if (!isActive || session.endedAt) return;

    // Update every 30 seconds for active sessions
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 30000);

    return () => clearInterval(interval);
  }, [isActive, session.endedAt]);

  // js-cache-function-results: Memoize computed values
  const duration = useMemo(() =>
    session.endedAt
      ? formatDuration(session.endedAt - session.startedAt)
      : formatDuration(now - session.startedAt),
    [session.endedAt, session.startedAt, now]
  );

  const promptPreview = useMemo(() =>
    session.initialPrompt?.slice(0, 50) || "No prompt",
    [session.initialPrompt]
  );

  // rerender-functional-setstate: Stable callback refs
  const handleResumeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onResume();
  }, [onResume]);

  const handleTerminateClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onTerminate();
  }, [onTerminate]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  }, [onDelete]);

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "p-3 hover:bg-[var(--surface-2)] cursor-pointer transition-colors",
        selected && "bg-[var(--surface-2)]"
      )}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect?.(); } }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        {statusIcons[session.status] || statusIcons.launching}
        <span className="font-medium truncate flex-1 text-sm">
          {promptPreview}
          {session.initialPrompt && session.initialPrompt.length > 50 && "..."}
        </span>
        <Badge variant="outline" className="text-xs shrink-0">
          <Terminal className="w-3 h-3 mr-1" />
          {session.terminal}
        </Badge>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 mt-1.5 text-xs text-[var(--text-muted)] flex-wrap">
        {session.taskId && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigateToTask?.(session.taskId!);
            }}
            className={cn(
              "flex items-center gap-1",
              onNavigateToTask && "hover:text-[var(--accent-primary)] cursor-pointer transition-colors"
            )}
            title="View task in Task Manager"
          >
            <ListTodo className="w-3 h-3" />
            {session.taskId.slice(0, 12)}...
          </button>
        )}
        {session.moduleId && (
          <span className="flex items-center gap-1">
            <Box className="w-3 h-3" />
            {session.moduleId}
          </span>
        )}
        <span>{duration}</span>
        <span>{formatRelativeTime(session.startedAt)}</span>
        {session.launchMode !== "normal" && (
          <Badge variant="secondary" className="text-xs">
            {session.launchMode}
          </Badge>
        )}
      </div>

      {/* Error message */}
      {session.errorMessage && (
        <div className="text-xs text-[var(--color-error)] mt-1.5 truncate">
          Error: {session.errorMessage}
        </div>
      )}

      {/* Actions row (on hover or selected) */}
      {(selected || !compact) && (
        <div className="flex gap-2 mt-2">
          {session.canResume && session.status !== "active" && session.status !== "launching" && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleResumeClick}
              className="h-7 text-xs"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Resume
            </Button>
          )}
          {(session.status === "active" || session.status === "launching") && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleTerminateClick}
              className="h-7 text-xs"
            >
              <StopCircle className="w-3 h-3 mr-1" />
              Terminate
            </Button>
          )}
          {onViewDetails && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails();
              }}
              className="h-7 text-xs"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              Details
            </Button>
          )}
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDeleteClick}
              className="h-7 text-xs text-[var(--color-error)] hover:opacity-80"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
});

export default SessionCard;
