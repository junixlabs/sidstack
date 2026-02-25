/**
 * ProjectDashboard - PM-focused dashboard for the Project Hub
 *
 * Single-page scrollable dashboard with:
 * - Work Pipeline (status cards)
 * - Quick Actions
 * - Needs Attention
 * - Workflow Grid
 * - Governance Status
 * - OKRs (if configured)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2,
  BarChart3,
  Zap,
  AlertTriangle,
  GitBranch,
  Shield,
  Target,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuickActions } from './QuickActions';
import { NeedsAttention } from './NeedsAttention';
import { WorkflowGrid } from './WorkflowGrid';
import { GovernanceStatus } from './GovernanceStatus';

import { getApiBaseUrl, apiFetch } from '@/lib/api-config';
const API_BASE = getApiBaseUrl();

// ============================================================================
// Types
// ============================================================================

interface TaskCounts {
  pending: number;
  in_progress: number;
  completed: number;
  blocked: number;
}

interface AttentionItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  age: string;
}

interface GovernanceStats {
  knowledgeDocs: number;
  qualityGates: number;
  openIncidents: number;
  activeRules: number;
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
  quarters: OKRQuarter[];
}

interface DashboardData {
  taskCounts: TaskCounts;
  tasksByType: Record<string, number>;
  needsAttention: AttentionItem[];
  governanceStats: GovernanceStats;
  okrData: OKRData | null;
}

// ============================================================================
// Props
// ============================================================================

interface ProjectDashboardProps {
  projectPath: string;
  projectId: string;
}

// ============================================================================
// Helpers
// ============================================================================

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return 'just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1d ago';
  return `${diffDays}d ago`;
}

// ============================================================================
// Main Component
// ============================================================================

export function ProjectDashboard({ projectPath, projectId }: ProjectDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const hasDataRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!projectId || !projectPath) return;

    // Only show loading spinner on first load
    if (!hasDataRef.current) setLoading(true);

    try {
      const [tasksResult, knowledgeResult, okrResult, trainingResult] = await Promise.allSettled([
        apiFetch(`${API_BASE}/api/tasks?projectId=${encodeURIComponent(projectId)}`).then((r) =>
          r.ok ? r.json() : null
        ),
        apiFetch(`${API_BASE}/api/knowledge/stats?projectPath=${encodeURIComponent(projectPath)}`).then((r) =>
          r.ok ? r.json() : null
        ),
        apiFetch(`${API_BASE}/api/projects/okrs?path=${encodeURIComponent(projectPath)}`).then((r) =>
          r.ok ? r.json() : null
        ),
        apiFetch(`${API_BASE}/api/training/stats?projectPath=${encodeURIComponent(projectPath)}`).then((r) =>
          r.ok ? r.json() : null
        ),
      ]);

      if (!mountedRef.current) return;

      const tasksData = tasksResult.status === 'fulfilled' ? tasksResult.value : null;
      const knowledgeData = knowledgeResult.status === 'fulfilled' ? knowledgeResult.value : null;
      const okrResponse = okrResult.status === 'fulfilled' ? okrResult.value : null;
      const trainingData = trainingResult.status === 'fulfilled' ? trainingResult.value : null;

      // If all results are null/failed, API is likely not ready — schedule retry
      const allFailed = !tasksData && !knowledgeData && !okrResponse && !trainingData;
      if (allFailed && !hasDataRef.current) {
        // Retry in 3 seconds if we have no data yet
        retryTimerRef.current = setTimeout(() => {
          if (mountedRef.current) fetchData();
        }, 3000);
        return;
      }

      const tasks = tasksData?.tasks || [];

      // Task counts
      const taskCounts: TaskCounts = {
        pending: tasks.filter((t: any) => t.status === 'pending').length,
        in_progress: tasks.filter((t: any) => t.status === 'in_progress').length,
        completed: tasks.filter((t: any) => t.status === 'completed').length,
        blocked: tasks.filter((t: any) => t.status === 'blocked').length,
      };

      // Tasks by type
      const tasksByType: Record<string, number> = {};
      for (const t of tasks) {
        if (t.status !== 'completed') {
          const type = (t as any).taskType || 'other';
          tasksByType[type] = (tasksByType[type] || 0) + 1;
        }
      }

      // Needs attention items
      const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const attentionItems: AttentionItem[] = [];

      // Blocked tasks
      for (const t of tasks.filter((t: any) => t.status === 'blocked')) {
        attentionItems.push({
          id: t.id,
          title: t.title,
          status: 'blocked',
          priority: t.priority || 'medium',
          age: timeAgo(t.updatedAt || t.createdAt),
        });
      }

      // High priority pending tasks
      for (const t of tasks
        .filter((t: any) => t.status === 'pending' && (t.priority === 'critical' || t.priority === 'high'))
        .sort((a: any, b: any) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4))
      ) {
        attentionItems.push({
          id: t.id,
          title: t.title,
          status: 'pending',
          priority: t.priority || 'medium',
          age: timeAgo(t.updatedAt || t.createdAt),
        });
      }

      // Governance stats from knowledge + training
      const byType = knowledgeData?.byType || {};
      const trainingStats = trainingData?.stats || {};
      const governanceStats: GovernanceStats = {
        knowledgeDocs: knowledgeData?.totalDocuments || 0,
        qualityGates: byType['rule'] || 0,
        openIncidents: trainingStats.openIncidents || 0,
        activeRules: trainingStats.activeRules || 0,
      };

      hasDataRef.current = true;
      setData({
        taskCounts,
        tasksByType,
        needsAttention: attentionItems.slice(0, 5),
        governanceStats,
        okrData: okrResponse?.okrs || null,
      });
      setLoading(false);
    } catch {
      // Network error — API not ready, retry if no data yet
      if (!hasDataRef.current && mountedRef.current) {
        retryTimerRef.current = setTimeout(() => {
          if (mountedRef.current) fetchData();
        }, 3000);
      }
    }
  }, [projectId, projectPath]);

  // Fetch on mount and when project changes
  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [fetchData]);

  // Listen for Cmd+R refresh
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener('sidstack:refresh', handler);
    return () => window.removeEventListener('sidstack:refresh', handler);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" />
        <span className="ml-2 text-sm text-[var(--text-muted)]">Loading dashboard...</span>
      </div>
    );
  }

  const taskCounts = data?.taskCounts || { pending: 0, in_progress: 0, completed: 0, blocked: 0 };
  const governanceStats = data?.governanceStats || { knowledgeDocs: 0, qualityGates: 0, openIncidents: 0, activeRules: 0 };

  return (
    <div className="p-4 space-y-5 max-w-5xl mx-auto">
      {/* Work Pipeline */}
      <DashboardSection title="Work Pipeline" icon={BarChart3}>
        <div className="grid grid-cols-4 gap-3">
          <PipelineCard label="Pending" count={taskCounts.pending} color="var(--color-warning)" />
          <PipelineCard label="In Progress" count={taskCounts.in_progress} color="var(--accent-primary)" />
          <PipelineCard label="Completed" count={taskCounts.completed} color="var(--color-success)" />
          <PipelineCard label="Blocked" count={taskCounts.blocked} color="var(--color-error)" />
        </div>
      </DashboardSection>

      {/* Quick Actions */}
      <DashboardSection title="Quick Actions" icon={Zap}>
        <QuickActions />
      </DashboardSection>

      {/* Needs Attention */}
      <DashboardSection title="Needs Attention" icon={AlertTriangle}>
        <NeedsAttention items={data?.needsAttention || []} />
      </DashboardSection>

      {/* Workflows */}
      <DashboardSection title="Workflows" icon={GitBranch}>
        <WorkflowGrid taskCounts={data?.tasksByType || {}} />
      </DashboardSection>

      {/* Governance Status */}
      <DashboardSection title="Governance Status" icon={Shield}>
        <GovernanceStatus stats={governanceStats} loading={loading} />
      </DashboardSection>

      {/* OKRs (only if configured) */}
      {data?.okrData && (
        <DashboardSection title={`OKRs ${data.okrData.year}`} icon={Target}>
          <OKRSummary okrData={data.okrData} />
        </DashboardSection>
      )}
    </div>
  );
}

