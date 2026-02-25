import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  FileText,
  FolderOpen,
  Folder,
  ArrowLeft,
  Save,
  Trash2,
  Edit3,
  X,
  RefreshCw,
} from 'lucide-react';
import { knowledge, type KnowledgeDoc, type TreeNode, type CreateKnowledgeDoc, type UpdateKnowledgeDoc } from '@/lib/api';

const DOC_TYPES = ['spec', 'decision', 'proposal', 'guide', 'reference', 'template', 'checklist', 'pattern'];
const DOC_STATUSES = ['draft', 'active', 'review', 'archived'];

type ViewMode = 'list' | 'detail' | 'create' | 'edit';

export default function KnowledgePage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || 'sidstack';

  // Data
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDoc | null>(null);
  const [total, setTotal] = useState(0);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTree] = useState(true);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('guide');
  const [formStatus, setFormStatus] = useState('draft');
  const [formContent, setFormContent] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formTags, setFormTags] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const opts: Record<string, string | number> = {};
      if (searchQuery) opts.search = searchQuery;
      if (typeFilter) opts.type = typeFilter;
      if (statusFilter) opts.status = statusFilter;
      const res = await knowledge.list(projectId, opts);
      setDocuments(res.documents);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, searchQuery, typeFilter, statusFilter]);

  const loadTree = useCallback(async () => {
    try {
      const res = await knowledge.tree(projectId);
      setTree(res);
      // Auto-expand folders with documents
      const expanded = new Set<string>();
      for (const node of res) {
        if (node.children && node.children.length > 0) {
          expanded.add(node.id);
        }
      }
      setExpandedFolders(expanded);
    } catch {
      // Tree is optional, don't block on failure
    }
  }, [projectId]);

  useEffect(() => {
    loadDocuments();
    loadTree();
  }, [loadDocuments, loadTree]);

  const openDoc = async (id: string) => {
    setIsLoading(true);
    try {
      const doc = await knowledge.get(id);
      setSelectedDoc(doc);
      setViewMode('detail');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load document');
    } finally {
      setIsLoading(false);
    }
  };

  const startCreate = () => {
    setFormTitle('');
    setFormType('guide');
    setFormStatus('draft');
    setFormContent('');
    setFormSummary('');
    setFormTags('');
    setViewMode('create');
  };

  const startEdit = () => {
    if (!selectedDoc) return;
    setFormTitle(selectedDoc.title);
    setFormType(selectedDoc.type);
    setFormStatus(selectedDoc.status);
    setFormContent(selectedDoc.content);
    setFormSummary(selectedDoc.summary || '');
    setFormTags(selectedDoc.tags?.join(', ') || '');
    setViewMode('edit');
  };

  const saveDocument = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const tags = formTags.split(',').map(t => t.trim()).filter(Boolean);
      if (viewMode === 'create') {
        const data: CreateKnowledgeDoc = {
          projectId,
          title: formTitle,
          type: formType,
          content: formContent,
          status: formStatus,
          summary: formSummary || undefined,
          tags: tags.length > 0 ? tags : undefined,
        };
        const doc = await knowledge.create(data);
        setSelectedDoc(doc);
        setViewMode('detail');
      } else if (viewMode === 'edit' && selectedDoc) {
        const data: UpdateKnowledgeDoc = {
          title: formTitle,
          content: formContent,
          status: formStatus,
          summary: formSummary || undefined,
          tags: tags.length > 0 ? tags : undefined,
        };
        const doc = await knowledge.update(selectedDoc.id, data);
        setSelectedDoc(doc);
        setViewMode('detail');
      }
      loadDocuments();
      loadTree();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteDocument = async () => {
    if (!selectedDoc || !confirm('Archive this document?')) return;
    try {
      await knowledge.delete(selectedDoc.id);
      setSelectedDoc(null);
      setViewMode('list');
      loadDocuments();
      loadTree();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const backToList = () => {
    setSelectedDoc(null);
    setViewMode('list');
    setError(null);
  };

  // Render tree sidebar
  const renderTree = () => (
    <div className={`border-r border-[var(--border-default)] bg-[var(--surface-1)] overflow-y-auto
      ${showTree ? 'w-60 shrink-0' : 'hidden'} hidden md:block`}>
      <div className="p-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Categories
      </div>
      {tree.map(folder => (
        <div key={folder.id}>
          <button
            onClick={() => toggleFolder(folder.id)}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[12px] hover:bg-[var(--surface-2)] transition-colors"
          >
            {expandedFolders.has(folder.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {expandedFolders.has(folder.id) ? <FolderOpen size={13} className="text-[var(--accent-amber)]" /> : <Folder size={13} className="text-[var(--text-muted)]" />}
            <span className="truncate text-[var(--text-secondary)]">{folder.name}</span>
            {folder.documentCount ? (
              <span className="ml-auto text-[10px] text-[var(--text-muted)]">{folder.documentCount}</span>
            ) : null}
          </button>
          {expandedFolders.has(folder.id) && folder.children?.map(child => (
            <button
              key={child.id}
              onClick={() => openDoc(child.id)}
              className={`w-full flex items-center gap-1.5 pl-8 pr-3 py-1 text-[12px] hover:bg-[var(--surface-2)] transition-colors
                ${selectedDoc?.id === child.id ? 'bg-[var(--surface-2)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}
            >
              <FileText size={12} />
              <span className="truncate">{child.name}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );

  // List view
  const renderList = () => (
    <div className="flex-1 overflow-auto">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-[var(--surface-0)] border-b border-[var(--border-default)] p-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-[13px] rounded bg-[var(--surface-1)] border border-[var(--border-default)]
                         text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]
                         focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-2 py-1.5 text-[12px] rounded bg-[var(--surface-1)] border border-[var(--border-default)]
                         text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-blue)]"
            >
              <option value="">All types</option>
              {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-2 py-1.5 text-[12px] rounded bg-[var(--surface-1)] border border-[var(--border-default)]
                         text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-blue)]"
            >
              <option value="">All statuses</option>
              {DOC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              onClick={loadDocuments}
              className="p-1.5 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)]"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={startCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded
                         bg-[var(--accent-blue)] text-white hover:opacity-90 transition-opacity"
            >
              <Plus size={13} /> New
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mt-3 px-3 py-2 text-[12px] rounded bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
        </div>
      )}

      {/* Document table */}
      <div className="p-3">
        {isLoading ? (
          <div className="text-center py-12 text-[var(--text-muted)] text-[13px]">Loading...</div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)] text-[13px]">
            {searchQuery || typeFilter || statusFilter ? 'No documents match filters' : 'No documents yet'}
          </div>
        ) : (
          <>
            <div className="text-[11px] text-[var(--text-muted)] mb-2">{total} document{total !== 1 ? 's' : ''}</div>
            <div className="space-y-1">
              {documents.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => openDoc(doc.id)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded
                             hover:bg-[var(--surface-1)] transition-colors group"
                >
                  <FileText size={15} className="text-[var(--text-muted)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-[var(--text-primary)] truncate">{doc.title}</div>
                    {doc.summary && (
                      <div className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">{doc.summary}</div>
                    )}
                  </div>
                  <TypeBadge type={doc.type} />
                  <StatusBadge status={doc.status} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );

  // Detail view
  const renderDetail = () => {
    if (!selectedDoc) return null;
    return (
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--surface-0)] border-b border-[var(--border-default)] px-4 py-3">
          <div className="flex items-center gap-2">
            <button onClick={backToList} className="p-1 rounded hover:bg-[var(--surface-2)]">
              <ArrowLeft size={16} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-[15px] font-semibold truncate">{selectedDoc.title}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <TypeBadge type={selectedDoc.type} />
                <StatusBadge status={selectedDoc.status} />
                {selectedDoc.tags?.map(tag => (
                  <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-muted)]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <button onClick={startEdit} className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] rounded hover:bg-[var(--surface-2)] text-[var(--text-secondary)]">
              <Edit3 size={13} /> Edit
            </button>
            <button onClick={deleteDocument} className="p-1.5 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--accent-red)]">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 max-w-4xl">
          <article className="prose prose-invert prose-sm max-w-none
            prose-headings:text-[var(--text-primary)] prose-p:text-[var(--text-secondary)]
            prose-a:text-[var(--accent-blue)] prose-code:text-[var(--accent-cyan)]
            prose-code:bg-[var(--surface-2)] prose-code:px-1 prose-code:py-0.5 prose-code:rounded
            prose-pre:bg-[var(--surface-1)] prose-pre:border prose-pre:border-[var(--border-default)]
            prose-strong:text-[var(--text-primary)]
            prose-th:text-[var(--text-secondary)] prose-td:text-[var(--text-secondary)]
            prose-hr:border-[var(--border-default)]
            prose-blockquote:border-[var(--border-emphasis)] prose-blockquote:text-[var(--text-muted)]
            prose-li:text-[var(--text-secondary)]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {selectedDoc.content}
            </ReactMarkdown>
          </article>

          {/* Metadata */}
          <div className="mt-8 pt-4 border-t border-[var(--border-muted)] text-[11px] text-[var(--text-muted)] space-y-1">
            <div>ID: {selectedDoc.id}</div>
            {selectedDoc.category && <div>Category: {selectedDoc.category}</div>}
            {selectedDoc.module && <div>Module: {selectedDoc.module}</div>}
            {selectedDoc.owner && <div>Owner: {selectedDoc.owner}</div>}
            <div>Updated: {new Date(selectedDoc.updatedAt).toLocaleString()}</div>
            <div>Created: {new Date(selectedDoc.createdAt).toLocaleString()}</div>
          </div>
        </div>
      </div>
    );
  };

  // Create/Edit form
  const renderForm = () => (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--surface-0)] border-b border-[var(--border-default)] px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={viewMode === 'edit' ? () => setViewMode('detail') : backToList} className="p-1 rounded hover:bg-[var(--surface-2)]">
            <X size={16} />
          </button>
          <h1 className="text-[15px] font-semibold flex-1">
            {viewMode === 'create' ? 'New Document' : 'Edit Document'}
          </h1>
          <button
            onClick={saveDocument}
            disabled={isSaving || !formTitle.trim() || !formContent.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded
                       bg-[var(--accent-blue)] text-white hover:opacity-90 transition-opacity
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save size={13} /> {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 px-3 py-2 text-[12px] rounded bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
        </div>
      )}

      <div className="p-4 max-w-3xl space-y-4">
        {/* Title */}
        <div>
          <label className="block text-[12px] text-[var(--text-muted)] mb-1">Title</label>
          <input
            type="text"
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            placeholder="Document title"
            className="w-full px-3 py-2 text-[13px] rounded bg-[var(--surface-1)] border border-[var(--border-default)]
                       text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]
                       focus:outline-none focus:border-[var(--accent-blue)]"
          />
        </div>

        {/* Type + Status row */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-[12px] text-[var(--text-muted)] mb-1">Type</label>
            <select
              value={formType}
              onChange={e => setFormType(e.target.value)}
              className="w-full px-3 py-2 text-[13px] rounded bg-[var(--surface-1)] border border-[var(--border-default)]
                         text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-blue)]"
            >
              {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[12px] text-[var(--text-muted)] mb-1">Status</label>
            <select
              value={formStatus}
              onChange={e => setFormStatus(e.target.value)}
              className="w-full px-3 py-2 text-[13px] rounded bg-[var(--surface-1)] border border-[var(--border-default)]
                         text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-blue)]"
            >
              {DOC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Summary */}
        <div>
          <label className="block text-[12px] text-[var(--text-muted)] mb-1">Summary (optional)</label>
          <input
            type="text"
            value={formSummary}
            onChange={e => setFormSummary(e.target.value)}
            placeholder="Brief description"
            className="w-full px-3 py-2 text-[13px] rounded bg-[var(--surface-1)] border border-[var(--border-default)]
                       text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]
                       focus:outline-none focus:border-[var(--accent-blue)]"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-[12px] text-[var(--text-muted)] mb-1">Tags (comma-separated)</label>
          <input
            type="text"
            value={formTags}
            onChange={e => setFormTags(e.target.value)}
            placeholder="security, api, auth"
            className="w-full px-3 py-2 text-[13px] rounded bg-[var(--surface-1)] border border-[var(--border-default)]
                       text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]
                       focus:outline-none focus:border-[var(--accent-blue)]"
          />
        </div>

        {/* Content */}
        <div>
          <label className="block text-[12px] text-[var(--text-muted)] mb-1">Content (Markdown)</label>
          <textarea
            value={formContent}
            onChange={e => setFormContent(e.target.value)}
            placeholder="Write your document content in Markdown..."
            rows={20}
            className="w-full px-3 py-2 text-[13px] rounded bg-[var(--surface-1)] border border-[var(--border-default)]
                       text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]
                       focus:outline-none focus:border-[var(--accent-blue)]
                       font-mono resize-y"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      {viewMode === 'list' && renderTree()}
      {viewMode === 'list' && renderList()}
      {viewMode === 'detail' && renderDetail()}
      {(viewMode === 'create' || viewMode === 'edit') && renderForm()}
    </div>
  );
}

// Badge components
function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    spec: 'text-blue-400 bg-blue-400/10',
    decision: 'text-purple-400 bg-purple-400/10',
    proposal: 'text-amber-400 bg-amber-400/10',
    guide: 'text-green-400 bg-green-400/10',
    reference: 'text-cyan-400 bg-cyan-400/10',
    template: 'text-gray-400 bg-gray-400/10',
    checklist: 'text-orange-400 bg-orange-400/10',
    pattern: 'text-pink-400 bg-pink-400/10',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[type] || 'text-gray-400 bg-gray-400/10'}`}>
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'text-gray-400 bg-gray-400/10',
    active: 'text-green-400 bg-green-400/10',
    review: 'text-amber-400 bg-amber-400/10',
    archived: 'text-red-400 bg-red-400/10',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[status] || 'text-gray-400 bg-gray-400/10'}`}>
      {status}
    </span>
  );
}
