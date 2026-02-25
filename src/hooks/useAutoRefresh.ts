/**
 * useAutoRefresh Hook
 *
 * Provides auto-refresh functionality based on project settings.
 * Views can use this hook to automatically refresh data at intervals.
 */

import { useEffect, useRef, useCallback } from 'react';

import { useProjectSettingsStore } from '@/stores/projectSettingsStore';

interface UseAutoRefreshOptions {
  /** Callback to refresh data */
  onRefresh: () => void | Promise<void>;
  /** Whether auto-refresh is enabled for this view (default: true) */
  enabled?: boolean;
  /** Override interval in seconds (uses settings if not provided) */
  intervalOverride?: number;
  /** Refresh immediately on mount (default: false) */
  refreshOnMount?: boolean;
  /** Refresh when window gains focus (uses settings if not provided) */
  refreshOnFocus?: boolean;
}

interface UseAutoRefreshReturn {
  /** Whether auto-refresh is currently active */
  isActive: boolean;
  /** Current interval in seconds */
  interval: number;
  /** Manually trigger a refresh */
  refresh: () => void;
  /** Time until next refresh in seconds (approximate) */
  nextRefreshIn: number;
}

export function useAutoRefresh({
  onRefresh,
  enabled = true,
  intervalOverride,
  refreshOnMount = false,
  refreshOnFocus,
}: UseAutoRefreshOptions): UseAutoRefreshReturn {
  const { settings } = useProjectSettingsStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastRefreshRef = useRef<number>(Date.now());
  const nextRefreshInRef = useRef<number>(0);

  // Get settings
  const autoRefreshEnabled = settings.sync.autoRefreshEnabled && enabled;
  const interval = intervalOverride ?? settings.sync.autoRefreshIntervalSeconds;
  const shouldRefreshOnFocus = refreshOnFocus ?? settings.sync.syncOnWindowFocus;

  // Use ref for onRefresh to avoid restarting intervals when callback changes
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // Stable refresh function — never changes, so intervals don't restart
  const refresh = useCallback(() => {
    lastRefreshRef.current = Date.now();
    onRefreshRef.current();
  }, []);

  // Refresh immediately when enabled transitions from false → true (workspace activation).
  // This ensures global stores (tasks, tickets, etc.) reload the correct project's data
  // when switching between workspaces, since all views share a single store instance.
  const prevEnabledRef = useRef(autoRefreshEnabled);
  useEffect(() => {
    if (autoRefreshEnabled && !prevEnabledRef.current) {
      refresh();
    }
    prevEnabledRef.current = autoRefreshEnabled;
  }, [autoRefreshEnabled, refresh]);

  // Set up interval
  useEffect(() => {
    if (!autoRefreshEnabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Refresh on mount if requested
    if (refreshOnMount) {
      refresh();
    }

    // Set up interval
    const intervalMs = interval * 1000;
    intervalRef.current = setInterval(() => {
      refresh();
    }, intervalMs);

    // Update next refresh countdown
    const countdownInterval = setInterval(() => {
      const elapsed = Date.now() - lastRefreshRef.current;
      nextRefreshInRef.current = Math.max(0, Math.ceil((intervalMs - elapsed) / 1000));
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      clearInterval(countdownInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh is stable (useCallback with [])
  }, [autoRefreshEnabled, interval, refreshOnMount]);

  // Set up focus listener
  useEffect(() => {
    if (!autoRefreshEnabled || !shouldRefreshOnFocus) {
      return;
    }

    const handleFocus = () => {
      // Only refresh if enough time has passed since last refresh
      const elapsed = Date.now() - lastRefreshRef.current;
      if (elapsed > 5000) {
        // At least 5 seconds
        refresh();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [autoRefreshEnabled, shouldRefreshOnFocus, refresh]);

  // Listen for global ⌘R refresh event
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('sidstack:refresh', handler);
    return () => window.removeEventListener('sidstack:refresh', handler);
  }, [refresh]);

  return {
    isActive: autoRefreshEnabled,
    interval,
    refresh,
    nextRefreshIn: nextRefreshInRef.current,
  };
}

export default useAutoRefresh;
