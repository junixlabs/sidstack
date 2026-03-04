import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTraceability } from '@/hooks/queries';

export default function TraceabilityPage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || '';

  const { data, isLoading } = useTraceability(projectId);
  const [tab, setTab] = useState<'matrix' | 'gaps'>('matrix');

  const matrix = data?.matrix ?? [];
  const gaps = matrix.filter(r => r.coverage < 50);
  const totalSpecs = matrix.length;
  const coveredSpecs = matrix.filter(r => r.coverage >= 80).length;
  const avgCoverage = totalSpecs > 0 ? Math.round(matrix.reduce((s, r) => s + r.coverage, 0) / totalSpecs) : 0;

  const displayed = tab === 'gaps' ? gaps : matrix;

  if (isLoading) return <div className="p-8 text-sm text-[var(--text-muted)]">Loading traceability matrix...</div>;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-1">Traceability</h1>
        <p className="text-sm text-[var(--text-secondary)]">Spec-to-task-to-test coverage matrix</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border border-[var(--border)] rounded-lg p-4">
          <div className="text-xs text-[var(--text-muted)] font-medium mb-1">Overall Coverage</div>
          <div className={`text-2xl font-bold ${avgCoverage >= 80 ? 'text-[var(--green)]' : avgCoverage >= 50 ? 'text-[var(--amber)]' : 'text-[var(--red)]'}`}>{avgCoverage}%</div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">{coveredSpecs} of {totalSpecs} specs covered</div>
        </div>
        <div className="border border-[var(--border)] rounded-lg p-4">
          <div className="text-xs text-[var(--text-muted)] font-medium mb-1">Total Specs</div>
          <div className="text-2xl font-bold">{totalSpecs}</div>
        </div>
        <div className="border border-[var(--border)] rounded-lg p-4">
          <div className="text-xs text-[var(--text-muted)] font-medium mb-1">Coverage Gaps</div>
          <div className={`text-2xl font-bold ${gaps.length > 0 ? 'text-[var(--red)]' : 'text-[var(--green)]'}`}>{gaps.length}</div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">Specs below 50%</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[var(--border)] mb-5">
        {(['matrix', 'gaps'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors capitalize
              ${tab === t ? 'text-[var(--accent)] border-[var(--accent)]' : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text)]'}`}
          >{t === 'matrix' ? 'Coverage Matrix' : `Gaps (${gaps.length})`}</button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <div className="text-center py-16 text-sm text-[var(--text-muted)]">
          {tab === 'gaps' ? 'No coverage gaps found' : 'No traceability data available'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.03em] py-2.5 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)]">Specification</th>
                <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.03em] py-2.5 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] w-20">Tasks</th>
                <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.03em] py-2.5 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] w-20">Tests</th>
                <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.03em] py-2.5 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] w-48">Coverage</th>
                <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-[0.03em] py-2.5 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] w-24">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(row => (
                <tr key={row.specId} className="hover:bg-[var(--bg-secondary)]">
                  <td className="py-2.5 px-3 border-b border-[var(--border-light)] font-medium">{row.specTitle}</td>
                  <td className="py-2.5 px-3 border-b border-[var(--border-light)]">{row.tasks.length}</td>
                  <td className="py-2.5 px-3 border-b border-[var(--border-light)]">{row.testResults.length}</td>
                  <td className="py-2.5 px-3 border-b border-[var(--border-light)]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${row.coverage >= 80 ? 'bg-[var(--green)]' : row.coverage >= 50 ? 'bg-[var(--accent)]' : 'bg-[var(--red)]'}`}
                          style={{ width: `${row.coverage}%` }} />
                      </div>
                      <span className="text-xs font-medium w-9 text-right">{row.coverage}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 border-b border-[var(--border-light)]">
                    <CoverageBadge coverage={row.coverage} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CoverageBadge({ coverage }: { coverage: number }) {
  if (coverage >= 80) return <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-[var(--green-bg)] text-[var(--green-text)]">Covered</span>;
  if (coverage >= 50) return <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-[var(--amber-bg)] text-[var(--amber-text)]">Partial</span>;
  return <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-[var(--red-bg)] text-[var(--red-text)]">Gap</span>;
}
