/**
 * ConnectionSetup — First-time server connection screen
 * Shown when no connection config exists
 */

import { useState } from 'react';
import { Server, CheckCircle2, XCircle, Loader2, Wifi } from 'lucide-react';
import {
  type ConnectionConfig,
  saveConnectionConfig,
} from '@/lib/api-config';

interface Props {
  onConnected: () => void;
  initialConfig?: ConnectionConfig;
}

type TestStatus = 'idle' | 'testing' | 'ok' | 'error';

export function ConnectionSetup({ onConnected, initialConfig }: Props) {
  const [apiUrl, setApiUrl] = useState(initialConfig?.apiUrl || '');
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey || '');
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testError, setTestError] = useState('');

  const testConnection = async () => {
    const url = apiUrl.replace(/\/+$/, '');
    if (!url) return;

    setTestStatus('testing');
    setTestError('');

    try {
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const res = await fetch(`${url}/health`, {
        headers,
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} — ${res.statusText}`);
      }

      const data = await res.json();
      if (data.status === 'ok') {
        setTestStatus('ok');
      } else {
        throw new Error('Unexpected health response');
      }
    } catch (e) {
      setTestStatus('error');
      setTestError(e instanceof Error ? e.message : 'Connection failed');
    }
  };

  const handleSave = () => {
    const url = apiUrl.replace(/\/+$/, '');
    saveConnectionConfig({ apiUrl: url, apiKey });
    onConnected();
  };

  return (
    <div className="min-h-full flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--surface-2)] mb-4">
            <Server size={24} className="text-[var(--accent-blue)]" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Connect to SidStack</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Enter your server URL and API key
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* API URL */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Server URL
            </label>
            <input
              type="url"
              placeholder="https://api.yourdomain.com"
              value={apiUrl}
              onChange={(e) => {
                setApiUrl(e.target.value);
                setTestStatus('idle');
              }}
              className="w-full px-3 py-2 text-sm bg-[var(--surface-1)] border border-[var(--border-default)]
                         rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]
                         focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              API Key
            </label>
            <input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestStatus('idle');
              }}
              className="w-full px-3 py-2 text-sm bg-[var(--surface-1)] border border-[var(--border-default)]
                         rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]
                         focus:outline-none focus:border-[var(--accent-blue)] font-mono"
            />
          </div>

          {/* Test Connection */}
          <button
            onClick={testConnection}
            disabled={!apiUrl || testStatus === 'testing'}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium
                       bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border-default)]
                       rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {testStatus === 'testing' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Wifi size={14} />
            )}
            Test Connection
          </button>

          {/* Test Result */}
          {testStatus === 'ok' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm">
              <CheckCircle2 size={14} />
              Connected successfully
            </div>
          )}
          {testStatus === 'error' && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">
              <XCircle size={14} className="mt-0.5 shrink-0" />
              <span>{testError || 'Connection failed'}</span>
            </div>
          )}

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={testStatus !== 'ok'}
            className="w-full px-4 py-2.5 text-sm font-medium
                       bg-[var(--accent-blue)] hover:bg-blue-600 text-white
                       rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Connect
          </button>
        </div>

        {/* Help */}
        <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
          Deploy SidStack server with Docker — see docs for setup
        </p>
      </div>
    </div>
  );
}
