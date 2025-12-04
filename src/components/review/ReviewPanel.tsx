import { useMemo, useCallback } from "react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";

import { useGitDiff } from "@/hooks/useGitDiff";
import { useReviewKeyboard } from "@/hooks/useReviewKeyboard";
import { useAppStore } from "@/stores/appStore";
import { useReviewStore } from "@/stores/reviewStore";

import { DiffPane } from "./DiffPane";
import { EmptyState } from "./EmptyState";
import { ReviewHeader } from "./ReviewHeader";
import { ReviewSidebar } from "./ReviewSidebar";
import "@/styles/diff-view.css";

interface ReviewPanelProps {
  className?: string;
}

/**
 * Main container for code review UI
 * Layout: Header + (Sidebar | DiffPane)
 */
export function ReviewPanel({ className = "" }: ReviewPanelProps) {
  const projectPath = useAppStore((state) => state.projectPath);
  const changedFiles = useReviewStore((state) => state.changedFiles);
  const selectedFilePath = useReviewStore((state) => state.selectedFilePath);
  const sidebarCollapsed = useReviewStore((state) => state.sidebarCollapsed);
  const sidebarWidth = useReviewStore((state) => state.sidebarWidth);
  const isLoading = useReviewStore((state) => state.isLoading);
  const error = useReviewStore((state) => state.error);
  const fileFilter = useReviewStore((state) => state.fileFilter);
  const setSidebarWidth = useReviewStore((state) => state.setSidebarWidth);

  // Load git diff data
  useGitDiff(projectPath);

  // Enable keyboard navigation
  useReviewKeyboard(true);

  // Memoized computed values to prevent re-renders
  const filteredFiles = useMemo(() => {
    if (!fileFilter) return changedFiles;
    return changedFiles.filter((f) =>
      f.path.toLowerCase().includes(fileFilter.toLowerCase())
    );
  }, [changedFiles, fileFilter]);

  const totalStats = useMemo(() => {
    return changedFiles.reduce(
      (acc, file) => ({
        files: acc.files + 1,
        additions: acc.additions + file.additions,
        deletions: acc.deletions + file.deletions,
      }),
      { files: 0, additions: 0, deletions: 0 }
    );
  }, [changedFiles]);

  // Calculate sidebar size as percentage (based on default 1000px container)
  const sidebarSizePercent = useMemo(() => {
    return Math.max(15, Math.min(40, (sidebarWidth / 1000) * 100));
  }, [sidebarWidth]);

  // Handle sidebar resize
  const handleSidebarResize = useCallback(
    (sizes: number[]) => {
      if (sizes[0]) {
        // Convert percentage back to pixels (assuming 1000px base)
        const newWidth = Math.round((sizes[0] / 100) * 1000);
        setSidebarWidth(Math.max(180, Math.min(400, newWidth)));
      }
    },
    [setSidebarWidth]
  );

  // Empty state
  if (!isLoading && changedFiles.length === 0) {
    return (
      <div className={`flex flex-col h-full bg-zinc-900 ${className}`}>
        <ReviewHeader stats={totalStats} />
        <EmptyState type="no-changes" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`flex flex-col h-full bg-zinc-900 ${className}`}>
        <ReviewHeader stats={totalStats} />
        <EmptyState type="error" message={error} />
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-zinc-900 ${className}`}>
      {/* Header with stats and controls */}
      <ReviewHeader stats={totalStats} />

      {/* Main content: Sidebar + Diff */}
      <div className="flex-1 min-h-0">
        <PanelGroup
          direction="horizontal"
          onLayout={handleSidebarResize}
          className="h-full"
        >
          {/* Sidebar */}
          {!sidebarCollapsed && (
            <>
              <Panel
                defaultSize={sidebarSizePercent}
                minSize={15}
                maxSize={40}
                className="h-full"
              >
                <ReviewSidebar files={filteredFiles} />
              </Panel>
              <PanelResizeHandle className="w-1 bg-zinc-800 hover:bg-blue-500/50 transition-colors cursor-col-resize" />
            </>
          )}

          {/* Main diff pane */}
          <Panel className="h-full">
            {selectedFilePath ? (
              <DiffPane filePath={selectedFilePath} />
            ) : (
              <EmptyState type="no-selection" />
            )}
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

export default ReviewPanel;
