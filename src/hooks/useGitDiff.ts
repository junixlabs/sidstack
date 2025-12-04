import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect, useCallback } from "react";

import { useReviewStore, type ChangedFile, type FileStatus } from "@/stores/reviewStore";

interface TauriFileDiff {
  path: string;
  status: TauriFileStatus;
  additions: number;
  deletions: number;
  hunks: TauriDiffHunk[];
}

interface TauriDiffHunk {
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  lines: TauriDiffLine[];
}

interface TauriDiffLine {
  origin: string;
  content: string;
  old_lineno: number | null;
  new_lineno: number | null;
}

type TauriFileStatus = "added" | "modified" | "deleted" | "renamed" | "untracked";

/**
 * Convert Tauri status to store status
 */
function convertStatus(status: TauriFileStatus): FileStatus {
  switch (status) {
    case "added":
    case "untracked":
      return "added";
    case "deleted":
      return "deleted";
    case "renamed":
      return "renamed";
    default:
      return "modified";
  }
}

/**
 * Hook to load git diff for a workspace
 */
export function useGitDiff(workspacePath: string | null, baseBranch?: string) {
  const { setChangedFiles, setLoading, setError } = useReviewStore();
  const [lastRefresh, setLastRefresh] = useState<number>(0);

  const refresh = useCallback(() => {
    setLastRefresh(Date.now());
  }, []);

  useEffect(() => {
    if (!workspacePath) {
      setChangedFiles([]);
      return;
    }

    const loadDiff = async () => {
      setLoading(true);
      setError(null);

      try {
        const diffs = await invoke<TauriFileDiff[]>("get_diff", {
          workspacePath,
          baseBranch: baseBranch || null,
        });

        const changedFiles: ChangedFile[] = diffs.map((diff) => ({
          path: diff.path,
          status: convertStatus(diff.status),
          additions: diff.additions,
          deletions: diff.deletions,
          binary: false,
        }));

        setChangedFiles(changedFiles);
      } catch (err) {
        console.error("Failed to load git diff:", err);
        setError(err instanceof Error ? err.message : "Failed to load diff");
        setChangedFiles([]);
      } finally {
        setLoading(false);
      }
    };

    loadDiff();
  }, [workspacePath, baseBranch, lastRefresh, setChangedFiles, setLoading, setError]);

  return { refresh };
}

/**
 * Hook to load detailed diff for a single file
 */
export function useFileDiff(
  workspacePath: string | null,
  filePath: string | null,
  baseBranch?: string
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffData, setDiffData] = useState<{
    oldContent: string;
    newContent: string;
    hunks: string[];
  } | null>(null);

  useEffect(() => {
    if (!workspacePath || !filePath) {
      setDiffData(null);
      return;
    }

    const loadFileDiff = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const diff = await invoke<TauriFileDiff>("get_file_diff", {
          workspacePath,
          filePath,
          baseBranch: baseBranch || null,
        });

        // Convert hunks to git diff format for @git-diff-view
        const hunks = diff.hunks.map((hunk) => {
          const header = `@@ -${hunk.old_start},${hunk.old_lines} +${hunk.new_start},${hunk.new_lines} @@`;
          const lines = hunk.lines.map((line) => `${line.origin}${line.content}`).join("");
          return `${header}\n${lines}`;
        });

        setDiffData({
          oldContent: "", // Will be fetched separately if needed
          newContent: "",
          hunks,
        });
      } catch (err) {
        console.error("Failed to load file diff:", err);
        setError(err instanceof Error ? err.message : "Failed to load file diff");
        setDiffData(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadFileDiff();
  }, [workspacePath, filePath, baseBranch]);

  return { isLoading, error, diffData };
}

export default useGitDiff;
