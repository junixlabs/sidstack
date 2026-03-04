import { invoke } from "@tauri-apps/api/core";
import { homeDir, join } from "@tauri-apps/api/path";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { Project, Worktree, PortAllocation, AgentDeskStatus } from "@/types";

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = "sidstack-projects";

/** Desk v2 port formula: PORT_BASES[key] + (deskIndex * STRIDE) */
const PORT_BASES: Record<keyof PortAllocation, number> = {
  api: 3100,
  mcp: 3200,
  web: 3300,
  dev: 5100,
};
const PORT_STRIDE = 100;

// =============================================================================
// Utility Functions
// =============================================================================

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

function extractProjectName(remoteOrPath: string): string {
  const gitMatch = remoteOrPath.match(/[/:]([^/:]+?)(\.git)?$/);
  if (gitMatch) return gitMatch[1];
  const parts = remoteOrPath.split("/").filter(Boolean);
  return parts[parts.length - 1] || "unknown";
}

async function getSharedContextPath(projectId: string): Promise<string> {
  const home = await homeDir();
  return await join(home, ".sidstack", "projects", projectId);
}

/**
 * Extract numeric index from desk name for port calculation.
 * "desk-1" → 1, "desk-review" → hash-based fallback (50-99).
 */
function extractDeskIndex(name: string): number {
  const match = name.match(/(\d+)$/);
  if (match) return parseInt(match[1], 10);
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash = hash & hash;
  }
  return 50 + (Math.abs(hash) % 50);
}

function calculatePorts(index: number): PortAllocation {
  const offset = index * PORT_STRIDE;
  return {
    api: PORT_BASES.api + offset,
    mcp: PORT_BASES.mcp + offset,
    web: PORT_BASES.web + offset,
    dev: PORT_BASES.dev + offset,
  };
}

/**
 * Compute desk status from branch name.
 * On main/master or agent/* = idle, everything else = working.
 */
function computeStatus(branch: string): AgentDeskStatus {
  if (branch === "main" || branch === "master" || branch.startsWith("agent/")) {
    return "idle";
  }
  return "working";
}

/**
 * Write .sidstack-local/session.json for desk v2.
 */
