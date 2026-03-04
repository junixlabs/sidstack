/**
 * Project Intelligence Hub Block View
 *
 * PM-focused dashboard replacing the old 3-panel layout.
 * Shows work pipeline, quick actions, governance status, and more.
 */

import { useEffect } from 'react';
import {
  Layers,
  CheckSquare,
  Terminal,
} from 'lucide-react';
import type { BlockViewProps } from '@/types/block';
import { useProjectHubStore } from '@/stores/projectHubStore';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { ProjectDashboard } from '@/components/hub/ProjectDashboard';
import { registerBlockView } from '../BlockRegistry';

function ProjectHubBlockView({ block }: BlockViewProps) {
  const projectPath = block.cwd || process.cwd();
  const { isActive, isWorkspaceReady, sidstackProjectId } = useWorkspaceContext();
  const fallbackId = projectPath.split('/').pop() || 'default';
  const projectId = sidstackProjectId || fallbackId;

  const contextBar = useProjectHubStore((s) => s.contextBar);
  const fetchContextBar = useProjectHubStore((s) => s.fetchContextBar);
  const setProjectContext = useProjectHubStore((s) => s.setProjectContext);

  // Initialize store with project context (wait for workspace to resolve correct projectId)
  useEffect(() => {
    if (isActive && isWorkspaceReady) {
      setProjectContext(projectPath, projectId);
    }
  }, [projectPath, projectId, isActive, isWorkspaceReady, setProjectContext]);

  const fetchCapabilityTree = useProjectHubStore((s) => s.fetchCapabilityTree);

  // Auto-refresh: context bar + capability tree (pauses when workspace is inactive)
  useAutoRefresh({
    onRefresh: () => {
      fetchContextBar(projectId);
      fetchCapabilityTree(projectPath);
    },
    enabled: isActive && isWorkspaceReady,
  });

  return (
    <div className="flex flex-col h-full bg-[var(--surface-0)]">
      {/* Work Context Bar */}
      <div className="flex items-center gap-3 px-3 h-9 border-b border-[var(--border-default)] bg-[var(--surface-1)] text-xs flex-shrink-0">
        <Layers size={14} className="text-[var(--text-muted)]" />
        <span className="font-medium text-[var(--text-primary)]">Project Hub</span>
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
        <div className="flex-1" />
      </div>

      {/* Dashboard */}
      <div className="flex-1 overflow-y-auto">
        <ProjectDashboard projectPath={projectPath} projectId={projectId} />
      </div>
    </div>
  );
}

// Register as block view
registerBlockView('project-hub', ProjectHubBlockView);

export default ProjectHubBlockView;
