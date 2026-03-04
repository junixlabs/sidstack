import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, Save } from 'lucide-react';
import { useTask, useUpdateTask } from '@/hooks/queries';

const STATUS_OPTIONS = ['pending', 'review', 'in_progress', 'completed', 'blocked', 'failed', 'cancelled'];

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get('projectId') || '';

  const { data: taskData, isLoading: loading, error: queryError } = useTask(projectId, id || '');
  const task = taskData?.task || null;

  const updateMutation = useUpdateTask(projectId);

  const [editStatus, setEditStatus] = useState('');
  const [editProgress, setEditProgress] = useState(0);
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    if (task) {
      setEditStatus(task.status);
      setEditProgress(task.progress);
      setEditNotes(task.notes || '');
    }
  }, [task]);

  const error = (updateMutation.error instanceof Error ? updateMutation.error.message : '')
    || (queryError instanceof Error ? queryError.message : queryError ? 'Failed to load' : '');

  const save = () => {
    if (!task) return;
    const updates: Record<string, string | number> = {};
    if (editStatus !== task.status) updates.status = editStatus;
    if (editProgress !== task.progress) updates.progress = editProgress;
    if (editNotes !== (task.notes || '')) updates.notes = editNotes;
    if (Object.keys(updates).length === 0) return;
    updateMutation.mutate({ id: task.id, data: updates });
  };

  const goBack = () => navigate(`/tasks?${searchParams.toString()}`);

  if (loading) return <div className="p-8 text-sm text-[var(--text-muted)]">Loading task...</div>;
  if (error) return <div className="p-8 text-sm text-[var(--red)]">{error}</div>;
  if (!task) return null;

  const criteria: { id: string; description: string; completed: boolean }[] = task.acceptanceCriteria
    ? JSON.parse(task.acceptanceCriteria) : [];
  const completedCriteria = criteria.filter(c => c.completed).length;

  return (
    <div className="p-6 lg:p-8">
      {/* Back */}
      <button onClick={goBack} className="text-[var(--accent)] text-sm font-medium mb-4 flex items-center gap-1 hover:underline">
        <ArrowLeft size={14} /> Back to Tasks
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-sm text-[var(--text-muted)]">#{task.id.split('-').pop()}</span>
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>
          <h1 className="text-xl font-bold">{task.title}</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={updateMutation.isPending} className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-white rounded-md text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-40">
            <Save size={14} /> {updateMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Main */}
        <div className="space-y-6">
          {/* Description */}
          {task.description && (
            <section>
              <SectionTitle>Description</SectionTitle>
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{task.description}</p>
            </section>
          )}

          {/* Acceptance Criteria */}
          {criteria.length > 0 && (
            <section>
              <SectionTitle>Acceptance Criteria</SectionTitle>
              <div className="space-y-1.5">
                {criteria.map(ac => (
                  <div key={ac.id} className="flex items-start gap-2 text-sm">
                    {ac.completed
                      ? <CheckCircle2 size={15} className="text-[var(--green)] mt-0.5 shrink-0" />
                      : <Circle size={15} className="text-[var(--text-muted)] mt-0.5 shrink-0" />}
                    <span className={ac.completed ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-secondary)]'}>
                      {ac.description}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Solution Plan */}
          {task.solutionPlan && (
            <section>
              <SectionTitle>
                Solution Plan
                {task.planStatus && <PlanStatusBadge status={task.planStatus} />}
              </SectionTitle>
              <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap bg-[var(--bg-secondary)] rounded-md p-4 border border-[var(--border)]">
                {task.solutionPlan}
              </div>
            </section>
          )}

          {/* Update Form */}
          <section className="border border-[var(--border)] rounded-lg p-5">
            <SectionTitle>Update Task</SectionTitle>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1 font-medium">Status</label>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-white focus:outline-none focus:border-[var(--accent)]">
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1 font-medium">Progress ({editProgress}%)</label>
                <input type="range" min={0} max={100} step={5} value={editProgress} onChange={e => setEditProgress(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1 font-medium">Notes</label>
              <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} placeholder="Add notes..."
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-white focus:outline-none focus:border-[var(--accent)] resize-y" />
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <section>
            <SectionTitle>Details</SectionTitle>
            <Field label="Status"><StatusBadge status={task.status} /></Field>
            <Field label="Priority"><PriorityBadge priority={task.priority} /></Field>
            <Field label="Assigned To">{task.assignedAgent || 'Unassigned'}</Field>
            {task.taskType && <Field label="Type"><span className="capitalize">{task.taskType}</span></Field>}
            {task.branch && <Field label="Branch"><span className="text-[var(--accent)] text-xs">{task.branch}</span></Field>}
            <Field label="Created">{new Date(task.createdAt).toLocaleDateString()}</Field>
            <Field label="Updated">{timeAgo(task.updatedAt)}</Field>
          </section>

          <section>
            <SectionTitle>Progress</SectionTitle>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="flex-1 h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${task.progress}%` }} />
              </div>
              <span className="text-sm font-semibold">{task.progress}%</span>
            </div>
            {criteria.length > 0 && (
              <div className="text-xs text-[var(--text-muted)]">{completedCriteria} of {criteria.length} criteria met</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[0.04em] mb-3 flex items-center gap-2">{children}</h3>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--border-light)] text-sm">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="font-medium">{children}</span>
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

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    high: 'bg-[var(--amber-bg)] text-[var(--amber-text)]',
    critical: 'bg-[var(--red-bg)] text-[var(--red-text)]',
    medium: 'bg-[var(--blue-bg)] text-[var(--blue-text)]',
    low: 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]',
  };
  return <span className={`text-[11px] px-2 py-0.5 rounded font-semibold capitalize ${map[priority] || map.medium}`}>{priority}</span>;
}

function PlanStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: 'bg-[var(--green-bg)] text-[var(--green-text)]',
    revision_requested: 'bg-[var(--amber-bg)] text-[var(--amber-text)]',
  };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ml-2 ${map[status] || 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'}`}>{status}</span>;
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
