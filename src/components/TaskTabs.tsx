import { ClipboardCheck, FileText, GitCompare, Plus, X, Pin } from "lucide-react";
import React, { useState, useRef, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import type { Tab } from "@/types";

import { NewTaskDialog } from "./NewTaskDialog";
import { TabContextMenu } from "./TabContextMenu";

// =============================================================================
// HELPER: Get display info for tabs with disambiguation
// =============================================================================
function getTabDisplayInfo(tabs: Tab[]): Map<string, { title: string; subtitle?: string }> {
  const displayMap = new Map<string, { title: string; subtitle?: string }>();

  // Helper to get file path as string
  const getFilePath = (tab: Tab): string | null => {
    if (tab.type === "file" && typeof tab.data === "string") {
      return tab.data;
    }
    return null;
  };

  // Group file tabs by filename
  const fileNameGroups = new Map<string, Tab[]>();

  for (const tab of tabs) {
    const filePath = getFilePath(tab);
    if (filePath) {
      const fileName = tab.title;
      if (!fileNameGroups.has(fileName)) {
        fileNameGroups.set(fileName, []);
      }
      fileNameGroups.get(fileName)!.push(tab);
    }
  }

  // Process each tab
  for (const tab of tabs) {
    const filePath = getFilePath(tab);
    if (filePath) {
      const fileName = tab.title;
      const sameNameTabs = fileNameGroups.get(fileName) || [];

      // If multiple files have same name, show parent folder
      if (sameNameTabs.length > 1) {
        const pathParts = filePath.split("/");
        const parentFolder = pathParts.length > 1 ? pathParts[pathParts.length - 2] : "";
        displayMap.set(tab.id, {
          title: fileName,
          subtitle: parentFolder || undefined,
        });
      } else {
        displayMap.set(tab.id, { title: fileName });
      }
    } else {
      displayMap.set(tab.id, { title: tab.title });
    }
  }

  return displayMap;
}

// =============================================================================
// LAYOUT CONSTANTS
// =============================================================================
const TABS_HEIGHT = 36; // px - matches App.tsx LAYOUT.TABS_HEIGHT

interface TaskTabsProps {
  className?: string;
}

export function TaskTabs({ className }: TaskTabsProps) {
  const { tabs, activeTabId, setActiveTab, removeTab, reorderTabs, theme } = useAppStore();
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);
  const isDark = theme === "dark";

  // Compute display info for tabs (disambiguate same filenames)
  const tabDisplayInfo = useMemo(() => getTabDisplayInfo(tabs), [tabs]);

  const handleClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    removeTab(tabId);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    setTimeout(() => {
      if (dragNodeRef.current) {
        dragNodeRef.current.style.opacity = "0.5";
      }
    }, 0);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = "1";
    }
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedIndex !== null && index !== draggedIndex) {
      setDropTargetIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDropTargetIndex(null);
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = draggedIndex;
    if (fromIndex !== null && fromIndex !== toIndex) {
      reorderTabs(fromIndex, toIndex);
    }
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  return (
    <>
      <div
        style={{ height: TABS_HEIGHT }}
        className={cn(
          "flex items-center border-b",
          isDark
            ? "bg-[var(--surface-1)] border-[var(--border-muted)]"
            : "bg-gray-50 border-gray-200",
          className
        )}
      >
        {/* Tab list - scrollable */}
        <div className="flex-1 flex items-center overflow-x-auto h-full">
          {tabs.length === 0 ? (
            <div className={cn(
              "px-4 text-[12px] flex items-center gap-2",
              isDark ? "text-[var(--text-muted)]" : "text-gray-400"
            )}>
              <FileText className="w-3.5 h-3.5" />
              No open tabs
            </div>
          ) : (
            tabs.map((tab, index) => {
              const displayInfo = tabDisplayInfo.get(tab.id) || { title: tab.title };
              return (
                <ContextMenu key={tab.id}>
                  <ContextMenuTrigger asChild>
                    <TabItem
                      tab={tab}
                      index={index}
                      displayTitle={displayInfo.title}
                      displaySubtitle={displayInfo.subtitle}
                      isActive={tab.id === activeTabId}
                      isDragging={draggedIndex === index}
                      isDropTarget={dropTargetIndex === index}
                      isDark={isDark}
                      onClick={() => setActiveTab(tab.id)}
                      onClose={(e) => handleClose(e, tab.id)}
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                      ref={draggedIndex === index ? dragNodeRef : null}
                    />
                  </ContextMenuTrigger>
                  <TabContextMenu tab={tab} tabIndex={index} />
                </ContextMenu>
              );
            })
          )}
        </div>

        {/* New task button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowNewTaskDialog(true)}
          className={cn(
            "h-full rounded-none border-l px-3 gap-1.5",
            isDark
              ? "border-[var(--border-muted)] hover:bg-[var(--surface-2)]"
              : "border-gray-200 hover:bg-gray-100"
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium">New Task</span>
        </Button>
      </div>

      <NewTaskDialog
        isOpen={showNewTaskDialog}
        onClose={() => setShowNewTaskDialog(false)}
      />
    </>
  );
}

// =============================================================================
// TAB ITEM SUB-COMPONENT
// =============================================================================

interface TabItemProps extends React.HTMLAttributes<HTMLDivElement> {
  tab: Tab;
  index: number;
  displayTitle: string;
  displaySubtitle?: string;
  isActive: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  isDark: boolean;
  onClose: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

const TabItem = React.forwardRef<HTMLDivElement, TabItemProps>(
  function TabItem(
    {
      tab,
      displayTitle,
      displaySubtitle,
      isActive,
      isDragging,
      isDropTarget,
      isDark,
      onClick,
      onClose,
      onDragStart,
      onDragEnd,
      onDragOver,
      onDragLeave,
      onDrop,
      ...props // Spread remaining props (including onContextMenu from Radix)
    },
    ref
  ) {
    const getIcon = () => {
      const iconClass = "w-3.5 h-3.5 shrink-0";
      switch (tab.type) {
        case "task": return <ClipboardCheck className={iconClass} />;
        case "file": return <FileText className={iconClass} />;
        case "diff": return <GitCompare className={iconClass} />;
        default: return <FileText className={iconClass} />;
      }
    };

    const isPinned = tab.pinned;

    return (
      <div
        ref={ref}
        draggable
        onClick={onClick}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        title={typeof tab.data === "string" ? tab.data : tab.title}
        {...props} // Pass through Radix props (onContextMenu, etc.)
        className={cn(
          "group relative h-full flex items-center cursor-pointer shrink-0",
          "transition-colors duration-100",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
          // Pinned tabs are more compact
          isPinned ? "gap-1 px-2" : "gap-1.5 px-3",
          // Background + text colors
          isActive
            ? isDark
              ? "bg-[var(--surface-0)] text-[var(--text-primary)]"
              : "bg-white text-gray-800"
            : isDark
              ? "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)]"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
          isDragging && "opacity-50",
          isDropTarget && "border-l-2 border-l-[var(--border-default)]",
          // Pinned tabs have a subtle left border
          isPinned && (isDark ? "border-r border-[var(--border-muted)]" : "border-r border-gray-200")
        )}
      >
        {/* VS Code style: Active indicator (bottom border) */}
        {isActive && (
          <div className={cn(
            "absolute bottom-0 left-0 right-0 h-[2px]",
            isDark ? "bg-[var(--surface-3)]" : "bg-blue-600"
          )} />
        )}

        {/* Icon */}
        <span className={cn(
          isActive
            ? isDark ? "text-[var(--text-secondary)]" : "text-blue-600"
            : isDark ? "text-[var(--text-muted)]" : "text-gray-400"
        )}>
          {getIcon()}
        </span>

        {/* Title + Subtitle (hidden for pinned tabs) */}
        {!isPinned && (
          <div className="flex items-center gap-1.5 min-w-0 max-w-[180px]">
            <span className={cn(
              "text-[12px] truncate select-none",
              isActive ? "font-medium" : "font-normal"
            )}>
              {displayTitle}
            </span>
            {displaySubtitle && (
              <span className={cn(
                "text-[11px] truncate select-none",
                isDark ? "text-[var(--text-muted)]" : "text-gray-400"
              )}>
                {displaySubtitle}
              </span>
            )}
          </div>
        )}

        {/* Pin indicator for pinned tabs */}
        {isPinned && (
          <Pin className={cn(
            "w-2 h-2 shrink-0",
            isDark ? "text-[var(--text-muted)]" : "text-gray-400"
          )} />
        )}

        {/* Close button (hidden for pinned tabs, only visible on hover) */}
        {!isPinned && (
          <button
            onClick={onClose}
            className={cn(
              "p-0.5 rounded shrink-0",
              // Show on hover OR when active
              isActive ? "opacity-60" : "opacity-0 group-hover:opacity-100",
              "transition-opacity",
              "focus:outline-none focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-[var(--border-default)]",
              isDark
                ? "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]"
                : "text-gray-400 hover:text-gray-700 hover:bg-gray-200"
            )}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }
);
