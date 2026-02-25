import { useEffect, useCallback, useState } from "react";

import { cn } from "@/lib/utils";
import { useSidBotStore } from "@/stores/sidBotStore";

import { SidBotChat } from "./SidBotChat";
import { SidBotConfig } from "./SidBotConfig";
import { SidBotHeader } from "./SidBotHeader";

const MIN_WIDTH = 320;
const MAX_WIDTH = 480;

export function SidBotPanel() {
  const isPanelOpen = useSidBotStore((s) => s.isPanelOpen);
  const activeTab = useSidBotStore((s) => s.activeTab);
  const togglePanel = useSidBotStore((s) => s.togglePanel);
  const panelWidth = useSidBotStore((s) => s.panelWidth);
  const setPanelWidth = useSidBotStore((s) => s.setPanelWidth);
  const [isResizing, setIsResizing] = useState(false);

  // Escape to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isPanelOpen) {
        e.stopPropagation();
        togglePanel();
      }
    },
    [isPanelOpen, togglePanel],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      const startX = e.clientX;
      const startWidth = panelWidth;

      const handleMouseMove = (e: MouseEvent) => {
        // Panel is on right, so dragging LEFT increases width
        const delta = startX - e.clientX;
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
        setPanelWidth(newWidth);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [panelWidth, setPanelWidth],
  );

  if (!isPanelOpen) return null;

  return (
    <div
      data-sidbot-panel
      className={cn(
        "flex flex-col shrink-0 overflow-hidden relative",
        "bg-[var(--surface-1)] border-l border-[var(--border-muted)]",
      )}
      style={{ width: panelWidth }}
    >
      {/* Resize handle - visible grip indicator */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize z-10 group",
          "flex items-center justify-center",
        )}
      >
        {/* Visible grip line */}
        <div
          className={cn(
            "w-0.5 h-12 rounded-full transition-all",
            isResizing
              ? "bg-[var(--accent-primary)]"
              : "bg-[var(--border-muted)] group-hover:bg-[var(--accent-primary)]/60",
          )}
        />
      </div>

      <SidBotHeader />
      <div className="flex-1 min-h-0 min-w-0 flex flex-col">
        {activeTab === "chat" ? <SidBotChat /> : <SidBotConfig />}
      </div>
    </div>
  );
}