async function writeDeskSession(
  worktreePath: string,
  session: Record<string, unknown>
): Promise<void> {
  const localDir = await join(worktreePath, ".sidstack-local");
  const sessionFile = await join(localDir, "session.json");

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
  addWorktree: (projectId: string, worktreePath: string) => Promise<void>;
  removeWorktree: (projectId: string, worktreeId: string) => void;
  switchWorktree: (worktreeId: string) => void;
  getActiveWorktree: () => Worktree | null;

  // Desk v2 actions
  createDesk: (name: string, opts?: { baseBranch?: string; bootstrap?: string }) => Promise<void>;
  checkoutDesk: (deskId: string, branch: string) => Promise<void>;
  checkoutCreateDesk: (deskId: string, newBranch: string, base?: string) => Promise<void>;
  removeDesk: (deskId: string, opts?: { force?: boolean }) => Promise<void>;
  refreshDesks: () => Promise<void>;
  getDesks: () => Worktree[];

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
        const { projects, _getGitRemote, _discoverWorktrees } = get();

        // 0. Resolve workspace root
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
            resolvedRoot = wsInfo.workspace_root;
            resolvedSharedContextPath = await join(wsInfo.workspace_root, ".sidstack");
          }
        } catch {
          // fallback
        }

        // 1. Get git remote
        const gitRemote = await _getGitRemote(resolvedRoot);
        const projectId = hashString(gitRemote || resolvedRoot);

        // 2. Check if project already exists
        const existing = projects.find((p) => p.id === projectId);
        if (existing) {
          const hasWorktree = existing.worktrees.some((w) => w.path === folderPath);
          if (!hasWorktree) {
            await get().addWorktree(projectId, folderPath);
          }
          set({ activeProjectId: projectId });
          return;
        }

        // 3. Discover existing worktrees
        const worktrees = await _discoverWorktrees(resolvedRoot);

        // 4. Try to read project name from .sidstack/config.json
        let projectName = extractProjectName(gitRemote || resolvedRoot);
        try {
          const configPath = await join(resolvedRoot, ".sidstack", "config.json");
          const configContent = await readTextFile(configPath);
          const config = JSON.parse(configContent);
          if (config.projectName) projectName = config.projectName;
        } catch {
          // fallback
        }

        // 5. Create new project
        const sharedContextPath = resolvedSharedContextPath || await getSharedContextPath(projectId);
        const project: Project = {
          id: projectId,
          name: projectName,
          gitRemote: gitRemote || "",
          worktrees,
          activeWorktreeId: worktrees[0]?.id || "main",
          sharedContextPath,
        };

        set((state) => ({
          projects: [...state.projects, project],
          activeProjectId: projectId,
        }));

        initializeSharedContext(sharedContextPath).catch(console.error);
      },

      closeProject: (projectId: string) => {
        set((state) => {
          const updated = state.projects.filter((p) => p.id !== projectId);
          const newActiveId =
            state.activeProjectId === projectId
              ? updated.length > 0 ? updated[updated.length - 1].id : null
              : state.activeProjectId;
          return { projects: updated, activeProjectId: newActiveId };
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
        let branch = "unknown";
        try {
          const result = await invoke<string>("run_git_command", {
            cwd: worktreePath,
            args: ["rev-parse", "--abbrev-ref", "HEAD"],
          });
          branch = result.trim();
        } catch {
          branch = worktreePath.split("/").pop() || "unknown";
        }

        const name = worktreePath.split("/").pop() || branch;
        const index = extractDeskIndex(name);
        const ports = calculatePorts(index);

        const newWorktree: Worktree = {
          id: name,
          path: worktreePath,
          branch,
          ports,
          isActive: false,
          lastActive: new Date().toISOString(),
          agentStatus: computeStatus(branch),
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
            const newActiveId =
              p.activeWorktreeId === worktreeId
                ? updated[0]?.id || ""
                : p.activeWorktreeId;
            return { ...p, worktrees: updated, activeWorktreeId: newActiveId };
          }),
        }));
      },

      switchWorktree: (worktreeId: string) => {
        const state = get();
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
                    lastActive: w.id === worktreeId ? new Date().toISOString() : w.lastActive,
                  })),
                }
              : p
          ),
        }));

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
      // Desk v2 Actions
      // =======================================================================

      createDesk: async (name: string, opts?: { baseBranch?: string; bootstrap?: string }) => {
        const project = get().getActiveProject();
        if (!project) throw new Error("No active project");

        // Find workspace root (main worktree path)
        const mainWt = project.worktrees.find((w) => w.branch === "main" || w.branch === "master") || project.worktrees[0];
        if (!mainWt) throw new Error("No worktree found");

        // Resolve workspace root
        let workspaceRoot = mainWt.path;
        try {
          const wsInfo = await invoke<{ workspace_root: string } | null>("resolve_workspace_root", { cwd: mainWt.path });
          if (wsInfo) workspaceRoot = wsInfo.workspace_root;
        } catch { /* fallback */ }

        const baseBranch = opts?.baseBranch || "main";
        const deskPath = `${workspaceRoot}/.desks/${name}`;
        const tempBranch = `agent/${name}`;

        // Ensure .desks/ directory exists
        const desksDir = `${workspaceRoot}/.desks`;
        const dirExists = await invoke<boolean>("path_exists", { path: desksDir }).catch(() => false);
        if (!dirExists) {
          await invoke("create_folder", { path: desksDir });
        }

        // git worktree add
        await invoke<string>("run_git_command", {
          cwd: workspaceRoot,
          args: ["worktree", "add", "-b", tempBranch, deskPath, baseBranch],
        });

        // Calculate ports
        const index = extractDeskIndex(name);
        const ports = calculatePorts(index);

        // Create .sidstack-local/session.json
        await writeDeskSession(deskPath, {
          name,
          status: "idle",
          branch: baseBranch,
          ports,
          lastActivity: new Date().toISOString(),
        });

        // Write .env
        const envContent = `# Auto-generated by SidStack Agent Desk\nSIDSTACK_API_PORT=${ports.api}\nSIDSTACK_MCP_PORT=${ports.mcp}\nSIDSTACK_WEB_PORT=${ports.web}\nSIDSTACK_DEV_PORT=${ports.dev}\n`;
        await invoke("create_file", { path: `${deskPath}/.env`, content: envContent });

        // Register in store
        const newWorktree: Worktree = {
          id: name,
          path: deskPath,
          branch: tempBranch,
          ports,
          isActive: false,
          lastActive: new Date().toISOString(),
          agentStatus: "idle",
        };

        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === project.id
              ? { ...p, worktrees: [...p.worktrees, newWorktree] }
              : p
          ),
        }));

        // Run bootstrap (non-blocking)
        if (opts?.bootstrap) {
          const [cmd, ...args] = opts.bootstrap.trim().split(/\s+/);
          invoke("run_shell_command", { command: cmd, args, cwd: deskPath }).catch(() => {});
        }
      },

      checkoutDesk: async (deskId: string, branch: string) => {
        const state = get();
        let worktree: Worktree | undefined;
        let projectId: string | undefined;
        for (const p of state.projects) {
          const wt = p.worktrees.find((w) => w.id === deskId);
          if (wt) { worktree = wt; projectId = p.id; break; }
        }
        if (!worktree || !projectId) throw new Error("Desk not found");

        await invoke<string>("run_git_command", {
          cwd: worktree.path,
          args: ["checkout", branch],
        });

        const newStatus = computeStatus(branch);

        set((s) => ({
          projects: s.projects.map((p) => ({
            ...p,
            worktrees: p.worktrees.map((w) =>
              w.id === deskId ? { ...w, branch, agentStatus: newStatus, lastActive: new Date().toISOString() } : w
            ),
          })),
        }));

        writeDeskSession(worktree.path, {
          name: worktree.id,
          status: newStatus,
          branch,
          ports: worktree.ports,
          lastActivity: new Date().toISOString(),
        }).catch(console.error);
      },

      checkoutCreateDesk: async (deskId: string, newBranch: string, base?: string) => {
        const state = get();
        let worktree: Worktree | undefined;
        for (const p of state.projects) {
          const wt = p.worktrees.find((w) => w.id === deskId);
          if (wt) { worktree = wt; break; }
        }
        if (!worktree) throw new Error("Desk not found");

        const args = base
          ? ["checkout", "-b", newBranch, base]
          : ["checkout", "-b", newBranch];

        await invoke<string>("run_git_command", {
          cwd: worktree.path,
          args,
        });

        set((s) => ({
          projects: s.projects.map((p) => ({
            ...p,
            worktrees: p.worktrees.map((w) =>
              w.id === deskId ? { ...w, branch: newBranch, agentStatus: "working" as AgentDeskStatus, lastActive: new Date().toISOString() } : w
            ),
          })),
        }));

        writeDeskSession(worktree.path, {
          name: worktree.id,
          status: "working",
          branch: newBranch,
          ports: worktree.ports,
          lastActivity: new Date().toISOString(),
        }).catch(console.error);
      },

      removeDesk: async (deskId: string, opts?: { force?: boolean }) => {
        const state = get();
        let worktree: Worktree | undefined;
        let projectId: string | undefined;
        let mainWtPath: string | undefined;
        for (const p of state.projects) {
          const wt = p.worktrees.find((w) => w.id === deskId);
          if (wt) {
            worktree = wt;
            projectId = p.id;
            mainWtPath = p.worktrees.find((w) => w.id !== deskId)?.path || p.worktrees[0]?.path;
            break;
          }
        }
        if (!worktree || !projectId || !mainWtPath) throw new Error("Desk not found");

        // Resolve workspace root for git worktree remove
        let cwd = mainWtPath;
        try {
          const wsInfo = await invoke<{ workspace_root: string } | null>("resolve_workspace_root", { cwd: mainWtPath });
          if (wsInfo) cwd = wsInfo.workspace_root;
        } catch { /* fallback */ }

        const forceFlag = opts?.force ? "--force" : "";
        try {
          await invoke<string>("run_git_command", {
            cwd,
            args: ["worktree", "remove", ...(forceFlag ? [forceFlag] : []), worktree.path],
          });
        } catch {
          if (opts?.force) {
            // Fallback: prune
            await invoke<string>("run_git_command", { cwd, args: ["worktree", "prune"] });
          } else {
            throw new Error("Desk has uncommitted changes. Use force to override.");
          }
        }

        // Remove from store
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p;
            const updated = p.worktrees.filter((w) => w.id !== deskId);
            return { ...p, worktrees: updated };
          }),
        }));
      },

      refreshDesks: async () => {
        const project = get().getActiveProject();
        if (!project) return;

        // Re-read git status for each desk
        for (const wt of project.worktrees) {
          try {
            const branchResult = await invoke<string>("run_git_command", {
              cwd: wt.path,
              args: ["rev-parse", "--abbrev-ref", "HEAD"],
            });
            const branch = branchResult.trim();
            const status = computeStatus(branch);

            set((s) => ({
              projects: s.projects.map((p) => ({
                ...p,
                worktrees: p.worktrees.map((w) =>
                  w.id === wt.id ? { ...w, branch, agentStatus: status } : w
                ),
              })),
            }));
          } catch {
            // Desk may be removed
          }
        }
      },

      getDesks: (): Worktree[] => {
        const project = get().getActiveProject();
        if (!project) return [];
        return project.worktrees;
      },

      // =======================================================================
      // Internal Helpers
      // =======================================================================

      _discoverWorktrees: async (folderPath: string): Promise<Worktree[]> => {
        try {
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
              const branch = branchLine?.replace("branch refs/heads/", "") || "HEAD";
              const name = path.split("/").pop() || branch;
              const index = extractDeskIndex(name);

              worktrees.push({
                id: name,
                path,
                branch,
                ports: calculatePorts(index),
                isActive: false,
                lastActive: new Date().toISOString(),
                agentStatus: computeStatus(branch),
              });
            }
          }

          if (worktrees.length === 0) {
            let branch = "main";
            try {
              const result = await invoke<string>("run_git_command", {
                cwd: folderPath,
                args: ["rev-parse", "--abbrev-ref", "HEAD"],
              });
              branch = result.trim();
            } catch { /* fallback */ }

            const name = folderPath.split("/").pop() || "main";
            worktrees.push({
              id: name,
              path: folderPath,
              branch,
              ports: calculatePorts(0),
              isActive: true,
              lastActive: new Date().toISOString(),
              agentStatus: computeStatus(branch),
            });
          }

          return worktrees;
        } catch {
          const name = folderPath.split("/").pop() || "main";
          return [{
            id: name,
            path: folderPath,
            branch: "main",
            ports: calculatePorts(0),
            isActive: true,
            lastActive: new Date().toISOString(),
            agentStatus: "idle",
          }];
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
      version: 2,
      migrate: (persistedState: unknown, _version: number) => {
        const state = persistedState as { projects: Project[]; activeProjectId: string | null };
        if (state?.projects) {
          // Migrate v1 worktrees to v2 format
          state.projects = state.projects.map((p) => ({
            ...p,
            worktrees: p.worktrees.map((w: any) => ({
              id: w.id,
              path: w.path,
              branch: w.branch || "main",
              ports: w.ports?.mcp !== undefined ? w.ports : { api: 0, mcp: 0, web: 0, dev: w.ports?.dev || 0 },
              isActive: w.isActive || false,
              lastActive: w.lastActive || new Date().toISOString(),
              agentStatus: computeStatus(w.branch || "main"),
            })),
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

export function needsMigration(): boolean {
  if (typeof window === "undefined") return false;
  const migrated = localStorage.getItem(MIGRATION_KEY);
  return migrated !== "done";
}

export async function migrateFromOldWorkspaceModel(): Promise<void> {
  if (!needsMigration()) return;

  const oldStorageKey = "sidstack-agent-manager-storage";
  const oldStorage = localStorage.getItem(oldStorageKey);

  if (oldStorage) {
    try {
      const oldState = JSON.parse(oldStorage);
      const openWorkspaces = oldState.state?.openWorkspaces || [];

      if (openWorkspaces.length > 0) {
        for (const workspacePath of openWorkspaces) {
          try {
            await useProjectStore.getState().openProject(workspacePath);
          } catch (e) {
            console.error(`[ProjectStore] Failed to migrate ${workspacePath}:`, e);
          }
        }
      }
    } catch (e) {
      console.error("[ProjectStore] Failed to parse old storage:", e);
    }
  }

  localStorage.setItem(MIGRATION_KEY, "done");
}

// =============================================================================
// Shared Context Initialization
// =============================================================================

async function initializeSharedContext(sharedPath: string): Promise<void> {
  try {
    await invoke("create_folder", { path: `${sharedPath}/shared/knowledge` });
    const files = [
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
