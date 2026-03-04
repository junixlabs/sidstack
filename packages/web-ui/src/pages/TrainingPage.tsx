import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTraining } from '@/hooks/queries';

type Tab = 'incidents' | 'lessons' | 'skills' | 'rules';

export default function TrainingPage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || '';
  const [tab, setTab] = useState<Tab>('incidents');

  const { data, isLoading: loading } = useTraining(projectId);
  const stats = data?.stats || null;
  const incidents = data?.incidents || [];
  const lessons = data?.lessons || [];
  const skills = data?.skills || [];
  const rules = data?.rules || [];

  if (loading) return <div className="p-8 text-sm text-[var(--text-muted)]">Loading training room...</div>;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-1">Training Room</h1>
        <p className="text-sm text-[var(--text-secondary)]">Incidents, lessons learned, and agent skills</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[var(--border)] mb-5">
        {(['incidents', 'lessons', 'skills', 'rules'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors capitalize
              ${tab === t ? 'text-[var(--accent)] border-[var(--accent)]' : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text)]'}`}
          >{t}</button>
        ))}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Incidents" value={stats.totalIncidents ?? 0} />
          <StatCard label="Lessons" value={stats.totalLessons ?? 0} sub={`${stats.pendingLessons ?? 0} pending`} />
          <StatCard label="Active Skills" value={stats.activeSkills ?? 0} />
          <StatCard label="Active Rules" value={stats.activeRules ?? 0} sub={`${stats.recentViolations ?? 0} violations`} />
        </div>
      )}

      {/* Content */}
      {tab === 'incidents' && (
        <div className="space-y-3">
          {incidents.length === 0 ? <Empty /> : incidents.map(i => (
            <div key={i.id} className="border border-[var(--border)] rounded-lg p-4">
              <div className="flex items-start justify-between mb-1">
                <div className="text-sm font-semibold">{i.title}</div>
                <SeverityBadge severity={i.severity} />
              </div>
              <div className="text-xs text-[var(--text-muted)] mb-2">{i.type} &middot; {new Date(i.createdAt).toLocaleDateString()}</div>
              <div className="text-sm text-[var(--text-secondary)]">{i.description}</div>
              {i.resolution && (
                <div className="mt-2 text-sm text-[var(--green-text)] bg-[var(--green-bg)] rounded px-3 py-2">
                  Resolution: {i.resolution}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'lessons' && (
        <div className="space-y-3">
          {lessons.length === 0 ? <Empty /> : lessons.map(l => (
            <div key={l.id} className="border border-[var(--border)] rounded-lg p-4">
              <div className="flex items-start justify-between mb-1">
                <div className="text-sm font-semibold">{l.title}</div>
                <LessonStatusBadge status={l.status} />
              </div>
              <div className="text-sm text-[var(--text-secondary)] mt-2">
                <p className="mb-1"><strong>Problem:</strong> {l.problem}</p>
                <p className="mb-1"><strong>Root Cause:</strong> {l.rootCause}</p>
                <p><strong>Solution:</strong> {l.solution}</p>
              </div>
              {l.status === 'pending' && (
                <div className="mt-3">
                  <button className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--green-bg)] text-[var(--green-text)] hover:bg-[var(--green)] hover:text-white transition-colors">
                    Approve Lesson
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'skills' && (
        <div className="space-y-3">
          {skills.length === 0 ? <Empty /> : skills.map(s => (
            <div key={s.id} className="border border-[var(--border)] rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold">{s.name}</div>
                  <div className="text-sm text-[var(--text-secondary)] mt-1">{s.description}</div>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${s.status === 'active' ? 'bg-[var(--green-bg)] text-[var(--green-text)]' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'}`}>
                  {s.status}
                </span>
              </div>
              <div className="text-xs text-[var(--text-muted)] mt-2">
                Type: {s.type} {s.usageCount !== undefined && `· Used ${s.usageCount} times`}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'rules' && (
        <div className="space-y-3">
          {rules.length === 0 ? <Empty /> : rules.map(r => (
            <div key={r.id} className="border border-[var(--border)] rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold">{r.name}</div>
                  <div className="text-sm text-[var(--text-secondary)] mt-1">{r.description}</div>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded font-semibold capitalize ${
                  r.level === 'critical' ? 'bg-[var(--red-bg)] text-[var(--red-text)]' :
                  r.level === 'warning' ? 'bg-[var(--amber-bg)] text-[var(--amber-text)]' :
                  'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                }`}>{r.level}</span>
              </div>
              <div className="text-xs text-[var(--text-muted)] mt-2">
                Enforcement: {r.enforcement} {r.violationCount !== undefined && `· ${r.violationCount} violations`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="border border-[var(--border)] rounded-lg p-4">
      <div className="text-xs text-[var(--text-muted)] font-medium mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-[var(--text-secondary)] mt-0.5">{sub}</div>}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: 'bg-[var(--red-bg)] text-[var(--red-text)]',
    high: 'bg-[var(--red-bg)] text-[var(--red-text)]',
    medium: 'bg-[var(--amber-bg)] text-[var(--amber-text)]',
    low: 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]',
  };
  return <span className={`text-[11px] px-2 py-0.5 rounded font-semibold capitalize ${map[severity] || map.medium}`}>{severity}</span>;
}

function LessonStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-[var(--amber-bg)] text-[var(--amber-text)]',
    approved: 'bg-[var(--green-bg)] text-[var(--green-text)]',
    rejected: 'bg-[var(--red-bg)] text-[var(--red-text)]',
  };
  return <span className={`text-[11px] px-2 py-0.5 rounded font-semibold capitalize ${map[status] || 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'}`}>{status}</span>;
}

function Empty() {
  return <div className="text-center py-16 text-sm text-[var(--text-muted)]">No data available</div>;
}
