import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  ChevronRight,
  ArrowRightLeft,
  Save,
  ExternalLink,
  Tag,
} from 'lucide-react';
import { tickets, type Ticket } from '@/lib/api';

const STATUS_OPTIONS = ['new', 'reviewing', 'approved', 'in_progress', 'completed', 'rejected'];
const TYPE_OPTIONS = ['bug', 'feature', 'improvement', 'task', 'epic'];
const PRIORITY_OPTIONS = ['critical', 'high', 'medium', 'low'];

export default function TicketsPage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || 'sidstack';

  const [ticketList, setTicketList] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [total, setTotal] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editStatus, setEditStatus] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const opts: Record<string, string | number> = {};
      if (statusFilter) opts.status = statusFilter;
      if (typeFilter) opts.type = typeFilter;
      const res = await tickets.list(projectId, opts);
      setTicketList(res.tickets || []);
      setTotal(res.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tickets');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, statusFilter, typeFilter]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const openTicket = async (id: string) => {
    setIsLoading(true);
    try {
      const res = await tickets.get(id);
      setSelectedTicket(res.ticket);
      setEditStatus(res.ticket.status);
      setEditPriority(res.ticket.priority);
      setEditAssignee(res.ticket.assignee || '');
      setViewMode('detail');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ticket');
    } finally {
      setIsLoading(false);
    }
  };

  const saveTicket = async () => {
    if (!selectedTicket) return;
    setIsSaving(true);
    setError(null);
    try {
      const updates: Record<string, string> = {};
      if (editStatus !== selectedTicket.status) updates.status = editStatus;
      if (editPriority !== selectedTicket.priority) updates.priority = editPriority;
      if (editAssignee !== (selectedTicket.assignee || '')) updates.assignee = editAssignee;

      if (Object.keys(updates).length > 0) {
        const res = await tickets.update(selectedTicket.id, updates);
        setSelectedTicket(res.ticket);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update ticket');
    } finally {
      setIsSaving(false);
    }
  };

  const convertToTask = async () => {
    if (!selectedTicket || !confirm('Convert this ticket to a task?')) return;
    setIsConverting(true);
    setError(null);
    try {
      const res = await tickets.convertToTask(selectedTicket.id);
      setSelectedTicket(res.ticket);
      alert(`Task created: ${res.task.title}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to convert');
    } finally {
      setIsConverting(false);
    }
  };

  const backToList = () => {
    setSelectedTicket(null);
    setViewMode('list');
    setError(null);
    loadTickets();
  };

  // List view
  if (viewMode === 'list') {
    return (
      <div className="h-full flex flex-col">
        {/* Toolbar */}
        <div className="border-b border-[var(--border-default)] p-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex gap-2 flex-1">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-2 py-1.5 text-[12px] rounded bg-[var(--surface-1)] border border-[var(--border-default)]
                           text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-blue)]"
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="px-2 py-1.5 text-[12px] rounded bg-[var(--surface-1)] border border-[var(--border-default)]
                           text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-blue)]"
              >
                <option value="">All types</option>
                {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button onClick={loadTickets} className="p-1.5 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)]" title="Refresh">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-3 mt-3 px-3 py-2 text-[12px] rounded bg-red-500/10 border border-red-500/30 text-red-400">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-auto p-3">
          {isLoading ? (
            <div className="text-center py-12 text-[var(--text-muted)] text-[13px]">Loading...</div>
          ) : ticketList.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-muted)] text-[13px]">No tickets found</div>
          ) : (
            <>
              <div className="text-[11px] text-[var(--text-muted)] mb-2">{total} ticket{total !== 1 ? 's' : ''}</div>
              <div className="space-y-1">
                {ticketList.map(ticket => (
                  <button
                    key={ticket.id}
                    onClick={() => openTicket(ticket.id)}
                    className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded
                               hover:bg-[var(--surface-1)] transition-colors"
                  >
                    <TicketTypeIcon type={ticket.type} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-[var(--text-primary)] truncate">{ticket.title}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-[var(--text-muted)]">{ticket.source}</span>
                        {ticket.externalId && (
                          <span className="text-[10px] text-[var(--text-muted)]">{ticket.externalId}</span>
                        )}
                      </div>
                    </div>
                    <TicketStatusBadge status={ticket.status} />
                    <TicketPriorityBadge priority={ticket.priority} />
                    <ChevronRight size={14} className="text-[var(--text-muted)] shrink-0" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Detail view
  if (!selectedTicket) return null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-[var(--border-default)] px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={backToList} className="p-1 rounded hover:bg-[var(--surface-2)]">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-semibold truncate">{selectedTicket.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <TicketStatusBadge status={selectedTicket.status} />
              <TicketPriorityBadge priority={selectedTicket.priority} />
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-muted)]">
                {selectedTicket.type}
              </span>
            </div>
          </div>
          {!selectedTicket.taskId && (
            <button
              onClick={convertToTask}
              disabled={isConverting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded
                         bg-[var(--accent-purple)] text-white hover:opacity-90 transition-opacity
                         disabled:opacity-40"
            >
              <ArrowRightLeft size={13} /> {isConverting ? 'Converting...' : 'Convert to Task'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 px-3 py-2 text-[12px] rounded bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 space-y-6 max-w-3xl">
        {/* Description */}
        {selectedTicket.description && (
          <section>
            <h2 className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Description</h2>
            <p className="text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap">{selectedTicket.description}</p>
          </section>
        )}

        {/* Labels */}
        {selectedTicket.labels.length > 0 && (
          <section>
            <h2 className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Labels</h2>
            <div className="flex flex-wrap gap-1.5">
              {selectedTicket.labels.map(label => (
                <span key={label} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--text-secondary)]">
                  <Tag size={10} /> {label}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* External Links */}
        {selectedTicket.externalUrls.length > 0 && (
          <section>
            <h2 className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">External Links</h2>
            <div className="space-y-1">
              {selectedTicket.externalUrls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[12px] text-[var(--accent-blue)] hover:underline"
                >
                  <ExternalLink size={12} /> {url}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Linked Task */}
        {selectedTicket.taskId && (
          <section>
            <h2 className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Linked Task</h2>
            <div className="text-[13px] text-[var(--accent-blue)]">{selectedTicket.taskId}</div>
          </section>
        )}

        {/* Edit Controls */}
        <section className="bg-[var(--surface-1)] rounded-lg p-4 border border-[var(--border-default)]">
          <h2 className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Update Ticket</h2>
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
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">Priority</label>
                <select
                  value={editPriority}
                  onChange={e => setEditPriority(e.target.value)}
                  className="w-full px-2 py-1.5 text-[12px] rounded bg-[var(--surface-0)] border border-[var(--border-default)]
                             text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-blue)]"
                >
                  {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-[var(--text-muted)] mb-1">Assignee</label>
              <input
                type="text"
                value={editAssignee}
                onChange={e => setEditAssignee(e.target.value)}
                placeholder="Assignee name"
                className="w-full px-3 py-1.5 text-[12px] rounded bg-[var(--surface-0)] border border-[var(--border-default)]
                           text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]
                           focus:outline-none focus:border-[var(--accent-blue)]"
              />
            </div>
            <button
              onClick={saveTicket}
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
          <div>ID: {selectedTicket.id}</div>
          {selectedTicket.externalId && <div>External ID: {selectedTicket.externalId}</div>}
          <div>Source: {selectedTicket.source}</div>
          {selectedTicket.reporter && <div>Reporter: {selectedTicket.reporter}</div>}
          {selectedTicket.assignee && <div>Assignee: {selectedTicket.assignee}</div>}
          <div>Updated: {new Date(selectedTicket.updatedAt).toLocaleString()}</div>
          <div>Created: {new Date(selectedTicket.createdAt).toLocaleString()}</div>
        </section>
      </div>
    </div>
  );
}

function TicketTypeIcon({ type }: { type: string }) {
  const colors: Record<string, string> = {
    bug: 'text-red-400',
    feature: 'text-blue-400',
    improvement: 'text-green-400',
    task: 'text-[var(--text-muted)]',
    epic: 'text-purple-400',
  };
  return (
    <span className={`text-[11px] font-semibold uppercase ${colors[type] || colors.task}`}>
      {type.slice(0, 3)}
    </span>
  );
}

function TicketStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: 'text-cyan-400 bg-cyan-400/10',
    reviewing: 'text-amber-400 bg-amber-400/10',
    approved: 'text-green-400 bg-green-400/10',
    in_progress: 'text-blue-400 bg-blue-400/10',
    completed: 'text-green-400 bg-green-400/10',
    rejected: 'text-red-400 bg-red-400/10',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[status] || 'text-gray-400 bg-gray-400/10'}`}>
      {status}
    </span>
  );
}

function TicketPriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    critical: 'text-red-400 bg-red-400/10',
    high: 'text-orange-400 bg-orange-400/10',
    medium: 'text-amber-400 bg-amber-400/10',
    low: 'text-gray-400 bg-gray-400/10',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[priority] || 'text-gray-400 bg-gray-400/10'}`}>
      {priority}
    </span>
  );
}
