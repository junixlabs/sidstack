/**
 * useWorkspacePersistence - Hook for workspace session persistence
 *
 * Manages terminal sessions per workspace (project folder):
 * - Auto-init workspace on first open
 * - Save/restore terminal tabs, cwd, and history
 * - Auto-save on tab changes
 * - Save on app close
 */

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef } from "react";

import { useAppStore } from "@/stores/appStore";
import { useBlockStore } from "@/stores/blockStore";

// ============================================================================
// Types (matching Rust structs)
// ============================================================================

export interface SessionTab {
  id: string;
  blockId?: string; // Block ID for persistence (reuse when switching back)
  type: string;
  cwd: string;
  title: string;
  pinned: boolean;
}

export interface SessionState {
  version: string;
  tabs: SessionTab[];
  active_tab_id: string | null;
  last_saved: string;
}

export interface WorkspaceConfig {
  version: string;
  name: string;
  created_at: string;
  last_opened: string;
}

// ============================================================================
// Tauri Commands
// ============================================================================

async function workspaceExists(workspacePath: string): Promise<boolean> {
  return invoke<boolean>("workspace_exists", { workspacePath });
}

async function workspaceInit(
  workspacePath: string,
  name: string
): Promise<WorkspaceConfig> {
  return invoke<WorkspaceConfig>("workspace_init", { workspacePath, name });
}

async function workspaceSessionLoad(
  workspacePath: string
): Promise<SessionState> {
  return invoke<SessionState>("workspace_session_load", { workspacePath });
}

async function workspaceSessionSave(
  workspacePath: string,
  state: SessionState
): Promise<void> {
  return invoke("workspace_session_save", { workspacePath, state });
}

export async function workspaceGetHistoryPath(
  workspacePath: string,
  terminalId: string
): Promise<string> {
  return invoke<string>("workspace_get_history_path", {
    workspacePath,
    terminalId,
  });
}

async function workspaceValidateCwd(
  cwd: string,
  fallback: string
): Promise<string> {
  return invoke<string>("workspace_validate_cwd", { cwd, fallback });
}

// ============================================================================
// Hook
// ============================================================================

interface UseWorkspacePersistenceOptions {
  /** Called when session is restored with tabs to create */
  onRestore?: (tabs: SessionTab[]) => void;
  /** Called when workspace is first initialized */
  onInit?: () => void;
  /** Debounce delay for auto-save (ms) */
  debounceMs?: number;
}

