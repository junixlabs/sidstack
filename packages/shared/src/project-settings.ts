/**
 * Project-level Settings
 *
 * Configuration that can be customized per project.
 * Stored in <project>/.sidstack/project-settings.json
 */

import type { TerminalApp, LaunchMode, WindowMode } from './external-session';

// Re-export for convenience
export type { TerminalApp, LaunchMode, WindowMode };

// ============================================================================
// Settings Schema
// ============================================================================

/**
 * Project settings version for migration support
 */
export const PROJECT_SETTINGS_VERSION = 1;

/**
 * Session-related settings
 */
export interface SessionSettings {
  /** How terminal windows are managed */
  windowMode: WindowMode;
  /** Default terminal application */
  defaultTerminal: TerminalApp;
  /** Default Claude launch mode */
  defaultMode: LaunchMode;
}

/**
 * Sync behavior settings
 */
export interface SyncSettings {
  /** Enable automatic session status sync */
  autoSyncEnabled: boolean;
  /** Sync interval in seconds (15-120) */
  syncIntervalSeconds: number;
  /** Sync when app window gains focus */
  syncOnWindowFocus: boolean;
  /** Enable automatic data refresh for views */
  autoRefreshEnabled: boolean;
  /** Auto-refresh interval in seconds (5-60) */
  autoRefreshIntervalSeconds: number;
}

/**
 * Agent-related settings
 */
export interface AgentSettings {
  /** Default role for new agents */
  defaultRole: string;
  /** Maximum concurrent agents */
  maxConcurrentAgents: number;
  /** Enable automatic agent recovery */
  autoRecoveryEnabled: boolean;
}

/**
 * Ticket source type
 * - 'self-hosted': Receive tickets via local webhook endpoint
 * - 'sidstack-cloud': Sync tickets via SidStack Cloud relay service
 */
export type TicketSource = 'self-hosted' | 'sidstack-cloud';

/**
 * SidStack Cloud connection settings
 */
export interface CloudConnectionSettings {
  /** Whether connected to SidStack Cloud */
  connected: boolean;
  /** User email for cloud account */
  email?: string;
  /** API key or token */
  apiKey?: string;
  /** Cloud webhook URL for this project */
  webhookUrl?: string;
  /** Connection status */
  status?: 'disconnected' | 'connecting' | 'connected' | 'error';
  /** Last sync timestamp */
  lastSyncAt?: string;
}

/**
 * Ticket settings for managing ticket sources
 */
export interface TicketSettings {
  /** Ticket source: self-hosted or sidstack-cloud */
  source: TicketSource;
  /** Enable webhook endpoint (only when source is 'self-hosted') */
  webhookEnabled: boolean;
  /** Enable tunnel for exposing local webhook */
  tunnelEnabled: boolean;
  /** Tunnel public URL if active */
  tunnelUrl?: string;
  /** SidStack Cloud connection (only when source is 'sidstack-cloud') */
  cloud?: CloudConnectionSettings;
}

/**
 * Complete project settings
 */
export interface ProjectSettings {
  /** Schema version for migrations */
  version: number;
  /** Session launch defaults */
  session: SessionSettings;
  /** Sync behavior */
  sync: SyncSettings;
  /** Agent defaults */
  agent: AgentSettings;
  /** Ticket settings */
  ticket?: TicketSettings;
}

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  windowMode: 'always-new',
  defaultTerminal: 'iTerm',
  defaultMode: 'normal',
};

export const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  autoSyncEnabled: true,
  syncIntervalSeconds: 30,
  syncOnWindowFocus: true,
  autoRefreshEnabled: true,
  autoRefreshIntervalSeconds: 15,
};

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  defaultRole: 'dev',
  maxConcurrentAgents: 5,
  autoRecoveryEnabled: true,
};

