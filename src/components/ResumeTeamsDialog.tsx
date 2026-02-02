/**
 * ResumeTeamsDialog - Prompt user to resume paused teams on app startup
 *
 * Shows when paused teams are found. User can select which teams
 * to resume or start fresh.
 */

import { RefreshCw, Play, X, Clock, Users, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useTeamStore, selectPausedTeams } from "@/stores/teamStore";

interface ResumeTeamsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Format time distance in a human-readable way
 */
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString();
}

export function ResumeTeamsDialog({
  isOpen,
  onClose,
}: ResumeTeamsDialogProps) {
  const pausedTeams = useTeamStore(selectPausedTeams);
  const resumeTeam = useTeamStore((state) => state.resumeTeam);
  const isLoading = useTeamStore((state) => state.isLoading);
  const error = useTeamStore((state) => state.error);
  const clearError = useTeamStore((state) => state.clearError);

  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(() => new Set());
  const [resumingTeams, setResumingTeams] = useState<Set<string>>(new Set());

  // Pre-select all paused teams when dialog opens
  useEffect(() => {
    if (isOpen && pausedTeams.length > 0) {
      setSelectedTeams(new Set(pausedTeams.map((t) => t.id)));
    }
  }, [isOpen, pausedTeams]);

  const toggleTeam = (teamId: string) => {
    setSelectedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  const handleResumeSelected = async () => {
    const teamsToResume = Array.from(selectedTeams);
    setResumingTeams(new Set(teamsToResume));

    for (const teamId of teamsToResume) {
      try {
        await resumeTeam(teamId);
        setResumingTeams((prev) => {
          const next = new Set(prev);
          next.delete(teamId);
          return next;
        });
      } catch (err) {
        console.error(`Failed to resume team ${teamId}:`, err);
      }
    }

    onClose();
  };

  const handleResumeAll = async () => {
    setSelectedTeams(new Set(pausedTeams.map((t) => t.id)));
    await handleResumeSelected();
  };

  const handleFreshStart = () => {
    onClose();
  };

  const selectedCount = selectedTeams.size;
  const totalCount = pausedTeams.length;

  if (pausedTeams.length === 0) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-[var(--text-secondary)]" />
            Resume Paused Teams?
          </DialogTitle>
          <DialogDescription>
            Found {totalCount} paused team{totalCount > 1 ? "s" : ""} from previous session
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2 p-2 rounded bg-[var(--surface-2)] border border-[var(--border-default)]">
              <AlertCircle className="w-4 h-4 text-[var(--text-secondary)]" />
              <span className="text-sm text-[var(--text-secondary)] flex-1">{error}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={clearError}
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* Team checkboxes */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Select teams to resume:
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {pausedTeams.map((team) => {
                const isResuming = resumingTeams.has(team.id);
                return (
                  <label
                    key={team.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                      "hover:bg-[var(--surface-1)]",
                      selectedTeams.has(team.id) && "bg-[var(--surface-2)]",
                      isResuming && "opacity-50 cursor-wait"
                    )}
                  >
                    <Checkbox
                      checked={selectedTeams.has(team.id)}
                      onCheckedChange={() => toggleTeam(team.id)}
                      disabled={isResuming}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-[var(--text-muted)]" />
                        <span className="font-medium">{team.name}</span>
                        <Badge variant="secondary" className="text-[11px]">
                          {team.memberCount} members
                        </Badge>
                        {isResuming && (
                          <div className="w-4 h-4 border-2 border-[var(--border-emphasis)] border-t-transparent rounded-full animate-spin" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-1">
                        <Clock className="w-3 h-3" />
                        <span>Last active {formatTimeAgo(team.lastActive)}</span>
                        {team.autoRecovery && (
                          <>
                            <span className="text-[var(--text-muted)]">•</span>
                            <span className="text-[var(--text-secondary)]">Auto-recovery enabled</span>
                          </>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            onClick={handleFreshStart}
            className="w-full sm:w-auto"
            disabled={isLoading}
          >
            <X className="w-4 h-4 mr-2" />
            Start Fresh
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            {selectedCount !== totalCount && selectedCount > 0 && (
              <Button
                variant="outline"
                onClick={handleResumeSelected}
                className="flex-1 sm:flex-none"
                disabled={isLoading}
              >
                Resume {selectedCount}
              </Button>
            )}
            <Button
              onClick={handleResumeAll}
              className="flex-1 sm:flex-none"
              disabled={totalCount === 0 || isLoading}
            >
              <Play className="w-4 h-4 mr-2" />
              Resume All ({totalCount})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ResumeTeamsDialog;
