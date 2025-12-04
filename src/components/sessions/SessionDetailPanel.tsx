/**
 * Session Detail Panel
 *
 * Detailed view of a single Claude session with events, actions, and metadata.
 */

import {
  Circle,
  CheckCircle,
  XCircle,
  StopCircle,
  Loader2,
  Terminal,
  Clock,
  RotateCcw,
  Trash2,
  ListTodo,
  Box,
  Calendar,
  Play,
  Square,
  FileCode,
  MessageSquare,
  AlertTriangle,
  X,
} from "lucide-react";
import React, { memo, useEffect, useCallback, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatDuration, formatDateTime } from "@/lib/utils";
import { useClaudeSessionStore } from "@/stores/claudeSessionStore";

interface SessionDetailPanelProps {
  sessionId: string | null;
  onClose: () => void;
}

// Uses CSS variables from index.css: --color-success, --color-warning, --color-error, --color-info
const statusIcons: Record<string, React.ReactNode> = {
  launching: <Loader2 className="w-5 h-5 animate-spin text-[var(--color-info)]" />,
  active: <Circle className="w-5 h-5 fill-[var(--color-success)] text-[var(--color-success)]" />,
  completed: <CheckCircle className="w-5 h-5 text-[var(--text-muted)]" />,
  error: <XCircle className="w-5 h-5 text-[var(--color-error)]" />,
  terminated: <StopCircle className="w-5 h-5 text-[var(--color-warning)]" />,
};

const eventTypeIcons: Record<string, React.ReactNode> = {
  launched: <Play className="w-3 h-3 text-[var(--color-success)]" />,
  active: <Circle className="w-3 h-3 fill-[var(--color-success)] text-[var(--color-success)]" />,
  completed: <CheckCircle className="w-3 h-3 text-[var(--text-muted)]" />,
  error: <XCircle className="w-3 h-3 text-[var(--color-error)]" />,
  terminated: <StopCircle className="w-3 h-3 text-[var(--color-warning)]" />,
  resumed: <RotateCcw className="w-3 h-3 text-[var(--color-info)]" />,
  tool_call: <FileCode className="w-3 h-3 text-[var(--accent-primary)]" />,
  message: <MessageSquare className="w-3 h-3 text-[var(--color-info)]" />,
  warning: <AlertTriangle className="w-3 h-3 text-[var(--color-warning)]" />,
};

// formatDuration and formatDateTime imported from @/lib/utils

