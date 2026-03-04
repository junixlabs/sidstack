import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useActivity } from '@/hooks/queries';

export default function ActivityPage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || '';

  const { data, isLoading } = useActivity(projectId);
  const [filter, setFilter] = useState<'all' | 'agent' | 'user'>('all');

  const recentTasks = [...(data?.tasks || [])].sort((a, b) => b.updatedAt - a.updatedAt);

  const filtered = recentTasks.filter(t => {
    if (filter === 'agent') return t.assignedAgent || t.createdBy === 'agent';
    if (filter === 'user') return t.createdBy === 'user' || (!t.assignedAgent && t.createdBy !== 'agent');
    return true;
  });

  if (isLoading) return <div className="p-8 text-sm text-[var(--text-muted)]">Loading activity...</div>;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-1">Activity</h1>
        <p className="text-sm text-[var(--text-secondary)]">Audit log of all actions across the project</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-5">
        {(['all', 'agent', 'user'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-[13px] font-medium rounded-md border transition-colors capitalize
              ${filter === f
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'bg-white text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-hover)]'}`}
          >{f === 'all' ? 'All Users' : f}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-[var(--text-muted)]">No activity found</div>
      ) : (
        <div>
          {filtered.map(t => (
            <div key={t.id} className="flex gap-3 py-3 border-b border-[var(--border-light)]">
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${statusDotColor(t.status)}`} />
              <div className="flex-1">
                <div className="text-sm text-[var(--text-secondary)]">
                  <strong className="text-[var(--text)]">{t.assignedAgent || t.createdBy || 'System'}</strong>
                  {' '}{actionVerb(t.status)}{' '}
                  <span className="text-[var(--accent)] font-medium">{t.title}</span>
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  {timeAgo(t.updatedAt)}
                  {t.progress > 0 && ` · ${t.progress}% complete`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function statusDotColor(status: string): string {
  const map: Record<string, string> = {
    completed: 'bg-[var(--green)]',
    in_progress: 'bg-[var(--blue)]',
    blocked: 'bg-[var(--red)]',
    review: 'bg-[var(--amber)]',
    pending: 'bg-[var(--text-muted)]',
    failed: 'bg-[var(--red)]',
  };
  return map[status] || 'bg-[var(--text-muted)]';
}

function actionVerb(status: string): string {
  const map: Record<string, string> = {
    completed: 'completed',
    in_progress: 'is working on',
    blocked: 'blocked',
    review: 'submitted for review',
    pending: 'created',
    failed: 'failed on',
  };
  return map[status] || 'updated';
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
