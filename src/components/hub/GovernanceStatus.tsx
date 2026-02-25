/**
 * GovernanceStatus - Grid of governance artifact counts
 */

import {
  AlertTriangle,
  BookOpen,
  CheckSquare,
  Shield,
} from 'lucide-react';

interface GovernanceStats {
  knowledgeDocs: number;
  qualityGates: number;
  openIncidents: number;
  activeRules: number;
}

interface GovernanceStatusProps {
  stats: GovernanceStats;
  loading: boolean;
}

export function GovernanceStatus({ stats, loading }: GovernanceStatusProps) {
  const items = [
    { label: 'Knowledge Docs', value: stats.knowledgeDocs, icon: BookOpen },
    { label: 'Quality Gates', value: stats.qualityGates, icon: CheckSquare },
    { label: 'Open Incidents', value: stats.openIncidents, icon: AlertTriangle },
    { label: 'Active Rules', value: stats.activeRules, icon: Shield },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="flex flex-col items-center gap-1 p-2 rounded-lg border border-[var(--border-muted)] bg-[var(--surface-1)]"
          >
            <Icon size={14} className="text-[var(--text-muted)]" />
            <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
              {loading ? '--' : item.value}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] text-center leading-tight">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
