import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, RefreshCw, ArrowLeft, Save, ArrowRightLeft, ExternalLink, Tag } from 'lucide-react';
import { useTickets, useTicket, useUpdateTicket, useConvertTicketToTask } from '@/hooks/queries';
import type { Ticket } from '@/lib/api';

const STATUS_OPTIONS = ['new', 'reviewing', 'approved', 'in_progress', 'completed', 'rejected'];
const TYPE_OPTIONS = ['bug', 'feature', 'improvement', 'task', 'epic'];
const PRIORITY_OPTIONS = ['critical', 'high', 'medium', 'low'];

export default function TicketsPage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || '';

  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [error, setError] = useState('');

  const [editStatus, setEditStatus] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editAssignee, setEditAssignee] = useState('');

  const filters: Record<string, string | number> = {};
  if (statusFilter) filters.status = statusFilter;
  if (typeFilter) filters.type = typeFilter;

  const { data, isLoading, refetch } = useTickets(projectId, filters);
  const ticketList = data?.tickets || [];
  const total = data?.total || 0;

  const { data: ticketDetail, isLoading: detailLoading } = useTicket(projectId, selectedTicketId);
  const selectedTicket: Ticket | null = ticketDetail?.ticket || null;

  const updateMutation = useUpdateTicket(projectId);
  const convertMutation = useConvertTicketToTask(projectId);

  useEffect(() => {
    if (selectedTicket) {
      setEditStatus(selectedTicket.status);
      setEditPriority(selectedTicket.priority);
      setEditAssignee(selectedTicket.assignee || '');
    }
  }, [selectedTicket]);

  const open = (id: string) => {
    setSelectedTicketId(id);
    setView('detail');
    setError('');
  };

  const save = () => {
    if (!selectedTicket) return;
    setError('');
    const updates: Record<string, string> = {};
    if (editStatus !== selectedTicket.status) updates.status = editStatus;
    if (editPriority !== selectedTicket.priority) updates.priority = editPriority;
    if (editAssignee !== (selectedTicket.assignee || '')) updates.assignee = editAssignee;
    if (Object.keys(updates).length === 0) return;
    updateMutation.mutate(
      { id: selectedTicket.id, data: updates },
      { onError: (e) => { setError(e instanceof Error ? e.message : 'Failed to save'); } },
    );
  };

  const convert = () => {
    if (!selectedTicket || !confirm('Convert this ticket to a task?')) return;
    setError('');
    convertMutation.mutate(selectedTicket.id, {
      onError: (e) => { setError(e instanceof Error ? e.message : 'Failed to convert'); },
    });
  };

  const back = () => { setSelectedTicketId(''); setView('list'); setError(''); };

  // Pipeline counts
  const pipelineCounts: Record<string, number> = {};
  STATUS_OPTIONS.forEach(s => { pipelineCounts[s] = ticketList.filter(t => t.status === s).length; });

  // Detail loading
  if (view === 'detail' && detailLoading) {
    return <div className="p-8 text-sm text-[var(--text-muted)]">Loading ticket...</div>;
  }

  // Detail view
  if (view === 'detail' && selectedTicket) {
    return (
      <div className="p-6 lg:p-8">
        <button onClick={back} className="text-[var(--accent)] text-sm font-medium mb-4 flex items-center gap-1 hover:underline">
          <ArrowLeft size={14} /> Back to Tickets
        </button>
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={selectedTicket.status} />
              <PriorityBadge priority={selectedTicket.priority} />
              <TypeBadge type={selectedTicket.type} />
            </div>
            <h1 className="text-xl font-bold">{selectedTicket.title}</h1>
          </div>
          {!selectedTicket.taskId && (
            <button onClick={convert} disabled={convertMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white rounded-md text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-40">
              <ArrowRightLeft size={14} /> {convertMutation.isPending ? 'Converting...' : 'Convert to Task'}
            </button>
          )}
        </div>

        {error && <div className="mb-4 px-3 py-2 text-sm rounded-md bg-[var(--red-bg)] text-[var(--red-text)]">{error}</div>}

        {selectedTicket.description && (
          <section className="mb-5">
            <SectionTitle>Description</SectionTitle>
            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{selectedTicket.description}</p>
          </section>
        )}

        {selectedTicket.labels.length > 0 && (
          <section className="mb-5">
            <SectionTitle>Labels</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {selectedTicket.labels.map(l => (
                <span key={l} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                  <Tag size={10} /> {l}
                </span>
              ))}
            </div>
          </section>
        )}

        {selectedTicket.externalUrls.length > 0 && (
          <section className="mb-5">
            <SectionTitle>External Links</SectionTitle>
            {selectedTicket.externalUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline mb-1">
                <ExternalLink size={13} /> {url}
              </a>
            ))}
          </section>
        )}

        {selectedTicket.taskId && (
          <section className="mb-5">
            <SectionTitle>Linked Task</SectionTitle>
            <span className="text-sm text-[var(--accent)] font-medium">{selectedTicket.taskId}</span>
          </section>
        )}

        {/* Edit */}
        <section className="border border-[var(--border)] rounded-lg p-5 mb-5">
          <SectionTitle>Update Ticket</SectionTitle>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1 font-medium">Status</label>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-white focus:outline-none focus:border-[var(--accent)]">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1 font-medium">Priority</label>
              <select value={editPriority} onChange={e => setEditPriority(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-white focus:outline-none focus:border-[var(--accent)]">
                {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs text-[var(--text-muted)] mb-1 font-medium">Assignee</label>
            <input type="text" value={editAssignee} onChange={e => setEditAssignee(e.target.value)} placeholder="Assignee"
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-white focus:outline-none focus:border-[var(--accent)]" />
          </div>
          <button onClick={save} disabled={updateMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-white rounded-md text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-40">
            <Save size={14} /> {updateMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </section>

        <div className="text-xs text-[var(--text-muted)] space-y-1 pt-4 border-t border-[var(--border-light)]">
          <div>ID: {selectedTicket.id}</div>
          {selectedTicket.externalId && <div>External: {selectedTicket.externalId}</div>}
          <div>Source: {selectedTicket.source}</div>
          {selectedTicket.reporter && <div>Reporter: {selectedTicket.reporter}</div>}
          <div>Updated: {new Date(selectedTicket.updatedAt).toLocaleString()}</div>
          <div>Created: {new Date(selectedTicket.createdAt).toLocaleString()}</div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold mb-1">Tickets</h1>
          <p className="text-sm text-[var(--text-secondary)]">Incoming work requests and issue triage</p>
        </div>
      </div>

      {/* Pipeline */}
      <div className="flex gap-0.5 mb-5">
        {STATUS_OPTIONS.filter(s => s !== 'rejected').map((s, i, arr) => (
          <div key={s}
            className={`flex-1 text-center py-2 text-xs font-semibold capitalize
              ${i === 0 ? 'rounded-l-md' : ''} ${i === arr.length - 1 ? 'rounded-r-md' : ''}
              ${statusFilter === s ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'}
              cursor-pointer hover:opacity-80 transition-opacity`}
            onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
          >
            {s.replace('_', ' ')} ({pipelineCounts[s] || 0})
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 border border-[var(--border)] rounded-md bg-white min-w-[200px]">
          <Search size={15} className="text-[var(--text-muted)]" />
          <input type="text" placeholder="Search tickets..." className="flex-1 text-sm bg-transparent outline-none placeholder:text-[var(--text-muted)]" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-white text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]">
          <option value="">All types</option>
          {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={() => refetch()} className="p-2 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"><RefreshCw size={15} /></button>
        <span className="ml-auto text-xs text-[var(--text-muted)]">{total} tickets</span>
      </div>

      {error && <div className="mb-4 px-3 py-2 text-sm rounded-md bg-[var(--red-bg)] text-[var(--red-text)]">{error}</div>}

      {isLoading ? (
        <div className="text-center py-16 text-sm text-[var(--text-muted)]">Loading...</div>
      ) : ticketList.length === 0 ? (
        <div className="text-center py-16 text-sm text-[var(--text-muted)]">No tickets found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.03em] py-2.5 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)]">Title</th>
                <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.03em] py-2.5 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] w-24">Status</th>
                <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.03em] py-2.5 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] w-20">Priority</th>
                <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.03em] py-2.5 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] w-20">Type</th>
                <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.03em] py-2.5 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] w-24">Source</th>
                <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.03em] py-2.5 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] w-24">Assigned</th>
              </tr>
            </thead>
            <tbody>
              {ticketList.map(ticket => (
                <tr key={ticket.id} className="hover:bg-[var(--bg-secondary)] cursor-pointer" onClick={() => open(ticket.id)}>
                  <td className="py-2.5 px-3 border-b border-[var(--border-light)] font-medium">{ticket.title}</td>
                  <td className="py-2.5 px-3 border-b border-[var(--border-light)]"><StatusBadge status={ticket.status} /></td>
                  <td className="py-2.5 px-3 border-b border-[var(--border-light)]"><PriorityBadge priority={ticket.priority} /></td>
                  <td className="py-2.5 px-3 border-b border-[var(--border-light)]"><TypeBadge type={ticket.type} /></td>
                  <td className="py-2.5 px-3 border-b border-[var(--border-light)] text-[var(--text-muted)] text-xs">{ticket.source}</td>
                  <td className="py-2.5 px-3 border-b border-[var(--border-light)] text-[var(--text-muted)]">{ticket.assignee || 'Unassigned'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[0.04em] mb-3">{children}</h3>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    new: 'bg-[var(--purple-bg)] text-[var(--purple-text)]',
    reviewing: 'bg-[var(--blue-bg)] text-[var(--blue-text)]',
    approved: 'bg-[var(--green-bg)] text-[var(--green-text)]',
    in_progress: 'bg-[var(--blue-bg)] text-[var(--blue-text)]',
    completed: 'bg-[var(--green-bg)] text-[var(--green-text)]',
    rejected: 'bg-[var(--red-bg)] text-[var(--red-text)]',
  };
  return <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${map[status] || 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'}`}>{status}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    critical: 'bg-[var(--red-bg)] text-[var(--red-text)]',
    high: 'bg-[var(--amber-bg)] text-[var(--amber-text)]',
    medium: 'bg-[var(--blue-bg)] text-[var(--blue-text)]',
    low: 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]',
  };
  return <span className={`text-[11px] px-2 py-0.5 rounded font-semibold capitalize ${map[priority] || map.medium}`}>{priority}</span>;
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    bug: 'bg-[var(--red-bg)] text-[var(--red-text)]',
    feature: 'bg-[var(--blue-bg)] text-[var(--blue-text)]',
    improvement: 'bg-[var(--green-bg)] text-[var(--green-text)]',
    task: 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]',
    epic: 'bg-[var(--purple-bg)] text-[var(--purple-text)]',
  };
  return <span className={`text-[11px] px-2 py-0.5 rounded font-semibold capitalize ${map[type] || map.task}`}>{type}</span>;
}
