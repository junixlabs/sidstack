import clsx from "clsx";
import { useEffect, useState, useRef, useCallback } from "react";

import { useGit } from "@/hooks/useGit";
import { useAppStore } from "@/stores/appStore";
import type { FileDiff, DiffHunk } from "@/types";

import { DiffViewerSkeleton } from "./Skeleton";

interface DiffViewerProps {
  workspacePath: string;
  filePath?: string;
  baseBranch?: string;
  className?: string;
}

export function DiffViewer({
  workspacePath,
  filePath,
  baseBranch,
  className,
}: DiffViewerProps) {
  const { getFileDiff, getDiff, loading, error } = useGit();
  const { diffViewMode, setDiffViewMode, currentDiff, setCurrentDiff } = useAppStore();
  const [selectedFile, setSelectedFile] = useState<FileDiff | null>(null);

  useEffect(() => {
    if (workspacePath) {
      if (filePath) {
        getFileDiff(workspacePath, filePath, baseBranch)
          .then((diff) => setSelectedFile(diff))
          .catch(console.error);
      } else {
        getDiff(workspacePath, baseBranch)
          .then(setCurrentDiff)
          .catch(console.error);
      }
    }
  }, [workspacePath, filePath, baseBranch, getFileDiff, getDiff, setCurrentDiff]);

  if (loading) {
    return (
      <div className={clsx("h-full", className)}>
        <DiffViewerSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={clsx("flex items-center justify-center h-full", className)}>
        <div className="text-[var(--text-secondary)]">{error}</div>
      </div>
    );
  }

  // Show file list if no specific file selected
  if (!filePath && currentDiff) {
    return (
      <div className={clsx("h-full flex flex-col", className)}>
        <DiffFileList
          files={currentDiff}
          onSelectFile={(path) => setSelectedFile(currentDiff.find((f) => f.path === path) || null)}
        />
        {selectedFile && (
          <div className="flex-1 overflow-auto">
            <DiffContent
              diff={selectedFile}
              viewMode={diffViewMode}
              onViewModeChange={setDiffViewMode}
            />
          </div>
        )}
      </div>
    );
  }

  if (!selectedFile) {
    return (
      <div className={clsx("flex items-center justify-center h-full", className)}>
        <div className="text-zinc-500">No changes to display</div>
      </div>
    );
  }

  return (
    <div className={clsx("h-full overflow-auto", className)}>
      <DiffContent
        diff={selectedFile}
        viewMode={diffViewMode}
        onViewModeChange={setDiffViewMode}
      />
    </div>
  );
}

interface DiffFileListProps {
  files: FileDiff[];
  onSelectFile: (path: string) => void;
}

