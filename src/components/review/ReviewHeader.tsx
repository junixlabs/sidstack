import clsx from "clsx";
import {
  ChevronLeft,
  ChevronRight,
  Columns2,
  Rows2,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useCallback, useMemo } from "react";

import { useReviewStore, selectSelectedFile } from "@/stores/reviewStore";

interface ReviewHeaderProps {
  stats: {
    files: number;
    additions: number;
    deletions: number;
  };
  className?: string;
}

/**
 * Toolbar button component
 */
function ToolbarButton({
  icon,
  label,
  shortcut,
  onClick,
  disabled = false,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  const tooltipText = shortcut ? `${label} (${shortcut})` : label;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={tooltipText}
      className={clsx(
        "inline-flex items-center justify-center",
        "w-7 h-7 rounded",
        "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
        "hover:bg-[var(--surface-2)]",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-active)]",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent",
        "transition-colors duration-100",
        active && "bg-[var(--surface-2)] text-[var(--text-primary)]"
      )}
    >
      {icon}
    </button>
  );
}

/**
 * Breadcrumb for file path
 */
function FileBreadcrumb({ filePath }: { filePath: string }) {
  const parts = filePath.split("/");
  const fileName = parts.pop() || "";
  const dirPath = parts.join("/");

  return (
    <div className="flex items-center gap-1 text-sm min-w-0">
      {dirPath && (
        <>
          <span className="text-[var(--text-muted)] truncate max-w-[200px]">{dirPath}/</span>
        </>
      )}
      <span className="text-[var(--text-primary)] font-medium truncate">{fileName}</span>
    </div>
  );
}

/**
 * Header component with navigation and controls
 */
export function ReviewHeader({ stats, className = "" }: ReviewHeaderProps) {
  const {
    viewMode,
    sidebarCollapsed,
    currentHunkIndex,
    totalHunks,
    toggleViewMode,
    toggleSidebar,
    nextFile,
    prevFile,
    nextHunk,
    prevHunk,
  } = useReviewStore();

  const selectedFile = useReviewStore(useCallback((state) => selectSelectedFile(state), []));

  // Hunk indicator text
  const hunkIndicator = useMemo(() => {
    if (totalHunks === 0) return null;
    return `${currentHunkIndex + 1} of ${totalHunks}`;
  }, [currentHunkIndex, totalHunks]);

  return (
    <div
      className={clsx(
        "flex items-center gap-4 px-3 py-2",
        "bg-[var(--surface-2)] border-b border-[var(--border-default)]",
        className
      )}
    >
      {/* Sidebar toggle */}
      <ToolbarButton
        icon={
          sidebarCollapsed ? (
            <PanelLeft className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )
        }
        label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
        shortcut="b"
        onClick={toggleSidebar}
      />

      {/* File breadcrumb */}
      <div className="flex-1 min-w-0">
        {selectedFile ? (
          <FileBreadcrumb filePath={selectedFile.path} />
        ) : (
          <span className="text-[var(--text-muted)] text-sm">No file selected</span>
        )}
      </div>

      {/* File stats */}
      {selectedFile && (
        <div className="flex items-center gap-2 text-xs shrink-0">
          <span className="text-[var(--text-secondary)]">+{selectedFile.additions}</span>
          <span className="text-[var(--text-secondary)]">-{selectedFile.deletions}</span>
        </div>
      )}

      {/* Divider */}
      <div className="w-px h-4 bg-[var(--border-default)]" />

      {/* Hunk navigation */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          icon={<ChevronLeft className="w-4 h-4" />}
          label="Previous hunk"
          shortcut="k"
          onClick={prevHunk}
          disabled={totalHunks === 0}
        />
        {hunkIndicator && (
          <span className="text-xs text-[var(--text-muted)] min-w-[50px] text-center">
            {hunkIndicator}
          </span>
        )}
        <ToolbarButton
          icon={<ChevronRight className="w-4 h-4" />}
          label="Next hunk"
          shortcut="j"
          onClick={nextHunk}
          disabled={totalHunks === 0}
        />
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-[var(--border-default)]" />

      {/* File navigation */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          icon={<ChevronLeft className="w-4 h-4" />}
          label="Previous file"
          shortcut="["
          onClick={prevFile}
          disabled={stats.files <= 1}
        />
        <span className="text-xs text-[var(--text-muted)]">{stats.files} files</span>
        <ToolbarButton
          icon={<ChevronRight className="w-4 h-4" />}
          label="Next file"
          shortcut="]"
          onClick={nextFile}
          disabled={stats.files <= 1}
        />
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-[var(--border-default)]" />

      {/* View mode toggle */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          icon={<Columns2 className="w-4 h-4" />}
          label="Split view"
          shortcut="s"
          onClick={toggleViewMode}
          active={viewMode === "split"}
        />
        <ToolbarButton
          icon={<Rows2 className="w-4 h-4" />}
          label="Unified view"
          shortcut="s"
          onClick={toggleViewMode}
          active={viewMode === "unified"}
        />
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-[var(--border-default)]" />

      {/* Total stats */}
      <div className="flex items-center gap-2 text-xs shrink-0">
        <span className="text-[var(--text-secondary)]">+{stats.additions}</span>
        <span className="text-[var(--text-secondary)]">-{stats.deletions}</span>
      </div>
    </div>
  );
}

export default ReviewHeader;
