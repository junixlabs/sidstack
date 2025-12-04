/**
 * Tunnel Store
 *
 * Zustand store for managing tunnel state in the UI
 */

import { create } from 'zustand';

const API_BASE = 'http://localhost:19432/api/tunnel';

export type TunnelProvider = 'cloudflared' | 'ngrok';
export type TunnelStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface TunnelProviderInfo {
  name: TunnelProvider;
  installed: boolean;
  command: string;
}

export interface TunnelInfo {
  provider: TunnelProvider | null;
  status: TunnelStatus;
  publicUrl: string | null;
  webhookUrl: string;
  error: string | null;
  startedAt: string | null;
}

interface TunnelStore {
  // State
  info: TunnelInfo;
  providers: TunnelProviderInfo[];
  recommendedProvider: TunnelProvider | null;
  isLoading: boolean;

  // Actions
  fetchStatus: () => Promise<void>;
  fetchProviders: () => Promise<void>;
  start: (provider?: TunnelProvider) => Promise<boolean>;
  stop: () => Promise<boolean>;
}

const DEFAULT_INFO: TunnelInfo = {
  provider: null,
  status: 'stopped',
  publicUrl: null,
  webhookUrl: 'http://localhost:19432/api/tickets',
  error: null,
  startedAt: null,
};

export const useTunnelStore = create<TunnelStore>((set, get) => ({
  // Initial state
  info: DEFAULT_INFO,
  providers: [],
  recommendedProvider: null,
  isLoading: false,

  // Fetch current tunnel status
  fetchStatus: async () => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      const data = await res.json();

      if (data.success) {
        set({
          info: {
            provider: data.provider,
            status: data.status,
            publicUrl: data.publicUrl,
            webhookUrl: data.webhookUrl,
            error: data.error,
            startedAt: data.startedAt,
          },
        });
      }
    } catch (err) {
      console.error('[tunnelStore] fetchStatus error:', err);
    }
  },

  // Fetch available providers
  fetchProviders: async () => {
    try {
      const res = await fetch(`${API_BASE}/providers`);
      const data = await res.json();

      if (data.success) {
        set({
          providers: data.providers,
          recommendedProvider: data.recommended,
        });
      }
    } catch (err) {
      console.error('[tunnelStore] fetchProviders error:', err);
    }
  },

  // Start tunnel
  start: async (provider?: TunnelProvider) => {
    set({ isLoading: true });

    try {
      const res = await fetch(`${API_BASE}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();

      set({
        isLoading: false,
        info: {
          provider: data.provider,
          status: data.status,
          publicUrl: data.publicUrl,
          webhookUrl: data.webhookUrl || DEFAULT_INFO.webhookUrl,
          error: data.error,
          startedAt: data.startedAt,
        },
      });

      return data.success;
    } catch (err) {
      console.error('[tunnelStore] start error:', err);
      set({
        isLoading: false,
        info: {
          ...get().info,
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to start tunnel',
        },
      });
      return false;
    }
  },

  // Stop tunnel
  stop: async () => {
    set({ isLoading: true });

    try {
      const res = await fetch(`${API_BASE}/stop`, {
        method: 'POST',
      });
      const data = await res.json();

      set({
        isLoading: false,
        info: {
          provider: data.provider,
          status: data.status,
          publicUrl: data.publicUrl,
          webhookUrl: data.webhookUrl || DEFAULT_INFO.webhookUrl,
          error: data.error,
          startedAt: data.startedAt,
        },
      });

      return data.success;
    } catch (err) {
      console.error('[tunnelStore] stop error:', err);
      set({ isLoading: false });
      return false;
    }
  },
}));

export default useTunnelStore;
