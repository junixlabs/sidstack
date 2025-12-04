/**
 * Project Overview - PM Dashboard for the Project Hub
 *
 * Replaces the empty state when no capability is selected in detail mode.
 * Shows 4 sections: Project OKRs, Capability Goals, Work Pipeline, Action Items.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Target,
  List,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Ticket,
  Shield,
  Plus,
  Loader2,
  CircleDot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { showSuccess, showError } from '@/lib/toast';
import { useProjectHubStore } from '@/stores/projectHubStore';
import type { HubViewMode, ProjectGoalsDomain, ProjectGoalsSubGoal } from '@/stores/projectHubStore';

const API_BASE = 'http://localhost:19432';

// ============================================================================
// Types
// ============================================================================

interface TaskSummary {
  id: string;
  title: string;
  status: string;
  priority: string;
}

interface OverviewData {
  tasks: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    blocked: number;
    topPending: TaskSummary[];
  };
  tickets: { total: number; awaitingReview: number };
  impact: { total: number; blocked: number };
}

interface OKRKeyResult {
  id: string;
  title: string;
  target: string;
  progress: number;
}

interface OKRObjective {
  id: string;
  title: string;
  keyResults: OKRKeyResult[];
}

interface OKRQuarter {
  id: string;
  label: string;
  theme: string;
  period: string;
  objectives: OKRObjective[];
}

interface OKRData {
  year: number;
  title: string;
  description: string;
  quarters: OKRQuarter[];
}

// ============================================================================
// Main Component
// ============================================================================

export function ProjectOverview() {
  const projectPath = useProjectHubStore((s) => s.projectPath);
  const viewMode = useProjectHubStore((s) => s.viewMode);
  const setViewMode = useProjectHubStore((s) => s.setViewMode);

  const projectId = useMemo(
    () => projectPath.split('/').pop() || 'default',
    [projectPath],
  );

  const [data, setData] = useState<OverviewData | null>(null);
  const [okrData, setOkrData] = useState<OKRData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || !projectPath) return;

    let cancelled = false;
    setLoading(true);

    const fetchData = async () => {
      const [tasksResult, ticketsResult, impactResult, okrResult] = await Promise.allSettled([
        fetch(`${API_BASE}/api/tasks?projectId=${encodeURIComponent(projectId)}`).then((r) =>
          r.ok ? r.json() : null,
        ),
        fetch(`${API_BASE}/api/tickets?projectId=${encodeURIComponent(projectId)}`).then((r) =>
          r.ok ? r.json() : null,
        ),
        fetch(`${API_BASE}/api/impact/list/${encodeURIComponent(projectId)}`).then((r) =>
          r.ok ? r.json() : null,
        ),
        fetch(`${API_BASE}/api/projects/okrs?path=${encodeURIComponent(projectPath)}`).then((r) =>
          r.ok ? r.json() : null,
        ),
      ]);

      if (cancelled) return;

      const tasksData = tasksResult.status === 'fulfilled' ? tasksResult.value : null;
      const ticketsData = ticketsResult.status === 'fulfilled' ? ticketsResult.value : null;
      const impactData = impactResult.status === 'fulfilled' ? impactResult.value : null;
      const okrResponse = okrResult.status === 'fulfilled' ? okrResult.value : null;

      if (okrResponse?.okrs) {
        setOkrData(okrResponse.okrs);
      }

      const tasks = tasksData?.tasks || [];
      const tickets = ticketsData?.tickets || [];
      const analyses = impactData?.analyses || [];

      const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const pendingTasks = tasks
        .filter((t: any) => t.status === 'pending')
        .sort((a: any, b: any) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4))
        .slice(0, 3)
        .map((t: any) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority }));

      setData({
        tasks: {
          total: tasks.length,
          pending: tasks.filter((t: any) => t.status === 'pending').length,
          inProgress: tasks.filter((t: any) => t.status === 'in_progress').length,
          completed: tasks.filter((t: any) => t.status === 'completed').length,
          blocked: tasks.filter((t: any) => t.status === 'blocked').length,
          topPending: pendingTasks,
        },
        tickets: {
          total: tickets.length,
          awaitingReview: tickets.filter(
            (t: any) => t.status === 'new' || t.status === 'reviewing',
          ).length,
        },
        impact: {
          total: analyses.length,
          blocked: analyses.filter((a: any) => a.gate?.status === 'blocked').length,
        },
      });
      setLoading(false);
    };

    fetchData();
    return () => { cancelled = true; };
  }, [projectId, projectPath]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <h2 className="text-base font-medium text-[var(--text-primary)] flex-1">
            Project Overview
          </h2>
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
        </div>

        {/* Section 1: Project OKRs */}
        <ProjectOKRsSection okrData={okrData} loading={loading} />

        {/* Section 2: Capability Goals */}
        <CapabilityGoalsSection />

        {/* Section 3: Work Pipeline */}
        <WorkPipelineSection data={data} loading={loading} />

        {/* Section 4: Action Items */}
        <ActionItemsSection data={data} loading={loading} projectId={projectId} />
      </div>
    </div>
  );
}

