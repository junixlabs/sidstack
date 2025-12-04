import {
  CheckCircle2,
  Circle,
  Layers,
  BookOpen,
  Terminal,
  CheckSquare,
  Trophy,
} from "lucide-react";
import { memo, useMemo } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useOnboardingStore, type OnboardingMilestones } from "@/stores/onboardingStore";

interface MilestoneConfig {
  key: keyof OnboardingMilestones;
  label: string;
  icon: React.ReactNode;
}

const MILESTONES: MilestoneConfig[] = [
  { key: "projectHubViewed", label: "View Project Hub", icon: <Layers className="w-3 h-3" /> },
  { key: "knowledgeBrowsed", label: "Browse Knowledge", icon: <BookOpen className="w-3 h-3" /> },
  { key: "sessionLaunched", label: "Launch Session", icon: <Terminal className="w-3 h-3" /> },
  { key: "taskCreated", label: "Create Task", icon: <CheckSquare className="w-3 h-3" /> },
];

interface OnboardingProgressProps {
  className?: string;
  compact?: boolean;
}

export const OnboardingProgress = memo(function OnboardingProgress({
  className,
  compact = false,
}: OnboardingProgressProps) {
  const { milestones, isOnboardingComplete } = useOnboardingStore();
  const isComplete = isOnboardingComplete();

  // Filter to only show key milestones (not projectOpened/taskCompleted which are more advanced)
  const activeMilestones = useMemo(() => {
    return MILESTONES.map(m => ({
      ...m,
      completed: milestones[m.key],
    }));
  }, [milestones]);

  const completedCount = activeMilestones.filter(m => m.completed).length;
  const totalCount = activeMilestones.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  // Show brief celebration when all milestones complete
  if (isComplete) {
    return (
      <div className={cn("px-2 py-1.5", className)}>
        <div className="flex items-center gap-2 text-xs text-[var(--color-success)]">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {!compact && <span className="font-medium">Onboarding complete</span>}
        </div>
      </div>
    );
  }

  // Compact mode - just show progress bar
  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("px-2 py-1", className)}>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent-primary)] rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[10px] text-[var(--text-muted)]">
                {completedCount}/{totalCount}
              </span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[220px]">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[var(--accent-primary)]" />
              <span className="font-medium">Getting Started</span>
            </div>
            <div className="space-y-1.5">
              {activeMilestones.map((m) => (
                <div key={m.key} className="flex items-center gap-2 text-xs">
                  {m.completed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)]" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  )}
                  <span className={m.completed ? "text-[var(--text-muted)] line-through" : ""}>
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Full mode
  return (
    <div className={cn("p-3 space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-[var(--accent-primary)]" />
          <span className="text-xs font-medium text-[var(--text-primary)]">
            Getting Started
          </span>
        </div>
        <span className="text-xs text-[var(--text-muted)]">
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--accent-primary)] rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Milestone list */}
      <div className="space-y-1.5 pt-1">
        {activeMilestones.map((m) => (
          <div
            key={m.key}
            className={cn(
              "flex items-center gap-2 text-xs",
              m.completed ? "text-[var(--text-muted)]" : "text-[var(--text-secondary)]"
            )}
          >
            {m.completed ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)]" aria-hidden="true" />
            ) : (
              <span className="w-3.5 h-3.5 flex items-center justify-center" aria-hidden="true">
                {m.icon}
              </span>
            )}
            <span className={m.completed ? "line-through" : ""}>{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

export default OnboardingProgress;
