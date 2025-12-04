/**
 * Linked Work Section - Shows tasks, sessions, knowledge linked to the selected capability
 * Fills the empty space below Status section in the detail panel.
 */

import { CheckSquare, Terminal, BookOpen, Loader2 } from 'lucide-react';
import { useProjectHubStore, type ConnectedEntity } from '@/stores/projectHubStore';

const MAX_ITEMS_PER_GROUP = 5;

export function LinkedWorkSection() {
  const connectedEntities = useProjectHubStore((s) => s.connectedEntities);
  const isLoadingConnected = useProjectHubStore((s) => s.isLoadingConnected);

  if (isLoadingConnected) {
    return (
      <div className="border-t border-[var(--border-muted)] pt-3">
        <div className="flex items-center gap-2 mb-2">
          <Loader2 size={12} className="text-[var(--text-muted)] animate-spin" />
          <h3 className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
            Linked Work
          </h3>
        </div>
      </div>
    );
  }

  if (!connectedEntities) return null;

  const { tasks, sessions, knowledge } = connectedEntities;
  const hasAny = tasks.length > 0 || sessions.length > 0 || knowledge.length > 0;

  if (!hasAny) {
    return (
      <div className="border-t border-[var(--border-muted)] pt-3">
        <div className="flex items-center gap-2 mb-2">
          <CheckSquare size={12} className="text-[var(--text-muted)]" />
          <h3 className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
            Linked Work
          </h3>
        </div>
        <p className="text-[11px] text-[var(--text-muted)] italic">No linked work yet</p>
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--border-muted)] pt-3">
      <div className="flex items-center gap-2 mb-2">
        <CheckSquare size={12} className="text-[var(--text-muted)]" />
        <h3 className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
          Linked Work
        </h3>
      </div>
      <div className="space-y-3">
        <EntityGroup label="Tasks" icon={CheckSquare} entities={tasks} />
        <EntityGroup label="Sessions" icon={Terminal} entities={sessions} />
        <EntityGroup label="Knowledge" icon={BookOpen} entities={knowledge} />
      </div>
    </div>
  );
}

function EntityGroup({
  label,
  icon: Icon,
  entities,
}: {
  label: string;
  icon: React.ElementType;
  entities: ConnectedEntity[];
}) {
  if (entities.length === 0) return null;

  const visible = entities.slice(0, MAX_ITEMS_PER_GROUP);
  const remaining = entities.length - MAX_ITEMS_PER_GROUP;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={10} className="text-[var(--text-muted)]" />
        <span className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
          {label}
        </span>
        <span className="text-[11px] text-[var(--text-muted)]">({entities.length})</span>
      </div>
      <div>
        {visible.map((entity) => (
          <EntityRow key={entity.id} entity={entity} />
        ))}
        {remaining > 0 && (
          <p className="text-[11px] text-[var(--text-muted)] pl-2 mt-0.5">
            +{remaining} more
          </p>
        )}
      </div>
    </div>
  );
}

const statusDotColor: Record<string, string> = {
  in_progress: 'bg-[var(--status-in-progress)]',
  completed: 'bg-[var(--status-completed)]',
  pending: 'bg-[var(--status-pending)]',
  active: 'bg-[var(--color-success)]',
};

function EntityRow({ entity }: { entity: ConnectedEntity }) {
  const dotClass = statusDotColor[entity.status || ''] || 'bg-[var(--status-pending)]';

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[var(--surface-2)] transition-colors cursor-pointer text-xs">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`} />
      <span className="text-[var(--text-primary)] truncate flex-1">{entity.title}</span>
      {entity.status && (
        <span className="text-[11px] text-[var(--text-muted)] flex-shrink-0">{entity.status}</span>
      )}
    </div>
  );
}