// ============================================================================
// Section 1: Project OKRs
// ============================================================================

function ProjectOKRsSection({
  okrData,
  loading,
}: {
  okrData: OKRData | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <SectionWrapper title="Project OKRs" icon={CircleDot}>
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Loader2 size={12} className="animate-spin" />
          <span>Loading...</span>
        </div>
      </SectionWrapper>
    );
  }

  if (!okrData) {
    return (
      <SectionWrapper title="Project OKRs" icon={CircleDot}>
        <p className="text-xs text-[var(--text-muted)] italic">
          No OKRs defined. Create .sidstack/project-okrs.json to set goals.
        </p>
      </SectionWrapper>
    );
  }

  // Compute overall progress across all quarters
  const allKRs = okrData.quarters.flatMap((q) =>
    q.objectives.flatMap((obj) => obj.keyResults),
  );
  const overallProgress = allKRs.length > 0
    ? Math.round(allKRs.reduce((sum, kr) => sum + kr.progress, 0) / allKRs.length)
    : 0;

  return (
    <SectionWrapper title={`OKRs ${okrData.year}`} icon={CircleDot}>
      {/* Year summary */}
      <div className="flex items-center gap-3 mb-1">
        <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
          Overall: {overallProgress}%
        </span>
        <span className="text-[10px] text-[var(--text-muted)]">
          {allKRs.length} key results
        </span>
      </div>
      <ProgressBar score={overallProgress} className="mb-3" />

      {/* Quarters */}
      <div className="space-y-2">
        {okrData.quarters.map((quarter) => (
          <QuarterCard key={quarter.id} quarter={quarter} />
        ))}
      </div>
    </SectionWrapper>
  );
}

