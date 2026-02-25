/**
 * Frontend API configuration
 * Reads connection settings from localStorage, falls back to env/localhost
 */

const STORAGE_KEY = 'sidstack-connection';

export interface ConnectionConfig {
  apiUrl: string;
  apiKey: string;
}

const DEFAULT_CONFIG: ConnectionConfig = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:19432',
  apiKey: '',
};

/** Read saved connection config from localStorage */
export function getConnectionConfig(): ConnectionConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        apiUrl: parsed.apiUrl || DEFAULT_CONFIG.apiUrl,
        apiKey: parsed.apiKey || '',
      };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_CONFIG };
}

/** Save connection config to localStorage */
export function saveConnectionConfig(config: ConnectionConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/** Check if user has configured a connection */
export function hasConnectionConfig(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

/** Clear saved connection config */
export function clearConnectionConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Get API base URL from saved config */
export function getApiBaseUrl(): string {
  return getConnectionConfig().apiUrl;
}

/** Get auth headers (empty object if no key configured) */
export function getAuthHeaders(): Record<string, string> {
  const { apiKey } = getConnectionConfig();
  if (apiKey) {
    return { Authorization: `Bearer ${apiKey}` };
  }
  return {};
}

/** Build standard headers for API calls */
export function getApiHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  };
}

/**
 * Fetch wrapper that auto-injects auth headers.
 * Drop-in replacement for window.fetch.
 */
export function apiFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const authHeaders = getAuthHeaders();
  const mergedHeaders = {
    ...authHeaders,
    ...(init?.headers as Record<string, string>),
  };
  return fetch(input, { ...init, headers: mergedHeaders });
}
