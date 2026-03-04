import { useState, useEffect } from 'react';
import { NavLink, Outlet, useSearchParams, Navigate, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Kanban,
  Ticket,
  BookOpen,
  Shield,
  GraduationCap,
  Link2,
  Activity,
  Settings,
  Bell,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import { projects } from '@/lib/api';
import type { Project } from '@/lib/api';
import { useSocketInvalidation } from '@/hooks/useSocketInvalidation';

interface NavGroup {
  label: string;
  items: { to: string; label: string; icon: typeof LayoutDashboard; badge?: number }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Work',
    items: [
      { to: '/tasks', label: 'Tasks', icon: CheckSquare },
      { to: '/board', label: 'Board', icon: Kanban },
      { to: '/tickets', label: 'Tickets', icon: Ticket },
    ],
  },
  {
    label: 'Knowledge',
    items: [
      { to: '/knowledge', label: 'Knowledge Base', icon: BookOpen },
    ],
  },
  {
    label: 'Quality',
    items: [
      { to: '/impact', label: 'Impact Analysis', icon: Shield },
      { to: '/training', label: 'Training Room', icon: GraduationCap },
      { to: '/traceability', label: 'Traceability', icon: Link2 },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/activity', label: 'Activity', icon: Activity },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const projectId = searchParams.get('projectId');

  useSocketInvalidation(projectId);

  useEffect(() => {
    projects.list().then((r) => setProjectList(r.projects)).catch(() => {});
  }, []);

  const setProject = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('projectId', id);
    setSearchParams(next);
    setProjectDropdownOpen(false);
  };

  if (!projectId) {
    return <Navigate to="/" replace />;
  }

  const currentProject = projectList.find((p) => p.id === projectId);

  return (
    <div className="flex h-full">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-[220px] flex flex-col
          bg-white border-r border-[var(--border)]
          transform transition-transform duration-200
          lg:static lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 h-[52px] px-4 border-b border-[var(--border)]">
          <div className="w-7 h-7 rounded-md bg-[var(--accent)] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 4h10M3 8h7M3 12h8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-bold text-[15px]">SidStack</span>
          <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded font-medium">v0.5</span>
          <button
            className="lg:hidden ml-auto p-1 rounded hover:bg-[var(--bg-hover)]"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-4">
              <div className="px-3 mb-1 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.05em]">
                {group.label}
              </div>
              {group.items.map(({ to, label, icon: Icon, badge }) => (
                <NavLink
                  key={to}
                  to={`${to}?${searchParams.toString()}`}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-colors ${
                      isActive
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]'
                    }`
                  }
                >
                  <Icon size={18} />
                  {label}
                  {badge !== undefined && badge > 0 && (
                    <span className="ml-auto text-[11px] font-semibold bg-[var(--red)] text-white px-1.5 rounded-full leading-[18px]">
                      {badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="px-2 py-3 border-t border-[var(--border)]">
          <div
            className="flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer hover:bg-[var(--bg-hover)]"
            onClick={() => navigate(`/settings?${searchParams.toString()}`)}
          >
            <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-[12px] font-semibold">
              U
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold truncate">User</div>
              <div className="text-[11px] text-[var(--text-muted)]">Admin</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-[52px] border-b border-[var(--border)] flex items-center justify-between px-6 bg-white sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1.5 -ml-1 rounded hover:bg-[var(--bg-hover)]"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={18} />
            </button>
            {/* Project selector */}
            <div className="relative">
              <button
                onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 border border-[var(--border)] rounded-md text-[13px] font-medium hover:bg-[var(--bg-hover)] transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-[var(--green)]" />
                {currentProject?.name || projectId}
                <ChevronDown size={14} className="text-[var(--text-muted)]" />
              </button>
              {projectDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProjectDropdownOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-[var(--border)] rounded-md shadow-lg z-50 py-1">
                    {projectList.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setProject(p.id)}
                        className={`w-full text-left px-3 py-2 text-[13px] hover:bg-[var(--bg-hover)] transition-colors
                          ${p.id === projectId ? 'text-[var(--accent)] font-medium' : 'text-[var(--text-secondary)]'}`}
                      >
                        {p.name || p.id}
                      </button>
                    ))}
                    <div className="border-t border-[var(--border)] mt-1 pt-1">
                      <button
                        onClick={() => { setProjectDropdownOpen(false); navigate('/'); }}
                        className="w-full text-left px-3 py-2 text-[13px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                      >
                        Switch Project...
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--red)] rounded-full border-2 border-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
