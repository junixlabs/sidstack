import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { Workspace, Tab, FileTreeNode, FileDiff } from "@/types";

// =============================================================================
// Window/Project Isolation Utilities
// =============================================================================

/**
 * Get project path from URL parameter (for multi-window support).
 * Each window with a different project gets isolated localStorage.
 */
function getProjectFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const project = params.get("project");
  return project ? decodeURIComponent(project) : null;
}

/**
 * Create a short hash from a path for localStorage key.
 */
function hashPath(path: string): string {
  let hash = 0;
  for (let i = 0; i < path.length; i++) {
    const char = path.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

/**
 * Get the localStorage key for this window.
 * - Windows with ?project=... get isolated storage
 * - Main window (no project param) uses default storage
 */
function getStorageKey(): string {
  const urlProject = getProjectFromUrl();
  if (urlProject) {
    return `sidstack-window-${hashPath(urlProject)}`;
  }
  return "sidstack-agent-manager-storage";
}

// Global settings stored separately (shared across all windows)
const GLOBAL_STORAGE_KEY = "sidstack-global-settings";

// Initialize storage key once at module load
const WINDOW_STORAGE_KEY = getStorageKey();
const URL_PROJECT_PATH = getProjectFromUrl();

// Session constants
export const SESSION_TTL_HOURS = 24;

// Session info for a role's Claude session
export interface SessionInfo {
  sessionId: string;
  sessionName?: string;
  lastActive: string;
}

// Session metadata for restore capability
export interface SessionMetadata {
  savedAt: number; // timestamp
  closeReason: "normal" | "crash" | "unknown";
  version: string; // for migration handling
}

// Available views in the app (⌘1-5 navigation)
export type AppView = "default" | "dashboard" | "home" | "specs" | "tasks" | "agents" | "tickets";

interface AppState {
  // Project
  projectPath: string | null;
  setProjectPath: (path: string) => void;

  // Open workspaces (tabs in header)
  openWorkspaces: string[];
  addWorkspace: (path: string) => void;
  removeWorkspace: (path: string) => void;
  switchWorkspace: (path: string) => void;

  // Recent projects for quick switching (max 5)
  recentProjects: string[];
  addRecentProject: (path: string) => void;
  removeRecentProject: (path: string) => void;

  // Active view
  activeView: AppView;
  setActiveView: (view: AppView) => void;

  // Tabs
  tabs: Tab[];
  activeTabId: string | null;
  recentlyClosedTabs: Tab[];
  addTab: (tab: Tab) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  pinTab: (id: string) => void;
  unpinTab: (id: string) => void;
  closeAllTabs: () => void;
  closeTabsToLeft: (index: number) => void;
  closeTabsToRight: (index: number) => void;
  closeSavedTabs: () => void;
  reopenLastClosedTab: () => void;

  // Workspaces
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setActiveWorkspace: (workspace: Workspace | null) => void;

  // File tree
  fileTree: FileTreeNode | null;
  selectedFiles: string[];
  setFileTree: (tree: FileTreeNode | null) => void;
  toggleFileSelection: (path: string) => void;
  clearFileSelection: () => void;
  clearSelectedFiles: () => void;

  // Diff
  currentDiff: FileDiff[] | null;
  setCurrentDiff: (diff: FileDiff[] | null) => void;

  // View mode
  diffViewMode: "side-by-side" | "unified";
  setDiffViewMode: (mode: "side-by-side" | "unified") => void;

  // Theme
  theme: "dark" | "light";
  toggleTheme: () => void;

  // Sidebar
  sidebarOpen: boolean;
  toggleSidebar: () => void;


  // Session tracking for resume capability
  roleSessions: Record<string, SessionInfo>;
  setRoleSession: (role: string, sessionInfo: SessionInfo) => void;
  removeRoleSession: (role: string) => void;
  clearRoleSessions: () => void;

  // Session metadata for restore
  sessionMeta: SessionMetadata | null;
  setSessionMeta: (meta: SessionMetadata) => void;
  markSessionSaved: () => void;
  markSessionClosed: (reason: "normal" | "crash") => void;
  isSessionStale: () => boolean;
  getSessionAge: () => number | null; // returns hours
}

// =============================================================================
// Global Store (shared across all windows)
// =============================================================================

// Load/save global settings manually (recentProjects, theme)
function loadGlobalSettings(): { recentProjects: string[]; theme: "dark" | "light" } {
  try {
    const stored = localStorage.getItem(GLOBAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        recentProjects: parsed.recentProjects || [],
        theme: parsed.theme || "dark",
      };
    }
  } catch {
    // Ignore parse errors
  }
  return { recentProjects: [], theme: "dark" };
}

function saveGlobalSettings(settings: { recentProjects?: string[]; theme?: "dark" | "light" }) {
  try {
    const current = loadGlobalSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore save errors
  }
}


// =============================================================================
// App Store (window-specific state)
// =============================================================================

// Get initial values from global settings
const globalSettings = loadGlobalSettings();

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Project - initialize from URL param if available
      projectPath: URL_PROJECT_PATH,
      setProjectPath: (path) => {
        set({ projectPath: path });
        // Auto-add to recent projects (also save globally)
        if (path) {
          const { recentProjects } = get();
          const filtered = recentProjects.filter((p) => p !== path);
          const updated = [path, ...filtered].slice(0, 5);
          set({ recentProjects: updated });
          // Sync to global storage
          saveGlobalSettings({ recentProjects: updated });
        }
      },

      // Open workspaces (tabs in header)
      openWorkspaces: URL_PROJECT_PATH ? [URL_PROJECT_PATH] : [],
      addWorkspace: (path) =>
        set((state) => {
          // Don't add duplicate
          if (state.openWorkspaces.includes(path)) {
            return { projectPath: path }; // Just switch to it
          }
          const updated = [...state.openWorkspaces, path];
          // Also add to recent projects
          const recentFiltered = state.recentProjects.filter((p) => p !== path);
          const recentUpdated = [path, ...recentFiltered].slice(0, 5);
          saveGlobalSettings({ recentProjects: recentUpdated });
          return {
            openWorkspaces: updated,
            projectPath: path,
            recentProjects: recentUpdated,
          };
        }),
      removeWorkspace: (path) =>
        set((state) => {
          const updated = state.openWorkspaces.filter((p) => p !== path);
          // If closing active workspace, switch to last one or null
          const newProjectPath =
            state.projectPath === path
              ? updated.length > 0
                ? updated[updated.length - 1]
                : null
              : state.projectPath;
          return {
            openWorkspaces: updated,
            projectPath: newProjectPath,
          };
        }),
      switchWorkspace: (path) =>
        set((state) => {
          if (!state.openWorkspaces.includes(path)) {
            // Add if not in list
            return {
              openWorkspaces: [...state.openWorkspaces, path],
              projectPath: path,
            };
          }
          return { projectPath: path };
        }),

      // Recent projects (max 5, synced globally)
      recentProjects: globalSettings.recentProjects,
      addRecentProject: (path) =>
        set((state) => {
          const filtered = state.recentProjects.filter((p) => p !== path);
          const updated = [path, ...filtered].slice(0, 5);
          saveGlobalSettings({ recentProjects: updated });
          return { recentProjects: updated };
        }),
      removeRecentProject: (path) =>
        set((state) => {
          const updated = state.recentProjects.filter((p) => p !== path);
          saveGlobalSettings({ recentProjects: updated });
          return { recentProjects: updated };
        }),

      // Active view
      activeView: "default" as AppView,
      setActiveView: (view) => set({ activeView: view }),

      // Tabs
      tabs: [],
      activeTabId: null,
      recentlyClosedTabs: [],
      addTab: (tab) =>
        set((state) => {
          // Keep pinned tabs at the start
          const pinnedTabs = state.tabs.filter((t) => t.pinned && t.id !== tab.id);
          const unpinnedTabs = state.tabs.filter((t) => !t.pinned && t.id !== tab.id);
          return {
            tabs: [...pinnedTabs, ...unpinnedTabs, tab],
            activeTabId: tab.id,
          };
        }),
      removeTab: (id) =>
        set((state) => {
          const tabToClose = state.tabs.find((t) => t.id === id);
          // Don't close pinned tabs (unless explicitly unpinned first)
          if (tabToClose?.pinned) return state;

          const newTabs = state.tabs.filter((t) => t.id !== id);
          const newActiveId =
            state.activeTabId === id
              ? newTabs.length > 0
                ? newTabs[newTabs.length - 1].id
                : null
              : state.activeTabId;

          // Save to recently closed (max 10)
          const recentlyClosed = tabToClose
            ? [tabToClose, ...state.recentlyClosedTabs].slice(0, 10)
            : state.recentlyClosedTabs;

          return { tabs: newTabs, activeTabId: newActiveId, recentlyClosedTabs: recentlyClosed };
        }),
      setActiveTab: (id) => set({ activeTabId: id }),
      reorderTabs: (fromIndex, toIndex) =>
        set((state) => {
          const newTabs = [...state.tabs];
          const [removed] = newTabs.splice(fromIndex, 1);
          newTabs.splice(toIndex, 0, removed);
          return { tabs: newTabs };
        }),
      pinTab: (id) =>
        set((state) => {
          const tabIndex = state.tabs.findIndex((t) => t.id === id);
          if (tabIndex === -1) return state;

          const tab = { ...state.tabs[tabIndex], pinned: true };
          const otherTabs = state.tabs.filter((t) => t.id !== id);
          const pinnedTabs = otherTabs.filter((t) => t.pinned);
          const unpinnedTabs = otherTabs.filter((t) => !t.pinned);

          return { tabs: [...pinnedTabs, tab, ...unpinnedTabs] };
        }),
      unpinTab: (id) =>
        set((state) => {
          const newTabs = state.tabs.map((t) =>
            t.id === id ? { ...t, pinned: false } : t
          );
          return { tabs: newTabs };
        }),
      closeAllTabs: () =>
        set((state) => {
          const pinnedTabs = state.tabs.filter((t) => t.pinned);
          const closedTabs = state.tabs.filter((t) => !t.pinned);
          const recentlyClosed = [...closedTabs, ...state.recentlyClosedTabs].slice(0, 10);
          return {
            tabs: pinnedTabs,
            activeTabId: pinnedTabs.length > 0 ? pinnedTabs[0].id : null,
            recentlyClosedTabs: recentlyClosed,
          };
        }),
      closeTabsToLeft: (index) =>
        set((state) => {
          const leftTabs = state.tabs.slice(0, index).filter((t) => !t.pinned);
          const remainingTabs = [
            ...state.tabs.slice(0, index).filter((t) => t.pinned),
            ...state.tabs.slice(index),
          ];
          const recentlyClosed = [...leftTabs, ...state.recentlyClosedTabs].slice(0, 10);
          return { tabs: remainingTabs, recentlyClosedTabs: recentlyClosed };
        }),
      closeTabsToRight: (index) =>
        set((state) => {
          const rightTabs = state.tabs.slice(index + 1).filter((t) => !t.pinned);
          const remainingTabs = [
            ...state.tabs.slice(0, index + 1),
            ...state.tabs.slice(index + 1).filter((t) => t.pinned),
          ];
          const recentlyClosed = [...rightTabs, ...state.recentlyClosedTabs].slice(0, 10);
          return { tabs: remainingTabs, recentlyClosedTabs: recentlyClosed };
        }),
      closeSavedTabs: () =>
        set((state) => {
          // For now, close all unpinned tabs (we don't track unsaved state yet)
          const pinnedTabs = state.tabs.filter((t) => t.pinned);
          const closedTabs = state.tabs.filter((t) => !t.pinned);
          const recentlyClosed = [...closedTabs, ...state.recentlyClosedTabs].slice(0, 10);
          return {
            tabs: pinnedTabs,
            activeTabId: pinnedTabs.length > 0 ? pinnedTabs[0].id : null,
            recentlyClosedTabs: recentlyClosed,
          };
        }),
      reopenLastClosedTab: () =>
        set((state) => {
          if (state.recentlyClosedTabs.length === 0) return state;
          const [tabToReopen, ...remaining] = state.recentlyClosedTabs;
          return {
            tabs: [...state.tabs, tabToReopen],
            activeTabId: tabToReopen.id,
            recentlyClosedTabs: remaining,
          };
        }),

      // Workspaces
      workspaces: [],
      activeWorkspace: null,
      setWorkspaces: (workspaces) => set({ workspaces }),
      setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),

      // File tree
      fileTree: null,
      selectedFiles: [],
      setFileTree: (tree) => set({ fileTree: tree }),
      toggleFileSelection: (path) =>
        set((state) => ({
          selectedFiles: state.selectedFiles.includes(path)
            ? state.selectedFiles.filter((p) => p !== path)
            : [...state.selectedFiles, path],
        })),
      clearFileSelection: () => set({ selectedFiles: [] }),
      clearSelectedFiles: () => set({ selectedFiles: [] }),

      // Diff
      currentDiff: null,
      setCurrentDiff: (diff) => set({ currentDiff: diff }),

      // View mode
      diffViewMode: "side-by-side",
      setDiffViewMode: (mode) => set({ diffViewMode: mode }),

      // Theme (synced globally)
      theme: globalSettings.theme,
      toggleTheme: () =>
        set((state) => {
          const newTheme = state.theme === "dark" ? "light" : "dark";
          saveGlobalSettings({ theme: newTheme });
          return { theme: newTheme };
        }),

      // Sidebar
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      // Session tracking for resume capability
      roleSessions: {},
      setRoleSession: (role, sessionInfo) =>
        set((state) => ({
          roleSessions: { ...state.roleSessions, [role]: sessionInfo },
        })),
      removeRoleSession: (role) =>
        set((state) => {
          const { [role]: _, ...rest } = state.roleSessions;
          return { roleSessions: rest };
        }),
      clearRoleSessions: () => set({ roleSessions: {} }),

      // Session metadata for restore
      sessionMeta: null,
      setSessionMeta: (meta) => set({ sessionMeta: meta }),
      markSessionSaved: () =>
        set({
          sessionMeta: {
            savedAt: Date.now(),
            closeReason: "unknown",
            version: "1.0",
          },
        }),
      markSessionClosed: (reason) =>
        set((state) => ({
          sessionMeta: state.sessionMeta
            ? { ...state.sessionMeta, closeReason: reason, savedAt: Date.now() }
            : { savedAt: Date.now(), closeReason: reason, version: "1.0" },
        })),
      isSessionStale: (): boolean => {
        const { sessionMeta } = get();
        if (!sessionMeta) return false;
        const ageHours = (Date.now() - sessionMeta.savedAt) / (1000 * 60 * 60);
        return ageHours > SESSION_TTL_HOURS;
      },
      getSessionAge: (): number | null => {
        const { sessionMeta } = get();
        if (!sessionMeta) return null;
        return (Date.now() - sessionMeta.savedAt) / (1000 * 60 * 60);
      },
    }),
    {
      // Use window-specific storage key for project isolation
      // Windows with ?project=... param get isolated localStorage
      name: WINDOW_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Persist window-specific state only
      // Global settings (recentProjects, theme) are synced separately via saveGlobalSettings()
      partialize: (state) => ({
        projectPath: state.projectPath,
        openWorkspaces: state.openWorkspaces,
        sidebarOpen: state.sidebarOpen,
        diffViewMode: state.diffViewMode,
        // Session state (window-specific)
        activeView: state.activeView,
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        roleSessions: state.roleSessions,
        sessionMeta: state.sessionMeta,
      }),
    }
  )
);
