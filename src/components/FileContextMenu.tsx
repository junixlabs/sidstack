/**
 * FileContextMenu - Context menu for files and folders in FileTree
 */

import { invoke } from "@tauri-apps/api/core";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  FileText,
  Copy,
  Trash2,
  FolderOpen,
  ExternalLink,
  FilePlus,
  FolderPlus,
  PanelRightClose,
} from "lucide-react";

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { useAppStore } from "@/stores/appStore";
import type { Tab } from "@/types";

interface FileContextMenuProps {
  path: string;
  isDir: boolean;
  onRefresh?: () => void;
}

export function FileContextMenu({ path, isDir, onRefresh }: FileContextMenuProps) {
  const { addTab, tabs, setActiveTab, projectPath } = useAppStore();

  // Get relative path from project root
  const getRelativePath = () => {
    if (projectPath && path.startsWith(projectPath)) {
      return path.slice(projectPath.length + 1);
    }
    return path;
  };

  // Copy path to clipboard
  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(getRelativePath());
    } catch (err) {
      console.error("Failed to copy path:", err);
    }
  };

  // Copy absolute path to clipboard
  const handleCopyAbsolutePath = async () => {
    try {
      await navigator.clipboard.writeText(path);
    } catch (err) {
      console.error("Failed to copy absolute path:", err);
    }
  };

  // Copy file content to clipboard
  const handleCopyContent = async () => {
    try {
      const result = await invoke<{ content: string }>("get_file_content", { filePath: path });
      await navigator.clipboard.writeText(result.content);
    } catch (err) {
      console.error("Failed to copy content:", err);
    }
  };

  // Open file in new tab
  const handleOpen = () => {
    if (isDir) return;

    const fileName = path.split("/").pop() || path;
    const existingTab = tabs.find((t: Tab) => t.type === "file" && t.data === path);

    if (existingTab) {
      setActiveTab(existingTab.id);
      return;
    }

    const newTab: Tab = {
      id: `file-${Date.now()}`,
      type: "file",
      title: fileName,
      data: path,
    };
    addTab(newTab);
  };

  // Open file to the side (split view) - simplified: just open in tab for now
  const handleOpenToSide = () => {
    handleOpen();
  };

  // Reveal in Finder/Explorer
  const handleRevealInFinder = async () => {
    try {
      await revealItemInDir(path);
    } catch (err) {
      console.error("Failed to reveal in finder:", err);
    }
  };

  // Open in external editor (VS Code)
  const handleOpenInEditor = async () => {
    try {
      // Use the opener plugin to open with default application
      await openPath(path);
    } catch (err) {
      console.error("Failed to open in editor:", err);
    }
  };

  // Delete file/folder
  const handleDelete = async () => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${path.split("/").pop()}"?`
    );
    if (!confirmDelete) return;

    try {
      await invoke("delete_file", { path });
      onRefresh?.();
    } catch (err) {
      console.error("Failed to delete:", err);
      alert(`Failed to delete: ${err}`);
    }
  };

  // Rename file/folder
  const handleRename = async () => {
    const oldName = path.split("/").pop() || "";
    const newName = window.prompt("Enter new name:", oldName);

    if (!newName || newName === oldName) return;

    const newPath = path.split("/").slice(0, -1).concat(newName).join("/");

    try {
      await invoke("rename_file", { oldPath: path, newPath });
      onRefresh?.();
    } catch (err) {
      console.error("Failed to rename:", err);
      alert(`Failed to rename: ${err}`);
    }
  };

  // Create new file in folder
  const handleNewFile = async () => {
    const fileName = window.prompt("Enter file name:");
    if (!fileName) return;

    const newPath = `${path}/${fileName}`;

    try {
      await invoke("create_file", { path: newPath, content: "" });
      onRefresh?.();
    } catch (err) {
      console.error("Failed to create file:", err);
      alert(`Failed to create file: ${err}`);
    }
  };

  // Create new folder
  const handleNewFolder = async () => {
    const folderName = window.prompt("Enter folder name:");
    if (!folderName) return;

    const newPath = `${path}/${folderName}`;

    try {
      await invoke("create_folder", { path: newPath });
      onRefresh?.();
    } catch (err) {
      console.error("Failed to create folder:", err);
      alert(`Failed to create folder: ${err}`);
    }
  };

  if (isDir) {
    return (
      <ContextMenuContent>
        {/* Create actions */}
        <ContextMenuItem onClick={handleNewFile}>
          <FilePlus className="w-4 h-4 mr-2" />
          New File...
          <ContextMenuShortcut>⌘N</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleNewFolder}>
          <FolderPlus className="w-4 h-4 mr-2" />
          New Folder...
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Path actions */}
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

        {/* Folder actions */}
        <ContextMenuItem onClick={handleRevealInFinder}>
          <FolderOpen className="w-4 h-4 mr-2" />
          Reveal in Finder
          <ContextMenuShortcut>⌘⇧R</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Destructive actions */}
        <ContextMenuItem onClick={handleRename}>
          <FileText className="w-4 h-4 mr-2" />
          Rename
          <ContextMenuShortcut>F2</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleDelete} destructive>
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    );
  }

  // File context menu
  return (
    <ContextMenuContent>
      {/* Open actions */}
      <ContextMenuItem onClick={handleOpen}>
        <FileText className="w-4 h-4 mr-2" />
        Open
      </ContextMenuItem>
      <ContextMenuItem onClick={handleOpenToSide}>
        <PanelRightClose className="w-4 h-4 mr-2" />
        Open to the Side
        <ContextMenuShortcut>⌘\</ContextMenuShortcut>
      </ContextMenuItem>

      <ContextMenuSeparator />

      {/* Copy actions */}
      <ContextMenuItem onClick={handleCopyPath}>
        <Copy className="w-4 h-4 mr-2" />
        Copy Path
        <ContextMenuShortcut>⌘⇧C</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onClick={handleCopyAbsolutePath}>
        <Copy className="w-4 h-4 mr-2" />
        Copy Absolute Path
      </ContextMenuItem>
      <ContextMenuItem onClick={handleCopyContent}>
        <Copy className="w-4 h-4 mr-2" />
        Copy Content
      </ContextMenuItem>

      <ContextMenuSeparator />

      {/* Edit actions */}
      <ContextMenuItem onClick={handleRename}>
        <FileText className="w-4 h-4 mr-2" />
        Rename
        <ContextMenuShortcut>F2</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onClick={handleDelete} destructive>
        <Trash2 className="w-4 h-4 mr-2" />
        Delete
        <ContextMenuShortcut>⌫</ContextMenuShortcut>
      </ContextMenuItem>

      <ContextMenuSeparator />

      {/* External actions */}
      <ContextMenuItem onClick={handleOpenInEditor}>
        <ExternalLink className="w-4 h-4 mr-2" />
        Open with Default App
      </ContextMenuItem>
      <ContextMenuItem onClick={handleRevealInFinder}>
        <FolderOpen className="w-4 h-4 mr-2" />
        Reveal in Finder
        <ContextMenuShortcut>⌘⇧R</ContextMenuShortcut>
      </ContextMenuItem>
    </ContextMenuContent>
  );
}

export default FileContextMenu;
