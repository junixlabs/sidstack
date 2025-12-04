import { invoke } from "@tauri-apps/api/core";
import { homeDir, join } from "@tauri-apps/api/path";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { Project, Worktree, PortAllocation, PortRanges } from "@/types";

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = "sidstack-projects";

/**
 * Port ranges for different server types.
 * Each worktree gets unique ports within these ranges.
 */
export const PORT_RANGES: PortRanges = {
  dev: { start: 3000, end: 3099 },
  api: { start: 19432, end: 19531 },
  preview: { start: 4000, end: 4099 },
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate a short hash from a string (for project IDs).
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

/**
 * Extract project name from git remote URL or folder path.
 * Examples:
 * - "https://github.com/user/project.git" -> "project"
 * - "git@github.com:user/project.git" -> "project"
 * - "/Users/x/my-project" -> "my-project"
 */
function extractProjectName(remoteOrPath: string): string {
  // Try git remote URL patterns
  const gitMatch = remoteOrPath.match(/[/:]([^/:]+?)(\.git)?$/);
  if (gitMatch) {
    return gitMatch[1];
  }
  // Fall back to folder name
  const parts = remoteOrPath.split("/").filter(Boolean);
  return parts[parts.length - 1] || "unknown";
}

/**
 * Generate worktree ID from branch name.
 * "main" -> "main"
 * "feature/auth" -> "feature-auth"
 * "bugfix/ABC-123" -> "bugfix-abc-123"
 */
function generateWorktreeId(branch: string): string {
  return branch
    .replace(/\//g, "-")
    .replace(/[^a-z0-9-]/gi, "-")
    .toLowerCase();
}

/**
 * Get the shared context path for a project.
 */
async function getSharedContextPath(projectId: string): Promise<string> {
  const home = await homeDir();
  return await join(home, ".sidstack", "projects", projectId);
}

// =============================================================================
// Store Interface
// =============================================================================

interface ProjectStore {
  // State
  projects: Project[];
  activeProjectId: string | null;

  // Project actions
  openProject: (folderPath: string) => Promise<void>;
  closeProject: (projectId: string) => void;
  switchProject: (projectId: string) => void;
  getActiveProject: () => Project | null;

  // Worktree actions
  addWorktree: (projectId: string, worktreePath: string) => Promise<void>;
  removeWorktree: (projectId: string, worktreeId: string) => void;
  switchWorktree: (worktreeId: string) => void;
  getActiveWorktree: () => Worktree | null;

  // Port management
  allocatePorts: (projectId: string, worktreeId: string) => PortAllocation;
  releasePorts: (projectId: string, worktreeId: string) => void;
  getAllocatedPorts: (portType: keyof PortAllocation) => Set<number>;

  // Internal helpers
  _discoverWorktrees: (folderPath: string) => Promise<Worktree[]>;
  _getGitRemote: (folderPath: string) => Promise<string | null>;
}

// =============================================================================
// Store Implementation
// =============================================================================

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      // State
      projects: [],
      activeProjectId: null,

      // =======================================================================
      // Project Actions
      // =======================================================================

      openProject: async (folderPath: string) => {
        const { projects, _getGitRemote, _discoverWorktrees, allocatePorts } = get();

        // 1. Get git remote (or use folder path as fallback)
        const gitRemote = await _getGitRemote(folderPath);
        const projectId = hashString(gitRemote || folderPath);

        // 2. Check if project already exists
        const existing = projects.find((p) => p.id === projectId);
        if (existing) {
          // Check if this folder is already a worktree
          const hasWorktree = existing.worktrees.some((w) => w.path === folderPath);
          if (!hasWorktree) {
            // Add as new worktree
            await get().addWorktree(projectId, folderPath);
          }
          // Switch to this project
          set({ activeProjectId: projectId });
          return;
        }

        // 3. Discover existing worktrees
        const worktrees = await _discoverWorktrees(folderPath);

        // 4. Allocate ports for each worktree
        const worktreesWithPorts = worktrees.map((w) => ({
          ...w,
          ports: allocatePorts(projectId, w.id),
        }));

        // 5. Create new project
        const sharedContextPath = await getSharedContextPath(projectId);
        const project: Project = {
          id: projectId,
          name: extractProjectName(gitRemote || folderPath),
          gitRemote: gitRemote || "",
          worktrees: worktreesWithPorts,
          activeWorktreeId: worktreesWithPorts[0]?.id || "main",
          sharedContextPath,
        };

        // 6. Add to state
        set((state) => ({
          projects: [...state.projects, project],
          activeProjectId: projectId,
        }));

        // 7. Initialize shared context directory (non-blocking)
        initializeSharedContext(sharedContextPath).catch(console.error);
      },

      closeProject: (projectId: string) => {
        set((state) => {
          const updated = state.projects.filter((p) => p.id !== projectId);
          // If closing active project, switch to another or null
          const newActiveId =
            state.activeProjectId === projectId
              ? updated.length > 0
                ? updated[updated.length - 1].id
                : null
              : state.activeProjectId;
          return {
            projects: updated,
            activeProjectId: newActiveId,
          };
        });
      },

      switchProject: (projectId: string) => {
        const { projects } = get();
        if (projects.some((p) => p.id === projectId)) {
          set({ activeProjectId: projectId });
        }
      },

      getActiveProject: () => {
        const { projects, activeProjectId } = get();
        return projects.find((p) => p.id === activeProjectId) || null;
      },

      // =======================================================================
      // Worktree Actions
      // =======================================================================

      addWorktree: async (projectId: string, worktreePath: string) => {
        const { allocatePorts } = get();

        // Get branch info for the worktree
        let branch = "unknown";
        try {
          const result = await invoke<string>("run_git_command", {
            cwd: worktreePath,
            args: ["rev-parse", "--abbrev-ref", "HEAD"],
          });
          branch = result.trim();
        } catch {
          // Use folder name as fallback
          branch = worktreePath.split("/").pop() || "unknown";
        }

        const worktreeId = generateWorktreeId(branch);
        const ports = allocatePorts(projectId, worktreeId);

        const newWorktree: Worktree = {
          id: worktreeId,
          path: worktreePath,
          branch,
          ports,
          isActive: false,
          lastActive: new Date().toISOString(),
        };

        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, worktrees: [...p.worktrees, newWorktree] }
              : p
          ),
        }));
      },

      removeWorktree: (projectId: string, worktreeId: string) => {
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;

            const updated = p.worktrees.filter((w) => w.id !== worktreeId);
            // If removing active worktree, switch to another
            const newActiveId =
              p.activeWorktreeId === worktreeId
                ? updated[0]?.id || ""
                : p.activeWorktreeId;

            return {
              ...p,
              worktrees: updated,
              activeWorktreeId: newActiveId,
            };
          }),
        }));
      },

      switchWorktree: (worktreeId: string) => {
        const state = get();

        // Find the project containing this worktree
        let targetProject: Project | undefined;
        let targetWorktree: Worktree | undefined;

        for (const project of state.projects) {
          const worktree = project.worktrees.find((w) => w.id === worktreeId);
          if (worktree) {
            targetProject = project;
            targetWorktree = worktree;
            break;
          }
        }

        if (!targetProject || !targetWorktree) return;

        // Update projectStore state
        set((state) => ({
          activeProjectId: targetProject!.id,
          projects: state.projects.map((p) =>
            p.id === targetProject!.id
              ? {
                  ...p,
                  activeWorktreeId: worktreeId,
                  worktrees: p.worktrees.map((w) => ({
                    ...w,
                    isActive: w.id === worktreeId,
                    lastActive:
                      w.id === worktreeId
                        ? new Date().toISOString()
                        : w.lastActive,
                  })),
                }
              : p
          ),
        }));

        // Sync with appStore - only update projectPath (don't add new workspace)
        // Import dynamically to avoid circular dependency
        import("./appStore").then(({ useAppStore }) => {
          useAppStore.getState().setProjectPath(targetWorktree!.path);
        });
      },

      getActiveWorktree: () => {
        const project = get().getActiveProject();
        if (!project) return null;
        return project.worktrees.find((w) => w.id === project.activeWorktreeId) || null;
      },

      // =======================================================================
      // Port Management
      // =======================================================================

      allocatePorts: (_projectId: string, _worktreeId: string): PortAllocation => {
        const { getAllocatedPorts } = get();
        const allocated: PortAllocation = { dev: 0, api: 0, preview: 0 };

        for (const [portType, range] of Object.entries(PORT_RANGES)) {
          const usedPorts = getAllocatedPorts(portType as keyof PortAllocation);

          // Find first available port in range
          for (let port = range.start; port <= range.end; port++) {
            if (!usedPorts.has(port)) {
              allocated[portType as keyof PortAllocation] = port;
              break;
            }
          }
        }

        return allocated;
      },

      releasePorts: (projectId: string, worktreeId: string) => {
        // Ports are implicitly released when worktree is removed
        // This function is kept for explicit cleanup if needed
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  worktrees: p.worktrees.map((w) =>
                    w.id === worktreeId
                      ? { ...w, ports: { dev: 0, api: 0, preview: 0 } }
                      : w
                  ),
                }
              : p
          ),
        }));
      },

      getAllocatedPorts: (portType: keyof PortAllocation): Set<number> => {
        const { projects } = get();
        const used = new Set<number>();

        for (const project of projects) {
          for (const worktree of project.worktrees) {
            const port = worktree.ports[portType];
            if (port > 0) {
              used.add(port);
            }
          }
        }

        return used;
      },

      // =======================================================================
      // Internal Helpers
      // =======================================================================

      _discoverWorktrees: async (folderPath: string): Promise<Worktree[]> => {
        try {
          // Run: git worktree list --porcelain
          const output = await invoke<string>("run_git_command", {
            cwd: folderPath,
            args: ["worktree", "list", "--porcelain"],
          });

          const worktrees: Worktree[] = [];
          const blocks = output.split("\n\n").filter(Boolean);

          for (const block of blocks) {
            const lines = block.trim().split("\n");
            const worktreeLine = lines.find((l) => l.startsWith("worktree "));
            const branchLine = lines.find((l) => l.startsWith("branch "));

            if (worktreeLine) {
              const path = worktreeLine.replace("worktree ", "");
              const branch =
                branchLine?.replace("branch refs/heads/", "") || "HEAD";
              const id = generateWorktreeId(branch);

              worktrees.push({
                id,
                path,
                branch,
                ports: { dev: 0, api: 0, preview: 0 }, // Allocated later
                isActive: false,
                lastActive: new Date().toISOString(),
              });
            }
          }

          // If no worktrees found, add the folder itself as the main worktree
          if (worktrees.length === 0) {
            let branch = "main";
            try {
              const result = await invoke<string>("run_git_command", {
                cwd: folderPath,
                args: ["rev-parse", "--abbrev-ref", "HEAD"],
              });
              branch = result.trim();
            } catch {
              // Ignore - use "main" as fallback
            }

            worktrees.push({
              id: generateWorktreeId(branch),
              path: folderPath,
              branch,
              ports: { dev: 0, api: 0, preview: 0 },
              isActive: true,
              lastActive: new Date().toISOString(),
            });
          }

          return worktrees;
        } catch {
          // Not a git repo or git not available
          return [
            {
              id: "main",
              path: folderPath,
              branch: "main",
              ports: { dev: 0, api: 0, preview: 0 },
              isActive: true,
              lastActive: new Date().toISOString(),
            },
          ];
        }
      },

      _getGitRemote: async (folderPath: string): Promise<string | null> => {
        try {
          const result = await invoke<string>("run_git_command", {
            cwd: folderPath,
            args: ["config", "--get", "remote.origin.url"],
          });
          return result.trim() || null;
        } catch {
          return null;
        }
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
      }),
    }
  )
);

