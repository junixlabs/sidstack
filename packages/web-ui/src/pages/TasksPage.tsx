import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, RefreshCw } from 'lucide-react';
import { useTasks } from '@/hooks/queries';

const STATUS_OPTIONS = ['pending', 'review', 'in_progress', 'completed', 'blocked', 'failed', 'cancelled'];

export default function TasksPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get('projectId') || '';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filters: Record<string, string | number> = { fields: 'standard' };
  if (searchQuery) filters.search = searchQuery;
  if (statusFilter) filters.status = statusFilter;
  else filters.preset = 'all';

  const { data, isLoading: loading, error: queryError, refetch } = useTasks(projectId, filters);
  const taskList = data?.tasks || [];
  const error = queryError instanceof Error ? queryError.message : queryError ? 'Failed to load' : '';

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold mb-1">Tasks</h1>
          <p className="text-sm text-[var(--text-secondary)]">Manage and track project tasks</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[var(--border)] mb-5">
        {['All Tasks', 'Active', 'Completed', 'Blocked'].map(t => {
          const isAll = t === 'All Tasks';
          const active = isAll ? !statusFilter : statusFilter === t.toLowerCase().replace(' ', '_');
          return (
            <button key={t}
              onClick={() => setStatusFilter(isAll ? '' : t === 'Active' ? 'in_progress' : t.toLowerCase())}
              className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors
                ${active ? 'text-[var(--accent)] border-[var(--accent)]' : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text)]'}`}
            >{t}</button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 border border-[var(--border)] rounded-md bg-white min-w-[240px]">
          <Search size={15} className="text-[var(--text-muted)]" />
          <input type="text" placeholder="Search tasks..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-[var(--text-muted)]" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-white text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <button onClick={() => refetch()} className="p-2 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)]" title="Refresh">
          <RefreshCw size={15} />
        </button>
        <span className="ml-auto text-xs text-[var(--text-muted)]">{taskList.length} tasks</span>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 text-sm rounded-md bg-[var(--red-bg)] text-[var(--red-text)] border border-red-200">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-sm text-[var(--text-muted)]">Loading...</div>
      ) : taskList.length === 0 ? (
        <div className="text-center py-16 text-sm text-[var(--text-muted)]">No tasks found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.03em] py-2.5 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)]">Title</th>
                <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.03em] py-2.5 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] w-24">Status</th>
                <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.03em] py-2.5 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] w-20">Priority</th>
                <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.03em] py-2.5 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] w-24">Assigned</th>
                <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.03em] py-2.5 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] w-20">Progress</th>
                <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.03em] py-2.5 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] w-24">Updated</th>
              </tr>
            </thead>
            <tbody>
              {taskList.map(task => (
                <tr key={task.id} className="hover:bg-[var(--bg-secondary)] cursor-pointer" onClick={() => navigate(`/tasks/${task.id}?${searchParams.toString()}`)}>
                  <td className="py-2.5 px-3 border-b border-[var(--border-light)] font-medium">{task.title}</td>
                  <td className="py-2.5 px-3 border-b border-[var(--border-light)]"><StatusBadge status={task.status} /></td>
                  <td className="py-2.5 px-3 border-b border-[var(--border-light)]">
                    <span className="flex items-center gap-1.5">
                      <PriorityDot priority={task.priority} />
                      <span className="capitalize">{task.priority}</span>
                    </span>
                  </td>
                  <td className="py-2.5 px-3 border-b border-[var(--border-light)] text-[var(--text-muted)]">{task.assignedAgent || 'Unassigned'}</td>
                  <td className="py-2.5 px-3 border-b border-[var(--border-light)]">
                    <div className="w-14 h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${task.status === 'completed' ? 'bg-[var(--green)]' : 'bg-[var(--accent)]'}`} style={{ width: `${task.progress}%` }} />
                    </div>
                  </td>
                  <td className="py-2.5 px-3 border-b border-[var(--border-light)] text-[var(--text-muted)] text-xs">{timeAgo(task.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]',
    review: 'bg-[var(--amber-bg)] text-[var(--amber-text)]',
    in_progress: 'bg-[var(--blue-bg)] text-[var(--blue-text)]',
    completed: 'bg-[var(--green-bg)] text-[var(--green-text)]',
    blocked: 'bg-[var(--red-bg)] text-[var(--red-text)]',
    failed: 'bg-[var(--red-bg)] text-[var(--red-text)]',
    cancelled: 'bg-[var(--bg-secondary)] text-[var(--text-muted)]',
  };
  return <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${map[status] || map.pending}`}>{status.replace('_', ' ')}</span>;
}

function PriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = { high: 'bg-[var(--amber)]', critical: 'bg-[var(--red)]', medium: 'bg-[var(--blue)]', low: 'bg-[var(--text-muted)]' };
  return <span className={`w-1.5 h-1.5 rounded-full ${colors[priority] || colors.medium}`} />;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
