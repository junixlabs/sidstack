/**
 * TabContextMenu - Context menu for tabs in TaskTabs (VS Code style)
 */

import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  X,
  XCircle,
  ArrowLeftToLine,
  ArrowRightToLine,
  Copy,
  FolderOpen,
  Pin,
  PinOff,
  RotateCcw,
} from "lucide-react";

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { useAppStore } from "@/stores/appStore";
import type { Tab } from "@/types";

interface TabContextMenuProps {
  tab: Tab;
  tabIndex: number;
}

export function TabContextMenu({ tab, tabIndex }: TabContextMenuProps) {
  const {
    tabs,
    removeTab,
    projectPath,
    setActiveTab,
    pinTab,
    unpinTab,
    closeAllTabs,
    closeTabsToLeft,
    closeTabsToRight,
    reopenLastClosedTab,
    recentlyClosedTabs,
  } = useAppStore();

  // Get file path for file tabs
  const getFilePath = (): string | null => {
    if (tab.type === "file" && typeof tab.data === "string") {
      return tab.data;
    }
    return null;
  };

  // Get relative path from project root
  const getRelativePath = (): string | null => {
    const filePath = getFilePath();
    if (!filePath) return null;
    if (projectPath && filePath.startsWith(projectPath)) {
      return filePath.slice(projectPath.length + 1);
    }
    return filePath;
  };

  // Close this tab
  const handleClose = () => {
    // Unpin first if pinned, then close
    if (tab.pinned) {
      unpinTab(tab.id);
    }
    removeTab(tab.id);
    // Activate previous tab if exists
    if (tabs.length > 1) {
      const newIndex = tabIndex > 0 ? tabIndex - 1 : 1;
      if (tabs[newIndex]) {
        setActiveTab(tabs[newIndex].id);
      }
    }
  };

  // Close other tabs
  const handleCloseOthers = () => {
    const otherTabs = tabs.filter((t: Tab) => t.id !== tab.id && !t.pinned);
    otherTabs.forEach((t: Tab) => removeTab(t.id));
    setActiveTab(tab.id);
  };

  // Copy path to clipboard
  const handleCopyPath = async () => {
    const path = getRelativePath();
    if (path) {
      try {
        await navigator.clipboard.writeText(path);
      } catch (err) {
        console.error("Failed to copy path:", err);
      }
    }
  };

  // Copy absolute path to clipboard
  const handleCopyAbsolutePath = async () => {
    const path = getFilePath();
    if (path) {
      try {
        await navigator.clipboard.writeText(path);
      } catch (err) {
        console.error("Failed to copy absolute path:", err);
      }
    }
  };

  // Reveal in Finder
  const handleRevealInFinder = async () => {
    const path = getFilePath();
    if (path) {
      try {
        await revealItemInDir(path);
      } catch (err) {
        console.error("Failed to reveal in finder:", err);
      }
    }
  };

  // Pin/Unpin
  const handleTogglePin = () => {
    if (tab.pinned) {
      unpinTab(tab.id);
    } else {
      pinTab(tab.id);
    }
  };

  const unpinnedTabs = tabs.filter((t) => !t.pinned);
  const hasOtherUnpinnedTabs = unpinnedTabs.length > 1 || (unpinnedTabs.length === 1 && tab.pinned);
  const hasLeftTabs = tabIndex > 0 && tabs.slice(0, tabIndex).some((t) => !t.pinned);
  const hasRightTabs = tabIndex < tabs.length - 1 && tabs.slice(tabIndex + 1).some((t) => !t.pinned);
  const hasClosedTabs = recentlyClosedTabs.length > 0;
  const isFileTab = tab.type === "file";

  return (
    <ContextMenuContent>
      {/* Close actions */}
      <ContextMenuItem onClick={handleClose}>
        <X className="w-4 h-4 mr-2" />
        Close
        <ContextMenuShortcut>⌘W</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onClick={handleCloseOthers} disabled={!hasOtherUnpinnedTabs}>
        <XCircle className="w-4 h-4 mr-2" />
        Close Others
      </ContextMenuItem>
      <ContextMenuItem onClick={() => closeTabsToLeft(tabIndex)} disabled={!hasLeftTabs}>
        <ArrowLeftToLine className="w-4 h-4 mr-2" />
        Close to the Left
      </ContextMenuItem>
      <ContextMenuItem onClick={() => closeTabsToRight(tabIndex)} disabled={!hasRightTabs}>
        <ArrowRightToLine className="w-4 h-4 mr-2" />
        Close to the Right
      </ContextMenuItem>
      <ContextMenuItem onClick={closeAllTabs} disabled={unpinnedTabs.length === 0}>
        <XCircle className="w-4 h-4 mr-2" />
        Close All
      </ContextMenuItem>

      <ContextMenuSeparator />

      {/* Pin action */}
      <ContextMenuItem onClick={handleTogglePin}>
        {tab.pinned ? (
          <>
            <PinOff className="w-4 h-4 mr-2" />
            Unpin Tab
          </>
        ) : (
          <>
            <Pin className="w-4 h-4 mr-2" />
            Pin Tab
          </>
        )}
      </ContextMenuItem>

      {/* Reopen closed tab */}
      <ContextMenuItem onClick={reopenLastClosedTab} disabled={!hasClosedTabs}>
        <RotateCcw className="w-4 h-4 mr-2" />
        Reopen Closed Tab
        <ContextMenuShortcut>⌘⇧T</ContextMenuShortcut>
      </ContextMenuItem>

      {/* File-specific actions */}
      {isFileTab && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleCopyPath}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Path
            <ContextMenuShortcut>⌘⇧C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleCopyAbsolutePath}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Absolute Path
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleRevealInFinder}>
            <FolderOpen className="w-4 h-4 mr-2" />
            Reveal in Finder
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  );
}

export default TabContextMenu;
