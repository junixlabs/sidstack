import { useState, useEffect } from 'react';
import { NavLink, Outlet, useSearchParams, Navigate, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  CheckSquare,
  Ticket,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';
import { projects } from '@/lib/api';
import type { Project } from '@/lib/api';

const NAV_ITEMS = [
  { to: '/knowledge', label: 'Knowledge', icon: BookOpen },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/tickets', label: 'Tickets', icon: Ticket },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const projectId = searchParams.get('projectId');

  useEffect(() => {
    projects.list().then((r) => setProjectList(r.projects)).catch(() => {});
  }, []);

  const setProject = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('projectId', id);
    setSearchParams(next);
    setProjectDropdownOpen(false);
  };

  const switchProject = () => {
    navigate('/');
  };

  // Redirect to project selector if no projectId
  if (!projectId) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-full">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-56 flex flex-col
          bg-[var(--surface-1)] border-r border-[var(--border-default)]
          transform transition-transform duration-200
          lg:static lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-12 px-4 border-b border-[var(--border-default)]">
          <span className="font-semibold text-[15px] tracking-tight">SidStack</span>
          <button
            className="lg:hidden p-1 rounded hover:bg-[var(--surface-2)]"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={16} />
          </button>
        </div>

        {/* Project Selector */}
        <div className="px-3 py-2 border-b border-[var(--border-muted)]">
          <div className="relative">
            <button
              onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs rounded
                         bg-[var(--surface-2)] hover:bg-[var(--surface-3)] transition-colors"
            >
              <span className="truncate text-[var(--text-secondary)]">
                {projectList.find((p) => p.id === projectId)?.name || projectId}
              </span>
              <ChevronDown size={12} className="text-[var(--text-muted)] shrink-0" />
            </button>
            {projectDropdownOpen && projectList.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface-2)] border border-[var(--border-default)] rounded shadow-lg z-50">
                {projectList.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProject(p.id)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--surface-3)] transition-colors
                      ${p.id === projectId ? 'text-[var(--accent-blue)]' : 'text-[var(--text-secondary)]'}`}
                  >
                    {p.name || p.id}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 px-2 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={`${to}?${searchParams.toString()}`}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded text-[13px] transition-colors ${
                  isActive
                    ? 'bg-[var(--surface-2)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-[var(--border-muted)]">
          <button
            onClick={switchProject}
            className="w-full text-left px-2 py-1.5 text-[11px] text-[var(--text-muted)]
                       hover:text-[var(--text-secondary)] hover:bg-[var(--surface-2)]
                       rounded transition-colors"
          >
            Switch Project
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="flex items-center h-12 px-4 border-b border-[var(--border-default)] lg:hidden">
          <button
            className="p-1.5 -ml-1 rounded hover:bg-[var(--surface-2)]"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={18} />
          </button>
          <span className="ml-3 font-semibold text-sm">SidStack</span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
