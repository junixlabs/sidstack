import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Search, Plus, ChevronRight, ChevronDown, FileText, FolderOpen, Folder,
  ArrowLeft, Save, Trash2, Edit3, X, RefreshCw,
} from 'lucide-react';
import { knowledge, type TreeNode, type CreateKnowledgeDoc, type UpdateKnowledgeDoc } from '@/lib/api';
import { useKnowledge, useKnowledgeDoc, useCreateKnowledge, useUpdateKnowledge, useDeleteKnowledge } from '@/hooks/queries';

const DOC_TYPES = ['spec', 'decision', 'proposal', 'guide', 'reference', 'template', 'checklist', 'pattern'];
const DOC_STATUSES = ['draft', 'active', 'review', 'archived'];

type ViewMode = 'list' | 'detail' | 'create' | 'edit';

export default function KnowledgePage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || '';

  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedDocId, setSelectedDocId] = useState('');

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('guide');
  const [formStatus, setFormStatus] = useState('draft');
  const [formContent, setFormContent] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formTags, setFormTags] = useState('');

  const filters: Record<string, string | number> = {};
  if (searchQuery) filters.search = searchQuery;
  if (typeFilter) filters.type = typeFilter;
  if (statusFilter) filters.status = statusFilter;

  const { data, isLoading, refetch } = useKnowledge(projectId, filters);
  const documents = data?.documents || [];
  const total = data?.total || 0;

  const { data: selectedDoc, isLoading: detailLoading } = useKnowledgeDoc(projectId, selectedDocId);

  const createMutation = useCreateKnowledge(projectId);
  const updateMutation = useUpdateKnowledge(projectId);
  const deleteMutation = useDeleteKnowledge(projectId);

  const loadTree = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await knowledge.tree(projectId);
      setTree(res);
      const expanded = new Set<string>();
      for (const node of res) { if (node.children?.length) expanded.add(node.id); }
      setExpandedFolders(expanded);
    } catch { /* optional */ }
  }, [projectId]);

  useEffect(() => { loadTree(); }, [loadTree]);

  const openDoc = (id: string) => {
    setSelectedDocId(id);
    setViewMode('detail');
    setError('');
  };

  const startCreate = () => {
    setFormTitle(''); setFormType('guide'); setFormStatus('draft');
    setFormContent(''); setFormSummary(''); setFormTags('');
    setViewMode('create');
  };

  const startEdit = () => {
    if (!selectedDoc) return;
    setFormTitle(selectedDoc.title); setFormType(selectedDoc.type);
    setFormStatus(selectedDoc.status); setFormContent(selectedDoc.content);
    setFormSummary(selectedDoc.summary || ''); setFormTags(selectedDoc.tags?.join(', ') || '');
    setViewMode('edit');
  };

  const saveDoc = () => {
    setError('');
    const tags = formTags.split(',').map(t => t.trim()).filter(Boolean);
    if (viewMode === 'create') {
      const data: CreateKnowledgeDoc = { projectId, title: formTitle, type: formType, content: formContent, status: formStatus, summary: formSummary || undefined, tags: tags.length > 0 ? tags : undefined };
      createMutation.mutate(data, {
        onSuccess: (doc) => { setSelectedDocId(doc.id); setViewMode('detail'); loadTree(); },
        onError: (e) => { setError(e instanceof Error ? e.message : 'Failed to save'); },
      });
    } else if (selectedDoc) {
      const data: UpdateKnowledgeDoc = { title: formTitle, content: formContent, status: formStatus, summary: formSummary || undefined, tags: tags.length > 0 ? tags : undefined };
      updateMutation.mutate({ id: selectedDoc.id, data }, {
        onSuccess: () => { setViewMode('detail'); loadTree(); },
        onError: (e) => { setError(e instanceof Error ? e.message : 'Failed to save'); },
      });
    }
  };

  const deleteDoc = () => {
    if (!selectedDoc || !confirm('Archive this document?')) return;
    setError('');
    deleteMutation.mutate(selectedDoc.id, {
      onSuccess: () => { setSelectedDocId(''); setViewMode('list'); loadTree(); },
      onError: (e) => { setError(e instanceof Error ? e.message : 'Failed to delete'); },
    });
  };

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const backToList = () => { setSelectedDocId(''); setViewMode('list'); setError(''); };

  const isMutating = createMutation.isPending || updateMutation.isPending;

  // Detail loading
  if (viewMode === 'detail' && detailLoading) {
    return (
      <div className="flex h-full">
        {renderTreeSidebar()}
        <div className="flex-1 p-8 text-sm text-[var(--text-muted)]">Loading document...</div>
      </div>
    );
  }

  // Detail
  if (viewMode === 'detail' && selectedDoc) {
    return (
      <div className="flex h-full">
        {renderTreeSidebar()}
        <div className="flex-1 overflow-auto p-6 lg:p-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <button onClick={backToList} className="text-[var(--accent)] text-sm font-medium mb-2 flex items-center gap-1 hover:underline">
                <ArrowLeft size={14} /> Back
              </button>
              <div className="flex items-center gap-2 mb-1">
                <TypeBadge type={selectedDoc.type} />
                <StatusBadge status={selectedDoc.status} />
              </div>
              <h1 className="text-xl font-bold">{selectedDoc.title}</h1>
            </div>
            <div className="flex gap-2">
              <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[var(--border)] rounded-md hover:bg-[var(--bg-hover)]">
                <Edit3 size={14} /> Edit
              </button>
              <button onClick={deleteDoc} disabled={deleteMutation.isPending} className="p-2 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--red)] disabled:opacity-40">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
          <article className="prose prose-sm max-w-none prose-headings:text-[var(--text)] prose-p:text-[var(--text-secondary)] prose-a:text-[var(--accent)] prose-code:bg-[var(--code-bg)] prose-code:text-[var(--code-text)] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-[var(--code-bg)] prose-pre:border prose-pre:border-[var(--border)] prose-strong:text-[var(--text)]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedDoc.content}</ReactMarkdown>
          </article>
          <div className="mt-8 pt-4 border-t border-[var(--border-light)] text-xs text-[var(--text-muted)] space-y-1">
            {selectedDoc.category && <div>Category: {selectedDoc.category}</div>}
            {selectedDoc.module && <div>Module: {selectedDoc.module}</div>}
            {selectedDoc.owner && <div>Owner: {selectedDoc.owner}</div>}
            <div>Updated: {new Date(selectedDoc.updatedAt).toLocaleString()}</div>
          </div>
        </div>
      </div>
    );
  }

  // Create/Edit
  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <button onClick={viewMode === 'edit' ? () => setViewMode('detail') : backToList} className="p-1.5 rounded-md hover:bg-[var(--bg-hover)]">
              <X size={16} />
            </button>
            <h1 className="text-xl font-bold">{viewMode === 'create' ? 'New Document' : 'Edit Document'}</h1>
          </div>
          <button onClick={saveDoc} disabled={isMutating || !formTitle.trim() || !formContent.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-white rounded-md text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-40">
            <Save size={14} /> {isMutating ? 'Saving...' : 'Save'}
          </button>
        </div>
        {error && <div className="mb-4 px-3 py-2 text-sm rounded-md bg-[var(--red-bg)] text-[var(--red-text)]">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Document title"
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-white focus:outline-none focus:border-[var(--accent)]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select value={formType} onChange={e => setFormType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-white focus:outline-none focus:border-[var(--accent)]">
                {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select value={formStatus} onChange={e => setFormStatus(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-white focus:outline-none focus:border-[var(--accent)]">
                {DOC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Summary</label>
            <input value={formSummary} onChange={e => setFormSummary(e.target.value)} placeholder="Brief description"
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-white focus:outline-none focus:border-[var(--accent)]" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tags (comma-separated)</label>
            <input value={formTags} onChange={e => setFormTags(e.target.value)} placeholder="security, api, auth"
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-white focus:outline-none focus:border-[var(--accent)]" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Content (Markdown)</label>
            <textarea value={formContent} onChange={e => setFormContent(e.target.value)} placeholder="Write content..."
              rows={18} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-white focus:outline-none focus:border-[var(--accent)] font-mono resize-y" />
          </div>
        </div>
      </div>
    );
  }

  // List
  return (
    <div className="flex h-full">
      {renderTreeSidebar()}
      <div className="flex-1 overflow-auto p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold mb-1">Knowledge Base</h1>
            <p className="text-sm text-[var(--text-secondary)]">Project documentation and shared knowledge</p>
          </div>
          <button onClick={startCreate} className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-white rounded-md text-sm font-medium hover:bg-[var(--accent-hover)]">
            <Plus size={14} /> New Document
          </button>
        </div>

        <div className="flex items-center gap-2.5 mb-4 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 border border-[var(--border)] rounded-md bg-white min-w-[240px]">
            <Search size={15} className="text-[var(--text-muted)]" />
            <input type="text" placeholder="Search docs..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-[var(--text-muted)]" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-white text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]">
            <option value="">All types</option>
            {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-white text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]">
            <option value="">All statuses</option>
            {DOC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => refetch()} className="p-2 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"><RefreshCw size={15} /></button>
          <span className="ml-auto text-xs text-[var(--text-muted)]">{total} documents</span>
        </div>

        {error && <div className="mb-4 px-3 py-2 text-sm rounded-md bg-[var(--red-bg)] text-[var(--red-text)]">{error}</div>}

        {isLoading ? (
          <div className="text-center py-16 text-sm text-[var(--text-muted)]">Loading...</div>
        ) : documents.length === 0 ? (
          <div className="text-center py-16 text-sm text-[var(--text-muted)]">No documents found</div>
        ) : (
          <div className="space-y-1">
            {documents.map(doc => (
              <button key={doc.id} onClick={() => openDoc(doc.id)}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-[var(--bg-secondary)] transition-colors">
                <FileText size={16} className="text-[var(--text-muted)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{doc.title}</div>
                  {doc.summary && <div className="text-xs text-[var(--text-muted)] truncate mt-0.5">{doc.summary}</div>}
                </div>
                <TypeBadge type={doc.type} />
                <StatusBadge status={doc.status} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  function renderTreeSidebar() {
    return (
      <div className="w-60 shrink-0 border-r border-[var(--border)] bg-[var(--bg-secondary)] overflow-y-auto hidden md:block">
        <div className="p-3 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Categories</div>
        {tree.map(folder => (
          <div key={folder.id}>
            <button onClick={() => toggleFolder(folder.id)}
              className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs hover:bg-[var(--bg-hover)] transition-colors">
              {expandedFolders.has(folder.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {expandedFolders.has(folder.id) ? <FolderOpen size={13} className="text-[var(--amber)]" /> : <Folder size={13} className="text-[var(--text-muted)]" />}
              <span className="truncate text-[var(--text-secondary)]">{folder.name}</span>
              {folder.documentCount ? <span className="ml-auto text-[10px] text-[var(--text-muted)]">{folder.documentCount}</span> : null}
            </button>
            {expandedFolders.has(folder.id) && folder.children?.map(child => (
              <button key={child.id} onClick={() => openDoc(child.id)}
                className={`w-full flex items-center gap-1.5 pl-7 pr-3 py-1 text-xs hover:bg-[var(--bg-hover)] transition-colors border-l-2
                  ${selectedDocId === child.id ? 'bg-[var(--accent-light)] text-[var(--accent)] font-medium border-[var(--accent)]' : 'text-[var(--text-secondary)] border-transparent'}`}>
                <FileText size={12} />
                <span className="truncate">{child.name}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  }
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    spec: 'bg-[var(--blue-bg)] text-[var(--blue-text)]',
    decision: 'bg-[var(--purple-bg)] text-[var(--purple-text)]',
    proposal: 'bg-[var(--amber-bg)] text-[var(--amber-text)]',
    guide: 'bg-[var(--green-bg)] text-[var(--green-text)]',
    reference: 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]',
    template: 'bg-[var(--bg-secondary)] text-[var(--text-muted)]',
    checklist: 'bg-[var(--amber-bg)] text-[var(--amber-text)]',
    pattern: 'bg-[var(--purple-bg)] text-[var(--purple-text)]',
  };
  return <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${map[type] || 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'}`}>{type}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-[var(--amber-bg)] text-[var(--amber-text)]',
    active: 'bg-[var(--green-bg)] text-[var(--green-text)]',
    review: 'bg-[var(--amber-bg)] text-[var(--amber-text)]',
    archived: 'bg-[var(--red-bg)] text-[var(--red-text)]',
  };
  return <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${map[status] || 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'}`}>{status}</span>;
}
