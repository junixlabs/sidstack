/**
 * NeedsAttention - Action items requiring attention
 */

import { AlertTriangle, Clock, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AttentionItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  age: string;
}

interface NeedsAttentionProps {
  items: AttentionItem[];
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-[var(--color-error)]',
  high: 'text-[var(--color-warning)]',
  medium: 'text-[var(--text-secondary)]',
  low: 'text-[var(--text-muted)]',
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'blocked') return <Ban size={12} className="text-[var(--color-error)] flex-shrink-0" />;
  if (status === 'pending') return <Clock size={12} className="text-[var(--color-warning)] flex-shrink-0" />;
  return <AlertTriangle size={12} className="text-[var(--text-muted)] flex-shrink-0" />;
}

export function NeedsAttention({ items }: NeedsAttentionProps) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-[var(--text-muted)] italic py-2">
        No items need attention right now.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {items.slice(0, 5).map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-2 px-2 py-1.5 rounded bg-[var(--surface-1)] border border-[var(--border-muted)]"
        >
          <StatusIcon status={item.status} />
          <span className="text-xs text-[var(--text-primary)] flex-1 truncate">
            {item.title}
          </span>
          <span className={cn('text-[11px] font-medium flex-shrink-0', PRIORITY_COLORS[item.priority] || '')}>
            {item.priority}
          </span>
          <span className="text-[11px] text-[var(--text-muted)] flex-shrink-0">
            {item.age}
          </span>
        </div>
      ))}
    </div>
  );
}
