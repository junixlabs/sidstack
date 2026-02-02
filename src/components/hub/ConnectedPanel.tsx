/**
 * Connected Panel - Entity Relationships
 *
 * Shows entity references for the selected capability.
 * Implements the Entity Reference Graph pillar of the Project Intelligence Hub.
 */

import { useState } from 'react';
import {
  Link2,
  CheckSquare,
  Terminal,
  BookOpen,
  Layers,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBlockNavigation } from '@/hooks/useBlockNavigation';
import { useProjectHubStore, type ConnectedEntity } from '@/stores/projectHubStore';

const MAX_ITEMS_PER_GROUP = 5;

interface ConnectedPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function ConnectedPanel({ collapsed, onToggleCollapse }: ConnectedPanelProps) {
  const { selectedCapabilityId, connectedEntities, isLoadingConnected } = useProjectHubStore();

  if (collapsed) {
    return (
      <div className="w-8 border-l border-[var(--border-default)] bg-[var(--surface-1)] flex flex-col items-center py-2">
        <button
          onClick={onToggleCollapse}
          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          title="Expand connected panel"
          aria-label="Expand connected panel"
        >
          <PanelRightOpen size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 border-l border-[var(--border-default)] bg-[var(--surface-1)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-default)]">
        <Link2 size={12} className="text-[var(--text-muted)]" />
        <span className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider flex-1">
          Connected
        </span>
        <button
          onClick={onToggleCollapse}
          className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          title="Collapse"
          aria-label="Collapse connected panel"
        >
          <PanelRightClose size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {!selectedCapabilityId ? (
          <EmptyNoSelection />
        ) : isLoadingConnected ? (
          <div className="p-2 text-[11px] text-[var(--text-muted)]">Loading...</div>
        ) : !connectedEntities ? (
          <EmptyNoConnections />
        ) : (
          <div className="space-y-3">
            <EntityGroup
              label="Tasks"
              icon={CheckSquare}
              entities={connectedEntities.tasks}
            />
            <EntityGroup
              label="Sessions"
              icon={Terminal}
              entities={connectedEntities.sessions}
            />
            <EntityGroup
              label="Knowledge"
              icon={BookOpen}
              entities={connectedEntities.knowledge}
            />
            <EntityGroup
              label="Capabilities"
              icon={Layers}
              entities={connectedEntities.capabilities}
            />
            {connectedEntities.tasks.length === 0 &&
             connectedEntities.sessions.length === 0 &&
             connectedEntities.knowledge.length === 0 &&
             connectedEntities.capabilities.length === 0 && (
              <EmptyNoConnections />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Entity Group
// ============================================================================

function EntityGroup({
  label,
  icon: Icon,
  entities,
}: {
  label: string;
  icon: React.ElementType;
  entities: ConnectedEntity[];
}) {
  const [showAll, setShowAll] = useState(false);

  if (entities.length === 0) return null;

  const visible = showAll ? entities : entities.slice(0, MAX_ITEMS_PER_GROUP);
  const remaining = entities.length - MAX_ITEMS_PER_GROUP;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={10} className="text-[var(--text-muted)]" />
        <span className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
          {label}
        </span>
        <span className="text-[11px] text-[var(--text-muted)]">({entities.length})</span>
      </div>
      <div className="space-y-0.5">
        {visible.map((entity) => (
          <EntityRow key={`${entity.type}-${entity.id}`} entity={entity} />
        ))}
        {!showAll && remaining > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className="text-[11px] text-[var(--accent-primary)] hover:underline pl-2"
          >
            +{remaining} more
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Entity Row
// ============================================================================

function EntityRow({ entity }: { entity: ConnectedEntity }) {
  const { selectCapability } = useProjectHubStore();
  const { navigateToBlockView } = useBlockNavigation();

  const isNavigable = entity.type === 'capability' || entity.type === 'task' || entity.type === 'knowledge';

  const handleClick = () => {
    if (entity.type === 'capability') {
      selectCapability(entity.id);
    } else if (entity.type === 'task') {
      navigateToBlockView('task-manager', { selectedTaskId: entity.id });
    } else if (entity.type === 'knowledge') {
      navigateToBlockView('knowledge-browser', { selectedKnowledgePath: entity.id });
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full text-left px-2 py-1 rounded text-[11px] transition-colors',
        isNavigable
          ? 'hover:bg-[var(--surface-2)] cursor-pointer'
          : 'cursor-default',
      )}
    >
      <div className="truncate text-[var(--text-primary)]">{entity.title}</div>
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
        {entity.status && <span>{entity.status}</span>}
        {entity.relationshipType && (
          <span className="font-mono">{entity.relationshipType}</span>
        )}
      </div>
    </button>
  );
}

// ============================================================================
// Empty States
// ============================================================================

function EmptyNoSelection() {
  return (
    <div className="p-3 text-center">
      <Link2 size={16} className="mx-auto mb-1.5 text-[var(--text-muted)] opacity-30" />
      <p className="text-[11px] text-[var(--text-muted)]">
        Select a capability to see connected entities
      </p>
    </div>
  );
}

function EmptyNoConnections() {
  return (
    <div className="p-3 text-center">
      <Link2 size={16} className="mx-auto mb-1.5 text-[var(--text-muted)] opacity-30" />
      <p className="text-[11px] text-[var(--text-muted)]">No connected entities</p>
      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
        Connections appear as work artifacts reference this capability.
      </p>
    </div>
  );
}
