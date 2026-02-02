/**
 * TeamPanel Component
 *
 * Displays list of teams for current project with status indicators,
 * member counts, and quick action buttons.
 */

import {
  Users,
  Play,
  Pause,
  Archive,
  RefreshCw,
  Plus,
  AlertCircle,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { useEffect, memo, useCallback } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useTeamStore,
  TeamSummary,
  TeamStatus,
  selectActiveTeams,
  selectPausedTeams,
} from "@/stores/teamStore";

// =============================================================================
// Status Colors & Icons
// =============================================================================

const STATUS_COLORS: Record<TeamStatus, string> = {
  active: "bg-[var(--text-secondary)]",
  paused: "bg-[var(--text-muted)]",
  archived: "bg-[var(--text-muted)]",
};

const STATUS_ICONS: Record<TeamStatus, typeof CheckCircle2> = {
  active: CheckCircle2,
  paused: Pause,
  archived: Archive,
};

const STATUS_LABELS: Record<TeamStatus, string> = {
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

// =============================================================================
// Team Card Component
// =============================================================================

interface TeamCardProps {
  team: TeamSummary;
  onSelect?: (teamId: string) => void;
  onResume?: (teamId: string) => void;
  onPause?: (teamId: string) => void;
  onArchive?: (teamId: string) => void;
}

const TeamCard = memo(function TeamCard({
  team,
  onSelect,
  onResume,
  onPause,
  onArchive,
}: TeamCardProps) {
  const StatusIcon = STATUS_ICONS[team.status];

  return (
    <div
      onClick={() => onSelect?.(team.id)}
      className={cn(
        "p-3 rounded-lg border cursor-pointer transition-all",
        "bg-[var(--surface-2)] border-[var(--border-default)]",
        "hover:bg-[var(--surface-3)] hover:border-[var(--border-hover)]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", STATUS_COLORS[team.status])} />
          <span className="font-medium text-[var(--text-primary)] text-sm">
            {team.name}
          </span>
        </div>
        <Badge
          variant={team.status === "active" ? "success" : team.status === "paused" ? "warning" : "secondary"}
          className="text-[11px]"
        >
          <StatusIcon className="w-3 h-3 mr-1" />
          {STATUS_LABELS[team.status]}
        </Badge>
      </div>

      {/* Info row */}
      <div className="flex items-center gap-4 mb-2 text-[11px] text-[var(--text-muted)]">
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          <span>{team.memberCount} members</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{formatTimeAgo(team.lastActive)}</span>
        </div>
        {team.autoRecovery && (
          <div className="flex items-center gap-1 text-[var(--text-secondary)]">
            <RefreshCw className="w-3 h-3" />
            <span>Auto-recovery</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
        {team.status === "paused" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] px-2"
            onClick={() => onResume?.(team.id)}
          >
            <Play className="w-3 h-3 mr-1" />
            Resume
          </Button>
        )}
        {team.status === "active" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] px-2"
            onClick={() => onPause?.(team.id)}
          >
            <Pause className="w-3 h-3 mr-1" />
            Pause
          </Button>
        )}
        {team.status !== "archived" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] px-2 text-[var(--text-muted)]"
            onClick={() => onArchive?.(team.id)}
          >
            <Archive className="w-3 h-3 mr-1" />
            Archive
          </Button>
        )}
      </div>
    </div>
  );
});

// =============================================================================
// Summary Stats Component
// =============================================================================

interface SummaryStatsProps {
  totalTeams: number;
  activeCount: number;
  pausedCount: number;
}

function SummaryStats({ totalTeams, activeCount, pausedCount }: SummaryStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-2 mb-4">
      <div className="p-2 rounded bg-[var(--surface-2)] text-center">
        <div className="text-lg font-bold text-[var(--text-primary)]">{totalTeams}</div>
        <div className="text-[11px] text-[var(--text-muted)]">Total</div>
      </div>
      <div className="p-2 rounded bg-[var(--surface-2)] text-center">
        <div className="text-lg font-bold text-[var(--text-secondary)]">{activeCount}</div>
        <div className="text-[11px] text-[var(--text-muted)]">Active</div>
      </div>
      <div className="p-2 rounded bg-[var(--surface-2)] text-center">
        <div className="text-lg font-bold text-[var(--text-secondary)]">{pausedCount}</div>
        <div className="text-[11px] text-[var(--text-muted)]">Paused</div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export interface TeamPanelProps {
  className?: string;
  projectPath?: string;
  onSelectTeam?: (teamId: string) => void;
  onCreateTeam?: () => void;
}

export function TeamPanel({
  className,
  projectPath,
  onSelectTeam,
  onCreateTeam,
}: TeamPanelProps) {
  const {
    teams,
    isLoading,
    error,
    loadTeams,
    setProjectPath,
    pauseTeam,
    resumeTeam,
    archiveTeam,
    clearError,
  } = useTeamStore();

  const activeTeams = useTeamStore(selectActiveTeams);
  const pausedTeams = useTeamStore(selectPausedTeams);

  // Set project path and load teams
  useEffect(() => {
    if (projectPath) {
      setProjectPath(projectPath);
      loadTeams(projectPath);
    }
  }, [projectPath, setProjectPath, loadTeams]);

  const handleResume = useCallback(async (teamId: string) => {
    try {
      await resumeTeam(teamId);
    } catch (err) {
      console.error("Failed to resume team:", err);
    }
  }, [resumeTeam]);

  const handlePause = useCallback(async (teamId: string) => {
    try {
      await pauseTeam(teamId);
    } catch (err) {
      console.error("Failed to pause team:", err);
    }
  }, [pauseTeam]);

  const handleArchive = useCallback(async (teamId: string) => {
    try {
      await archiveTeam(teamId);
    } catch (err) {
      console.error("Failed to archive team:", err);
    }
  }, [archiveTeam]);

  const handleRefresh = useCallback(() => {
    loadTeams();
  }, [loadTeams]);

  if (isLoading) {
    return (
      <div className={cn("p-4", className)}>
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-[var(--text-secondary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--border-default)]">
        <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Users className="w-4 h-4" />
          Teams
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleRefresh}
            title="Refresh teams"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onCreateTeam}
            title="Create team"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-2 bg-[var(--surface-2)] border-b border-[var(--border-muted)] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[var(--text-secondary)]" />
          <span className="text-[var(--text-secondary)] text-sm flex-1">{error}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px]"
            onClick={clearError}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
            <Users className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm">No teams created</p>
            <p className="text-xs mt-1">Create a team to coordinate agents</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={onCreateTeam}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Team
            </Button>
          </div>
        ) : (
          <>
            {/* Summary */}
            <SummaryStats
              totalTeams={teams.length}
              activeCount={activeTeams.length}
              pausedCount={pausedTeams.length}
            />

            {/* Team list */}
            <div className="space-y-2">
              {teams
                .sort((a, b) => {
                  // Active first, then paused, then archived
                  const order: Record<TeamStatus, number> = { active: 0, paused: 1, archived: 2 };
                  return order[a.status] - order[b.status];
                })
                .map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    onSelect={onSelectTeam}
                    onResume={handleResume}
                    onPause={handlePause}
                    onArchive={handleArchive}
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

function formatTimeAgo(timestamp: string): string {
  const now = Date.now();
  const date = new Date(timestamp);
  const diff = (now - date.getTime()) / 1000;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default TeamPanel;
