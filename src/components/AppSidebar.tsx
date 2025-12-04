import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  GraduationCap,
  HelpCircle,
  Inbox,
  Layers,
  ListTodo,
  Settings2,
} from "lucide-react";
import { memo, useCallback, useState, useMemo, useRef } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useProjectStore } from "@/stores/projectStore";
import type { BlockViewType } from "@/types/block";

import { OnboardingProgress } from "./onboarding/OnboardingProgress";
import { WorktreesList } from "./sidebar/WorktreesList";

// =============================================================================
// Types
// =============================================================================

export interface SidebarItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  shortcut: string;
  blockType?: BlockViewType;
  separator?: boolean;
  description?: string;
}

interface AppSidebarProps {
  activeItem?: string;
  onItemClick: (item: SidebarItem) => void;
  onWorktreeClick?: (worktreePath: string, branch: string) => void;
  className?: string;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

// =============================================================================
// Sidebar Items Configuration
// =============================================================================

export const sidebarItems: SidebarItem[] = [
  {
    id: "project-hub",
    icon: <Layers className="w-5 h-5" />,
    label: "Project Hub",
    shortcut: "⌘1",
    blockType: "project-hub",
    description: "Project Intelligence Hub - capabilities, tasks, sessions, knowledge",
  },
  {
    id: "task-manager",
    icon: <ListTodo className="w-5 h-5" />,
    label: "Task Manager",
    shortcut: "⌘2",
    blockType: "task-manager",
    description: "Track development tasks and progress",
  },
  {
    id: "knowledge",
    icon: <BookOpen className="w-5 h-5" />,
    label: "Knowledge",
    shortcut: "⌘3",
    blockType: "knowledge-browser",
    description: "Browse and manage project documentation",
  },
  {
    id: "ticket-queue",
    icon: <Inbox className="w-5 h-5" />,
    label: "Ticket Queue",
    shortcut: "⌘4",
    blockType: "ticket-queue",
    description: "Import and manage external tickets/issues",
  },
  {
    id: "training-room",
    icon: <GraduationCap className="w-5 h-5" />,
    label: "Training Room",
    shortcut: "⌘5",
    blockType: "training-room",
    description: "Capture learnings from incidents and bugs",
  },
];

// Bottom sidebar items (settings, etc.)
export const bottomSidebarItems: SidebarItem[] = [
  {
    id: "settings",
    icon: <Settings2 className="w-5 h-5" />,
    label: "Project Settings",
    shortcut: "⌘,",
    blockType: "settings",
    description: "Configure project paths and preferences",
  },
];

// =============================================================================
// Sidebar Item Component
// =============================================================================

interface SidebarItemButtonProps {
  item: SidebarItem;
  isActive: boolean;
  onClick: () => void;
  expanded?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  tabIndex?: number;
  buttonRef?: React.Ref<HTMLButtonElement>;
}

const SidebarItemButton = memo(function SidebarItemButton({
  item,
  isActive,
  onClick,
  expanded = false,
  onKeyDown,
  tabIndex = 0,
  buttonRef,
}: SidebarItemButtonProps) {
  if (item.separator) {
    return (
      <div className="mx-2 my-2">
        <div className="h-px bg-[var(--border-muted)]" />
      </div>
    );
  }

  // Expanded mode: show icon + label
  if (expanded) {
    return (
      <button
        ref={buttonRef}
        onClick={onClick}
        onKeyDown={onKeyDown}
        tabIndex={tabIndex}
        className={cn(
          "relative w-full flex items-center gap-2 px-3 py-2 text-sm",
          "rounded-md transition-colors duration-150",
          isActive
            ? [
                "bg-[var(--surface-2)] text-[var(--text-primary)]",
                "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
                "before:w-[3px] before:h-5 before:bg-[var(--text-secondary)] before:rounded-r",
              ]
            : [
                "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                "hover:bg-[var(--surface-1)]",
              ]
        )}
      >
        <span className="shrink-0 w-5 h-5 flex items-center justify-center">
          {item.icon}
        </span>
        <span className="flex-1 truncate text-left">{item.label}</span>
        <kbd className="shrink-0 px-1.5 py-0.5 bg-[var(--surface-3)] rounded text-[11px] text-[var(--text-muted)] font-mono">
          {item.shortcut}
        </kbd>
      </button>
    );
  }

  // Collapsed mode: icon only with tooltip
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={buttonRef}
          onClick={onClick}
          onKeyDown={onKeyDown}
          tabIndex={tabIndex}
          className={cn(
            "relative w-10 h-10 mx-auto flex items-center justify-center",
            "rounded transition-colors duration-150",
            isActive
              ? [
                  "bg-[var(--surface-3)] text-[var(--text-primary)]",
                  "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
                  "before:w-[3px] before:h-5 before:bg-[var(--text-secondary)] before:rounded-r",
                ]
              : [
                  "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                  "hover:bg-[var(--surface-3)]",
                ]
          )}
        >
          {item.icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[200px]">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="font-medium">{item.label}</span>
            <kbd className="px-1.5 py-0.5 bg-[var(--surface-3)] rounded text-[11px] text-[var(--text-muted)] font-mono">
              {item.shortcut}
            </kbd>
          </div>
          {item.description && (
            <p className="text-[var(--text-secondary)] text-[11px]">
              {item.description}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

// =============================================================================
// Main AppSidebar Component
// =============================================================================

export const AppSidebar = memo(function AppSidebar({
  activeItem = "project-hub",
  onItemClick,
  onWorktreeClick,
  className,
  expanded: controlledExpanded,
  onToggleExpand,
}: AppSidebarProps) {
  // Use internal state if not controlled — persist to localStorage
  const [internalExpanded, setInternalExpanded] = useState(() => {
    const saved = localStorage.getItem('sidstack-sidebar-expanded');
    return saved !== null ? saved === 'true' : true;
  });
  const expanded = controlledExpanded ?? internalExpanded;
  const { projects } = useProjectStore();
  const { projectPath } = useAppStore();
  const { setShowGettingStarted } = useOnboardingStore();

  // Find project based on current projectPath
  const activeProject = useMemo(() => {
    if (!projectPath) return null;
    return projects.find((p) =>
      p.worktrees.some((w) => w.path === projectPath)
    ) || null;
  }, [projects, projectPath]);

  const handleItemClick = useCallback(
    (item: SidebarItem) => {
      if (!item.separator) {
        onItemClick(item);
      }
    },
    [onItemClick]
  );

  const handleToggle = useCallback(() => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalExpanded((prev) => {
        const next = !prev;
        localStorage.setItem('sidstack-sidebar-expanded', String(next));
        return next;
      });
    }
  }, [onToggleExpand]);

  // Keyboard navigation for sidebar items
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    const items = sidebarItems.filter(item => !item.separator);

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const nextIndex = index < items.length - 1 ? index + 1 : 0;
        setFocusedIndex(nextIndex);
        itemRefs.current[nextIndex]?.focus();
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prevIndex = index > 0 ? index - 1 : items.length - 1;
        setFocusedIndex(prevIndex);
        itemRefs.current[prevIndex]?.focus();
        break;
      }
      case "Home":
        e.preventDefault();
        setFocusedIndex(0);
        itemRefs.current[0]?.focus();
        break;
      case "End":
        e.preventDefault();
        setFocusedIndex(items.length - 1);
        itemRefs.current[items.length - 1]?.focus();
        break;
    }
  }, []);

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className={cn(
        "flex flex-col shrink-0 transition-all duration-200",
        "bg-[var(--surface-0)] border-r border-[var(--border-muted)]",
        expanded ? "w-48" : "w-12",
        className
      )}
    >
      {/* Views section */}
      <div className="flex flex-col gap-0.5 py-2 px-1">
        {expanded && (
          <div className="text-[11px] font-medium text-[var(--text-muted)] px-2 py-1 uppercase tracking-wider">
            Views
          </div>
        )}
        {sidebarItems.map((item, index) => (
          <SidebarItemButton
            key={item.id}
            item={item}
            isActive={activeItem === item.id}
            onClick={() => handleItemClick(item)}
            expanded={expanded}
            onKeyDown={(e) => handleKeyDown(e, index)}
            tabIndex={focusedIndex === -1 ? (index === 0 ? 0 : -1) : (focusedIndex === index ? 0 : -1)}
            buttonRef={(el) => { itemRefs.current[index] = el; }}
          />
        ))}
      </div>

      {/* Worktrees section */}
      {activeProject && activeProject.worktrees.length > 0 && (
        <div className="border-t border-[var(--border-muted)] pt-2 px-1">
          {expanded ? (
            <WorktreesList
              onWorktreeClick={onWorktreeClick}
              activeViewId={activeItem}
            />
          ) : (
            /* Collapsed: show branch icon with tooltip listing worktrees */
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center gap-1 py-1">
                  <div className="w-10 h-8 mx-auto flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-1)] transition-colors duration-150">
                    <GitBranch className="w-4 h-4" />
                  </div>
                  <div className="flex gap-0.5 justify-center">
                    {activeProject.worktrees.map((wt) => (
                      <span
                        key={wt.id}
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          wt.path === projectPath
                            ? "bg-[var(--accent-primary)]"
                            : "bg-[var(--text-muted)]"
                        )}
                      />
                    ))}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[200px]">
                <div className="space-y-1">
                  <span className="font-medium text-xs">Worktrees</span>
                  {activeProject.worktrees.map((wt) => (
                    <div key={wt.id} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        wt.path === projectPath ? "bg-[var(--accent-primary)]" : "bg-[var(--text-muted)]"
                      )} />
                      <span className="truncate">{wt.id}</span>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Onboarding Progress (only when not completed) */}
      <OnboardingProgress compact={!expanded} className="border-t border-[var(--border-muted)]" />

      {/* Bottom items (only render if there are items) */}
      {bottomSidebarItems.length > 0 && (
        <div className="flex flex-col gap-1 py-2 px-1 border-t border-[var(--border-muted)]">
          {bottomSidebarItems.map((item) => (
            <SidebarItemButton
              key={item.id}
              item={item}
              isActive={activeItem === item.id}
              onClick={() => handleItemClick(item)}
              expanded={expanded}
            />
          ))}
        </div>
      )}

      {/* Help button - reopen onboarding */}
      <div className="px-1 pb-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setShowGettingStarted(true)}
              aria-label="Show getting started guide"
              className={cn(
                "flex items-center justify-center rounded",
                "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
                "hover:bg-[var(--surface-1)] transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]",
                expanded ? "w-full gap-2 px-3 py-1.5 text-xs" : "w-10 h-8 mx-auto"
              )}
            >
              <HelpCircle className="w-4 h-4 shrink-0" />
              {expanded && <span>Getting Started</span>}
            </button>
          </TooltipTrigger>
          {!expanded && (
            <TooltipContent side="right">Getting Started</TooltipContent>
          )}
        </Tooltip>
      </div>

      {/* Toggle button */}
      <div className="py-2 px-1 border-t border-[var(--border-muted)]">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleToggle}
              aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
              className={cn(
                "w-full flex items-center justify-center py-2 rounded",
                "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                "hover:bg-[var(--surface-1)] transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]"
              )}
            >
              {expanded ? (
                <ChevronLeft className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {expanded ? "Collapse sidebar" : "Expand sidebar"}
          </TooltipContent>
        </Tooltip>
      </div>
    </nav>
  );
});

// =============================================================================
// Helper to get all sidebar items (for keyboard shortcuts)
// =============================================================================

export const getAllSidebarItems = () => [...sidebarItems, ...bottomSidebarItems];
