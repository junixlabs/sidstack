import { invoke } from "@tauri-apps/api/core";
import { useState, useCallback } from "react";

import type {
  FileDiff,
  BranchInfo,
  CommitInfo,
  RepoStatus,
} from "@/types";

export function useGit() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getDiff = useCallback(
    async (workspacePath: string, baseBranch?: string): Promise<FileDiff[]> => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<FileDiff[]>("get_diff", {
          workspacePath,
          baseBranch,
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getFileDiff = useCallback(
    async (
      workspacePath: string,
      filePath: string,
      baseBranch?: string
    ): Promise<FileDiff> => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<FileDiff>("get_file_diff", {
          workspacePath,
          filePath,
          baseBranch,
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const listBranches = useCallback(
    async (repoPath: string): Promise<BranchInfo[]> => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<BranchInfo[]>("list_branches", {
          repoPath,
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getCommitLog = useCallback(
    async (
      repoPath: string,
      branch?: string,
      limit?: number
    ): Promise<CommitInfo[]> => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<CommitInfo[]>("get_commit_log", {
          repoPath,
          branch,
          limit,
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getRepoStatus = useCallback(
    async (repoPath: string): Promise<RepoStatus> => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<RepoStatus>("get_repo_status", {
          repoPath,
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    getDiff,
    getFileDiff,
    listBranches,
    getCommitLog,
    getRepoStatus,
  };
}
