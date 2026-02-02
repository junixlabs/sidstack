/**
 * AgentStatusPanel Component
 *
 * Displays all coordinated agents with status indicators,
 * progress bars, and health monitoring.
 */

import { useEffect, memo, useMemo, useCallback } from "react";

import { useVisibilityPolling } from "@/hooks/useVisibility";
import { cn } from "@/lib/utils";
import {
  useAgentStore,
  CoordinatedAgent,
  CoordinationStatus,
} from "@/stores/agentStore";

// =============================================================================
// Status Colors & Icons
// =============================================================================

// Performance: Removed animate-pulse from static status indicators
// Animations only applied to truly active states and limited to 3 iterations via CSS
const STATUS_COLORS: Record<CoordinationStatus, string> = {
  idle: "bg-[var(--text-muted)]",
  working: "bg-[var(--text-secondary)]", // Animation handled separately for active states only
  waiting_for_input: "bg-[var(--text-secondary)]",
  waiting_for_dependency: "bg-[var(--text-secondary)]",
  blocked: "bg-[var(--text-secondary)]",
  completed: "bg-[var(--text-secondary)]",
  error: "bg-[var(--text-secondary)]",
};

const STATUS_LABELS: Record<CoordinationStatus, string> = {
  idle: "Idle",
  working: "Working",
  waiting_for_input: "Waiting for Input",
  waiting_for_dependency: "Waiting for Dependency",
  blocked: "Blocked",
  completed: "Completed",
  error: "Error",
};

const ROLE_COLORS: Record<string, string> = {
  orchestrator: "border-[var(--border-default)] bg-[var(--surface-2)]",
  worker: "border-[var(--border-default)] bg-[var(--surface-2)]",
  frontend: "border-[var(--border-default)] bg-[var(--surface-2)]",
  backend: "border-[var(--border-default)] bg-[var(--surface-2)]",
  tester: "border-[var(--border-default)] bg-[var(--surface-2)]",
};

// =============================================================================
// Agent Card Component
// =============================================================================

interface AgentCardProps {
  agent: CoordinatedAgent;
  isOrchestrator: boolean;
  onSelect?: (agentId: string) => void;
}

