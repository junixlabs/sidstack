import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";

export interface WindowInfo {
  label: string;
  taskId?: string;
}

export function useWindowManager() {
  const [windows, setWindows] = useState<string[]>([]);
  const [currentLabel, setCurrentLabel] = useState<string>("");
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // Get current window label
  useEffect(() => {
    const getLabel = async () => {
      const win = getCurrentWindow();
      setCurrentLabel(win.label);
    };
    getLabel();
  }, []);

  // Listen for window list changes
  useEffect(() => {
    const setup = async () => {
      unlistenRef.current = await listen("windows-changed", async () => {
        await refreshWindows();
      });
    };
    setup();
    refreshWindows();

    return () => {
      unlistenRef.current?.();
    };
  }, []);

  const refreshWindows = useCallback(async () => {
    try {
      const result = await invoke<string[]>("list_windows");
      setWindows(result);
    } catch (e) {
      console.error("Failed to list windows:", e);
    }
  }, []);

  const openTaskWindow = useCallback(async (taskId: string, title: string) => {
    try {
      const label = await invoke<string>("open_task_window", { taskId, title });
      await refreshWindows();
      return label;
    } catch (e) {
      console.error("Failed to open task window:", e);
      throw e;
    }
  }, [refreshWindows]);

  const closeTaskWindow = useCallback(async (taskId: string) => {
    try {
      await invoke("close_task_window", { taskId });
      await refreshWindows();
    } catch (e) {
      console.error("Failed to close task window:", e);
    }
  }, [refreshWindows]);

  const focusWindow = useCallback(async (label: string) => {
    try {
      await invoke("focus_window", { label });
    } catch (e) {
      console.error("Failed to focus window:", e);
    }
  }, []);

  const savePosition = useCallback(async (label?: string) => {
    try {
      await invoke("save_window_position", { label: label || currentLabel });
    } catch (e) {
      console.error("Failed to save window position:", e);
    }
  }, [currentLabel]);

  const broadcast = useCallback(async (event: string, payload: unknown) => {
    try {
      await invoke("broadcast_to_windows", {
        event,
        payload: JSON.stringify(payload),
      });
    } catch (e) {
      console.error("Failed to broadcast:", e);
    }
  }, []);

  return {
    windows,
    currentLabel,
    isMainWindow: currentLabel === "main",
    openTaskWindow,
    closeTaskWindow,
    focusWindow,
    savePosition,
    broadcast,
    refreshWindows,
  };
}

export function useWindowSync<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    const setup = async () => {
      unlistenRef.current = await listen<string>(`sync-${key}`, (event) => {
        try {
          const parsed = JSON.parse(event.payload);
          setValue(parsed);
        } catch (e) {
          console.error("Failed to parse sync payload:", e);
        }
      });
    };
    setup();

    return () => {
      unlistenRef.current?.();
    };
  }, [key]);

  const setAndSync = useCallback(async (newValue: T) => {
    setValue(newValue);
    try {
      await invoke("broadcast_to_windows", {
        event: `sync-${key}`,
        payload: JSON.stringify(newValue),
      });
    } catch (e) {
      console.error("Failed to sync value:", e);
    }
  }, [key]);

  return [value, setAndSync] as const;
}

// Hook to save window position on close/resize
export function useWindowPosition() {
  const { savePosition, currentLabel } = useWindowManager();
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const handleResize = () => {
      // Debounce save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = window.setTimeout(() => {
        savePosition();
      }, 500);
    };

    const handleBeforeUnload = () => {
      savePosition();
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [savePosition, currentLabel]);
}
