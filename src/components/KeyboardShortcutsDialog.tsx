import { useEffect, useCallback, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["\u2318", "1\u20136"], description: "Switch sidebar view" },
      { keys: ["\u2318", "O"], description: "Open project" },
      { keys: ["\u2318", "W"], description: "Close active block" },
      { keys: ["?"], description: "Show keyboard shortcuts" },
    ],
  },
  {
    title: "Workspaces",
    shortcuts: [
      { keys: ["\u2318", "\u2325", "1\u20139"], description: "Switch workspace by position" },
      { keys: ["\u2318", "["], description: "Previous workspace" },
      { keys: ["\u2318", "]"], description: "Next workspace" },
    ],
  },
  {
    title: "Blocks",
    shortcuts: [
      { keys: ["\u2318", "1\u20139"], description: "Focus block by position" },
    ],
  },
];

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-[var(--border-muted)]">
          <DialogTitle className="text-sm font-semibold text-[var(--text-primary)]">
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="px-4 py-3 space-y-4 max-h-[60vh] overflow-y-auto">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-xs text-[var(--text-secondary)]">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {shortcut.keys.map((key, i) => (
                        <kbd
                          key={i}
                          className={cn(
                            "inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5",
                            "text-[11px] font-mono rounded",
                            "bg-[var(--surface-2)] text-[var(--text-secondary)]",
                            "border border-[var(--border-muted)]"
                          )}
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook to manage keyboard shortcut help dialog state.
 * Listens for "?" key (unmodified) or Cmd+/ to toggle the dialog.
 */
export function useKeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // "?" key (Shift+/) without meta/ctrl
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Don't trigger when typing in an input/textarea
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
          return;
        }
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      // Cmd+/ or Ctrl+/
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { open, setOpen };
}
