/**
 * WorkflowGrid - Grid of workflow type cards
 */

import {
  Sparkles,
  Flame,
  Bug,
  Rocket,
  Wrench,
  Lightbulb,
} from 'lucide-react';

interface WorkflowCardData {
  name: string;
  icon: typeof Sparkles;
  taskType: string;
  description: string;
  count: number;
}

interface WorkflowGridProps {
  taskCounts: Record<string, number>;
}

const WORKFLOWS: Omit<WorkflowCardData, 'count'>[] = [
  { name: 'Feature', icon: Sparkles, taskType: 'feature', description: 'New capabilities' },
  { name: 'Hotfix', icon: Flame, taskType: 'hotfix', description: 'Urgent fixes' },
  { name: 'Bugfix', icon: Bug, taskType: 'bugfix', description: 'Bug corrections' },
  { name: 'Release', icon: Rocket, taskType: 'infra', description: 'Release prep' },
  { name: 'Tech Debt', icon: Wrench, taskType: 'debt', description: 'Code improvements' },
  { name: 'Spike', icon: Lightbulb, taskType: 'refactor', description: 'Research & explore' },
];

export function WorkflowGrid({ taskCounts }: WorkflowGridProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {WORKFLOWS.map((wf) => {
        const Icon = wf.icon;
        const count = taskCounts[wf.taskType] || 0;
        return (
          <div
            key={wf.taskType}
            className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-muted)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <Icon size={16} className="text-[var(--text-muted)] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[var(--text-primary)]">{wf.name}</span>
                {count > 0 && (
                  <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded bg-[var(--surface-3)] text-[var(--text-secondary)]">
                    {count}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">{wf.description}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
