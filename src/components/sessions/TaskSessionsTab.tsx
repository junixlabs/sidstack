/**
 * Task Sessions Tab
 *
 * Displays Claude session history for a specific task.
 * Used in TaskDetail view to show all sessions that worked on the task.
 */

import {
  Terminal,
  Plus,
  RefreshCw,
  Loader2,
  Clock,
  CheckCircle,
} from "lucide-react";
import React, { useEffect, useState, useCallback, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBlockNavigation } from "@/hooks/useBlockNavigation";
import { useClaudeSessionStore } from "@/stores/claudeSessionStore";
import type { ClaudeSession } from "@sidstack/shared";

import { SessionCard } from "./SessionCard";

interface TaskSessionsTabProps {
  taskId: string;
  workspacePath?: string;
  onLaunchSession?: () => void;
  className?: string;
}

export const TaskSessionsTab: React.FC<TaskSessionsTabProps> = ({
  taskId,
  workspacePath: _workspacePath, // Reserved for future use
  onLaunchSession,
  className,
}) => {
  const {
    fetchSessionsByTask,
    resumeSession,
    updateStatus,
    deleteSession,
    selectSession,
    selectedSessionId,
  } = useClaudeSessionStore();

  // Navigation helpers for cross-feature links
  const { navigateToTaskManager } = useBlockNavigation();

  const [sessions, setSessions] = useState<ClaudeSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionPending, setIsActionPending] = useState(false);

  // Debounce ref to prevent rapid re-fetches
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Memoized load function with debounce
  const loadSessions = useCallback(async (debounceMs = 0) => {
    // Clear any pending fetch
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    if (debounceMs > 0) {
      fetchTimeoutRef.current = setTimeout(async () => {
        setIsLoading(true);
        const result = await fetchSessionsByTask(taskId);
        setSessions(result);
        setIsLoading(false);
      }, debounceMs);
    } else {
      setIsLoading(true);
      const result = await fetchSessionsByTask(taskId);
      setSessions(result);
      setIsLoading(false);
    }
  }, [fetchSessionsByTask, taskId]);

  // Load sessions when taskId changes
  useEffect(() => {
    loadSessions();

    // Cleanup timeout on unmount
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [loadSessions]);

  // Optimized handlers - no redundant loadSessions calls
  // Store methods already refresh internal state, we just need to update local state
  const handleResume = useCallback(async (sessionId: string) => {
    if (isActionPending) return;
    setIsActionPending(true);
    try {
      await resumeSession(sessionId);
      // Debounced refresh to batch potential rapid updates
      loadSessions(100);
    } finally {
      setIsActionPending(false);
    }
  }, [resumeSession, loadSessions, isActionPending]);

  const handleTerminate = useCallback(async (sessionId: string) => {
    if (isActionPending) return;
    setIsActionPending(true);
    try {
      await updateStatus(sessionId, "terminated");
      // Optimistic update - update local state immediately
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, status: "terminated" as const, endedAt: Date.now() } : s
      ));
    } finally {
      setIsActionPending(false);
    }
  }, [updateStatus, isActionPending]);

  const handleDelete = useCallback(async (sessionId: string) => {
    if (isActionPending) return;
    if (!confirm("Delete this session?")) return;

    setIsActionPending(true);
    try {
      // Optimistic update - remove from local state immediately
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      await deleteSession(sessionId);
    } finally {
      setIsActionPending(false);
    }
  }, [deleteSession, isActionPending]);

  // Calculate stats
  const activeSessions = sessions.filter(
    (s) => s.status === "active" || s.status === "launching"
  );
  const completedSessions = sessions.filter((s) => s.status === "completed");
  const totalDuration = sessions.reduce((sum, s) => {
    const end = s.endedAt || Date.now();
    return sum + (end - s.startedAt);
  }, 0);

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4" />
          <span className="font-medium text-sm">Sessions</span>
          <Badge variant="secondary" className="text-xs">
            {sessions.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => loadSessions()}
            disabled={isLoading}
            className="h-7 w-7 p-0"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          {onLaunchSession && (
            <Button size="sm" onClick={onLaunchSession} className="h-7">
              <Plus className="w-4 h-4 mr-1" />
              New
            </Button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      {sessions.length > 0 && (
        <div className="flex gap-4 text-xs text-[var(--text-muted)] mb-3 pb-2 border-b border-[var(--border-muted)]">
          {activeSessions.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-[var(--color-success)] rounded-full animate-pulse" />
              {activeSessions.length} active
            </span>
          )}
          <span className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            {completedSessions.length} completed
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {Math.round(totalDuration / 60000)}m total
          </span>
        </div>
      )}

      {/* Session list */}
      {isLoading ? (
        <div className="p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-[var(--text-muted)]" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="p-8 text-center text-[var(--text-muted)]">
          <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No sessions for this task</p>
          {onLaunchSession && (
            <Button
              size="sm"
              variant="outline"
              onClick={onLaunchSession}
              className="mt-3"
            >
              <Plus className="w-4 h-4 mr-1" />
              Launch First Session
            </Button>
          )}
        </div>
      ) : (
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-1">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                compact
                selected={selectedSessionId === session.id}
                onSelect={() => selectSession(session.id)}
                onResume={() => handleResume(session.id)}
                onTerminate={() => handleTerminate(session.id)}
                onDelete={() => handleDelete(session.id)}
                onNavigateToTask={(taskId) => navigateToTaskManager({ selectedTaskId: taskId })}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default TaskSessionsTab;
