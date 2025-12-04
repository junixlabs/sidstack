/**
 * ViewSwitcher Component
 *
 * Allows switching between different task view modes:
 * - List: Flat list of tasks
 * - Tree: Hierarchical tree view
 * - Kanban: Board with status columns
 * - Timeline: Roadmap/milestone view
 */

import { List, GitBranch, Columns3, CalendarRange } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ViewMode } from "@/stores/taskStore";

interface ViewSwitcherProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  className?: string;
}

const VIEW_CONFIG: Record<ViewMode, { icon: React.ReactNode; label: string; shortcut: string }> = {
  list: {
    icon: <List className="w-4 h-4" />,
    label: "List",
    shortcut: "1",
  },
  tree: {
    icon: <GitBranch className="w-4 h-4" />,
    label: "Tree",
    shortcut: "2",
  },
  kanban: {
    icon: <Columns3 className="w-4 h-4" />,
    label: "Kanban",
    shortcut: "3",
  },
  timeline: {
    icon: <CalendarRange className="w-4 h-4" />,
    label: "Timeline",
    shortcut: "4",
  },
};

export function ViewSwitcher({ currentView, onViewChange, className }: ViewSwitcherProps) {
  return (
    <div className={cn("flex items-center gap-1 p-1 bg-[var(--surface-1)] rounded-lg", className)}>
      {(Object.keys(VIEW_CONFIG) as ViewMode[]).map((mode) => {
        const config = VIEW_CONFIG[mode];
        const isActive = currentView === mode;

        return (
          <button
            key={mode}
            onClick={() => onViewChange(mode)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
              isActive
                ? "bg-[var(--surface-3)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
            )}
            title={`${config.label} view (${config.shortcut})`}
          >
            {config.icon}
            <span className="hidden sm:inline">{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}
