import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, RefreshCw, Search } from 'lucide-react';
import { useProjects } from '@/hooks/queries';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { data, isLoading: loading, error, refetch } = useProjects();
  const [search, setSearch] = useState('');

  const projectList = data?.projects ?? [];
  const filtered = projectList.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase()),
  );

  const select = (id: string) => {
    navigate(`/dashboard?projectId=${encodeURIComponent(id)}`);
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 bg-[var(--bg-secondary)]">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--accent)] mb-4">
            <svg width="24" height="24" viewBox="0 0 16 16" fill="none">
              <path d="M3 4h10M3 8h7M3 12h8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-1">SidStack</h1>
          <p className="text-sm text-[var(--text-secondary)]">Select a project to get started</p>
        </div>

        <div className="flex items-center gap-2 px-3 py-2.5 border border-[var(--border)] rounded-md bg-white mb-4">
          <Search size={15} className="text-[var(--text-muted)]" />
          <input type="text" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-[var(--text-muted)]" />
        </div>

        <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[var(--text-muted)] text-sm">
              <RefreshCw size={16} className="animate-spin mr-2" /> Loading projects...
            </div>
          ) : error ? (
            <div className="text-center py-12 px-4">
              <p className="text-sm text-[var(--red)] mb-3">{error?.message}</p>
              <button onClick={() => refetch()} className="text-sm text-[var(--accent)] hover:underline">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-[var(--text-muted)]">
              {search ? 'No matching projects' : 'No projects found'}
            </div>
          ) : (
            filtered.map(p => (
              <button key={p.id} onClick={() => select(p.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--bg-secondary)] transition-colors border-b border-[var(--border-light)] last:border-b-0">
                <FolderOpen size={18} className="text-[var(--accent)] shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-[var(--text-muted)] truncate">{p.id}</div>
                </div>
                {p.status === 'archived' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)] font-medium">archived</span>
                )}
              </button>
            ))
          )}
        </div>

        {!loading && !error && (
          <div className="mt-3 text-center text-xs text-[var(--text-muted)]">
            {filtered.length} project{filtered.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
