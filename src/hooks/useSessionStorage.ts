/**
 * useSessionStorage - Hook for managing persistent session storage
 *
 * Provides interface to Tauri backend for session operations:
 * - List sessions (by project or all)
 * - Create, rename, delete sessions
 * - Export session as markdown
 * - Load session output history
 */

import { invoke } from "@tauri-apps/api/core";
import { useState, useCallback, useEffect } from "react";

// ============================================================================
// Types
// ============================================================================

export type SessionStatus = "active" | "saved" | "archived";

export interface SessionMeta {
  sessionId: string;
  projectPath: string;
  projectHash: string;
  role: string | null;
  displayName: string | null;
  claudeSessionId: string | null;
  createdAt: string;
  lastActiveAt: string;
  status: SessionStatus;
  logSizeBytes: number;
}

// ============================================================================
// Hook
// ============================================================================

export function useSessionStorage(projectPath?: string) {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load sessions
  const loadSessions = useCallback(async (path?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<SessionMeta[]>("session_storage_list", {
        projectPath: path,
      });
      setSessions(result);
    } catch (e) {
      setError(String(e));
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount and when projectPath changes
  useEffect(() => {
    loadSessions(projectPath);
  }, [projectPath, loadSessions]);

  // Get single session
  const getSession = useCallback(
    async (sessionId: string): Promise<SessionMeta | null> => {
      if (!projectPath) return null;
      try {
        return await invoke<SessionMeta | null>("session_storage_get", {
          projectPath,
          sessionId,
        });
      } catch (e) {
        console.error("[useSessionStorage] getSession error:", e);
        return null;
      }
    },
    [projectPath]
  );

  // Create session
  const createSession = useCallback(
    async (
      sessionId: string,
      role?: string,
      claudeSessionId?: string
    ): Promise<SessionMeta | null> => {
      if (!projectPath) return null;
      try {
        const session = await invoke<SessionMeta>("session_storage_create", {
          sessionId,
          projectPath,
          role,
          claudeSessionId,
        });
        await loadSessions(projectPath);
        return session;
      } catch (e) {
        console.error("[useSessionStorage] createSession error:", e);
        return null;
      }
    },
    [projectPath, loadSessions]
  );

  // Rename session
  const renameSession = useCallback(
    async (sessionId: string, displayName: string): Promise<boolean> => {
      if (!projectPath) return false;
      try {
        await invoke("session_storage_rename", {
          projectPath,
          sessionId,
          displayName,
        });
        await loadSessions(projectPath);
        return true;
      } catch (e) {
        console.error("[useSessionStorage] renameSession error:", e);
        return false;
      }
    },
    [projectPath, loadSessions]
  );

  // Delete session
  const deleteSession = useCallback(
    async (sessionId: string, deleteLogs: boolean = true): Promise<boolean> => {
      if (!projectPath) return false;
      try {
        await invoke("session_storage_delete", {
          projectPath,
          sessionId,
          deleteLogs,
        });
        await loadSessions(projectPath);
        return true;
      } catch (e) {
        console.error("[useSessionStorage] deleteSession error:", e);
        return false;
      }
    },
    [projectPath, loadSessions]
  );

  // Update session status
  const updateStatus = useCallback(
    async (sessionId: string, status: SessionStatus): Promise<boolean> => {
      if (!projectPath) return false;
      try {
        await invoke("session_storage_update_status", {
          projectPath,
          sessionId,
          status,
        });
        await loadSessions(projectPath);
        return true;
      } catch (e) {
        console.error("[useSessionStorage] updateStatus error:", e);
        return false;
      }
    },
    [projectPath, loadSessions]
  );

  // Update session role
  const updateRole = useCallback(
    async (sessionId: string, role: string): Promise<boolean> => {
      if (!projectPath) return false;
      try {
        await invoke("session_storage_update_role", {
          projectPath,
          sessionId,
          role,
        });
        await loadSessions(projectPath);
        return true;
      } catch (e) {
        console.error("[useSessionStorage] updateRole error:", e);
        return false;
      }
    },
    [projectPath, loadSessions]
  );

  // Update Claude session ID - called when we receive system.init event
  const updateClaudeSessionId = useCallback(
    async (sessionId: string, claudeSessionId: string): Promise<boolean> => {
      if (!projectPath) return false;
      try {
        await invoke("session_storage_update_claude_id", {
          projectPath,
          sessionId,
          claudeSessionId,
        });
        await loadSessions(projectPath);
        return true;
      } catch (e) {
        console.error("[useSessionStorage] updateClaudeSessionId error:", e);
        return false;
      }
    },
    [projectPath, loadSessions]
  );

  // Export session as markdown
  const exportSession = useCallback(
    async (sessionId: string): Promise<string | null> => {
      if (!projectPath) return null;
      try {
        return await invoke<string>("session_storage_export", {
          projectPath,
          sessionId,
        });
      } catch (e) {
        console.error("[useSessionStorage] exportSession error:", e);
        return null;
      }
    },
    [projectPath]
  );

  // Load output from session log
  const loadOutput = useCallback(
    async (sessionId: string, lines: number = 100): Promise<string[]> => {
      if (!projectPath) return [];
      try {
        return await invoke<string[]>("session_storage_load_output", {
          projectPath,
          sessionId,
          lines,
        });
      } catch (e) {
        console.error("[useSessionStorage] loadOutput error:", e);
        return [];
      }
    },
    [projectPath]
  );

  // Append output to session log
  const appendOutput = useCallback(
    async (sessionId: string, data: string): Promise<boolean> => {
      if (!projectPath) return false;
      try {
        await invoke("session_storage_append_output", {
          projectPath,
          sessionId,
          data,
        });
        return true;
      } catch (e) {
        console.error("[useSessionStorage] appendOutput error:", e);
        return false;
      }
    },
    [projectPath]
  );

  // Cleanup old sessions
  const cleanup = useCallback(async (days: number = 30): Promise<number> => {
    try {
      return await invoke<number>("session_storage_cleanup", { days });
    } catch (e) {
      console.error("[useSessionStorage] cleanup error:", e);
      return 0;
    }
  }, []);

  // Group sessions by project
  const sessionsByProject = sessions.reduce(
    (acc, session) => {
      const key = session.projectPath;
      if (!acc[key]) acc[key] = [];
      acc[key].push(session);
      return acc;
    },
    {} as Record<string, SessionMeta[]>
  );

  // Filter active sessions
  const activeSessions = sessions.filter((s) => s.status === "active");
  const savedSessions = sessions.filter((s) => s.status === "saved");

  return {
    sessions,
    sessionsByProject,
    activeSessions,
    savedSessions,
    loading,
    error,
    refresh: () => loadSessions(projectPath),
    getSession,
    createSession,
    renameSession,
    deleteSession,
    updateStatus,
    updateRole,
    updateClaudeSessionId,
    exportSession,
    loadOutput,
    appendOutput,
    cleanup,
  };
}
