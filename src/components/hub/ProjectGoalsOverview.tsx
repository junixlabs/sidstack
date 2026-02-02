/**
 * Project Goals Overview - Project-wide goal progress dashboard
 *
 * Shows when viewMode === 'goals' and no capability is selected.
 * Aggregates all L0 domains with L1 sub-goals and scores.
 */

import { useMemo, useState } from 'react';
import { Target, ChevronDown, ChevronRight, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectHubStore } from '@/stores/projectHubStore';
import type { HubViewMode, ProjectGoalsDomain, ProjectGoalsSubGoal } from '@/stores/projectHubStore';

export function ProjectGoalsOverview() {
  const projectGoalsData = useProjectHubStore((s) => s.projectGoalsData);
  const viewMode = useProjectHubStore((s) => s.viewMode);
  const setViewMode = useProjectHubStore((s) => s.setViewMode);

  if (!projectGoalsData || projectGoalsData.domains.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Target size={48} className="mx-auto mb-3 text-[var(--text-muted)] opacity-30" />
          <p className="text-sm text-[var(--text-secondary)] mb-1">No goals data available</p>
          <p className="text-xs text-[var(--text-muted)] max-w-[240px]">
            Load capabilities to view the project goals overview.
          </p>
        </div>
      </div>
    );
  }

  const { overallScore, domains } = projectGoalsData;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-5">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-medium text-[var(--text-primary)] flex-1">Project Goals Overview</h2>
            <ViewModeToggle mode={viewMode} onChange={setViewMode} />
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
              Overall: {overallScore}%
            </span>
          </div>
          <ProgressBar score={overallScore} className="mt-2" />
        </div>

        {/* Domain sections */}
        {domains.map((domain) => (
          <DomainSection key={domain.domain.id} domain={domain} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Domain Section
// ============================================================================

function DomainSection({ domain }: { domain: ProjectGoalsDomain }) {
  const [expanded, setExpanded] = useState(true);
  const selectCapability = useProjectHubStore((s) => s.selectCapability);

  const purpose = useMemo(() => {
    const p = domain.domain.purpose;
    if (typeof p === 'string') return p;
    return p?.objective || p?.description || '';
  }, [domain.domain.purpose]);

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-1)] overflow-hidden">
      {/* Domain header */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--surface-2)] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown size={14} className="text-[var(--text-muted)] flex-shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-[var(--text-muted)] flex-shrink-0" />
        )}
        <span className="text-xs font-medium text-[var(--text-primary)] uppercase tracking-wider flex-1 text-left">
          {domain.domain.name}
        </span>
        <span className="text-xs text-[var(--text-muted)]">({domain.subGoals.length})</span>
        <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums ml-2">
          {domain.score}%
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border-muted)]">
          {/* Domain progress bar */}
          <div className="px-3 pt-2.5 pb-1">
            <ProgressBar score={domain.score} />
          </div>

          {/* Domain goal */}
          {purpose && (
            <div className="px-3 py-1.5">
              <span className="text-[11px] text-[var(--text-muted)]">Goal: </span>
              <span className="text-[11px] text-[var(--text-secondary)]">{purpose}</span>
            </div>
          )}

          {/* Sub-goal rows */}
          <div className="px-3 pb-3 space-y-1 mt-1">
            {domain.subGoals.map((sg, i) => (
              <SubGoalRow
                key={sg.capability.id}
                index={i + 1}
                subGoal={sg}
                onSelect={() => selectCapability(sg.capability.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-goal Row
// ============================================================================

function SubGoalRow({
  index,
  subGoal,
  onSelect,
}: {
  index: number;
  subGoal: ProjectGoalsSubGoal;
  onSelect: () => void;
}) {
  return (
    <button
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--surface-2)] transition-colors text-left"
      onClick={onSelect}
    >
      <span className="text-[11px] text-[var(--text-muted)] w-5 text-right flex-shrink-0 tabular-nums">
        {index}.
      </span>
      <span className="text-xs text-[var(--text-primary)] flex-1 truncate">
        {subGoal.capability.name}
      </span>
      <MaturityTag maturity={subGoal.capability.maturity} />
      <span className="text-[11px] font-semibold text-[var(--text-primary)] tabular-nums w-8 text-right flex-shrink-0">
        {subGoal.score}%
      </span>
    </button>
  );
}

// ============================================================================
// Shared Components
// ============================================================================

function ProgressBar({ score, className }: { score: number; className?: string }) {
  return (
    <div className={cn('h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden', className)}>
      <div
        className={cn(
          'h-full rounded-full transition-all duration-300',
          score >= 80 ? 'bg-[var(--color-success)]' :
          score >= 50 ? 'bg-[var(--accent-primary)]' :
          score >= 20 ? 'bg-[var(--color-warning)]' :
          'bg-[var(--text-muted)]',
        )}
        style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
      />
    </div>
  );
}

function ViewModeToggle({ mode, onChange }: { mode: HubViewMode; onChange: (m: HubViewMode) => void }) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 bg-[var(--surface-2)] rounded-md">
      <button
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all',
          mode === 'detail'
            ? 'bg-[var(--surface-0)] text-[var(--text-primary)] shadow-sm'
            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
        )}
        onClick={() => onChange('detail')}
      >
        <List className="w-3 h-3" />
        Detail
      </button>
      <button
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all',
          mode === 'goals'
            ? 'bg-[var(--surface-0)] text-[var(--text-primary)] shadow-sm'
            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
        )}
        onClick={() => onChange('goals')}
      >
        <Target className="w-3 h-3" />
        Goals
      </button>
    </div>
  );
}

function MaturityTag({ maturity }: { maturity: string }) {
  const colors: Record<string, string> = {
    planned: 'bg-[var(--surface-3)] text-[var(--text-muted)]',
    developing: 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]',
    established: 'bg-[var(--color-success)]/20 text-[var(--color-success)]',
    optimized: 'bg-[var(--color-info)]/20 text-[var(--color-info)]',
  };
  return (
    <span className={cn('text-[11px] px-1.5 py-0.5 rounded flex-shrink-0', colors[maturity] || 'bg-[var(--surface-3)] text-[var(--text-muted)]')}>
      {maturity}
    </span>
  );
}