// rerender-memo: Memoize component to prevent unnecessary re-renders
export const SessionDetailPanel = memo(function SessionDetailPanel({
  sessionId,
  onClose,
}: SessionDetailPanelProps) {
  const {
    selectedSession,
    sessionEvents,
    isLoading,
    fetchSession,
    fetchSessionEvents,
    resumeSession,
    updateStatus,
    deleteSession,
  } = useClaudeSessionStore();

  // async-parallel: Fetch both in parallel when opening
  useEffect(() => {
    if (sessionId) {
      Promise.all([
        fetchSession(sessionId),
        fetchSessionEvents(sessionId),
      ]);
    }
  }, [sessionId, fetchSession, fetchSessionEvents]);

  const session = selectedSession;

  // rerender-dependencies: Use primitive values for stable callbacks
  const currentSessionId = session?.id;
  const canResume = session?.canResume;
  const status = session?.status;

  // rerender-functional-setstate: Stable callback refs with primitive dependencies
  const handleResume = useCallback(async () => {
    if (currentSessionId) {
      await resumeSession(currentSessionId);
    }
  }, [currentSessionId, resumeSession]);

  const handleTerminate = useCallback(async () => {
    if (currentSessionId) {
      await updateStatus(currentSessionId, "terminated");
    }
  }, [currentSessionId, updateStatus]);

  const handleDelete = useCallback(async () => {
    if (currentSessionId && confirm("Delete this session and all its events?")) {
      await deleteSession(currentSessionId);
      onClose();
    }
  }, [currentSessionId, deleteSession, onClose]);

  // js-cache-function-results: Memoize computed duration
  const duration = useMemo(() =>
    session
      ? session.endedAt
        ? formatDuration(session.endedAt - session.startedAt)
        : formatDuration(Date.now() - session.startedAt)
      : "0s",
    [session?.endedAt, session?.startedAt]
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-muted)]">
        <span className="text-sm font-medium text-[var(--text-primary)] truncate flex-1">
          Session Details
        </span>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] rounded transition-colors"
          aria-label="Close session details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      {isLoading || !session ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Status header */}
          <div className="flex items-center gap-2">
            {statusIcons[session.status]}
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">
                {session.id.slice(0, 12)}...
              </div>
              <Badge
                variant={
                  status === "active" || status === "launching"
                    ? "success"
                    : status === "error"
                      ? "destructive"
                      : status === "terminated"
                        ? "warning"
                        : "secondary"
                }
              >
                {session.status}
              </Badge>
            </div>
          </div>

          {/* Prompt */}
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">Initial Prompt</div>
            <div className="p-2 bg-[var(--surface-2)] rounded-lg text-sm max-h-[120px] overflow-y-auto">
              {session.initialPrompt || (
                <span className="text-[var(--text-muted)] italic">
                  No prompt
                </span>
              )}
            </div>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-[var(--text-muted)] mb-1">Terminal</div>
              <div className="flex items-center gap-1 text-sm">
                <Terminal className="w-3 h-3" />
                {session.terminal}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)] mb-1">Duration</div>
              <div className="flex items-center gap-1 text-sm">
                <Clock className="w-3 h-3" />
                {duration}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)] mb-1">Mode</div>
              <div className="text-sm">{session.launchMode}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)] mb-1">Started</div>
              <div className="flex items-center gap-1 text-sm">
                <Calendar className="w-3 h-3" />
                {formatDateTime(session.startedAt)}
              </div>
            </div>
            {session.endedAt ? (
              <div>
                <div className="text-xs text-[var(--text-muted)] mb-1">Ended</div>
                <div className="text-sm">{formatDateTime(session.endedAt)}</div>
              </div>
            ) : null}
          </div>

          {/* Links */}
          {session.taskId || session.moduleId ? (
            <>
              <Separator />
              <div>
                <div className="text-xs text-[var(--text-muted)] mb-1">Linked To</div>
                <div className="space-y-1">
                  {session.taskId ? (
                    <div className="flex items-center gap-2 text-sm">
                      <ListTodo className="w-3 h-3 text-[var(--text-muted)]" />
                      <span>Task: {session.taskId}</span>
                    </div>
                  ) : null}
                  {session.moduleId ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Box className="w-3 h-3 text-[var(--text-muted)]" />
                      <span>Module: {session.moduleId}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}

          {/* Error message */}
          {session.errorMessage ? (
            <>
              <Separator />
              <div>
                <div className="text-xs text-[var(--text-muted)] mb-1 text-[var(--color-error)]">
                  Error
                </div>
                <div className="p-2 bg-[var(--color-error)]/15 text-[var(--color-error)] rounded-lg text-sm">
                  {session.errorMessage}
                </div>
              </div>
            </>
          ) : null}

          {/* Resume info */}
          {session.resumeCount > 0 ? (
            <>
              <Separator />
              <div>
                <div className="text-xs text-[var(--text-muted)] mb-1">Resume History</div>
                <div className="text-sm text-[var(--text-muted)]">
                  Resumed {session.resumeCount} time(s)
                  {session.lastResumeAt ? (
                    <span> • Last: {new Date(session.lastResumeAt).toLocaleString()}</span>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}

          {/* Events timeline */}
          <Separator />
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-2">
              Events ({sessionEvents.length})
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {sessionEvents.length === 0 ? (
                <div className="text-sm text-[var(--text-muted)] text-center py-4">
                  No events recorded
                </div>
              ) : (
                <div className="space-y-2">
                  {sessionEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-2 p-2 rounded hover:bg-[var(--surface-2)]/50"
                    >
                      <div className="mt-1">
                        {eventTypeIcons[event.eventType] || (
                          <Circle className="w-3 h-3" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">
                          {event.eventType}
                        </div>
                        {event.details ? (
                          <div className="text-xs text-[var(--text-muted)] truncate">
                            {event.details}
                          </div>
                        ) : null}
                        <div className="text-xs text-[var(--text-muted)]">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer actions */}
      {session && (
        <div className="px-3 py-2 border-t border-[var(--border-muted)] flex gap-2">
          {canResume && status !== "active" && status !== "launching" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleResume}
              className="flex-1"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Resume
            </Button>
          ) : null}
          {status === "active" || status === "launching" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleTerminate}
              className="flex-1"
            >
              <Square className="w-4 h-4 mr-1" />
              Terminate
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            className="text-[var(--color-error)] hover:opacity-80"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
});

export default SessionDetailPanel;
