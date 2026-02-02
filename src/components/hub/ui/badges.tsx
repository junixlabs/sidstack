/**
 * Shared badge components for the Project Hub.
 * Used by HubNavigator, HubDetailPanel, and GoalsView.
 */

import { cn } from '@/lib/utils';

export function LevelBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    L0: 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]',
    L1: 'bg-[var(--color-info)]/20 text-[var(--color-info)]',
    L2: 'bg-[var(--color-success)]/20 text-[var(--color-success)]',
  };
  return (
    <span className={cn('text-[11px] font-mono font-bold px-1.5 py-0.5 rounded', colors[level] || 'bg-[var(--surface-3)] text-[var(--text-muted)]')}>
      {level}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-[var(--color-success)]/20 text-[var(--color-success)]',
    planned: 'bg-[var(--surface-3)] text-[var(--text-muted)]',
    deprecated: 'bg-[var(--color-error)]/20 text-[var(--color-error)]',
  };
  return (
    <span className={cn('text-[11px] px-1.5 py-0.5 rounded', colors[status] || 'bg-[var(--surface-3)] text-[var(--text-muted)]')}>
      {status}
    </span>
  );
}

export function MaturityBadge({ maturity }: { maturity: string }) {
  const colors: Record<string, string> = {
    planned: 'bg-[var(--surface-3)] text-[var(--text-muted)]',
    developing: 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]',
    established: 'bg-[var(--color-success)]/20 text-[var(--color-success)]',
    optimized: 'bg-[var(--color-info)]/20 text-[var(--color-info)]',
  };
  return (
    <span className={cn('text-[11px] px-1.5 py-0.5 rounded', colors[maturity] || 'bg-[var(--surface-3)] text-[var(--text-muted)]')}>
      {maturity}
    </span>
  );
}
