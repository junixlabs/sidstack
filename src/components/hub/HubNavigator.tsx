/**
 * Hub Navigator - Capability Tree
 *
 * Displays capabilities as an expandable L0/L1/L2 hierarchy tree.
 * Implements the Capability Map (TOGAF) professional concept.
 */

import { useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Layers,
  ChevronRight,
  ChevronDown,
  Circle,
  Search,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectHubStore } from '@/stores/projectHubStore';
import { LevelBadge } from './ui/badges';
import type { CapabilityNode } from '@sidstack/shared';

interface HubNavigatorProps {
  projectPath: string;
}

export function HubNavigator({ projectPath }: HubNavigatorProps) {
  const {
    capabilityTree,
    selectedCapabilityId,
    selectCapability,
    expandedGroups,
    toggleGroup,
    searchQuery,
    setSearchQuery,
    fetchCapabilityTree,
    isLoading,
    error,
  } = useProjectHubStore();

  const searchRef = useRef<HTMLInputElement>(null);

  // Fetch tree on mount
  useEffect(() => {
    fetchCapabilityTree(projectPath);
  }, [projectPath, fetchCapabilityTree]);

  // Keyboard: / focuses search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter tree by search query
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return capabilityTree;

    const q = searchQuery.toLowerCase();
    function matchesNode(node: CapabilityNode): boolean {
      const cap = node.capability;
      const purposeStr = typeof cap.purpose === 'string' ? cap.purpose : cap.purpose?.description || '';
      if (cap.name.toLowerCase().includes(q)) return true;
      if (cap.id.toLowerCase().includes(q)) return true;
      if (purposeStr.toLowerCase().includes(q)) return true;
      if (cap.tags?.some(t => t.toLowerCase().includes(q))) return true;
      return false;
    }

    function filterNode(node: CapabilityNode): CapabilityNode | null {
      const filteredChildren = node.children
        .map(filterNode)
        .filter((n): n is CapabilityNode => n !== null);

      if (matchesNode(node) || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      return null;
    }

    return capabilityTree
      .map(filterNode)
      .filter((n): n is CapabilityNode => n !== null);
  }, [capabilityTree, searchQuery]);

  const handleSelect = useCallback((capId: string) => {
    selectCapability(selectedCapabilityId === capId ? null : capId);
  }, [selectCapability, selectedCapabilityId]);

  return (
    <div className="flex flex-col h-full border-r border-[var(--border-default)]">
      {/* Search */}
      <div className="p-2 border-b border-[var(--border-default)]">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search capabilities..."
            aria-label="Search capabilities"
            className="w-full pl-7 pr-8 py-1.5 text-xs bg-[var(--surface-2)] border border-[var(--border-muted)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)] bg-[var(--surface-0)] border border-[var(--border-muted)] rounded px-1">
            /
          </kbd>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading ? (
          <div className="p-3 text-xs text-[var(--text-muted)]">Loading capabilities...</div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => fetchCapabilityTree(projectPath)} />
        ) : filteredTree.length === 0 ? (
          <EmptyState hasSearch={!!searchQuery.trim()} onRetry={() => fetchCapabilityTree(projectPath)} />
        ) : (
          filteredTree.map((node) => (
            <TreeNode
              key={node.capability.id}
              node={node}
              selectedId={selectedCapabilityId}
              expandedGroups={expandedGroups}
              onSelect={handleSelect}
              onToggle={toggleGroup}
              isSearching={!!searchQuery.trim()}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Tree Node (recursive)
// ============================================================================

function TreeNode({
  node,
  selectedId,
  expandedGroups,
  onSelect,
  onToggle,
  isSearching,
}: {
  node: CapabilityNode;
  selectedId: string | null;
  expandedGroups: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  isSearching: boolean;
}) {
  const cap = node.capability;
  const isL0 = cap.level === 'L0';
  const hasChildren = node.children.length > 0;
  const isExpanded = isSearching || expandedGroups.has(cap.id);
  const isSelected = selectedId === cap.id;

  return (
    <div>
      <button
        onClick={() => {
          if (isL0 && hasChildren) {
            onToggle(cap.id);
          }
          onSelect(cap.id);
        }}
        className={cn(
          'w-full text-left flex items-center gap-1.5 transition-colors',
          isL0 ? 'px-2 py-1.5' : 'px-2 py-1',
          isSelected
            ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
            : 'text-[var(--text-primary)] hover:bg-[var(--surface-2)]',
        )}
        style={{ paddingLeft: isL0 ? 8 : 8 + node.depth * 16 }}
      >
        {/* Chevron for L0 groups */}
        {isL0 && hasChildren ? (
          isExpanded
            ? <ChevronDown size={12} className="flex-shrink-0 opacity-50" />
            : <ChevronRight size={12} className="flex-shrink-0 opacity-50" />
        ) : isL0 ? (
          <span className="w-3 flex-shrink-0" />
        ) : null}

        {/* Level badge */}
        <LevelBadge level={cap.level} />

        {/* Name */}
        <span className={cn(
          'truncate flex-1 text-xs',
          isL0 && 'font-medium',
        )}>
          {cap.name}
        </span>

        {/* Child count for L0 */}
        {isL0 && hasChildren && (
          <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">
            ({node.children.length})
          </span>
        )}

        {/* Status dot */}
        <StatusDot status={cap.status} />
      </button>

      {/* Progress bar for L1/L2 */}
      {!isL0 && isSelected && (
        <div className="px-2 pb-1" style={{ paddingLeft: 8 + node.depth * 16 + 24 }}>
          <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
            <span>{cap.maturity}</span>
          </div>
        </div>
      )}

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.capability.id}
              node={child}
              selectedId={selectedId}
              expandedGroups={expandedGroups}
              onSelect={onSelect}
              onToggle={onToggle}
              isSearching={isSearching}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="p-4 text-center">
      <AlertTriangle size={24} className="mx-auto mb-2 text-yellow-400" />
      <p className="text-xs text-[var(--text-secondary)] mb-1">Failed to load capabilities</p>
      <p className="text-[10px] text-[var(--text-muted)] mb-2">{error}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1 text-[10px] text-[var(--accent-primary)] hover:underline"
      >
        <RefreshCw size={10} />
        Retry
      </button>
    </div>
  );
}

function EmptyState({ hasSearch, onRetry }: { hasSearch: boolean; onRetry: () => void }) {
  if (hasSearch) {
    return (
      <div className="p-4 text-center">
        <Search size={24} className="mx-auto mb-2 text-[var(--text-muted)] opacity-40" />
        <p className="text-xs text-[var(--text-muted)]">No matching capabilities</p>
      </div>
    );
  }

  return (
    <div className="p-4 text-center">
      <Layers size={24} className="mx-auto mb-2 text-[var(--text-muted)] opacity-40" />
      <p className="text-xs text-[var(--text-secondary)] mb-1">No capabilities defined</p>
      <p className="text-[10px] text-[var(--text-muted)] mb-2">
        Run the migration tool or create capabilities in .sidstack/capabilities/
      </p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1 text-[10px] text-[var(--accent-primary)] hover:underline"
      >
        <RefreshCw size={10} />
        Reload
      </button>
    </div>
  );
}

// ============================================================================
// UI Helpers
// ============================================================================

function StatusDot({ status }: { status?: string }) {
  const colors: Record<string, string> = {
    active: 'text-[var(--color-success)]',
    planned: 'text-[var(--text-muted)]',
    deprecated: 'text-[var(--color-error)]',
  };
  return (
    <Circle
      size={6}
      className={cn('fill-current flex-shrink-0', colors[status || ''] || 'text-[var(--text-muted)]')}
    />
  );
}
