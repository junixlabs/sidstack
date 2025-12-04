import {
  Copy,
  ExternalLink,
  History,
  FileCode,
  MoreHorizontal,
  Terminal,
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";

import { cn } from "@/lib/utils";
import type { Task } from "@/stores/taskStore";

interface TaskContextMenuProps {
  task: Task;
  position: { x: number; y: number };
  onClose: () => void;
  onViewProgressHistory?: (taskId: string) => void;
  onLaunchSession?: (taskId: string) => void;
}

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  divider?: boolean;
}

export function TaskContextMenu({
  task,
  position,
  onClose,
  onViewProgressHistory,
  onLaunchSession,
}: TaskContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    onClose();
  }, [onClose]);

  const menuItems: MenuItem[] = [
    {
      label: "Copy Task ID",
      icon: <Copy className="w-3.5 h-3.5" />,
      onClick: () => copyToClipboard(task.id),
    },
    {
      label: "Copy Title",
      icon: <FileCode className="w-3.5 h-3.5" />,
      onClick: () => copyToClipboard(task.title),
    },
    {
      label: "",
      icon: null,
      onClick: () => {},
      divider: true,
    },
    {
      label: "View Progress History",
      icon: <History className="w-3.5 h-3.5" />,
      onClick: () => {
        onViewProgressHistory?.(task.id);
        onClose();
      },
    },
    {
      label: "",
      icon: null,
      onClick: () => {},
      divider: true,
    },
    {
      label: "Launch Claude Session",
      icon: <Terminal className="w-3.5 h-3.5" />,
      onClick: () => {
        onLaunchSession?.(task.id);
        onClose();
      },
      disabled: !onLaunchSession,
    },
    {
      label: "Open in Terminal",
      icon: <ExternalLink className="w-3.5 h-3.5" />,
      onClick: () => {
        copyToClipboard(`sidstack task get ${task.id}`);
        onClose();
      },
    },
  ];

  // Actionable items only (skip dividers)
  const actionableItems = menuItems.filter((item) => !item.divider);

  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let { x, y } = position;

      if (x + rect.width > viewportWidth) {
        x = viewportWidth - rect.width - 8;
      }

      if (y + rect.height > viewportHeight) {
        y = viewportHeight - rect.height - 8;
      }

      setAdjustedPosition({ x, y });
    }
  }, [position]);

  // Auto-focus first item on mount
  useEffect(() => {
    const firstButton = menuRef.current?.querySelector<HTMLButtonElement>(
      '[role="menuitem"]:not([aria-disabled="true"])'
    );
    firstButton?.focus();
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "ArrowDown": {
          e.preventDefault();
          const nextIndex = (focusedIndex + 1) % actionableItems.length;
          setFocusedIndex(nextIndex);
          const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
          buttons?.[nextIndex]?.focus();
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prevIndex = (focusedIndex - 1 + actionableItems.length) % actionableItems.length;
          setFocusedIndex(prevIndex);
          const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
          buttons?.[prevIndex]?.focus();
          break;
        }
        case "Tab":
          // Trap focus within menu
          e.preventDefault();
          break;
        case "Home": {
          e.preventDefault();
          setFocusedIndex(0);
          const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
          buttons?.[0]?.focus();
          break;
        }
        case "End": {
          e.preventDefault();
          const lastIdx = actionableItems.length - 1;
          setFocusedIndex(lastIdx);
          const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
          buttons?.[lastIdx]?.focus();
          break;
        }
      }
    },
    [focusedIndex, actionableItems.length, onClose]
  );

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`${task.taskType || "Task"} actions`}
      onKeyDown={handleKeyDown}
      className="fixed z-50 min-w-[180px] bg-[var(--surface-2)] border border-[var(--border-muted)] rounded-lg shadow-lg py-1 animate-in fade-in-0 zoom-in-95"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {/* Header with task type */}
      <div className="px-3 py-1.5 text-[10px] uppercase text-[var(--text-muted)] border-b border-[var(--border-muted)]">
        {task.taskType || "Task"} Actions
      </div>

      {/* Menu items */}
      <div className="py-1">
        {menuItems.map((item, index) => {
          if (item.divider) {
            return (
              <div
                key={index}
                role="separator"
                className="h-px bg-[var(--border-muted)] my-1"
              />
            );
          }

          return (
            <button
              key={index}
              role="menuitem"
              onClick={item.disabled ? undefined : item.onClick}
              aria-disabled={item.disabled || undefined}
              tabIndex={-1}
              className={cn(
                "w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 transition-colors",
                "focus-visible:outline-none focus:bg-[var(--surface-3)]",
                item.disabled
                  ? "text-[var(--text-muted)] cursor-not-allowed opacity-50"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Hook to manage context menu state
 */
export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState<{
    task: Task;
    position: { x: number; y: number };
  } | null>(null);

  const openContextMenu = (task: Task, event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({
      task,
      position: { x: event.clientX, y: event.clientY },
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  return {
    contextMenu,
    openContextMenu,
    closeContextMenu,
  };
}

/**
 * Simple context menu trigger button
 */
export function ContextMenuTrigger({
  task,
  onOpenMenu,
}: {
  task: Task;
  onOpenMenu: (task: Task, event: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onOpenMenu(task, e);
      }}
      className="w-5 h-5 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]"
      title="More actions"
      aria-label="More actions"
      aria-haspopup="menu"
    >
      <MoreHorizontal className="w-3.5 h-3.5" />
    </button>
  );
}
