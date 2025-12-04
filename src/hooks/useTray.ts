import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";

export function useTray() {
  const updateTooltip = useCallback(
    async (activeTasks: number, connectedAgents: number) => {
      try {
        await invoke("update_tray_tooltip", {
          activeTasks,
          connectedAgents,
        });
      } catch (e) {
        console.error("Failed to update tray tooltip:", e);
      }
    },
    []
  );

  const showNotification = useCallback(
    async (title: string, body: string) => {
      try {
        await invoke("show_notification", { title, body });
      } catch (e) {
        console.error("Failed to show notification:", e);
      }
    },
    []
  );

  return {
    updateTooltip,
    showNotification,
  };
}
