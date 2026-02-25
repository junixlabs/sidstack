/**
 * QuickActions - Row of action buttons for common workflows
 */

import {
  Plus,
  Bug,
  Rocket,
  Lightbulb,
  AlertTriangle,
} from 'lucide-react';
import { useBlockNavigation } from '@/hooks/useBlockNavigation';

export function QuickActions() {
  const { navigateToTaskManager, navigateToBlockView } = useBlockNavigation();

  const actions = [
    { label: 'New Feature', icon: Plus, type: 'feature', target: 'task-manager' as const },
    { label: 'Report Bug', icon: Bug, type: 'bugfix', target: 'task-manager' as const },
    { label: 'Report Incident', icon: AlertTriangle, type: 'incident', target: 'training-room' as const },
    { label: 'Plan Release', icon: Rocket, type: 'infra', target: 'task-manager' as const },
    { label: 'Start Spike', icon: Lightbulb, type: 'refactor', target: 'task-manager' as const },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.type}
            onClick={() => action.target === 'training-room' ? navigateToBlockView('training-room') : navigateToTaskManager()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border-default)] bg-[var(--surface-1)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Icon size={13} />
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
