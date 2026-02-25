import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  ArrowLeft,
  RefreshCw,
  ChevronRight,
  Clock,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Loader2,
  XCircle,
  Save,
} from 'lucide-react';
import { tasks, type Task } from '@/lib/api';

const STATUS_OPTIONS = ['pending', 'review', 'in_progress', 'completed', 'blocked', 'failed', 'cancelled'];
// Priority options available if needed for future filtering
// const PRIORITY_OPTIONS = ['low', 'medium', 'high'];

export default function TasksPage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || 'sidstack';

  const [taskList, setTaskList] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit state for detail panel
  const [editStatus, setEditStatus] = useState('');
  const [editProgress, setEditProgress] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const opts: Record<string, string | number> = { fields: 'standard' };
      if (searchQuery) opts.search = searchQuery;
      if (statusFilter) opts.status = statusFilter;
      else opts.preset = 'all';
      const res = await tasks.list(projectId, opts);
      setTaskList(res.tasks || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, searchQuery, statusFilter]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const openTask = async (id: string) => {
    setIsLoading(true);
    try {
      const res = await tasks.get(id);
      setSelectedTask(res.task);
      setEditStatus(res.task.status);
      setEditProgress(res.task.progress);
      setEditNotes(res.task.notes || '');
      setViewMode('detail');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load task');
    } finally {
      setIsLoading(false);
    }
  };

  const saveTask = async () => {
    if (!selectedTask) return;
    setIsSaving(true);
    setError(null);
    try {
      const updates: Record<string, string | number> = {};
      if (editStatus !== selectedTask.status) updates.status = editStatus;
      if (editProgress !== selectedTask.progress) updates.progress = editProgress;
      if (editNotes !== (selectedTask.notes || '')) updates.notes = editNotes;

      if (Object.keys(updates).length > 0) {
        const res = await tasks.update(selectedTask.id, updates);
        setSelectedTask(res.task);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update task');
    } finally {
      setIsSaving(false);
    }
  };

  const backToList = () => {
    setSelectedTask(null);
    setViewMode('list');
    setError(null);
    loadTasks();
  };

  // List view
  if (viewMode === 'list') {
    return (
      <div className="h-full flex flex-col">
        {/* Toolbar */}
        <div className="border-b border-[var(--border-default)] p-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-[13px] rounded bg-[var(--surface-1)] border border-[var(--border-default)]
                           text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]
                           focus:outline-none focus:border-[var(--accent-blue)]"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-2 py-1.5 text-[12px] rounded bg-[var(--surface-1)] border border-[var(--border-default)]
                           text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-blue)]"
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
              <button onClick={loadTasks} className="p-1.5 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)]" title="Refresh">
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-3 mt-3 px-3 py-2 text-[12px] rounded bg-red-500/10 border border-red-500/30 text-red-400">
            {error}
          </div>
        )}

        {/* Task list */}
        <div className="flex-1 overflow-auto p-3">
          {isLoading ? (
            <div className="text-center py-12 text-[var(--text-muted)] text-[13px]">Loading...</div>
          ) : taskList.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-muted)] text-[13px]">No tasks found</div>
          ) : (
            <div className="space-y-1">
              {taskList.map(task => (
                <button
                  key={task.id}
                  onClick={() => openTask(task.id)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded
                             hover:bg-[var(--surface-1)] transition-colors group"
                >
                  <TaskStatusIcon status={task.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-[var(--text-primary)] truncate">{task.title}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <PriorityDot priority={task.priority} />
                      {task.assignedAgent && (
                        <span className="text-[10px] text-[var(--text-muted)]">{task.assignedAgent}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] text-[var(--text-muted)]">{task.progress}%</div>
                    <div className="w-16 h-1 bg-[var(--surface-2)] rounded-full mt-1">
                      <div
                        className="h-full rounded-full bg-[var(--accent-blue)] transition-all"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-[var(--text-muted)] shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Detail view
  if (!selectedTask) return null;

  const acceptanceCriteria = selectedTask.acceptanceCriteria ? JSON.parse(selectedTask.acceptanceCriteria) : [];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-[var(--border-default)] px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={backToList} className="p-1 rounded hover:bg-[var(--surface-2)]">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-semibold truncate">{selectedTask.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <TaskStatusBadge status={selectedTask.status} />
              <PriorityBadge priority={selectedTask.priority} />
              {selectedTask.taskType && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-muted)]">
                  {selectedTask.taskType}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 px-3 py-2 text-[12px] rounded bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 space-y-6 max-w-3xl">
        {/* Description */}
        {selectedTask.description && (
          <section>
            <h2 className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Description</h2>
            <p className="text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap">{selectedTask.description}</p>
          </section>
        )}

        {/* Acceptance Criteria */}
        {acceptanceCriteria.length > 0 && (
          <section>
            <h2 className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Acceptance Criteria
            </h2>
            <div className="space-y-1">
              {acceptanceCriteria.map((ac: { id: string; description: string; completed: boolean }) => (
                <div key={ac.id} className="flex items-start gap-2 text-[13px]">
                  <span className={ac.completed ? 'text-green-400' : 'text-[var(--text-muted)]'}>
                    {ac.completed ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                  </span>
                  <span className={ac.completed ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-secondary)]'}>
                    {ac.description}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Solution Plan */}
        {selectedTask.solutionPlan && (
          <section>
            <h2 className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Solution Plan
              {selectedTask.planStatus && (
                <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${
                  selectedTask.planStatus === 'approved' ? 'bg-green-400/10 text-green-400' :
                  selectedTask.planStatus === 'revision_requested' ? 'bg-amber-400/10 text-amber-400' :
                  'bg-gray-400/10 text-gray-400'
                }`}>
                  {selectedTask.planStatus}
                </span>
              )}
            </h2>
            <div className="text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap bg-[var(--surface-1)] rounded p-3 border border-[var(--border-muted)]">
              {selectedTask.solutionPlan}
            </div>
          </section>
        )}

        {/* Edit Controls */}
        <section className="bg-[var(--surface-1)] rounded-lg p-4 border border-[var(--border-default)]">
          <h2 className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Update Task</h2>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">Status</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  className="w-full px-2 py-1.5 text-[12px] rounded bg-[var(--surface-0)] border border-[var(--border-default)]
                             text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-blue)]"
                >
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">Progress ({editProgress}%)</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={editProgress}
                  onChange={e => setEditProgress(Number(e.target.value))}
                  className="w-full accent-[var(--accent-blue)]"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-[var(--text-muted)] mb-1">Notes</label>
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-[12px] rounded bg-[var(--surface-0)] border border-[var(--border-default)]
                           text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]
                           focus:outline-none focus:border-[var(--accent-blue)] resize-y"
                placeholder="Add notes..."
              />
            </div>
            <button
              onClick={saveTask}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded
                         bg-[var(--accent-blue)] text-white hover:opacity-90 transition-opacity
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save size={13} /> {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </section>

        {/* Metadata */}
        <section className="text-[11px] text-[var(--text-muted)] space-y-1 pt-4 border-t border-[var(--border-muted)]">
          <div>ID: {selectedTask.id}</div>
          {selectedTask.branch && <div>Branch: {selectedTask.branch}</div>}
          {selectedTask.moduleId && <div>Module: {selectedTask.moduleId}</div>}
          {selectedTask.assignedAgent && <div>Agent: {selectedTask.assignedAgent}</div>}
          <div>Created by: {selectedTask.createdBy || 'unknown'}</div>
          <div>Updated: {new Date(selectedTask.updatedAt).toLocaleString()}</div>
          <div>Created: {new Date(selectedTask.createdAt).toLocaleString()}</div>
        </section>
      </div>
    </div>
  );
}

// Status icon for task list
function TaskStatusIcon({ status }: { status: string }) {
  const map: Record<string, { icon: typeof Circle; color: string }> = {
    pending: { icon: Circle, color: 'text-[var(--text-muted)]' },
    review: { icon: Clock, color: 'text-amber-400' },
    in_progress: { icon: Loader2, color: 'text-blue-400' },
    completed: { icon: CheckCircle2, color: 'text-green-400' },
    blocked: { icon: AlertTriangle, color: 'text-red-400' },
    failed: { icon: XCircle, color: 'text-red-400' },
    cancelled: { icon: XCircle, color: 'text-[var(--text-muted)]' },
  };
  const { icon: Icon, color } = map[status] || map.pending;
  return <Icon size={15} className={`${color} shrink-0`} />;
}

function TaskStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'text-gray-400 bg-gray-400/10',
    review: 'text-amber-400 bg-amber-400/10',
    in_progress: 'text-blue-400 bg-blue-400/10',
    completed: 'text-green-400 bg-green-400/10',
    blocked: 'text-red-400 bg-red-400/10',
    failed: 'text-red-400 bg-red-400/10',
    cancelled: 'text-gray-400 bg-gray-400/10',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[status] || colors.pending}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    high: 'bg-red-400',
    medium: 'bg-amber-400',
    low: 'bg-[var(--text-muted)]',
  };
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${colors[priority] || colors.medium}`} />;
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    high: 'text-red-400 bg-red-400/10',
    medium: 'text-amber-400 bg-amber-400/10',
    low: 'text-gray-400 bg-gray-400/10',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[priority] || colors.medium}`}>
      {priority}
    </span>
  );
}