// ============================================================================
// Pipeline Card
// ============================================================================

function PipelineCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-muted)] bg-[var(--surface-1)] p-4 text-center">
      <div className="text-2xl font-semibold tabular-nums" style={{ color }}>
        {count}
      </div>
      <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider mt-1">
        {label}
      </div>
    </div>
  );
}

// ============================================================================
// Dashboard Section Wrapper
// ============================================================================

function DashboardSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} className="text-[var(--text-muted)]" />
        <h3 className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
          {title}
        </h3>
      </div>
      <div className="border-t border-[var(--border-muted)] pt-3">
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// OKR Summary (compact version)
// ============================================================================

function OKRSummary({ okrData }: { okrData: OKRData }) {
  const allKRs = okrData.quarters.flatMap((q) =>
    q.objectives.flatMap((obj) => obj.keyResults)
  );
  const overallProgress = allKRs.length > 0
    ? Math.round(allKRs.reduce((sum, kr) => sum + kr.progress, 0) / allKRs.length)
    : 0;

  return (
    <div className="space-y-3">
      {/* Overall progress */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
          Overall: {overallProgress}%
        </span>
        <span className="text-[11px] text-[var(--text-muted)]">
          {allKRs.length} key results
        </span>
      </div>
      <ProgressBar score={overallProgress} />

      {/* Quarter cards */}
      <div className="grid grid-cols-2 gap-2">
        {okrData.quarters.map((quarter) => {
          const qKRs = quarter.objectives.flatMap((obj) => obj.keyResults);
          const qProgress = qKRs.length > 0
            ? Math.round(qKRs.reduce((sum, kr) => sum + kr.progress, 0) / qKRs.length)
            : 0;

          return (
            <QuarterCompact key={quarter.id} quarter={quarter} progress={qProgress} />
          );
        })}
      </div>
    </div>
  );
}

function QuarterCompact({ quarter, progress }: { quarter: OKRQuarter; progress: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--border-muted)] bg-[var(--surface-1)] overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--surface-2)] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown size={12} className="text-[var(--text-muted)] flex-shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-[var(--text-muted)] flex-shrink-0" />
        )}
        <span className="text-xs font-medium text-[var(--text-primary)] flex-1 text-left">
          {quarter.label}
        </span>
        <span className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">
          {progress}%
        </span>
      </button>
      {expanded && (
        <div className="border-t border-[var(--border-muted)] px-3 py-2 space-y-1">
          <ProgressBar score={progress} />
          {quarter.objectives.map((obj) => (
            <div key={obj.id} className="text-xs text-[var(--text-secondary)] truncate mt-1">
              {obj.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ score }: { score: number }) {
  return (
    <div className="h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
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
