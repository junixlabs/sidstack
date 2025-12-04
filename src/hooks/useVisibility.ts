/**
 * useVisibility Hook
 *
 * Provides visibility state and utilities for:
 * - Pausing animations when tab is hidden (CPU optimization)
 * - Pausing polling intervals when tab is hidden
 * - Reducing resource usage for background tabs
 */

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Hook to track document visibility state
 */
export function useDocumentVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(() => !document.hidden);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsVisible(visible);

      // Toggle tab-hidden class on root for CSS-based animation pausing
      if (visible) {
        document.documentElement.classList.remove("tab-hidden");
      } else {
        document.documentElement.classList.add("tab-hidden");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Set initial state
    if (document.hidden) {
      document.documentElement.classList.add("tab-hidden");
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.documentElement.classList.remove("tab-hidden");
    };
  }, []);

  return isVisible;
}

/**
 * Hook for visibility-aware polling
 * Automatically pauses when tab is hidden
 */
export function useVisibilityPolling(
  pollFn: () => void | Promise<void>,
  intervalMs: number,
  options: {
    /** Run immediately on mount */
    immediate?: boolean;
    /** Continue polling even when hidden (not recommended) */
    ignoreVisibility?: boolean;
  } = {}
): {
  isPolling: boolean;
  lastPollTime: number | null;
  pollNow: () => void;
} {
  const { immediate = true, ignoreVisibility = false } = options;
  const isVisible = useDocumentVisibility();
  const [isPolling, setIsPolling] = useState(false);
  const [lastPollTime, setLastPollTime] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollFnRef = useRef(pollFn);

  // Keep pollFn ref updated
  useEffect(() => {
    pollFnRef.current = pollFn;
  }, [pollFn]);

  const executePoll = useCallback(async () => {
    setIsPolling(true);
    try {
      await pollFnRef.current();
      setLastPollTime(Date.now());
    } catch (error) {
      console.error("[useVisibilityPolling] Poll error:", error);
    } finally {
      setIsPolling(false);
    }
  }, []);

  const pollNow = useCallback(() => {
    executePoll();
  }, [executePoll]);

  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Don't poll if tab is hidden (unless ignoreVisibility is true)
    if (!isVisible && !ignoreVisibility) {
      return;
    }

    // Run immediately if requested
    if (immediate) {
      executePoll();
    }

    // Setup interval
    intervalRef.current = setInterval(executePoll, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isVisible, ignoreVisibility, intervalMs, immediate, executePoll]);

  return { isPolling, lastPollTime, pollNow };
}

/**
 * Hook to reduce update frequency when tab is hidden
 */
export function useThrottledUpdates<T>(
  value: T,
  options: {
    /** Delay for visible tab (ms) */
    visibleDelay?: number;
    /** Delay for hidden tab (ms) - longer to save CPU */
    hiddenDelay?: number;
  } = {}
): T {
  const { visibleDelay = 0, hiddenDelay = 1000 } = options;
  const isVisible = useDocumentVisibility();
  const [throttledValue, setThrottledValue] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const delay = isVisible ? visibleDelay : hiddenDelay;

    if (delay === 0) {
      setThrottledValue(value);
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setThrottledValue(value);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, isVisible, visibleDelay, hiddenDelay]);

  return throttledValue;
}

export default useDocumentVisibility;
