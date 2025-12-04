import { invoke } from "@tauri-apps/api/core";
import { useState, useCallback } from "react";

import type { FileContent, FileTreeNode } from "@/types";

export function useFile() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getFileContent = useCallback(
    async (filePath: string): Promise<FileContent> => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<FileContent>("get_file_content", {
          filePath,
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

  const getFileTree = useCallback(
    async (dirPath: string, maxDepth?: number): Promise<FileTreeNode> => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<FileTreeNode>("get_file_tree", {
          dirPath,
          maxDepth,
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

  const searchFiles = useCallback(
    async (
      dirPath: string,
      pattern: string,
      maxResults?: number
    ): Promise<string[]> => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<string[]>("search_files", {
          dirPath,
          pattern,
          maxResults,
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
    getFileContent,
    getFileTree,
    searchFiles,
  };
}
