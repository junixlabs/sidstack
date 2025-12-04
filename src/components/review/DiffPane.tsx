import { DiffView, DiffFile, DiffModeEnum } from "@git-diff-view/react";
import clsx from "clsx";
import { Loader2, AlertCircle } from "lucide-react";
import { useRef, useEffect, useMemo } from "react";

import { useFileDiff } from "@/hooks/useGitDiff";
import { useAppStore } from "@/stores/appStore";
import { useReviewStore } from "@/stores/reviewStore";

interface DiffPaneProps {
  filePath: string;
  className?: string;
}

/**
 * DiffPane wrapper for @git-diff-view/react
 * Handles loading diff data and rendering
 */
export function DiffPane({ filePath, className = "" }: DiffPaneProps) {
  const { viewMode, setTotalHunks } = useReviewStore();
  const projectPath = useAppStore((state) => state.projectPath);
  const diffRef = useRef<{ getDiffFileInstance: () => DiffFile } | null>(null);

  // Load diff data from Tauri
  const { isLoading, error, diffData } = useFileDiff(projectPath, filePath);

  // Convert view mode to DiffModeEnum
  const diffViewMode = viewMode === "split" ? DiffModeEnum.Split : DiffModeEnum.Unified;

  // Prepare data for DiffView component
  const viewData = useMemo(() => {
    if (!diffData) return null;

    return {
      oldFile: {
        fileName: filePath,
        content: diffData.oldContent || "",
      },
      newFile: {
        fileName: filePath,
        content: diffData.newContent || "",
      },
      hunks: diffData.hunks,
    };
  }, [diffData, filePath]);

  // Update hunk count when diff file changes
  useEffect(() => {
    if (diffRef.current) {
      const diffFile = diffRef.current.getDiffFileInstance();
      if (diffFile) {
        // Count hunks from diff file
        const hunkCount = diffFile.diffLineLength || 0;
        setTotalHunks(hunkCount);
      }
    }
  }, [viewData, setTotalHunks]);

  // Loading state
  if (isLoading) {
    return (
      <div
        className={clsx(
          "flex flex-col items-center justify-center h-full",
          "bg-[var(--surface-0)] text-[var(--text-muted)]",
          className
        )}
      >
        <Loader2 className="w-8 h-8 animate-spin mb-2" />
        <span className="text-sm">Loading diff...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={clsx(
          "flex flex-col items-center justify-center h-full",
          "bg-[var(--surface-0)] text-[var(--text-secondary)]",
          className
        )}
      >
        <AlertCircle className="w-8 h-8 mb-2" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  // No data state
  if (!viewData) {
    return (
      <div
        className={clsx(
          "flex flex-col items-center justify-center h-full",
          "bg-[var(--surface-0)] text-[var(--text-muted)]",
          className
        )}
      >
        <span className="text-sm">No diff data available</span>
      </div>
    );
  }

  return (
    <div className={clsx("diff-view-wrapper h-full overflow-auto", className)}>
      <DiffView
        ref={diffRef}
        data={viewData}
        diffViewMode={diffViewMode}
        diffViewTheme="dark"
        diffViewHighlight={true}
        diffViewWrap={false}
        diffViewFontSize={13}
        className="h-full"
      />
    </div>
  );
}

export default DiffPane;
