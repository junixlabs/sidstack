/**
 * Session Manager Panel
 *
 * Overview panel for managing Claude Code sessions.
 * Shows list of sessions with filters and actions.
 */

import {
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Terminal,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBlockNavigation } from "@/hooks/useBlockNavigation";
import { cn } from "@/lib/utils";
import { useClaudeSessionStore } from "@/stores/claudeSessionStore";
import type { WindowMode } from "@sidstack/shared";

import { LaunchSessionDialog } from "./LaunchSessionDialog";
import { SessionCard } from "./SessionCard";
import { SessionDetailPanel } from "./SessionDetailPanel";

interface SessionManagerPanelProps {
  workspacePath?: string;
  taskId?: string;
  moduleId?: string;
  initialSessionId?: string;
  compact?: boolean;
  className?: string;
}

type FilterType = "all" | "active" | "completed" | "error";

const filterStatusMap: Record<FilterType, string[] | undefined> = {
  all: undefined,
  active: ["launching", "active"],
  completed: ["completed"],
  error: ["error", "terminated"],
};

export const SessionManagerPanel: React.FC<SessionManagerPanelProps> = ({
  workspacePath,
  taskId,
  moduleId,
  initialSessionId,
  compact = false,
  className,
}) => {
  const {
    sessions,
    total,
    isLoading,
    error,
    stats,
    fetchSessions,
    fetchStats,
    launchSession,
    updateStatus,
    resumeSession,
    deleteSession,
    selectSession,
    selectedSessionId,
    clearError,
    syncAllSessions,
  } = useClaudeSessionStore();

  // Navigation helpers for cross-feature links
  const { navigateToTaskManager } = useBlockNavigation();

  const [filter, setFilter] = useState<FilterType>("all");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);

  // Load sessions on mount and when filters change
  // async-parallel: Run both fetches in parallel since they're independent
  useEffect(() => {
    const statusFilter = filterStatusMap[filter];
    const loadData = async () => {
      await Promise.all([
        fetchSessions({
          workspacePath,
          taskId,
          moduleId,
          status: statusFilter as any,
          limit: 50,
        }),
        fetchStats({ workspacePath, taskId, moduleId }),
      ]);
    };
    loadData();
  }, [workspacePath, taskId, moduleId, filter, fetchSessions, fetchStats]);

  // Apply cross-feature navigation: select session if initialSessionId provided
  useEffect(() => {
    if (initialSessionId) {
      selectSession(initialSessionId);
      setDetailSessionId(initialSessionId);
    }
  }, [initialSessionId, selectSession]);

  // rerender-functional-setstate: Use useCallback for stable handlers
  const handleRefresh = useCallback(() => {
    const statusFilter = filterStatusMap[filter];
    Promise.all([
      fetchSessions({
        workspacePath,
        taskId,
        moduleId,
        status: statusFilter as any,
        limit: 50,
      }),
      fetchStats({ workspacePath, taskId, moduleId }),
    ]);
  }, [workspacePath, taskId, moduleId, filter, fetchSessions, fetchStats]);

  // Sync all active sessions with actual terminal state
  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const result = await syncAllSessions(workspacePath);
      if (result.changed > 0) {
        // Refresh stats after sync
        await fetchStats({ workspacePath, taskId, moduleId });
      }
    } finally {
      setIsSyncing(false);
    }
  }, [workspacePath, taskId, moduleId, syncAllSessions, fetchStats]);

  // Auto-polling: sync active sessions every 30 seconds
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only poll if there are active sessions
    const hasActiveSessions = sessions.some(
      (s) => s.status === "active" || s.status === "launching"
    );

    if (hasActiveSessions) {
      syncIntervalRef.current = setInterval(async () => {
        const result = await syncAllSessions(workspacePath);
        if (result.changed > 0) {
          await fetchStats({ workspacePath, taskId, moduleId });
        }
      }, 30000); // 30 seconds
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [sessions, workspacePath, taskId, moduleId, syncAllSessions, fetchStats]);

  // Handler for LaunchSessionDialog
  const handleLaunchSession = useCallback(
    async (options: { prompt?: string; terminal: string; mode: string; windowMode?: WindowMode; taskId?: string; moduleId?: string; specId?: string; ticketId?: string }) => {
      if (!workspacePath) {
        return { success: false, error: "Workspace path is required" };
      }

      const result = await launchSession({
        projectDir: workspacePath,
        taskId,
        moduleId,
        prompt: options.prompt,
        terminal: options.terminal,
        mode: options.mode,
        windowMode: options.windowMode,
      });

      return result;
    },
    [workspacePath, taskId, moduleId, launchSession]
  );

  const handleResume = useCallback(async (sessionId: string) => {
    await resumeSession(sessionId);
  }, [resumeSession]);

  const handleTerminate = useCallback(async (sessionId: string) => {
    await updateStatus(sessionId, "terminated");
  }, [updateStatus]);

  const handleDelete = useCallback(async (sessionId: string) => {
    if (confirm("Are you sure you want to delete this session?")) {
      await deleteSession(sessionId);
    }
  }, [deleteSession]);

  // Count sessions by status
  const counts = {
    all: total,
    active: sessions.filter((s) => s.status === "active" || s.status === "launching").length,
    completed: sessions.filter((s) => s.status === "completed").length,
    error: sessions.filter((s) => s.status === "error" || s.status === "terminated").length,
  };

  return (
    <div className={cn("flex h-full", className)}>
    {/* Main list area */}
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--border-muted)]">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4" />
          <h3 className="font-medium text-sm">Claude Sessions</h3>
          {stats && (
            <Badge variant="secondary" className="text-xs">
              {stats.active} active
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSync}
            disabled={isSyncing}
            className="h-7 w-7 p-0"
            title="Sync session status with terminals"
          >
            <RotateCcw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            disabled={isLoading}
            className="h-7 w-7 p-0"
            title="Refresh sessions list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>

          <Button size="sm" className="h-7" onClick={() => setShowNewDialog(true)}>
            <Plus className="w-4 h-4 mr-1" />
            New
          </Button>

          <LaunchSessionDialog
            open={showNewDialog}
            onOpenChange={setShowNewDialog}
            workspacePath={workspacePath}
            taskId={taskId}
            moduleId={moduleId}
            onLaunch={handleLaunchSession}
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-2 border-b border-[var(--border-muted)] overflow-x-auto">
        {(["all", "active", "completed", "error"] as FilterType[]).map((f) => (
          <Badge
            key={f}
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
            className="cursor-pointer capitalize shrink-0"
          >
            {f} ({counts[f]})
          </Badge>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-[var(--color-error)]/15 text-[var(--color-error)] text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="ghost" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Session list */}
      <ScrollArea className="flex-1">
        {isLoading && sessions.length === 0 ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-[var(--text-muted)]" />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={<Terminal className="w-full h-full" />}
            title="No Claude sessions yet"
            description="Launch a Claude Code session to start working with AI assistance. Sessions automatically link to tasks and modules for context."
            actions={[
              {
                label: "New Session",
                onClick: () => setShowNewDialog(true),
                icon: <Sparkles className="w-4 h-4" />,
              },
            ]}
            tips={[
              "Sessions preserve context and can be resumed later",
              "Tip: Link sessions to tasks for better tracking",
            ]}
            compact={compact}
          />
        ) : (
          <div className="divide-y divide-[var(--border-muted)]">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                compact={compact}
                selected={selectedSessionId === session.id}
                onSelect={() => selectSession(session.id)}
                onResume={() => handleResume(session.id)}
                onTerminate={() => handleTerminate(session.id)}
                onDelete={() => handleDelete(session.id)}
                onViewDetails={() => setDetailSessionId(session.id)}
                onNavigateToTask={(taskId) => navigateToTaskManager({ selectedTaskId: taskId })}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Stats footer */}
      {stats && !compact && (
        <div className="p-2 border-t border-[var(--border-muted)] text-xs text-[var(--text-muted)] flex items-center gap-4">
          <span>{stats.total} total</span>
          <span>{stats.completed} completed</span>
          {stats.totalDuration > 0 && (
            <span>
              {Math.round(stats.totalDuration / 60000)}m total time
            </span>
          )}
        </div>
      )}

    </div>

      {/* Session detail panel - right sidebar */}
      {detailSessionId && (
        <div className="w-80 shrink-0 border-l border-[var(--border-muted)] overflow-y-auto bg-[var(--surface-1)]">
          <SessionDetailPanel
            sessionId={detailSessionId}
            onClose={() => setDetailSessionId(null)}
          />
        </div>
      )}
    </div>
  );
};

export default SessionManagerPanel;