const AgentCard = memo(function AgentCard({
  agent,
  isOrchestrator,
  onSelect,
}: AgentCardProps) {
  const roleColor = ROLE_COLORS[agent.role] || "border-[var(--border-muted)] bg-[var(--surface-2)]";
  const healthColor =
    agent.health_score >= 80
      ? "text-[var(--text-secondary)]"
      : agent.health_score >= 50
      ? "text-[var(--text-secondary)]"
      : "text-[var(--text-secondary)]";

  return (
    <div
      onClick={() => onSelect?.(agent.id)}
      className={cn(
        "p-3 rounded-lg border-l-4 cursor-pointer transition-all hover:bg-[var(--surface-3)]",
        roleColor,
        isOrchestrator && "ring-1 ring-[var(--border-default)]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", STATUS_COLORS[agent.status])} />
          <span className="font-medium text-[var(--text-primary)] text-sm">
            {agent.id}
          </span>
          {isOrchestrator && (
            <span className="px-1.5 py-0.5 text-[11px] font-medium bg-[var(--surface-3)] text-[var(--text-secondary)] rounded">
              Orchestrator
            </span>
          )}
        </div>
        <span className={cn("text-[11px] font-mono", healthColor)}>
          {agent.health_score}%
        </span>
      </div>

      {/* Role badge */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] text-[var(--text-muted)]">Role:</span>
        <span className="px-1.5 py-0.5 text-[11px] bg-[var(--surface-3)] text-[var(--text-secondary)] rounded capitalize">
          {agent.role}
        </span>
        <span className="text-[11px] text-[var(--text-muted)] ml-auto">
          {STATUS_LABELS[agent.status]}
        </span>
      </div>

      {/* Progress bar (if working) */}
      {agent.status === "working" && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mb-1">
            <span>{agent.current_task || "Working..."}</span>
            <span>{agent.progress}%</span>
          </div>
          <div className="h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--text-secondary)] transition-all duration-300"
              style={{ width: `${agent.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Current task (if not working but has task) */}
      {agent.status !== "working" && agent.current_task && (
        <div className="text-[11px] text-[var(--text-muted)] truncate">
          Task: {agent.current_task}
        </div>
      )}

      {/* Last activity */}
      <div className="text-[11px] text-[var(--text-muted)] mt-1">
        Last active: {formatTimeAgo(agent.last_activity)}
      </div>
    </div>
  );
});

// =============================================================================
// Summary Stats Component
// =============================================================================

interface SummaryStatsProps {
  totalAgents: number;
  workingCount: number;
  blockedCount: number;
  unhealthyCount: number;
}

function SummaryStats({
  totalAgents,
  workingCount,
  blockedCount,
  unhealthyCount,
}: SummaryStatsProps) {
  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      <div className="p-2 rounded bg-[var(--surface-2)] text-center">
        <div className="text-lg font-bold text-[var(--text-primary)]">{totalAgents}</div>
        <div className="text-[11px] text-[var(--text-muted)]">Total</div>
      </div>
      <div className="p-2 rounded bg-[var(--surface-2)] text-center">
        <div className="text-lg font-bold text-[var(--text-secondary)]">{workingCount}</div>
        <div className="text-[11px] text-[var(--text-muted)]">Working</div>
      </div>
      <div className="p-2 rounded bg-[var(--surface-2)] text-center">
        <div className="text-lg font-bold text-[var(--text-secondary)]">{blockedCount}</div>
        <div className="text-[11px] text-[var(--text-muted)]">Blocked</div>
      </div>
      <div className="p-2 rounded bg-[var(--surface-2)] text-center">
        <div className="text-lg font-bold text-[var(--text-secondary)]">{unhealthyCount}</div>
        <div className="text-[11px] text-[var(--text-muted)]">Unhealthy</div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export interface AgentStatusPanelProps {
  className?: string;
  isDark?: boolean;
  onSelectAgent?: (agentId: string) => void;
}

export function AgentStatusPanel({ className, onSelectAgent }: AgentStatusPanelProps) {
  const {
    agents,
    orchestratorId,
    healthIssues,
    isLoading,
    error,
    coordinatorAvailable,
  } = useAgentStore();

  // Initialize store on mount (empty deps - run once)
  useEffect(() => {
    useAgentStore.getState().initialize();
    return () => useAgentStore.getState().cleanup();
  }, []);

  // Performance: Visibility-based health check - pauses when tab is hidden
  const runHealthCheck = useCallback(() => {
    if (coordinatorAvailable) {
      useAgentStore.getState().runHealthCheck();
    }
  }, [coordinatorAvailable]);

  useVisibilityPolling(runHealthCheck, 30000, {
    immediate: false, // Don't run immediately, let initialize() handle first check
  });

  // Memoize agent list to avoid re-creating array on every render
  const agentList = useMemo(() => {
    return agents instanceof Map ? Array.from(agents.values()) : [];
  }, [agents]);

  // Memoize derived stats to avoid infinite re-renders (was using selectors that created new arrays)
  const workingAgents = useMemo(() => agentList.filter((a) => a.status === "working"), [agentList]);
  const blockedAgents = useMemo(() => agentList.filter((a) => a.status === "blocked"), [agentList]);
  const unhealthyAgents = useMemo(() => agentList.filter((a) => a.health_score < 50), [agentList]);

  if (isLoading) {
    return (
      <div className={cn("p-4", className)}>
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-[var(--text-secondary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Show coordinator offline state
  if (!coordinatorAvailable && agentList.length === 0) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-[var(--border-default)]">
          <h2 className="font-semibold text-[var(--text-primary)]">Agent Coordination</h2>
          <button
            onClick={() => useAgentStore.getState().initialize()}
            className="p-1.5 rounded hover:bg-[var(--surface-3)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            title="Retry connection"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>

        {/* Coordinator offline state */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 mb-4 rounded-full bg-[var(--surface-2)] flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a5 5 0 01-7.072 0m7.072 0l2.829-2.829M6.343 6.343a9 9 0 000 12.728m0 0l2.829-2.829M3 3l18 18"
              />
            </svg>
          </div>
          <h3 className="font-medium text-[var(--text-primary)] mb-1">Coordinator Offline</h3>
          <p className="text-sm text-[var(--text-muted)] mb-4 max-w-xs">
            The agent coordinator is not running. Start it to monitor and manage agents.
          </p>
          <button
            onClick={() => useAgentStore.getState().initialize()}
            className="px-4 py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--surface-3)] hover:bg-[var(--surface-4)] rounded-lg transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--border-default)]">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-[var(--text-primary)]">Agent Coordination</h2>
          {coordinatorAvailable && (
            <span className="w-2 h-2 rounded-full bg-[var(--text-secondary)]" title="Coordinator connected" />
          )}
        </div>
        <button
          onClick={() => coordinatorAvailable ? useAgentStore.getState().runHealthCheck() : useAgentStore.getState().initialize()}
          className="p-1.5 rounded hover:bg-[var(--surface-3)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          title={coordinatorAvailable ? "Run health check" : "Retry connection"}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-2 bg-[var(--surface-2)] border-b border-[var(--border-muted)] text-[var(--text-secondary)] text-sm">
          {error}
        </div>
      )}

      {/* Health issues banner */}
      {healthIssues.length > 0 && (
        <div className="p-2 bg-[var(--surface-2)] border-b border-[var(--border-muted)]">
          <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{healthIssues.length} health issue(s) detected</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {agentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
            <svg className="w-12 h-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="text-sm">No agents registered</p>
            <p className="text-xs mt-1">Start agents to see them here</p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <SummaryStats
              totalAgents={agentList.length}
              workingCount={workingAgents.length}
              blockedCount={blockedAgents.length}
              unhealthyCount={unhealthyAgents.length}
            />

            {/* Agent list */}
            <div className="space-y-2">
              {agentList
                .sort((a, b) => {
                  // Orchestrator first, then by status
                  if (a.id === orchestratorId) return -1;
                  if (b.id === orchestratorId) return 1;
                  if (a.status === "working" && b.status !== "working") return -1;
                  if (b.status === "working" && a.status !== "working") return 1;
                  return 0;
                })
                .map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    isOrchestrator={agent.id === orchestratorId}
                    onSelect={onSelectAgent}
                  />
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function formatTimeAgo(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default AgentStatusPanel;
