import { exists, readTextFile } from "@tauri-apps/plugin-fs";
import { useState, useEffect, useCallback } from "react";

import { executeBash } from "@/lib/bashExecutor";
import { useAppStore } from "@/stores/appStore";

export interface GovernanceVersion {
  version: string;
  sidstackVersion: string;
  initializedAt: string;
  updatedAt: string;
}

export interface GovernanceStatus {
  isInstalled: boolean;
  isLoading: boolean;
  version: GovernanceVersion | null;
  error: string | null;
}

interface UseGovernanceCheckResult {
  status: GovernanceStatus;
  installGovernance: () => Promise<boolean>;
  updateGovernance: () => Promise<boolean>;
  checkGovernance: () => Promise<void>;
  dismissPrompt: () => void;
  showPrompt: boolean;
}

// Storage key for dismissed workspaces
const DISMISSED_KEY = "sidstack-governance-dismissed";

function getDismissedWorkspaces(): string[] {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setDismissedWorkspace(path: string) {
  try {
    const dismissed = getDismissedWorkspaces();
    if (!dismissed.includes(path)) {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed, path]));
    }
  } catch {
    // Ignore storage errors
  }
}

export function useGovernanceCheck(): UseGovernanceCheckResult {
  const projectPath = useAppStore((state) => state.projectPath);

  const [status, setStatus] = useState<GovernanceStatus>({
    isInstalled: false,
    isLoading: true,
    version: null,
    error: null,
  });

  const [showPrompt, setShowPrompt] = useState(false);

  const checkGovernance = useCallback(async () => {
    if (!projectPath) {
      setStatus({
        isInstalled: false,
        isLoading: false,
        version: null,
        error: null,
      });
      setShowPrompt(false);
      return;
    }

    setStatus((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const versionPath = `${projectPath}/.sidstack/version.json`;
      const hasVersion = await exists(versionPath);

      if (hasVersion) {
        // Read version file
        const content = await readTextFile(versionPath);
        const version: GovernanceVersion = JSON.parse(content);

        setStatus({
          isInstalled: true,
          isLoading: false,
          version,
          error: null,
        });
        setShowPrompt(false);
      } else {
        // Check if user dismissed prompt for this workspace
        const dismissed = getDismissedWorkspaces();
        const isDismissed = dismissed.includes(projectPath);

        setStatus({
          isInstalled: false,
          isLoading: false,
          version: null,
          error: null,
        });
        setShowPrompt(!isDismissed);
      }
    } catch (err) {
      // Permission errors are expected for new projects outside Tauri's allowed scope
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isPermissionError = errorMessage.includes("forbidden path") ||
                                errorMessage.includes("not allowed on the scope");

      if (!isPermissionError) {
        console.error("[useGovernanceCheck] Error checking governance:", err);
      }

      setStatus({
        isInstalled: false,
        isLoading: false,
        version: null,
        error: isPermissionError ? null : errorMessage,
      });
      setShowPrompt(false);
    }
  }, [projectPath]);

  // Check governance when projectPath changes
  useEffect(() => {
    checkGovernance();
  }, [checkGovernance]);

  const installGovernance = useCallback(async (): Promise<boolean> => {
    if (!projectPath) return false;

    try {
      setStatus((prev) => ({ ...prev, isLoading: true }));

      // Run sidstack init --governance command
      const result = await executeBash(
        `sidstack init "${projectPath}" --governance --skip-health-check`,
        projectPath
      );

      if (result.success) {
        // Re-check governance status
        await checkGovernance();
        return true;
      } else {
        setStatus((prev) => ({
          ...prev,
          isLoading: false,
          error: result.stderr || "Installation failed",
        }));
        return false;
      }
    } catch (err) {
      console.error("[useGovernanceCheck] Error installing governance:", err);
      setStatus((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Installation failed",
      }));
      return false;
    }
  }, [projectPath, checkGovernance]);

  const updateGovernance = useCallback(async (): Promise<boolean> => {
    if (!projectPath) return false;

    try {
      setStatus((prev) => ({ ...prev, isLoading: true }));

      // Run sidstack update --governance-only command
      const result = await executeBash(
        `sidstack update "${projectPath}" --governance-only --force`,
        projectPath
      );

      if (result.success) {
        // Re-check governance status
        await checkGovernance();
        return true;
      } else {
        setStatus((prev) => ({
          ...prev,
          isLoading: false,
          error: result.stderr || "Update failed",
        }));
        return false;
      }
    } catch (err) {
      console.error("[useGovernanceCheck] Error updating governance:", err);
      setStatus((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Update failed",
      }));
      return false;
    }
  }, [projectPath, checkGovernance]);

  const dismissPrompt = useCallback(() => {
    if (projectPath) {
      setDismissedWorkspace(projectPath);
    }
    setShowPrompt(false);
  }, [projectPath]);

  return {
    status,
    installGovernance,
    updateGovernance,
    checkGovernance,
    dismissPrompt,
    showPrompt,
  };
}