function QuarterCard({ quarter }: { quarter: OKRQuarter }) {
  const [expanded, setExpanded] = useState(() => {
    // Auto-expand the current quarter
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const currentQ = `Q${Math.ceil(month / 3)}-${year}`;
    return quarter.id === currentQ;
  });

  // Quarter-level progress
  const allKRs = quarter.objectives.flatMap((obj) => obj.keyResults);
  const quarterProgress = allKRs.length > 0
    ? Math.round(allKRs.reduce((sum, kr) => sum + kr.progress, 0) / allKRs.length)
    : 0;

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-1)] overflow-hidden">
      {/* Quarter header */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--surface-2)] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown size={14} className="text-[var(--text-muted)] flex-shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-[var(--text-muted)] flex-shrink-0" />
        )}
        <span className="text-xs font-medium text-[var(--text-primary)] flex-1 text-left">
          {quarter.label}
          <span className="text-[var(--text-muted)] font-normal ml-1.5">{quarter.theme}</span>
        </span>
        <span className="text-[10px] text-[var(--text-muted)] mr-1">{quarter.period}</span>
        <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums w-10 text-right">
          {quarterProgress}%
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border-muted)]">
          {/* Quarter progress bar */}
          <div className="px-3 pt-2 pb-1">
            <ProgressBar score={quarterProgress} />
          </div>

          {/* Objectives */}
          <div className="px-3 pb-3 space-y-2 mt-1">
            {quarter.objectives.map((obj) => (
              <ObjectiveBlock key={obj.id} objective={obj} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ObjectiveBlock({ objective }: { objective: OKRObjective }) {
  const [expanded, setExpanded] = useState(false);

  const objProgress = objective.keyResults.length > 0
    ? Math.round(
        objective.keyResults.reduce((sum, kr) => sum + kr.progress, 0) /
          objective.keyResults.length,
      )
    : 0;

  return (
    <div>
      {/* Objective header */}
      <button
        className="w-full flex items-center gap-2 py-1 text-left hover:bg-[var(--surface-2)] rounded px-1 -mx-1 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown size={10} className="text-[var(--text-muted)] flex-shrink-0" />
        ) : (
          <ChevronRight size={10} className="text-[var(--text-muted)] flex-shrink-0" />
        )}
        <span className="text-[10px] text-[var(--text-muted)] font-mono flex-shrink-0">
          {objective.id}
        </span>
        <span className="text-xs text-[var(--text-primary)] flex-1 truncate">
          {objective.title}
        </span>
        <span className="text-[11px] font-semibold text-[var(--text-primary)] tabular-nums w-8 text-right flex-shrink-0">
          {objProgress}%
        </span>
      </button>

      {/* Key Results */}
      {expanded && (
        <div className="ml-5 mt-1 space-y-1.5">
          {objective.keyResults.map((kr) => (
            <KeyResultRow key={kr.id} kr={kr} />
          ))}
        </div>
      )}
    </div>
  );
}

function KeyResultRow({ kr }: { kr: OKRKeyResult }) {
  return (
    <div className="text-xs">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[var(--text-muted)] font-mono w-10 flex-shrink-0">
          {kr.id}
        </span>
        <span className="text-[var(--text-primary)] flex-1 truncate">{kr.title}</span>
        <span className="text-[11px] font-semibold text-[var(--text-primary)] tabular-nums w-8 text-right flex-shrink-0">
          {kr.progress}%
        </span>
      </div>
      <div className="flex items-center gap-2 mt-0.5 ml-12">
        <div className="flex-1">
          <ProgressBar score={kr.progress} />
        </div>
        <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0 w-24 text-right truncate">
          {kr.target}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Section 2: Capability Goals
// ============================================================================

function CapabilityGoalsSection() {
  const projectGoalsData = useProjectHubStore((s) => s.projectGoalsData);

  if (!projectGoalsData || projectGoalsData.domains.length === 0) {
    return null;
  }

  const { overallScore, domains } = projectGoalsData;

  return (
    <SectionWrapper title="Capability Goals" icon={Target}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
          Overall: {overallScore}%
        </span>
      </div>
      <ProgressBar score={overallScore} className="mb-3" />

      <div className="space-y-2">
        {domains.map((domain) => (
          <DomainRow key={domain.domain.id} domain={domain} />
        ))}
      </div>
    </SectionWrapper>
  );
}

function DomainRow({ domain }: { domain: ProjectGoalsDomain }) {
  const [expanded, setExpanded] = useState(false);
  const selectCapability = useProjectHubStore((s) => s.selectCapability);

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-1)] overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--surface-2)] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown size={14} className="text-[var(--text-muted)] flex-shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-[var(--text-muted)] flex-shrink-0" />
        )}
        <span className="text-xs font-medium text-[var(--text-primary)] flex-1 text-left truncate">
          {domain.domain.name}
        </span>
        <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
          {domain.score}%
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border-muted)] px-3 pb-2 pt-1.5 space-y-0.5">
          {domain.subGoals.map((sg, i) => (
            <SubGoalRow
              key={sg.capability.id}
              index={i + 1}
              subGoal={sg}
              onSelect={() => selectCapability(sg.capability.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

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
// Section 3: Work Pipeline
// ============================================================================

function WorkPipelineSection({
  data,
  loading,
}: {
  data: OverviewData | null;
  loading: boolean;
}) {
  return (
    <SectionWrapper title="Work Pipeline" icon={List}>
      <div className="grid grid-cols-4 gap-2 mb-3">
        <StatusCard label="Pending" value={data?.tasks.pending} loading={loading} />
        <StatusCard label="In Progress" value={data?.tasks.inProgress} loading={loading} />
        <StatusCard label="Completed" value={data?.tasks.completed} loading={loading} />
        <StatusCard label="Blocked" value={data?.tasks.blocked} loading={loading} />
      </div>

      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        <Ticket size={12} className="text-[var(--text-muted)] flex-shrink-0" />
        <span>
          Tickets: {loading ? '--' : data?.tickets.total ?? '--'} total
          {!loading && data && data.tickets.awaitingReview > 0 && (
            <>, <span className="text-[var(--color-warning)]">{data.tickets.awaitingReview} awaiting review</span></>
          )}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mt-1.5">
        <Shield size={12} className="text-[var(--text-muted)] flex-shrink-0" />
        <span>
          Impact: {loading ? '--' : data?.impact.total ?? '--'} analyses
          {!loading && data && data.impact.blocked > 0 && (
            <>, <span className="text-[var(--color-error)]">{data.impact.blocked} blocked</span></>
          )}
        </span>
      </div>
    </SectionWrapper>
  );
}

function StatusCard({
  label,
  value,
  loading,
}: {
  label: string;
  value?: number;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-1)] p-3 text-center">
      <div className="text-lg font-semibold text-[var(--text-primary)] tabular-nums">
        {loading ? '--' : value ?? '--'}
      </div>
      <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5">
        {label}
      </div>
    </div>
  );
}

// ============================================================================
// Section 4: Action Items
// ============================================================================

function ActionItemsSection({
  data,
  loading,
  projectId,
}: {
  data: OverviewData | null;
  loading: boolean;
  projectId: string;
}) {
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateTask = async () => {
    setIsCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: 'New task',
          description: 'Created from Project Overview',
          taskType: 'feature',
          createdBy: 'ui',
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      showSuccess('Task created');
    } catch (err: any) {
      showError('Failed to create task', err.message);
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <SectionWrapper title="Action Items" icon={AlertTriangle}>
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Loader2 size={12} className="animate-spin" />
          <span>Loading...</span>
        </div>
      </SectionWrapper>
    );
  }

  const hasBlockers = data && data.impact.blocked > 0;
  const hasTicketsToReview = data && data.tickets.awaitingReview > 0;
  const hasTopTasks = data && data.tasks.topPending.length > 0;
  const hasItems = hasBlockers || hasTicketsToReview || hasTopTasks;

  return (
    <SectionWrapper title="Action Items" icon={AlertTriangle}>
      {!hasItems && (
        <p className="text-xs text-[var(--text-muted)] italic">No action items right now.</p>
      )}

      <div className="space-y-2">
        {hasBlockers && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[var(--color-error)]">
              {data!.impact.blocked} impact blocker{data!.impact.blocked > 1 ? 's' : ''} to resolve
            </span>
          </div>
        )}

        {hasTicketsToReview && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[var(--color-warning)]">
              {data!.tickets.awaitingReview} ticket{data!.tickets.awaitingReview > 1 ? 's' : ''} awaiting review
            </span>
          </div>
        )}

        {hasTopTasks && (
          <div className="mt-1">
            <div className="text-[11px] text-[var(--text-muted)] mb-1">Top tasks to start:</div>
            <div className="space-y-1">
              {data!.tasks.topPending.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-[var(--surface-1)] border border-[var(--border-muted)]"
                >
                  <PriorityBadge priority={task.priority} />
                  <span className="text-[var(--text-primary)] flex-1 truncate">{task.title}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">pending</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCreateTask}
          disabled={isCreating}
        >
          {isCreating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          Create Task
        </Button>
      </div>
    </SectionWrapper>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-[var(--color-error)]/20 text-[var(--color-error)]',
    high: 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]',
    medium: 'bg-[var(--surface-3)] text-[var(--text-secondary)]',
    low: 'bg-[var(--surface-2)] text-[var(--text-muted)]',
  };
  return (
    <span
      className={cn(
        'text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0',
        colors[priority] || 'bg-[var(--surface-3)] text-[var(--text-muted)]',
      )}
    >
      {priority}
    </span>
  );
}

// ============================================================================
// Shared Components
// ============================================================================

function SectionWrapper({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-[var(--border-muted)] pt-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={12} className="text-[var(--text-muted)]" />
        <h3 className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function ProgressBar({ score, className }: { score: number; className?: string }) {
  return (
    <div className={cn('h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden', className)}>
      <div
        className={cn(
          'h-full rounded-full transition-all duration-300',
          score >= 80
            ? 'bg-[var(--color-success)]'
            : score >= 50
              ? 'bg-[var(--accent-primary)]'
              : score >= 20
                ? 'bg-[var(--color-warning)]'
                : 'bg-[var(--text-muted)]',
        )}
        style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
      />
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
    <span
      className={cn(
        'text-[10px] px-1.5 py-0.5 rounded flex-shrink-0',
        colors[maturity] || 'bg-[var(--surface-3)] text-[var(--text-muted)]',
      )}
    >
      {maturity}
    </span>
  );
}

function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: HubViewMode;
  onChange: (m: HubViewMode) => void;
}) {
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