// =============================================================================
// Migration from Old Workspace Model
// =============================================================================

const MIGRATION_KEY = "sidstack-migration-v2";

/**
 * Check if migration from old workspace model is needed.
 */
export function needsMigration(): boolean {
  if (typeof window === "undefined") return false;
  const migrated = localStorage.getItem(MIGRATION_KEY);
  return migrated !== "done";
}

/**
 * Migrate from old openWorkspaces model to new project-based model.
 * This should be called once on app startup.
 */
export async function migrateFromOldWorkspaceModel(): Promise<void> {
  if (!needsMigration()) return;

  const oldStorageKey = "sidstack-agent-manager-storage";
  const oldStorage = localStorage.getItem(oldStorageKey);

  if (oldStorage) {
    try {
      const oldState = JSON.parse(oldStorage);
      const openWorkspaces = oldState.state?.openWorkspaces || [];

      if (openWorkspaces.length > 0) {
        console.log(`[ProjectStore] Migrating ${openWorkspaces.length} workspace(s) to project model...`);

        for (const workspacePath of openWorkspaces) {
          try {
            await useProjectStore.getState().openProject(workspacePath);
            console.log(`[ProjectStore] Migrated: ${workspacePath}`);
          } catch (e) {
            console.error(`[ProjectStore] Failed to migrate ${workspacePath}:`, e);
          }
        }
      }
    } catch (e) {
      console.error("[ProjectStore] Failed to parse old storage:", e);
    }
  }

  // Mark migration complete
  localStorage.setItem(MIGRATION_KEY, "done");
  console.log("[ProjectStore] Migration complete");
}

// =============================================================================
// Shared Context Initialization
// =============================================================================

/**
 * Initialize the shared context directory for a project.
 * Creates the directory structure and default files if they don't exist.
 */
async function initializeSharedContext(sharedPath: string): Promise<void> {
  try {
    // Create directory structure
    await invoke("create_folder", { path: `${sharedPath}/shared/knowledge` });

    // Initialize default files
    const files = [
      { path: `${sharedPath}/worktrees.json`, content: "[]" },
      { path: `${sharedPath}/ports.json`, content: "{}" },
      { path: `${sharedPath}/shared/governance.md`, content: "# Governance\n" },
    ];

    for (const file of files) {
      const exists = await invoke<boolean>("path_exists", { path: file.path });
      if (!exists) {
        await invoke("create_file", { path: file.path, content: file.content });
      }
    }
  } catch (error) {
    console.error("Failed to initialize shared context:", error);
  }
}
