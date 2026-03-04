import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, XCircle, Info } from 'lucide-react';
import { type ImpactAnalysis } from '@/lib/api';
import { useImpact } from '@/hooks/queries';

export default function ImpactPage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || '';

  const { data, isLoading } = useImpact(projectId, { limit: 50 });
  const [tab, setTab] = useState<'all' | 'pending' | 'approved' | 'blocked'>('all');

  const analyses = data?.analyses ?? [];
  const filtered = tab === 'all' ? analyses : analyses.filter(a => {
    if (tab === 'pending') return a.status === 'pending' || a.status === 'in_progress';
    if (tab === 'approved') return a.status === 'approved' || a.status === 'clear';
    if (tab === 'blocked') return a.status === 'blocked';
    return true;
  });

  const pendingCount = analyses.filter(a => a.status === 'pending' || a.status === 'in_progress').length;

  if (isLoading) return <div className="p-8 text-sm text-[var(--text-muted)]">Loading impact analyses...</div>;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-1">Impact Analysis</h1>
        <p className="text-sm text-[var(--text-secondary)]">Review risks and approve deployment gates</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[var(--border)] mb-5">
        {(['all', 'pending', 'approved', 'blocked'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors capitalize
              ${tab === t ? 'text-[var(--accent)] border-[var(--accent)]' : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text)]'}`}
          >{t === 'all' ? 'All' : t} {t === 'pending' && pendingCount > 0 ? `(${pendingCount})` : ''}</button>
        ))}
      </div>

      {pendingCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[var(--accent-light)] rounded-lg mb-5 text-sm text-[var(--accent)]">
          <Info size={16} />
          {pendingCount} analysis{pendingCount !== 1 ? 'es' : ''} pending review. Gate decisions required before deployment.
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-[var(--text-muted)]">No impact analyses found</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => (
            <AnalysisCard key={a.id} analysis={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function AnalysisCard({ analysis }: { analysis: ImpactAnalysis }) {
  const riskLevel = analysis.riskLevel || 'unknown';
  const borderColor = riskLevel === 'high' || riskLevel === 'critical' ? 'border-l-[var(--red)]' : riskLevel === 'medium' ? 'border-l-[var(--amber)]' : 'border-l-[var(--green)]';

  const risks = analysis.risks || [];

  return (
    <div className={`border border-[var(--border)] rounded-lg p-4 border-l-[3px] ${borderColor}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-sm font-semibold">{analysis.description}</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">
            {analysis.id.slice(0, 12)} {analysis.taskId && `· Task ${analysis.taskId.slice(-8)}`} · {timeAgo(analysis.createdAt)}
          </div>
        </div>
        <RiskBadge level={riskLevel} />
      </div>

      {risks.length > 0 && (
        <div className="mt-3 text-sm text-[var(--text-secondary)]">
          {risks.map((r, i) => (
            <div key={r.id || i} className="flex items-start gap-2 py-1">
              {r.mitigated
                ? <CheckCircle2 size={14} className="text-[var(--green)] mt-0.5 shrink-0" />
                : <AlertTriangle size={14} className="text-[var(--amber)] mt-0.5 shrink-0" />}
              <span>{r.description}</span>
            </div>
          ))}
        </div>
      )}

      {(analysis.status === 'pending' || analysis.status === 'in_progress') && (
        <div className="flex gap-2 mt-3">
          <button className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--green-bg)] text-[var(--green-text)] hover:bg-[var(--green)] hover:text-white transition-colors">
            Approve Gate
          </button>
          <button className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--red-bg)] text-[var(--red-text)] hover:bg-[var(--red)] hover:text-white transition-colors">
            Block Deployment
          </button>
        </div>
      )}

      {(analysis.status === 'approved' || analysis.status === 'clear') && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--green-text)]">
          <CheckCircle2 size={13} /> Approved
        </div>
      )}

      {analysis.status === 'blocked' && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--red-text)]">
          <XCircle size={13} /> Blocked
        </div>
      )}
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    critical: 'bg-[var(--red-bg)] text-[var(--red-text)]',
    high: 'bg-[var(--red-bg)] text-[var(--red-text)]',
    medium: 'bg-[var(--amber-bg)] text-[var(--amber-text)]',
    low: 'bg-[var(--green-bg)] text-[var(--green-text)]',
  };
  return <span className={`text-[11px] px-2 py-0.5 rounded font-semibold capitalize ${map[level] || 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'}`}>{level} Risk</span>;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
