import { invoke } from "@tauri-apps/api/core";
import { homeDir, join } from "@tauri-apps/api/path";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { Project, Worktree, PortAllocation, PortRanges, AgentRole, AgentDeskStatus } from "@/types";

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

/**
 * Write .sidstack-local/session.json for an agent desk.
 * This bridges Desktop App state to the filesystem for CLI/MCP to read.
 */
async function writeDeskSession(
  worktreePath: string,
  session: Record<string, unknown>
): Promise<void> {
  const localDir = await join(worktreePath, ".sidstack-local");
  const sessionFile = await join(localDir, "session.json");

  // Ensure .sidstack-local/ directory exists
  const dirExists = await invoke<boolean>("path_exists", { path: localDir }).catch(() => false);
  if (!dirExists) {
    await invoke("create_folder", { path: localDir });
  }

  await invoke("create_file", {
    path: sessionFile,
    content: JSON.stringify(session, null, 2),
  });
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
  addWorktree: (projectId: string, worktreePath: string, purpose?: string) => Promise<void>;
  removeWorktree: (projectId: string, worktreeId: string) => void;
  removeWorktreeFromDisk: (projectId: string, worktreeId: string) => Promise<void>;
  switchWorktree: (worktreeId: string) => void;
  getActiveWorktree: () => Worktree | null;

  // Port management (allocates globally to avoid cross-project conflicts)
  allocatePorts: () => PortAllocation;
  releasePorts: (projectId: string, worktreeId: string) => void;
  getAllocatedPorts: (portType: keyof PortAllocation) => Set<number>;

  // Agent Desk actions
  createAgentDesk: (projectId: string, worktreePath: string, branch: string, role: AgentRole, name?: string) => void;
  updateDeskStatus: (worktreeId: string, status: AgentDeskStatus, taskId?: string, taskTitle?: string) => void;
  renameDeskAgent: (worktreeId: string, name: string) => void;
  getNextAgentName: (role: AgentRole) => string;
  getAgentDesks: () => Worktree[];
  acquireDesk: (worktreeId: string, taskId: string, taskTitle: string, branchName: string) => Promise<void>;
  releaseDesk: (worktreeId: string, options?: { force?: boolean; deleteBranch?: boolean }) => Promise<void>;

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

        // 0. Resolve workspace root (handles both Mode A and Mode B)
        let resolvedRoot = folderPath;
        let resolvedSharedContextPath: string | null = null;
        try {
          const wsInfo = await invoke<{
            workspace_root: string;
            project_root: string;
            is_workspace_structure: boolean;
            is_worktree: boolean;
          } | null>("resolve_workspace_root", { cwd: folderPath });

          if (wsInfo) {
            // Use workspace root for project identity and .sidstack/ resolution
            resolvedRoot = wsInfo.workspace_root;
            resolvedSharedContextPath = await join(wsInfo.workspace_root, ".sidstack");
          }
        } catch {
          // resolve_workspace_root not available, fall back to default behavior
        }

        // 1. Get git remote (or use folder path as fallback)
        const gitRemote = await _getGitRemote(resolvedRoot);
        const projectId = hashString(gitRemote || resolvedRoot);

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
        const worktrees = await _discoverWorktrees(resolvedRoot);

        // 4. Allocate ports for each worktree
        const worktreesWithPorts = worktrees.map((w) => ({
          ...w,
          ports: allocatePorts(),
        }));

        // 5. Try to read project name from .sidstack/config.json
        let projectName = extractProjectName(gitRemote || resolvedRoot);
        try {
          const configPath = await join(resolvedRoot, ".sidstack", "config.json");
          const configContent = await readTextFile(configPath);
          const config = JSON.parse(configContent);
          if (config.projectName) {
            projectName = config.projectName;
          }
        } catch {
          // No config.json or invalid — use fallback name
        }

        // 6. Create new project
        const sharedContextPath = resolvedSharedContextPath || await getSharedContextPath(projectId);
        const project: Project = {
          id: projectId,
          name: projectName,
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

      addWorktree: async (projectId: string, worktreePath: string, purpose?: string) => {
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
        const ports = allocatePorts();

        const newWorktree: Worktree = {
          id: worktreeId,
          path: worktreePath,
          branch,
          purpose,
          ports,
          isActive: false,
          lastActive: new Date().toISOString(),
          agentRole: "worker",
          agentName: branch,
          agentStatus: "idle",
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

      removeWorktreeFromDisk: async (projectId: string, worktreeId: string) => {
        const { projects, removeWorktree } = get();
        const project = projects.find((p) => p.id === projectId);
        const worktree = project?.worktrees.find((w) => w.id === worktreeId);
        if (!worktree || !project) return;

        // Find the reference worktree (main/master) as cwd for the git command
        const mainWorktree =
          project.worktrees.find((w) => w.branch === "main" || w.branch === "master") ||
          project.worktrees.find((w) => w.id !== worktreeId);
        if (!mainWorktree) return;

        try {
          await invoke<string>("run_git_command", {
            cwd: mainWorktree.path,
            args: ["worktree", "remove", worktree.path],
          });
        } catch (error) {
          // Try force remove if regular remove fails
          await invoke<string>("run_git_command", {
            cwd: mainWorktree.path,
            args: ["worktree", "remove", "--force", worktree.path],
          });
        }

        // Remove from SidStack state
        removeWorktree(projectId, worktreeId);
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

      // Allocates globally across all projects to avoid port conflicts
      allocatePorts: (): PortAllocation => {
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
      // Agent Desk Actions
      // =======================================================================

      createAgentDesk: (projectId: string, worktreePath: string, branch: string, role: AgentRole, name?: string) => {
        const { allocatePorts, getNextAgentName } = get();
        const agentName = name || getNextAgentName(role);
        const worktreeId = generateWorktreeId(branch);
        const ports = allocatePorts();

        const newWorktree: Worktree = {
          id: worktreeId,
          path: worktreePath,
          branch,
          ports,
          isActive: false,
          lastActive: new Date().toISOString(),
          agentRole: role,
          agentName,
          agentStatus: "idle",
        };

        // Synchronous state update — saves to localStorage immediately
        // before Vite file watcher can trigger a page reload
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, worktrees: [...p.worktrees, newWorktree] }
              : p
          ),
        }));

        // Write .sidstack-local/session.json to filesystem (non-blocking)
        writeDeskSession(worktreePath, {
          status: "idle",
          branch,
          agentRole: role,
          agentName,
          lastActivity: new Date().toISOString(),
          currentTaskId: null,
          ports,
        }).catch(console.error);
      },

      updateDeskStatus: (worktreeId: string, status: AgentDeskStatus, taskId?: string, taskTitle?: string) => {
        set((state) => ({
          projects: state.projects.map((p) => ({
            ...p,
            worktrees: p.worktrees.map((w) =>
              w.id === worktreeId
                ? {
                    ...w,
                    agentStatus: status,
                    currentTaskId: taskId ?? (status === "idle" ? undefined : w.currentTaskId),
                    currentTaskTitle: taskTitle ?? (status === "idle" ? undefined : w.currentTaskTitle),
                  }
                : w
            ),
          })),
        }));

        // Sync to .sidstack-local/session.json (non-blocking)
        const project = get().getActiveProject();
        const worktree = project?.worktrees.find((w) => w.id === worktreeId);
        if (worktree) {
          writeDeskSession(worktree.path, {
            status,
            branch: worktree.branch,
            agentRole: worktree.agentRole || "worker",
            agentName: worktree.agentName,
            lastActivity: new Date().toISOString(),
            currentTaskId: taskId ?? (status === "idle" ? null : worktree.currentTaskId ?? null),
            ports: worktree.ports,
          }).catch(console.error);
        }
      },

      renameDeskAgent: (worktreeId: string, name: string) => {
        set((state) => ({
          projects: state.projects.map((p) => ({
            ...p,
            worktrees: p.worktrees.map((w) =>
              w.id === worktreeId ? { ...w, agentName: name } : w
            ),
          })),
        }));
      },

      getNextAgentName: (role: AgentRole): string => {
        const project = get().getActiveProject();
        if (!project) return role === "worker" ? "Worker 1" : "Reviewer 1";

        const prefix = role === "worker" ? "Worker" : "Reviewer";
        const existing = project.worktrees
          .filter((w) => w.agentRole === role && w.agentName?.startsWith(prefix))
          .map((w) => {
            const num = parseInt(w.agentName?.replace(`${prefix} `, "") || "0");
            return isNaN(num) ? 0 : num;
          });

        const maxNum = existing.length > 0 ? Math.max(...existing) : 0;
        return `${prefix} ${maxNum + 1}`;
      },

      getAgentDesks: (): Worktree[] => {
        const project = get().getActiveProject();
        if (!project) return [];
        return project.worktrees;
      },

      acquireDesk: async (worktreeId: string, taskId: string, taskTitle: string, branchName: string) => {
        // Find the worktree
        const state = get();
        let worktree: Worktree | undefined;
        for (const project of state.projects) {
          const wt = project.worktrees.find((w) => w.id === worktreeId);
          if (wt) { worktree = wt; break; }
        }
        if (!worktree) throw new Error("Desk not found");

        // Git: ensure on main, pull latest, create feature branch
        const currentBranch = (await invoke<string>("run_git_command", {
          cwd: worktree.path, args: ["rev-parse", "--abbrev-ref", "HEAD"],
        })).trim();

        if (currentBranch !== "main") {
          await invoke("run_git_command", { cwd: worktree.path, args: ["checkout", "main"] });
        }
        try {
          await invoke("run_git_command", { cwd: worktree.path, args: ["pull", "origin", "main"] });
        } catch { /* no remote */ }

        await invoke("run_git_command", { cwd: worktree.path, args: ["checkout", "-b", branchName] });

        // Update store state
        set((s) => ({
          projects: s.projects.map((p) => ({
            ...p,
            worktrees: p.worktrees.map((w) =>
              w.id === worktreeId
                ? { ...w, agentStatus: "working" as AgentDeskStatus, currentTaskId: taskId, currentTaskTitle: taskTitle, branch: branchName }
                : w
            ),
          })),
        }));

        // Sync session.json
        await writeDeskSession(worktree.path, {
          status: "working",
          branch: branchName,
          agentRole: worktree.agentRole || "worker",
          agentName: worktree.agentName,
          lastActivity: new Date().toISOString(),
          currentTaskId: taskId,
          ports: worktree.ports,
        });
      },

      releaseDesk: async (worktreeId: string, options?: { force?: boolean; deleteBranch?: boolean }) => {
        const state = get();
        let worktree: Worktree | undefined;
        for (const project of state.projects) {
          const wt = project.worktrees.find((w) => w.id === worktreeId);
          if (wt) { worktree = wt; break; }
        }
        if (!worktree) throw new Error("Desk not found");

        const previousBranch = worktree.branch;

        // Discard changes if force
        if (options?.force) {
          try { await invoke("run_git_command", { cwd: worktree.path, args: ["checkout", "--", "."] }); } catch { /* ignore */ }
          try { await invoke("run_git_command", { cwd: worktree.path, args: ["clean", "-fd"] }); } catch { /* ignore */ }
        }

        // Switch to main
        await invoke("run_git_command", { cwd: worktree.path, args: ["checkout", "main"] });
        try {
          await invoke("run_git_command", { cwd: worktree.path, args: ["pull", "origin", "main"] });
        } catch { /* no remote */ }

        // Delete feature branch
        if (options?.deleteBranch !== false && previousBranch && previousBranch !== "main") {
          try { await invoke("run_git_command", { cwd: worktree.path, args: ["branch", "-D", previousBranch] }); } catch { /* ignore */ }
        }

        // Update store state
        set((s) => ({
          projects: s.projects.map((p) => ({
            ...p,
            worktrees: p.worktrees.map((w) =>
              w.id === worktreeId
                ? { ...w, agentStatus: "idle" as AgentDeskStatus, currentTaskId: undefined, currentTaskTitle: undefined, branch: "main" }
                : w
            ),
          })),
        }));

        // Sync session.json
        await writeDeskSession(worktree.path, {
          status: "idle",
          branch: "main",
          agentRole: worktree.agentRole || "worker",
          agentName: worktree.agentName,
          lastActivity: new Date().toISOString(),
          currentTaskId: null,
          ports: worktree.ports,
        });
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
                agentRole: "worker",
                agentName: branch,
                agentStatus: "idle",
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
              agentRole: "worker",
              agentName: branch,
              agentStatus: "idle",
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
              agentRole: "worker",
              agentName: "main",
              agentStatus: "idle",
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
      version: 1,
      migrate: (persistedState: unknown) => {
        // Auto-convert legacy worktrees (no agentRole) to worker agents
        const state = persistedState as { projects: Project[]; activeProjectId: string | null };
        if (state?.projects) {
          state.projects = state.projects.map((p) => ({
            ...p,
            worktrees: p.worktrees.map((w) =>
              w.agentRole !== undefined
                ? w
                : { ...w, agentRole: "worker" as AgentRole, agentName: w.branch || w.id, agentStatus: "idle" as AgentDeskStatus }
            ),
          }));
        }
        return state;
      },
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
