/**
 * Project Intelligence Hub Block View
 *
 * Three-panel layout: Capability Tree + Detail Panel + Connected Panel.
 * Surfaces 4 professional concepts: Capability Map, Goal Tree, Bounded Context, Feature Registry.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Layers,
  CheckSquare,
  Terminal,
  RefreshCw,
} from 'lucide-react';
import type { BlockViewProps } from '@/types/block';
import { useProjectHubStore } from '@/stores/projectHubStore';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { HubNavigator } from '@/components/hub/HubNavigator';
import { HubDetailPanel } from '@/components/hub/HubDetailPanel';
import { ConnectedPanel } from '@/components/hub/ConnectedPanel';
import { registerBlockView } from '../BlockRegistry';

const COLLAPSED_KEY = 'sidstack-hub-connected-collapsed';

function ProjectHubBlockView({ block }: BlockViewProps) {
  const projectPath = block.cwd || process.cwd();
  const projectId = projectPath.split('/').pop() || 'default';
  const { isActive } = useWorkspaceContext();

  const contextBar = useProjectHubStore((s) => s.contextBar);
  const fetchContextBar = useProjectHubStore((s) => s.fetchContextBar);
  const fetchCapabilityTree = useProjectHubStore((s) => s.fetchCapabilityTree);
  const setProjectContext = useProjectHubStore((s) => s.setProjectContext);
  const selectedCapability = useProjectHubStore((s) => s.selectedCapability);
  const connectedEntities = useProjectHubStore((s) => s.connectedEntities);

  // Connected panel collapse state (persisted)
  const [connectedCollapsed, setConnectedCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleConnected = useCallback(() => {
    setConnectedCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  // Initialize store with project context (resets state on workspace switch)
  // isActive changes when user switches workspace tabs — all workspaces stay mounted
  // but only the active one should own the global store state.
  useEffect(() => {
    if (isActive) {
      setProjectContext(projectPath);
    }
  }, [projectPath, isActive, setProjectContext]);

  // Periodically refresh context bar
  useEffect(() => {
    const interval = setInterval(() => fetchContextBar(projectId), 30000);
    return () => clearInterval(interval);
  }, [projectId, fetchContextBar]);

  const handleRefresh = useCallback(() => {
    fetchContextBar(projectId);
    fetchCapabilityTree(projectPath);
  }, [projectId, projectPath, fetchContextBar, fetchCapabilityTree]);

  return (
    <div className="flex flex-col h-full bg-[var(--surface-0)]">
      {/* Work Context Bar (36px) */}
      <div className="flex items-center gap-3 px-3 h-9 border-b border-[var(--border-default)] bg-[var(--surface-1)] text-xs flex-shrink-0">
        <Layers size={14} className="text-[var(--text-muted)]" />
        <span className="font-medium text-[var(--text-primary)]">Project Hub</span>
        {selectedCapability ? (
          <div className="flex items-center gap-3 text-[var(--text-secondary)]">
            <span className="text-[var(--text-primary)]">{selectedCapability.name}</span>
            {connectedEntities && (
              <>
                {connectedEntities.tasks.length > 0 && (
                  <span className="flex items-center gap-1">
                    <CheckSquare size={11} />
                    {connectedEntities.tasks.length} linked tasks
                  </span>
                )}
                {connectedEntities.sessions.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Terminal size={11} />
                    {connectedEntities.sessions.length} sessions
                  </span>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 text-[var(--text-secondary)]">
            <span className="flex items-center gap-1">
              <CheckSquare size={11} />
              {contextBar.activeTasks} tasks
            </span>
            <span className="flex items-center gap-1">
              <Terminal size={11} />
              {contextBar.runningSessions} sessions
            </span>
          </div>
        )}
        <div className="flex-1" />
        <button
          onClick={handleRefresh}
          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          title="Refresh"
          aria-label="Refresh"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Main Content: 3-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* Navigator (left, w-72) */}
        <div className="w-72 flex-shrink-0">
          <HubNavigator projectPath={projectPath} />
        </div>

        {/* Detail Panel (center, flex-1) */}
        <div className="flex-1 min-w-0 border-l border-[var(--border-default)]">
          <HubDetailPanel />
        </div>

        {/* Connected Panel (right, w-64, collapsible) */}
        <ConnectedPanel
          collapsed={connectedCollapsed}
          onToggleCollapse={toggleConnected}
        />
      </div>
    </div>
  );
}

// Register as block view
registerBlockView('project-hub', ProjectHubBlockView);

export default ProjectHubBlockView;
