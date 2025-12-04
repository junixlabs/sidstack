import { invoke } from "@tauri-apps/api/core";
import { useState, useCallback } from "react";

import type { Workspace, WorkspaceStats } from "@/types";

export function useWorkspace() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listWorkspaces = useCallback(
    async (projectPath: string): Promise<Workspace[]> => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<Workspace[]>("list_workspaces", {
          projectPath,
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

  const createWorkspace = useCallback(
    async (
      projectPath: string,
      taskId: string,
      branchName?: string
    ): Promise<Workspace> => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<Workspace>("create_workspace", {
          projectPath,
          taskId,
          branchName,
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

  const deleteWorkspace = useCallback(
    async (
      projectPath: string,
      taskId: string,
      deleteBranch?: boolean
    ): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        await invoke("delete_workspace", {
          projectPath,
          taskId,
          deleteBranch,
        });
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

  const getWorkspaceStatus = useCallback(
    async (workspacePath: string): Promise<WorkspaceStats> => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<WorkspaceStats>("get_workspace_status", {
          workspacePath,
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

  const syncSharedSymlinks = useCallback(
    async (workspacePath: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        await invoke("sync_shared_symlinks", { workspacePath });
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
    listWorkspaces,
    createWorkspace,
    deleteWorkspace,
    getWorkspaceStatus,
    syncSharedSymlinks,
  };
}
