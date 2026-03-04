import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTasks } from '@/hooks/queries';

const COLUMNS = [
  { key: 'pending', label: 'Pending' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'completed', label: 'Done' },
];

export default function KanbanPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get('projectId') || '';

  const { data, isLoading: loading } = useTasks(projectId, { preset: 'all', fields: 'standard', limit: 200 });
  const taskList = data?.tasks || [];

  const byCol = (key: string) => {
    if (key === 'completed') return taskList.filter(t => t.status === 'completed');
    if (key === 'blocked') return taskList.filter(t => t.status === 'blocked' || t.status === 'failed');
    if (key === 'in_progress') return taskList.filter(t => t.status === 'in_progress' || t.status === 'review');
    return taskList.filter(t => t.status === 'pending' || t.status === 'cancelled');
  };

  if (loading) return <div className="p-8 text-sm text-[var(--text-muted)]">Loading board...</div>;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-1">Board</h1>
        <p className="text-sm text-[var(--text-secondary)]">Kanban view of project tasks</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNS.map(col => {
          const items = byCol(col.key);
          return (
            <div key={col.key} className="min-w-0">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[0.04em]">{col.label}</span>
                <span className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-full font-semibold">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map(task => (
                  <div
                    key={task.id}
                    onClick={() => navigate(`/tasks/${task.id}?${searchParams.toString()}`)}
                    className={`p-3 bg-white border border-[var(--border)] rounded-md cursor-pointer
                      hover:border-[var(--accent)] transition-colors
                      ${task.status === 'blocked' ? 'border-l-[3px] border-l-[var(--red)]' : ''}`}
                  >
                    <div className="text-[13px] font-medium mb-1.5 line-clamp-2">{task.title}</div>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                      <PriorityDot priority={task.priority} />
                      <span className="capitalize">{task.priority}</span>
                      {task.assignedAgent && (
                        <>
                          <span>&middot;</span>
                          <span>{task.assignedAgent}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="text-center py-8 text-xs text-[var(--text-muted)]">No tasks</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    high: 'bg-[var(--amber)]',
    critical: 'bg-[var(--red)]',
    medium: 'bg-[var(--blue)]',
    low: 'bg-[var(--text-muted)]',
  };
  return <span className={`w-1.5 h-1.5 rounded-full ${colors[priority] || colors.medium}`} />;
}
