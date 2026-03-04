import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useDashboard } from '@/hooks/queries';

export default function DashboardPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get('projectId') || '';

  const { data, isLoading: loading } = useDashboard(projectId);
  const taskList = data?.tasks || [];
  const ticketList = data?.tickets || [];
  const docCount = data?.docCount || 0;

  const byStatus = (status: string) => taskList.filter(t => t.status === status).length;
  const activeTasks = taskList.filter(t => t.status === 'in_progress').length;
  const completedTasks = taskList.filter(t => t.status === 'completed').length;
  const blockedTasks = taskList.filter(t => t.status === 'blocked');
  const openTickets = ticketList.filter(t => t.status !== 'completed' && t.status !== 'rejected').length;
  const totalTasks = taskList.length;
  const healthPct = totalTasks > 0 ? Math.round(((completedTasks + activeTasks) / totalTasks) * 100) : 0;

  const recentTasks = [...taskList].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);

  if (loading) {
    return <div className="p-8 text-[var(--text-muted)] text-sm">Loading dashboard...</div>;
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-1">Dashboard</h1>
        <p className="text-sm text-[var(--text-secondary)]">Project overview and team activity</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Health Score" value={`${healthPct}%`} sub={healthPct >= 80 ? 'On track' : 'Needs attention'} color={healthPct >= 80 ? 'green' : 'amber'} />
        <StatCard label="Active Tasks" value={String(activeTasks)} sub={`${completedTasks} completed`} />
        <StatCard label="Open Tickets" value={String(openTickets)} sub={`${ticketList.length} total`} color={openTickets > 5 ? 'amber' : undefined} />
        <StatCard label="Knowledge Docs" value={String(docCount)} sub="Total documents" color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Work Pipeline */}
        <div className="border border-[var(--border)] rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Work Pipeline</h3>
          <PipelineRow label="Pending" count={byStatus('pending')} total={totalTasks} />
          <PipelineRow label="In Progress" count={byStatus('in_progress')} total={totalTasks} />
          <PipelineRow label="Completed" count={byStatus('completed')} total={totalTasks} color="green" />
          <PipelineRow label="Blocked" count={byStatus('blocked')} total={totalTasks} color="red" />
        </div>

        {/* Blockers */}
        <div className="border border-[var(--border)] rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Blockers <span className="text-[var(--text-muted)] font-normal">({blockedTasks.length})</span></h3>
          {blockedTasks.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No blocked tasks</p>
          ) : (
            blockedTasks.slice(0, 3).map(t => (
              <div key={t.id} className="py-2.5 border-b border-[var(--border-light)] last:border-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--red-bg)] text-[var(--red-text)]">
                    <AlertTriangle size={11} /> BLOCKED
                  </span>
                  <span
                    className="text-sm font-medium cursor-pointer hover:text-[var(--accent)]"
                    onClick={() => navigate(`/tasks/${t.id}?${searchParams.toString()}`)}
                  >
                    {t.title}
                  </span>
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {t.assignedAgent || 'Unassigned'} &middot; {timeAgo(t.updatedAt)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Recent Activity */}
        <div className="border border-[var(--border)] rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Recent Activity</h3>
          {recentTasks.map(t => (
            <div key={t.id} className="flex gap-3 py-2.5 border-b border-[var(--border-light)] last:border-0">
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${statusDotColor(t.status)}`} />
              <div>
                <div className="text-sm text-[var(--text-secondary)]">
                  <strong className="text-[var(--text)]">{t.assignedAgent || t.createdBy || 'Agent'}</strong> updated "{t.title}"
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">{timeAgo(t.updatedAt)}</div>
              </div>
            </div>
          ))}
          {recentTasks.length === 0 && <p className="text-sm text-[var(--text-muted)]">No recent activity</p>}
        </div>

        {/* Task Distribution */}
        <div className="border border-[var(--border)] rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4">Task Summary</h3>
          <div className="space-y-3">
            {['pending', 'review', 'in_progress', 'completed', 'blocked'].map(status => {
              const count = byStatus(status);
              return (
                <div key={status} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${statusDotColor(status)}`} />
                    <span className="text-[var(--text-secondary)] capitalize">{status.replace('_', ' ')}</span>
                  </div>
                  <span className="font-medium">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  const colorClass = color === 'green' ? 'text-[var(--green)]' : color === 'amber' ? 'text-[var(--amber)]' : color === 'red' ? 'text-[var(--red)]' : color === 'blue' ? 'text-[var(--blue)]' : '';
  return (
    <div className="border border-[var(--border)] rounded-lg p-4">
      <div className="text-xs text-[var(--text-muted)] font-medium mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-xs text-[var(--text-secondary)] mt-0.5">{sub}</div>
    </div>
  );
}

function PipelineRow({ label, count, total, color }: { label: string; count: number; total: number; color?: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const barColor = color === 'green' ? 'bg-[var(--green)]' : color === 'red' ? 'bg-[var(--red)]' : 'bg-[var(--accent)]';
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between text-xs mb-1.5">
        <span>{label}</span>
        <span className="text-[var(--text-muted)]">{count}</span>
      </div>
      <div className="h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function statusDotColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-[var(--text-muted)]',
    review: 'bg-[var(--amber)]',
    in_progress: 'bg-[var(--blue)]',
    completed: 'bg-[var(--green)]',
    blocked: 'bg-[var(--red)]',
    failed: 'bg-[var(--red)]',
  };
  return map[status] || 'bg-[var(--text-muted)]';
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
