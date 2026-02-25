/**
 * Traceability Block View
 *
 * Shows spec → task → test result coverage matrix.
 * Left panel: spec list with coverage indicators.
 * Right panel: selected spec's tasks and test results.
 */

import {
  ClipboardCheck,
  RefreshCw,
  CheckCircle2,
  Circle,
  CircleDot,
  Loader2,
} from "lucide-react";
import { memo, useEffect, useCallback } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";
import {
  useTraceabilityStore,
  type TraceabilityMatrixEntry,
  type TraceabilityTaskEntry,
} from "@/stores/traceabilityStore";
import type { BlockViewProps } from "@/types/block";

// =============================================================================
// Verdict Badge
// =============================================================================

function VerdictBadge({ verdict, passRate }: { verdict: string | null; passRate: number | null }) {
  if (!verdict) {
    return (
      <Badge variant="outline" className="text-[var(--text-muted)] text-xs">
        pending
      </Badge>
    );
  }

  const color =
    verdict === "pass"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : verdict === "fail"
        ? "bg-red-500/15 text-red-400 border-red-500/30"
        : "bg-amber-500/15 text-amber-400 border-amber-500/30";

  return (
    <Badge className={cn("text-xs border", color)}>
      {verdict.toUpperCase()}
      {passRate !== null && ` ${passRate}%`}
    </Badge>
  );
}

// =============================================================================
// Coverage Icon
// =============================================================================

function CoverageIcon({ rate, totalTasks }: { rate: number; totalTasks: number }) {
  if (totalTasks === 0) {
    return <Circle className="w-4 h-4 text-[var(--text-muted)]" />;
  }
  if (rate === 100) {
    return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  }
  if (rate > 0) {
    return <CircleDot className="w-4 h-4 text-amber-400" />;
  }
  return <Circle className="w-4 h-4 text-[var(--text-muted)]" />;
}

// =============================================================================
// Task Row
// =============================================================================

function TaskRow({ task }: { task: TraceabilityTaskEntry }) {
  const statusColor =
    task.status === "completed"
      ? "text-emerald-400"
      : task.status === "in_progress"
        ? "text-blue-400"
        : "text-[var(--text-muted)]";

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-md bg-[var(--surface-1)] hover:bg-[var(--surface-2)] transition-colors">
      <span className={cn("text-xs font-mono", statusColor)}>
        {task.status === "completed" ? "\u2713" : task.status === "in_progress" ? "\u29D7" : "\u25CB"}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-[var(--text-primary)] truncate">{task.title}</div>
        <div className="text-xs text-[var(--text-muted)]">{task.id}</div>
      </div>
      <VerdictBadge verdict={task.verdict} passRate={task.passRate} />
    </div>
  );
}

// =============================================================================
// Detail Panel
// =============================================================================

function DetailPanel({ entry }: { entry: TraceabilityMatrixEntry }) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-muted)]">
        <h3 className="text-base font-medium text-[var(--text-primary)]">{entry.specTitle}</h3>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-xs">{entry.specId}</Badge>
          <Badge variant="outline" className="text-xs">{entry.specStatus}</Badge>
        </div>
      </div>

      {/* Coverage summary */}
      <div className="px-4 py-3 border-b border-[var(--border-muted)] flex items-center gap-4 text-xs">
        <span className="text-[var(--text-muted)]">
          Coverage: <span className="text-[var(--text-primary)] font-medium">{entry.coverage.tested}/{entry.coverage.totalTasks}</span> tested
        </span>
        <span className="text-[var(--text-muted)]">
          Passed: <span className="text-emerald-400 font-medium">{entry.coverage.passed}</span>
        </span>
        <span className="text-[var(--text-muted)]">
          Rate: <span className="text-[var(--text-primary)] font-medium">{entry.coverage.rate}%</span>
        </span>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {entry.tasks.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] text-center py-8">No linked tasks</p>
        ) : (
          entry.tasks.map((task) => <TaskRow key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main View
// =============================================================================

export const TraceabilityBlockView = memo(function TraceabilityBlockView(
  _props: BlockViewProps
) {
  const { workspacePath, sidstackProjectId, isActive } = useWorkspaceContext();
  const {
    matrix,
    summary,
    isLoading,
    error,
    selectedSpecId,
    fetchMatrix,
    selectSpec,
  } = useTraceabilityStore();

  const handleRefresh = useCallback(() => {
    if (sidstackProjectId && workspacePath) {
      fetchMatrix(sidstackProjectId, workspacePath);
    }
  }, [sidstackProjectId, workspacePath, fetchMatrix]);

  useEffect(() => {
    if (isActive && sidstackProjectId && workspacePath) {
      fetchMatrix(sidstackProjectId, workspacePath);
    }
  }, [isActive, sidstackProjectId, workspacePath, fetchMatrix]);

  const selectedEntry = matrix.find((m) => m.specId === selectedSpecId) || matrix[0] || null;

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState
          icon={<ClipboardCheck className="w-10 h-10" />}
          title="Failed to load traceability"
          description={error}
          actions={[{ label: "Retry", onClick: handleRefresh }]}
        />
      </div>
    );
  }

  if (isLoading && matrix.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--text-muted)]">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!isLoading && matrix.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState
          icon={<ClipboardCheck className="w-10 h-10" />}
          title="No traceability data"
          description="Create specs in Knowledge and link tasks to see coverage. Use test_result_create with specId/taskId to build the traceability chain."
          actions={[{ label: "Refresh", onClick: handleRefresh }]}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header bar */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[var(--border-muted)]">
        <ClipboardCheck className="w-5 h-5 text-[var(--text-secondary)]" />
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Traceability Matrix</h2>
        <div className="flex-1" />

        {/* Summary badges */}
        {summary && (
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline">{summary.totalSpecs} specs</Badge>
            <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {summary.fullyCovered} covered
            </Badge>
            {summary.partial > 0 && (
              <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30">
                {summary.partial} partial
              </Badge>
            )}
            {summary.uncovered > 0 && (
              <Badge className="bg-[var(--surface-3)] text-[var(--text-muted)] border border-[var(--border-muted)]">
                {summary.uncovered} uncovered
              </Badge>
            )}
            <span className="text-[var(--text-muted)] ml-1">{summary.overallRate}% overall</span>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className="h-7 px-2"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      {/* Main content: split pane */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Spec list */}
        <div className="w-72 shrink-0 border-r border-[var(--border-muted)] overflow-auto">
          {matrix.map((entry) => {
            const isSelected = selectedEntry?.specId === entry.specId;
            return (
              <button
                key={entry.specId}
                onClick={() => selectSpec(entry.specId)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-[var(--border-muted)]",
                  "hover:bg-[var(--surface-1)] transition-colors",
                  isSelected && "bg-[var(--surface-2)]"
                )}
              >
                <div className="flex items-center gap-2">
                  <CoverageIcon rate={entry.coverage.rate} totalTasks={entry.coverage.totalTasks} />
                  <span className="flex-1 text-sm text-[var(--text-primary)] truncate">
                    {entry.specTitle}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] tabular-nums">
                    {entry.coverage.rate}%
                  </span>
                </div>
                <div className="mt-1 ml-6 text-xs text-[var(--text-muted)]">
                  {entry.coverage.tested}/{entry.coverage.totalTasks} tasks tested
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Detail panel */}
        <div className="flex-1 overflow-hidden">
          {selectedEntry ? (
            <DetailPanel entry={selectedEntry} />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-[var(--text-muted)]">
              Select a spec to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
