import { useEffect, useCallback } from "react";

import { useReviewStore } from "@/stores/reviewStore";

/**
 * Keyboard shortcuts for review panel
 * - j: Next hunk
 * - k: Previous hunk
 * - ]: Next file
 * - [: Previous file
 * - s: Toggle split/unified view
 * - b: Toggle sidebar
 * - Escape: Clear selection
 */
export function useReviewKeyboard(enabled: boolean = true) {
  const {
    nextFile,
    prevFile,
    nextHunk,
    prevHunk,
    toggleViewMode,
    toggleSidebar,
  } = useReviewStore();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't handle if typing in an input/textarea
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Don't handle if modifier keys are pressed (except for Cmd+F)
      if (event.ctrlKey || event.metaKey || event.altKey) {
        // Allow Cmd+F for search (let browser handle it)
        if (event.key === "f" && (event.ctrlKey || event.metaKey)) {
          return;
        }
        return;
      }

      switch (event.key) {
        case "j":
          event.preventDefault();
          nextHunk();
          break;
        case "k":
          event.preventDefault();
          prevHunk();
          break;
        case "]":
          event.preventDefault();
          nextFile();
          break;
        case "[":
          event.preventDefault();
          prevFile();
          break;
        case "s":
          event.preventDefault();
          toggleViewMode();
          break;
        case "b":
          event.preventDefault();
          toggleSidebar();
          break;
        case "Escape":
          event.preventDefault();
          // Could clear selection or close something
          break;
      }
    },
    [nextFile, prevFile, nextHunk, prevHunk, toggleViewMode, toggleSidebar]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}

export default useReviewKeyboard;