export function useWorkspacePersistence(
  options: UseWorkspacePersistenceOptions = {}
) {
  const { onRestore, onInit, debounceMs = 1000 } = options;

  const projectPath = useAppStore((s) => s.projectPath);
  const blocks = useBlockStore((s) => s.blocks);
  const activeBlockId = useBlockStore((s) => s.activeBlockId);

  // Refs for debouncing and tracking initialization
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitializedRef = useRef(false);
  const isRestoringRef = useRef(false); // Prevent auto-save during restore
  const lastSavedRef = useRef<string>("");
  const previousProjectPathRef = useRef<string | null>(null);

  // =========================================================================
  // Save current workspace session (for switching)
  // =========================================================================
  const saveCurrentSession = useCallback(async (workspacePath: string) => {
    try {
      const blockList = Object.values(useBlockStore.getState().blocks);
      const currentActiveBlockId = useBlockStore.getState().activeBlockId;

      const sessionTabs: SessionTab[] = blockList.map((block) => ({
        id: block.id,
        blockId: block.id,
        type: block.viewType,
        cwd: block.cwd || workspacePath,
        title: block.title || "Block",
        pinned: false,
      }));

      const state: SessionState = {
        version: "1.0",
        tabs: sessionTabs,
        active_tab_id: currentActiveBlockId,
        last_saved: new Date().toISOString(),
      };

      await workspaceSessionSave(workspacePath, state);
      console.log("[WorkspacePersistence] Saved session before switch:", sessionTabs.length, "tabs");
    } catch (e) {
      console.error("[WorkspacePersistence] Save before switch error:", e);
    }
  }, []);

  // =========================================================================
  // Initialize workspace on mount or when projectPath changes
  // =========================================================================
  useEffect(() => {
    if (!projectPath) return;

    const init = async () => {
      try {
        // Save previous workspace session before switching
        if (previousProjectPathRef.current && previousProjectPathRef.current !== projectPath) {
          await saveCurrentSession(previousProjectPathRef.current);
          // Reset state for new workspace
          isInitializedRef.current = false;
          lastSavedRef.current = "";
        }
        previousProjectPathRef.current = projectPath;

        const exists = await workspaceExists(projectPath);

        if (!exists) {
          // First time opening - initialize workspace
          const name = projectPath.split("/").pop() || "workspace";
          await workspaceInit(projectPath, name);
          console.log(
            "[WorkspacePersistence] Initialized workspace:",
            projectPath
          );
          isInitializedRef.current = true;
          onInit?.();
          return;
        }

        // Load existing session
        const session = await workspaceSessionLoad(projectPath);

        if (session.tabs.length > 0) {
          console.log(
            "[WorkspacePersistence] Restoring",
            session.tabs.length,
            "tabs"
          );

          // Validate cwds and restore
          const validatedTabs = await Promise.all(
            session.tabs.map(async (tab) => ({
              ...tab,
              cwd: await workspaceValidateCwd(tab.cwd, projectPath),
            }))
          );

          // IMPORTANT: Set isRestoring BEFORE onRestore to prevent auto-save during block creation
          isRestoringRef.current = true;
          onRestore?.(validatedTabs);

          // After restore, set lastSavedRef to current state to prevent immediate auto-save
          // This is a safeguard against React async timing issues
          const restoredBlocks = Object.values(useBlockStore.getState().blocks);
          const restoredActiveId = useBlockStore.getState().activeBlockId;
          lastSavedRef.current = JSON.stringify({ blocks: restoredBlocks, activeBlockId: restoredActiveId });

          isRestoringRef.current = false;
          isInitializedRef.current = true;
          console.log("[WorkspacePersistence] Restore complete, saved state for", restoredBlocks.length, "blocks");
        } else {
          console.log("[WorkspacePersistence] No tabs to restore");
          isInitializedRef.current = true;
          onInit?.();
        }
      } catch (e) {
        console.error("[WorkspacePersistence] Init error:", e);
        // Start fresh on error
        onInit?.();
      }
    };

    init();
  }, [projectPath, saveCurrentSession]);

  // =========================================================================
  // Auto-save on block changes (debounced)
  // =========================================================================
  useEffect(() => {
    // Skip auto-save if not initialized or currently restoring session
    if (!projectPath || !isInitializedRef.current || isRestoringRef.current) return;

    // Skip if no actual change
    const blockList = Object.values(blocks);
    const currentState = JSON.stringify({ blocks: blockList, activeBlockId });
    if (currentState === lastSavedRef.current) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Schedule save
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const sessionTabs: SessionTab[] = blockList.map((block) => ({
          id: block.id,
          blockId: block.id,
          type: block.viewType,
          cwd: block.cwd || projectPath,
          title: block.title || "Block",
          pinned: false,
        }));

        const state: SessionState = {
          version: "1.0",
          tabs: sessionTabs,
          active_tab_id: activeBlockId,
          last_saved: new Date().toISOString(),
        };

        await workspaceSessionSave(projectPath, state);
        lastSavedRef.current = currentState;
        console.log("[WorkspacePersistence] Auto-saved", sessionTabs.length, "blocks");
      } catch (e) {
        console.error("[WorkspacePersistence] Auto-save error:", e);
      }
    }, debounceMs);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [blocks, activeBlockId, projectPath, debounceMs]);

  // =========================================================================
  // Save on window close
  // =========================================================================
  useEffect(() => {
    if (!projectPath) return;

    const handleBeforeUnload = async () => {
      // Cancel pending debounced save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Save immediately
      try {
        const blockList = Object.values(blocks);
        const sessionTabs: SessionTab[] = blockList.map((block) => ({
          id: block.id,
          blockId: block.id,
          type: block.viewType,
          cwd: block.cwd || projectPath,
          title: block.title || "Block",
          pinned: false,
        }));

        const state: SessionState = {
          version: "1.0",
          tabs: sessionTabs,
          active_tab_id: activeBlockId,
          last_saved: new Date().toISOString(),
        };

        await workspaceSessionSave(projectPath, state);
        console.log("[WorkspacePersistence] Saved on close");
      } catch (e) {
        console.error("[WorkspacePersistence] Save on close error:", e);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [blocks, activeBlockId, projectPath]);

  // =========================================================================
  // Manual save function
  // =========================================================================
  const saveNow = useCallback(async () => {
    if (!projectPath) return;

    try {
      const blockList = Object.values(blocks);
      const sessionTabs: SessionTab[] = blockList.map((block) => ({
        id: block.id,
        blockId: block.id,
        type: block.viewType,
        cwd: block.cwd || projectPath,
        title: block.title || "Block",
        pinned: false,
      }));

      const state: SessionState = {
        version: "1.0",
        tabs: sessionTabs,
        active_tab_id: activeBlockId,
        last_saved: new Date().toISOString(),
      };

      await workspaceSessionSave(projectPath, state);
      console.log("[WorkspacePersistence] Manual save completed");
    } catch (e) {
      console.error("[WorkspacePersistence] Manual save error:", e);
    }
  }, [blocks, activeBlockId, projectPath]);

  return {
    saveNow,
    isInitialized: isInitializedRef.current,
  };
}