export const DEFAULT_TICKET_SETTINGS: TicketSettings = {
  source: 'self-hosted',
  webhookEnabled: false,
  tunnelEnabled: false,
  cloud: {
    connected: false,
    status: 'disconnected',
  },
};

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  version: PROJECT_SETTINGS_VERSION,
  session: DEFAULT_SESSION_SETTINGS,
  sync: DEFAULT_SYNC_SETTINGS,
  agent: DEFAULT_AGENT_SETTINGS,
  ticket: DEFAULT_TICKET_SETTINGS,
};

// ============================================================================
// Utilities
// ============================================================================

/**
 * Merge partial settings with defaults
 */
export function mergeWithDefaults(partial: Partial<ProjectSettings>): ProjectSettings {
  return {
    version: partial.version ?? PROJECT_SETTINGS_VERSION,
    session: {
      ...DEFAULT_SESSION_SETTINGS,
      ...partial.session,
    },
    sync: {
      ...DEFAULT_SYNC_SETTINGS,
      ...partial.sync,
    },
    agent: {
      ...DEFAULT_AGENT_SETTINGS,
      ...partial.agent,
    },
    ticket: {
      ...DEFAULT_TICKET_SETTINGS,
      ...partial.ticket,
    },
  };
}

/**
 * Validate settings values
 */
export function validateSettings(settings: ProjectSettings): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate sync interval
  if (settings.sync.syncIntervalSeconds < 15 || settings.sync.syncIntervalSeconds > 120) {
    errors.push('syncIntervalSeconds must be between 15 and 120');
  }

  // Validate max concurrent agents
  if (settings.agent.maxConcurrentAgents < 1 || settings.agent.maxConcurrentAgents > 20) {
    errors.push('maxConcurrentAgents must be between 1 and 20');
  }

  // Validate terminal
  const validTerminals = ['iTerm', 'Terminal', 'Warp', 'Alacritty', 'kitty', 'ghostty'];
  if (!validTerminals.includes(settings.session.defaultTerminal)) {
    errors.push(`defaultTerminal must be one of: ${validTerminals.join(', ')}`);
  }

  // Validate mode
  const validModes = ['normal', 'skip-permissions', 'continue', 'verbose'];
  if (!validModes.includes(settings.session.defaultMode)) {
    errors.push(`defaultMode must be one of: ${validModes.join(', ')}`);
  }

  // Validate window mode
  const validWindowModes = ['always-new', 'per-project-tabs', 'per-project-splits'];
  if (!validWindowModes.includes(settings.session.windowMode)) {
    errors.push(`windowMode must be one of: ${validWindowModes.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Settings file path for a project
 */
export function getSettingsPath(projectPath: string): string {
  return `${projectPath}/.sidstack/project-settings.json`;
}

/**
 * Load project settings from file
 * Returns defaults if file doesn't exist or is invalid
 */
export function loadProjectSettings(projectPath: string): ProjectSettings {
  const fs = require('fs');
  const settingsPath = getSettingsPath(projectPath);

  try {
    if (!fs.existsSync(settingsPath)) {
      return DEFAULT_PROJECT_SETTINGS;
    }

    const content = fs.readFileSync(settingsPath, 'utf-8');
    const parsed = JSON.parse(content);

    // Merge with defaults to ensure all fields exist
    return mergeWithDefaults(parsed);
  } catch (err) {
    console.warn(`Failed to load project settings from ${settingsPath}:`, err);
    return DEFAULT_PROJECT_SETTINGS;
  }
}

/**
 * Save project settings to file
 */
export function saveProjectSettings(projectPath: string, settings: ProjectSettings): void {
  const fs = require('fs');
  const path = require('path');
  const settingsPath = getSettingsPath(projectPath);

  // Ensure .sidstack directory exists
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

/**
 * Get session settings for a project (convenience function)
 */
export function getSessionSettings(projectPath: string): SessionSettings {
  const settings = loadProjectSettings(projectPath);
  return settings.session;
}
