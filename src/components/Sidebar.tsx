import { ChevronRight, FolderOpen } from "lucide-react";
import { useState, useEffect } from "react";

import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import { useNotificationStore } from "@/stores/notificationStore";

import { FileTree } from "./FileTree";
import { WorkspaceSelector } from "./WorkspaceSelector";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const {
    projectPath,
    activeWorkspace,
    sidebarOpen,
    theme,
    workspaces,
  } = useAppStore();
  const startPolling = useNotificationStore((state) => state.startPolling);
  const stopPolling = useNotificationStore((state) => state.stopPolling);

  const [expandedSections, setExpandedSections] = useState({
    explorer: true,
    workspaces: true,
  });

  // Start polling for notifications when mounted
  useEffect(() => {
    startPolling(30000);
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  // When sidebar is closed, render nothing
  if (!sidebarOpen) {
    return null;
  }

  const currentPath = activeWorkspace?.worktree_path || projectPath;
  const isDark = theme === "dark";
  const hasWorkspaces = workspaces.length > 0 || activeWorkspace !== null;

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <aside
      className={cn(
        "h-full w-full flex flex-col overflow-hidden",
        isDark ? "bg-[var(--surface-1)]" : "bg-gray-50",
        className
      )}
    >
      {/* Scrollable content area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Explorer Section - File tree */}
        <ExplorerSection
          isDark={isDark}
          isExpanded={expandedSections.explorer}
          onToggle={() => toggleSection("explorer")}
          currentPath={currentPath}
          projectPath={projectPath}
        />

        {/* Workspaces Section - Conditional */}
        {hasWorkspaces && projectPath && (
          <WorkspacesSection
            isDark={isDark}
            isExpanded={expandedSections.workspaces}
            onToggle={() => toggleSection("workspaces")}
          />
        )}
      </div>
    </aside>
  );
}

// =============================================================================
// EXPLORER SECTION
// =============================================================================

interface ExplorerSectionProps {
  isDark: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  currentPath: string | null;
  projectPath: string | null;
}

function ExplorerSection({
  isDark,
  isExpanded,
  onToggle,
  currentPath,
  projectPath: _projectPath,
}: ExplorerSectionProps) {
  return (
    <section className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Section header */}
      <button
        onClick={onToggle}
        className={cn(
          "flex-none flex items-center gap-2 w-full text-left px-3 py-2 border-b",
          "transition-colors duration-100",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
          isDark ? "border-[var(--surface-2)] hover:bg-[var(--surface-2)]" : "border-gray-200 hover:bg-gray-100"
        )}
        aria-expanded={isExpanded}
      >
        <ChevronRight
          className={cn(
            "w-3 h-3 transition-transform duration-150",
            isExpanded && "rotate-90",
            isDark ? "text-[var(--text-muted)]" : "text-gray-400"
          )}
        />
        <span
          className={cn(
            "text-[11px] font-semibold uppercase tracking-wider",
            isDark ? "text-[var(--text-muted)]" : "text-gray-500"
          )}
        >
          Explorer
        </span>
      </button>

      {/* File tree */}
      {isExpanded && (
        <div className="flex-1 overflow-auto">
          {currentPath ? (
            <FileTree rootPath={currentPath} className="h-full" />
          ) : (
            <div
              className={cn(
                "px-4 py-6 text-center text-[11px]",
                isDark ? "text-[var(--text-muted)]" : "text-gray-400"
              )}
            >
              <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Open a project to browse files</p>
              <p className="mt-1 text-[11px] font-mono">⌘O</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// =============================================================================
// WORKSPACES SECTION
// =============================================================================

interface WorkspacesSectionProps {
  isDark: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

function WorkspacesSection({ isDark, isExpanded, onToggle }: WorkspacesSectionProps) {
  return (
    <section
      className={cn("flex-none border-t", isDark ? "border-[var(--surface-2)]" : "border-gray-200")}
    >
      {/* Section header */}
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center gap-2 w-full text-left px-3 py-2",
          "transition-colors duration-100",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
          isDark ? "hover:bg-[var(--surface-2)]" : "hover:bg-gray-100"
        )}
        aria-expanded={isExpanded}
      >
        <ChevronRight
          className={cn(
            "w-3 h-3 transition-transform duration-150",
            isExpanded && "rotate-90",
            isDark ? "text-[var(--text-muted)]" : "text-gray-400"
          )}
        />
        <span
          className={cn(
            "text-[11px] font-semibold uppercase tracking-wider",
            isDark ? "text-[var(--text-muted)]" : "text-gray-500"
          )}
        >
          Workspaces
        </span>
      </button>

      {/* Workspace selector */}
      {isExpanded && (
        <div
          className={cn(
            "px-2 pb-2",
            isDark ? "bg-[var(--surface-0)]/30" : "bg-gray-50/50"
          )}
        >
          <WorkspaceSelector />
        </div>
      )}
    </section>
  );
}

