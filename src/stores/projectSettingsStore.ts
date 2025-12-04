/**
 * Project Settings Store
 *
 * Zustand store for managing project-level settings.
 * Settings are loaded from the API and cached locally.
 */

import { create } from 'zustand';

import type {
  ProjectSettings,
  SessionSettings,
  SyncSettings,
  AgentSettings,
  TicketSettings,
} from '@sidstack/shared';

const API_BASE = 'http://localhost:19432/api/projects';

// Default settings (duplicated here to avoid import issues)
const DEFAULT_SETTINGS: ProjectSettings = {
  version: 1,
  session: {
    windowMode: 'always-new',
    defaultTerminal: 'iTerm',
    defaultMode: 'normal',
  },
  sync: {
    autoSyncEnabled: true,
    syncIntervalSeconds: 30,
    syncOnWindowFocus: true,
    autoRefreshEnabled: true,
    autoRefreshIntervalSeconds: 15,
  },
  agent: {
    defaultRole: 'dev',
    maxConcurrentAgents: 5,
    autoRecoveryEnabled: true,
  },
  ticket: {
    source: 'self-hosted',
    webhookEnabled: false,
    tunnelEnabled: false,
    cloud: {
      connected: false,
      status: 'disconnected',
    },
  },
};

interface ProjectSettingsStore {
  // Current project path
  currentProjectPath: string | null;

  // Settings
  settings: ProjectSettings;
  isLoading: boolean;
  error: string | null;
  isDirty: boolean;

  // Actions
  loadSettings: (projectPath: string) => Promise<void>;
  saveSettings: () => Promise<boolean>;
  updateSessionSettings: (updates: Partial<SessionSettings>) => void;
  updateSyncSettings: (updates: Partial<SyncSettings>) => void;
  updateAgentSettings: (updates: Partial<AgentSettings>) => void;
  updateTicketSettings: (updates: Partial<TicketSettings>) => void;
  resetToDefaults: () => Promise<void>;
  clearError: () => void;

  // Helpers
  getSessionDefault: <K extends keyof SessionSettings>(key: K) => SessionSettings[K];
  getSyncSetting: <K extends keyof SyncSettings>(key: K) => SyncSettings[K];
  getAgentSetting: <K extends keyof AgentSettings>(key: K) => AgentSettings[K];
  getTicketSetting: <K extends keyof TicketSettings>(key: K) => TicketSettings[K];
}

export const useProjectSettingsStore = create<ProjectSettingsStore>((set, get) => ({
  // Initial state
  currentProjectPath: null,
  settings: DEFAULT_SETTINGS,
  isLoading: false,
  error: null,
  isDirty: false,

  // Load settings from API
  loadSettings: async (projectPath: string) => {
    // Skip if already loading same project
    if (get().currentProjectPath === projectPath && !get().isDirty) {
      return;
    }

    set({ isLoading: true, error: null, currentProjectPath: projectPath });

    try {
      const res = await fetch(
        `${API_BASE}/settings?path=${encodeURIComponent(projectPath)}`
      );
      const data = await res.json();

      if (data.success) {
        set({ settings: data.settings, isLoading: false, isDirty: false });
      } else {
        set({ error: data.error, isLoading: false });
      }
    } catch (err) {
      console.error('[projectSettings] Load error:', err);
      set({ error: 'Failed to load settings', isLoading: false });
    }
  },

  // Save settings to API
  saveSettings: async () => {
    const { currentProjectPath, settings } = get();

    if (!currentProjectPath) {
      set({ error: 'No project selected' });
      return false;
    }

    set({ isLoading: true, error: null });

    try {
      const res = await fetch(
        `${API_BASE}/settings?path=${encodeURIComponent(currentProjectPath)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings),
        }
      );
      const data = await res.json();

      if (data.success) {
        set({ settings: data.settings, isLoading: false, isDirty: false });
        return true;
      } else {
        set({ error: data.error || 'Failed to save', isLoading: false });
        return false;
      }
    } catch (err) {
      console.error('[projectSettings] Save error:', err);
      set({ error: 'Failed to save settings', isLoading: false });
      return false;
    }
  },

  // Update session settings (local, mark dirty)
  updateSessionSettings: (updates: Partial<SessionSettings>) => {
    set((state) => ({
      settings: {
        ...state.settings,
        session: { ...state.settings.session, ...updates },
      },
      isDirty: true,
    }));
  },

  // Update sync settings (local, mark dirty)
  updateSyncSettings: (updates: Partial<SyncSettings>) => {
    set((state) => ({
      settings: {
        ...state.settings,
        sync: { ...state.settings.sync, ...updates },
      },
      isDirty: true,
    }));
  },

  // Update agent settings (local, mark dirty)
  updateAgentSettings: (updates: Partial<AgentSettings>) => {
    set((state) => ({
      settings: {
        ...state.settings,
        agent: { ...state.settings.agent, ...updates },
      },
      isDirty: true,
    }));
  },

  // Update ticket settings (local, mark dirty)
  updateTicketSettings: (updates: Partial<TicketSettings>) => {
    set((state) => ({
      settings: {
        ...state.settings,
        ticket: { ...state.settings.ticket!, ...updates },
      },
      isDirty: true,
    }));
  },

  // Reset to defaults
  resetToDefaults: async () => {
    const { currentProjectPath } = get();

    if (!currentProjectPath) {
      set({ error: 'No project selected' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const res = await fetch(
        `${API_BASE}/settings?path=${encodeURIComponent(currentProjectPath)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();

      if (data.success) {
        set({
          settings: data.settings,
          isLoading: false,
          isDirty: false,
        });
      } else {
        set({ error: data.error, isLoading: false });
      }
    } catch (err) {
      console.error('[projectSettings] Reset error:', err);
      set({ error: 'Failed to reset settings', isLoading: false });
    }
  },

  clearError: () => set({ error: null }),

  // Helpers to get specific settings
  getSessionDefault: (key) => get().settings.session[key],
  getSyncSetting: (key) => get().settings.sync[key],
  getAgentSetting: (key) => get().settings.agent[key],
  getTicketSetting: (key) => get().settings.ticket![key],
}));

// Re-export types for convenience
export type {
  ProjectSettings,
  SessionSettings,
  SyncSettings,
  AgentSettings,
  TicketSettings,
};
