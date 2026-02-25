import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, RefreshCw, Search } from 'lucide-react';
import { projects, type Project } from '@/lib/api';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    projects
      .list()
      .then((r) => setProjectList(r.projects))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = projectList.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase()),
  );

  const selectProject = (id: string) => {
    navigate(`/knowledge?projectId=${encodeURIComponent(id)}`);
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">SidStack</h1>
          <p className="text-sm text-[var(--text-secondary)]">Select a project to get started</p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-[var(--surface-1)] border border-[var(--border-default)]
                       rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]
                       focus:outline-none focus:border-[var(--accent-blue)]"
          />
        </div>

        {/* Project List */}
        <div className="border border-[var(--border-default)] rounded-lg overflow-hidden bg-[var(--surface-1)]">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[var(--text-muted)]">
              <RefreshCw size={16} className="animate-spin mr-2" />
              Loading projects...
            </div>
          ) : error ? (
            <div className="text-center py-12 px-4">
              <p className="text-sm text-[var(--accent-red)] mb-3">{error}</p>
              <button
                onClick={load}
                className="text-xs text-[var(--accent-blue)] hover:underline"
              >
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-[var(--text-muted)]">
              {search ? 'No matching projects' : 'No projects found'}
            </div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => selectProject(p.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left
                           hover:bg-[var(--surface-2)] transition-colors
                           border-b border-[var(--border-muted)] last:border-b-0"
              >
                <FolderOpen size={18} className="text-[var(--accent-blue)] shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {p.name}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] truncate">{p.id}</div>
                </div>
                {p.status === 'archived' && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-3)] text-[var(--text-muted)]">
                    archived
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Count */}
        {!loading && !error && (
          <div className="mt-3 text-center text-xs text-[var(--text-muted)]">
            {filtered.length} project{filtered.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