function DiffFileList({ files, onSelectFile }: DiffFileListProps) {
  return (
    <div className="border-b border-[var(--border-muted)] p-2 max-h-48 overflow-auto">
      <div className="text-sm text-[var(--text-muted)] mb-2">
        {files.length} files changed
      </div>
      <div className="space-y-1">
        {files.map((file) => (
          <div
            key={file.path}
            onClick={() => onSelectFile(file.path)}
            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[var(--surface-2)] cursor-pointer"
          >
            <StatusBadge status={file.status} />
            <span className="text-sm text-[var(--text-secondary)] truncate flex-1">
              {file.path}
            </span>
            <span className="text-xs">
              <span className="text-[var(--text-secondary)]">+{file.additions}</span>
              {" "}
              <span className="text-[var(--text-secondary)]">-{file.deletions}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const colors: Record<string, string> = {
    added: "bg-[var(--surface-2)] text-[var(--text-secondary)]",
    modified: "bg-[var(--surface-2)] text-[var(--text-secondary)]",
    deleted: "bg-[var(--surface-2)] text-[var(--text-secondary)]",
    renamed: "bg-[var(--surface-2)] text-[var(--text-secondary)]",
  };

  const labels: Record<string, string> = {
    added: "A",
    modified: "M",
    deleted: "D",
    renamed: "R",
  };

  return (
    <span
      className={clsx(
        "w-5 h-5 flex items-center justify-center rounded text-xs font-mono",
        colors[status] || "bg-[var(--surface-3)] text-[var(--text-muted)]"
      )}
    >
      {labels[status] || "?"}
    </span>
  );
}

interface DiffContentProps {
  diff: FileDiff;
  viewMode: "side-by-side" | "unified";
  onViewModeChange: (mode: "side-by-side" | "unified") => void;
}

function DiffContent({ diff, viewMode, onViewModeChange }: DiffContentProps) {
  const [currentHunkIndex, setCurrentHunkIndex] = useState(0);
  const hunkRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToHunk = useCallback((index: number) => {
    if (index >= 0 && index < diff.hunks.length) {
      setCurrentHunkIndex(index);
      hunkRefs.current[index]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [diff.hunks.length]);

  const goToPrevHunk = useCallback(() => {
    scrollToHunk(Math.max(0, currentHunkIndex - 1));
  }, [currentHunkIndex, scrollToHunk]);

  const goToNextHunk = useCallback(() => {
    scrollToHunk(Math.min(diff.hunks.length - 1, currentHunkIndex + 1));
  }, [currentHunkIndex, diff.hunks.length, scrollToHunk]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        goToNextHunk();
      }
      if (e.key === "p" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        goToPrevHunk();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNextHunk, goToPrevHunk]);

  return (
    <div ref={containerRef}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--surface-2)] border-b border-[var(--border-muted)] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusBadge status={diff.status} />
          <span className="text-sm text-[var(--text-secondary)]">{diff.path}</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Hunk navigation */}
          {diff.hunks.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={goToPrevHunk}
                disabled={currentHunkIndex === 0}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] disabled:opacity-30 disabled:cursor-not-allowed"
                title="Previous hunk (p)"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708l-3 3a.5.5 0 01-.708 0l-3-3a.5.5 0 010-.708z" transform="rotate(180 8 8)"/>
                </svg>
              </button>
              <span className="text-xs text-[var(--text-muted)] min-w-[3rem] text-center">
                {currentHunkIndex + 1}/{diff.hunks.length}
              </span>
              <button
                onClick={goToNextHunk}
                disabled={currentHunkIndex === diff.hunks.length - 1}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next hunk (n)"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708l-3 3a.5.5 0 01-.708 0l-3-3a.5.5 0 010-.708z"/>
                </svg>
              </button>
            </div>
          )}
          <span className="text-xs">
            <span className="text-[var(--text-secondary)]">+{diff.additions}</span>
            {" "}
            <span className="text-[var(--text-secondary)]">-{diff.deletions}</span>
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => onViewModeChange("side-by-side")}
              className={clsx(
                "px-2 py-1 text-xs rounded",
                viewMode === "side-by-side"
                  ? "bg-[var(--surface-3)] text-[var(--text-primary)]"
                  : "bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
              )}
            >
              Side-by-side
            </button>
            <button
              onClick={() => onViewModeChange("unified")}
              className={clsx(
                "px-2 py-1 text-xs rounded",
                viewMode === "unified"
                  ? "bg-[var(--surface-3)] text-[var(--text-primary)]"
                  : "bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
              )}
            >
              Unified
            </button>
          </div>
        </div>
      </div>

      {/* Hunks */}
      <div className="p-4">
        {diff.hunks.map((hunk, index) => (
          <div
            key={index}
            ref={(el) => { hunkRefs.current[index] = el; }}
          >
            <HunkView
              hunk={hunk}
              viewMode={viewMode}
              isActive={index === currentHunkIndex}
              onClick={() => setCurrentHunkIndex(index)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface HunkViewProps {
  hunk: DiffHunk;
  viewMode: "side-by-side" | "unified";
  isActive?: boolean;
  onClick?: () => void;
}

function HunkView({ hunk, viewMode, isActive, onClick }: HunkViewProps) {
  const [contextExpanded, setContextExpanded] = useState(true);

  // Count context lines (lines that are neither additions nor deletions)
  const contextLineCount = hunk.lines.filter((l) => l.origin === " ").length;
  const hasContextLines = contextLineCount > 0;

  // Filter lines based on context expansion state
  const visibleLines = contextExpanded
    ? hunk.lines
    : hunk.lines.filter((l) => l.origin !== " ");

  const toggleContext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setContextExpanded(!contextExpanded);
  };

  return (
    <div
      onClick={onClick}
      className={clsx(
        "mb-4 border rounded overflow-hidden cursor-pointer transition-colors",
        isActive
          ? "border-[var(--border-default)] ring-1 ring-[var(--border-default)]"
          : "border-[var(--border-muted)] hover:border-[var(--border-default)]"
      )}
    >
      {/* Hunk header */}
      <div className={clsx(
        "px-4 py-1 text-xs font-mono flex items-center justify-between",
        isActive ? "bg-[var(--surface-3)] text-[var(--text-secondary)]" : "bg-[var(--surface-2)] text-[var(--text-muted)]"
      )}>
        <span>@@ -{hunk.old_start},{hunk.old_lines} +{hunk.new_start},{hunk.new_lines} @@</span>
        {hasContextLines && (
          <button
            onClick={toggleContext}
            className={clsx(
              "ml-2 px-2 py-0.5 rounded text-[11px] transition-colors",
              contextExpanded
                ? "bg-[var(--surface-3)] text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
                : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)]"
            )}
            title={contextExpanded ? "Hide context lines" : "Show context lines"}
          >
            {contextExpanded ? (
              <>
                <span className="mr-1">−</span>
                Hide {contextLineCount} context
              </>
            ) : (
              <>
                <span className="mr-1">+</span>
                Show {contextLineCount} context
              </>
            )}
          </button>
        )}
      </div>

      {/* Collapsed indicator */}
      {!contextExpanded && hasContextLines && (
        <div
          onClick={toggleContext}
          className="bg-[var(--surface-2)] px-4 py-1 text-xs text-[var(--text-muted)] text-center hover:bg-[var(--surface-3)] cursor-pointer border-b border-[var(--border-muted)]"
        >
          ... {contextLineCount} context lines hidden ...
        </div>
      )}

      {/* Lines */}
      <div className="font-mono text-sm">
        {viewMode === "unified" ? (
          <UnifiedHunkLines lines={visibleLines} showContext={contextExpanded} />
        ) : (
          <SideBySideHunkLines lines={visibleLines} showContext={contextExpanded} />
        )}
      </div>
    </div>
  );
}

function UnifiedHunkLines({ lines, showContext: _showContext }: { lines: DiffHunk["lines"]; showContext?: boolean }) {
  return (
    <div>
      {lines.map((line, index) => {
        const bgColor =
          line.origin === "+"
            ? "bg-[var(--surface-2)]"
            : line.origin === "-"
            ? "bg-[var(--surface-2)]"
            : "";

        const textColor =
          line.origin === "+"
            ? "text-[var(--text-secondary)]"
            : line.origin === "-"
            ? "text-[var(--text-secondary)]"
            : "text-[var(--text-muted)]";

        return (
          <div
            key={index}
            className={clsx("flex", bgColor)}
          >
            <span className="w-10 text-right pr-2 text-[var(--text-muted)] select-none">
              {line.old_lineno || ""}
            </span>
            <span className="w-10 text-right pr-2 text-[var(--text-muted)] select-none">
              {line.new_lineno || ""}
            </span>
            <span className="w-4 text-center text-[var(--text-muted)] select-none">
              {line.origin}
            </span>
            <span className={clsx("flex-1 px-2", textColor)}>
              {line.content}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SideBySideHunkLines({ lines, showContext: _showContext }: { lines: DiffHunk["lines"]; showContext?: boolean }) {
  // Pair up old and new lines
  const oldLines = lines.filter((l) => l.origin !== "+");
  const newLines = lines.filter((l) => l.origin !== "-");

  const maxLines = Math.max(oldLines.length, newLines.length);

  return (
    <div className="flex">
      {/* Old side */}
      <div className="flex-1 border-r border-[var(--border-muted)]">
        {Array.from({ length: maxLines }).map((_, index) => {
          const line = oldLines[index];
          if (!line) {
            return <div key={index} className="h-6" />;
          }

          const bgColor = line.origin === "-" ? "bg-[var(--surface-2)]" : "";
          const textColor = line.origin === "-" ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]";

          return (
            <div key={index} className={clsx("flex h-6", bgColor)}>
              <span className="w-10 text-right pr-2 text-[var(--text-muted)] select-none">
                {line.old_lineno || ""}
              </span>
              <span className="w-4 text-center text-[var(--text-muted)] select-none">
                {line.origin === "-" ? "-" : " "}
              </span>
              <span className={clsx("flex-1 px-2 truncate", textColor)}>
                {line.content}
              </span>
            </div>
          );
        })}
      </div>

      {/* New side */}
      <div className="flex-1">
        {Array.from({ length: maxLines }).map((_, index) => {
          const line = newLines[index];
          if (!line) {
            return <div key={index} className="h-6" />;
          }

          const bgColor = line.origin === "+" ? "bg-[var(--surface-2)]" : "";
          const textColor = line.origin === "+" ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]";

          return (
            <div key={index} className={clsx("flex h-6", bgColor)}>
              <span className="w-10 text-right pr-2 text-[var(--text-muted)] select-none">
                {line.new_lineno || ""}
              </span>
              <span className="w-4 text-center text-[var(--text-muted)] select-none">
                {line.origin === "+" ? "+" : " "}
              </span>
              <span className={clsx("flex-1 px-2 truncate", textColor)}>
                {line.content}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
