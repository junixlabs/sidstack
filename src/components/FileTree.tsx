import clsx from "clsx";
import { ChevronsDownUp, ChevronsUpDown, RefreshCw, Search, X } from "lucide-react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";

import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { useFile } from "@/hooks/useFile";
import { useAppStore } from "@/stores/appStore";
import type { FileTreeNode, Tab } from "@/types";


import { FileContextMenu } from "./FileContextMenu";
import { FileTreeSkeleton } from "./Skeleton";

// =============================================================================
// Toolbar Button Component (VS Code style)
// =============================================================================

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
}

function ToolbarButton({ icon, label, shortcut, onClick, disabled = false }: ToolbarButtonProps) {
  const tooltipText = shortcut ? `${label} (${shortcut})` : label;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={tooltipText}
      className={clsx(
        "relative inline-flex items-center justify-center",
        "w-[22px] h-[22px] rounded",
        "text-zinc-500 hover:text-zinc-200",
        "hover:bg-zinc-700/60",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent",
        "transition-colors duration-100"
      )}
    >
      <span className="sr-only">{label}</span>
      {icon}
    </button>
  );
}

interface FileTreeProps {
  rootPath: string;
  onFileSelect?: (path: string) => void;
  className?: string;
}

// Track expanded folders globally for collapse/expand all
type ExpandedState = { [path: string]: boolean };

export function FileTree({ rootPath, onFileSelect, className }: FileTreeProps) {
  const { getFileTree, loading, error } = useFile();
  const { fileTree, setFileTree, selectedFiles, toggleFileSelection, addTab, tabs, setActiveTab } = useAppStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [expandedState, setExpandedState] = useState<ExpandedState>({});
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rootPath) {
      getFileTree(rootPath, 4)
        .then(setFileTree)
        .catch(console.error);
    }
  }, [rootPath, getFileTree, setFileTree]);

  // Collect all folder paths for collapse/expand all
  const getAllFolderPaths = useCallback((node: FileTreeNode): string[] => {
    const paths: string[] = [];
    if (node.is_dir) {
      paths.push(node.path);
      node.children?.forEach((child) => {
        paths.push(...getAllFolderPaths(child));
      });
    }
    return paths;
  }, []);

  const handleCollapseAll = useCallback(() => {
    if (!fileTree) return;
    const allPaths = getAllFolderPaths(fileTree);
    const collapsed: ExpandedState = {};
    allPaths.forEach((path) => {
      collapsed[path] = false;
    });
    setExpandedState(collapsed);
  }, [fileTree, getAllFolderPaths]);

  const handleExpandAll = useCallback(() => {
    if (!fileTree) return;
    const allPaths = getAllFolderPaths(fileTree);
    const expanded: ExpandedState = {};
    allPaths.forEach((path) => {
      expanded[path] = true;
    });
    setExpandedState(expanded);
  }, [fileTree, getAllFolderPaths]);

  const toggleExpanded = useCallback((path: string) => {
    setExpandedState((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  }, []);

  // Get flattened list of visible nodes for keyboard navigation
  const getVisibleNodes = useCallback((node: FileTreeNode, currentExpandedState: ExpandedState): FileTreeNode[] => {
    const nodes: FileTreeNode[] = [node];
    if (node.is_dir && node.children) {
      const isExpanded = currentExpandedState[node.path] ?? (node.path.split("/").length < 3);
      if (isExpanded) {
        node.children.forEach((child) => {
          nodes.push(...getVisibleNodes(child, currentExpandedState));
        });
      }
    }
    return nodes;
  }, []);

  // Filter tree based on search query
  const filteredTree = useMemo(() => {
    if (!fileTree || !searchQuery.trim()) return fileTree;

    const query = searchQuery.toLowerCase();

    const filterNode = (node: FileTreeNode): FileTreeNode | null => {
      const nameMatches = node.name.toLowerCase().includes(query);

      if (node.is_dir && node.children) {
        const filteredChildren = node.children
          .map(filterNode)
          .filter((n): n is FileTreeNode => n !== null);

        if (filteredChildren.length > 0 || nameMatches) {
          return { ...node, children: filteredChildren };
        }
        return null;
      }

      return nameMatches ? node : null;
    };

    return filterNode(fileTree);
  }, [fileTree, searchQuery]);

  // Handle file selection - open in new tab
  const handleSelect = useCallback((path: string) => {
    // Extract filename from path
    const fileName = path.split("/").pop() || path;

    // Check if tab already exists for this file
    const existingTab = tabs.find((t: Tab) => t.type === "file" && t.data === path);
    if (existingTab) {
      // Activate existing tab
      setActiveTab(existingTab.id);
      onFileSelect?.(path);
      return;
    }

    // Create new file tab
    const newTab: Tab = {
      id: `file-${Date.now()}`,
      type: "file",
      title: fileName,
      data: path,
    };
    addTab(newTab);
    toggleFileSelection(path);
    onFileSelect?.(path);
  }, [toggleFileSelection, onFileSelect, addTab, tabs, setActiveTab]);

  // Keyboard navigation handler
  const handleTreeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!filteredTree) return;

    const visibleNodes = getVisibleNodes(filteredTree, expandedState);
    const currentIndex = focusedPath ? visibleNodes.findIndex((n) => n.path === focusedPath) : -1;

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const nextIndex = currentIndex < visibleNodes.length - 1 ? currentIndex + 1 : 0;
        setFocusedPath(visibleNodes[nextIndex].path);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : visibleNodes.length - 1;
        setFocusedPath(visibleNodes[prevIndex].path);
        break;
      }
      case "ArrowRight": {
        e.preventDefault();
        const node = visibleNodes[currentIndex];
        if (node?.is_dir && !expandedState[node.path]) {
          setExpandedState((prev) => ({ ...prev, [node.path]: true }));
        }
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        const node = visibleNodes[currentIndex];
        if (node?.is_dir && expandedState[node.path]) {
          setExpandedState((prev) => ({ ...prev, [node.path]: false }));
        }
        break;
      }
      case "Enter": {
        e.preventDefault();
        const node = visibleNodes[currentIndex];
        if (node) {
          if (node.is_dir) {
            toggleExpanded(node.path);
          } else {
            handleSelect(node.path);
          }
        }
        break;
      }
      case " ": {
        e.preventDefault();
        const node = visibleNodes[currentIndex];
        if (node && !node.is_dir) {
          handleSelect(node.path);
        }
        break;
      }
    }
  }, [filteredTree, expandedState, focusedPath, getVisibleNodes, toggleExpanded, handleSelect]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+F to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === "f" && e.target === document.body) {
        e.preventDefault();
        setShowSearch(true);
      }
      // Escape to close search
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false);
        setSearchQuery("");
      }
      // Cmd/Ctrl+Shift+C to collapse all
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "c") {
        e.preventDefault();
        handleCollapseAll();
      }
      // Cmd/Ctrl+Shift+E to expand all
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "e") {
        e.preventDefault();
        handleExpandAll();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSearch, handleCollapseAll, handleExpandAll]);

  // Refresh handler (must be defined before early returns for hooks order)
  const handleRefresh = useCallback(() => {
    if (rootPath) {
      getFileTree(rootPath, 4)
        .then(setFileTree)
        .catch(console.error);
    }
  }, [rootPath, getFileTree, setFileTree]);

  if (loading && !fileTree) {
    return (
      <div className={clsx("", className)}>
        <FileTreeSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={clsx("p-4 text-[var(--text-secondary)] text-sm", className)}>{error}</div>
    );
  }

  if (!fileTree) {
    return (
      <div className={clsx("p-4 text-[var(--text-muted)] text-sm", className)}>No files</div>
    );
  }

  return (
    <div className={clsx("flex flex-col", className)}>
      {/* Header with toolbar and search */}
      <div className="px-2 py-1.5 border-b border-zinc-800">
        {/* VS Code-style toolbar */}
        <div className="flex items-center justify-end mb-1.5">
          <div
            role="toolbar"
            aria-label="File tree actions"
            className="flex items-center gap-0.5"
          >
            {/* Expand/Collapse group */}
            <div role="group" aria-label="Expand and collapse" className="flex items-center">
              <ToolbarButton
                icon={<ChevronsUpDown size={14} strokeWidth={1.5} />}
                label="Expand All"
                shortcut="⌘⇧E"
                onClick={handleExpandAll}
              />
              <ToolbarButton
                icon={<ChevronsDownUp size={14} strokeWidth={1.5} />}
                label="Collapse All"
                shortcut="⌘⇧C"
                onClick={handleCollapseAll}
              />
            </div>
            {/* Separator */}
            <div role="separator" aria-orientation="vertical" className="w-px h-3.5 mx-0.5 bg-zinc-700" />
            {/* Refresh */}
            <ToolbarButton
              icon={<RefreshCw size={14} strokeWidth={1.5} className={loading ? "animate-spin" : ""} />}
              label="Refresh"
              onClick={handleRefresh}
              disabled={loading}
            />
          </div>
        </div>
        {/* Search bar */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-7 pr-7 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
          />
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" size={12} />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5 rounded hover:bg-zinc-700/60"
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Tree content */}
      <div
        ref={treeRef}
        className="flex-1 overflow-auto focus:outline-none"
        tabIndex={0}
        onKeyDown={handleTreeKeyDown}
      >
        {filteredTree ? (
          <FileTreeNodeComponent
            node={filteredTree}
            depth={0}
            selectedFiles={selectedFiles}
            onSelect={handleSelect}
            searchQuery={searchQuery}
            expandedState={expandedState}
            onToggleExpanded={toggleExpanded}
            focusedPath={focusedPath}
            onRefresh={handleRefresh}
          />
        ) : (
          <div className="p-4 text-zinc-500 text-xs text-center">
            No matches found
          </div>
        )}
      </div>
    </div>
  );
}

interface FileTreeNodeProps {
  node: FileTreeNode;
  depth: number;
  selectedFiles: string[];
  onSelect: (path: string) => void;
  searchQuery?: string;
  expandedState: ExpandedState;
  onToggleExpanded: (path: string) => void;
  focusedPath: string | null;
  onRefresh?: () => void;
}

function FileTreeNodeComponent({
  node,
  depth,
  selectedFiles,
  onSelect,
  searchQuery = "",
  expandedState,
  onToggleExpanded,
  focusedPath,
  onRefresh,
}: FileTreeNodeProps) {
  // Check if expanded from global state, default to expanded for first 2 levels or when searching
  const isExpanded = expandedState[node.path] ?? (depth < 2 || !!searchQuery);
  const isSelected = selectedFiles.includes(node.path);
  const isFocused = focusedPath === node.path;

  const handleClick = () => {
    if (node.is_dir) {
      onToggleExpanded(node.path);
    } else {
      onSelect(node.path);
    }
  };

  const statusColor = getStatusColor(node.status);

  // Highlight matching text
  const highlightMatch = (text: string) => {
    if (!searchQuery) return text;
    const query = searchQuery.toLowerCase();
    const index = text.toLowerCase().indexOf(query);
    if (index === -1) return text;

    return (
      <>
        {text.slice(0, index)}
        <span className="bg-[var(--surface-3)] text-[var(--text-primary)]">
          {text.slice(index, index + query.length)}
        </span>
        {text.slice(index + query.length)}
      </>
    );
  };

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onClick={handleClick}
            className={clsx(
              "flex items-center gap-1.5 px-2 py-0.5 cursor-pointer hover:bg-zinc-800/50 rounded-sm mx-1",
              isSelected && "bg-blue-600/20 hover:bg-blue-600/30",
              isFocused && "ring-1 ring-blue-500/50 bg-zinc-800/30"
            )}
            style={{ paddingLeft: `${depth * 12 + 4}px` }}
          >
            {/* Expand/collapse icon for dirs */}
            <span className="w-3 text-center flex-shrink-0">
              {node.is_dir && (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="currentColor"
                  className={clsx(
                    "text-zinc-500 transition-transform",
                    isExpanded && "rotate-90"
                  )}
                >
                  <path d="M3 1l4 4-4 4V1z" />
                </svg>
              )}
            </span>

            {/* File/folder icon */}
            <span className={clsx("w-4 text-center flex-shrink-0", node.is_dir ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]")}>
              {node.is_dir ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M1 3.5A1.5 1.5 0 012.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0115 5.5v7a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z"/>
                </svg>
              ) : (
                <span className="text-xs">{getFileIcon(node.name)}</span>
              )}
            </span>

            {/* Name with highlight */}
            <span
              className={clsx(
                "text-xs truncate flex-1",
                node.is_dir ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]",
                statusColor
              )}
            >
              {highlightMatch(node.name)}
            </span>

            {/* Status indicator */}
            {node.status && (
              <span className={clsx("text-[11px] flex-shrink-0", statusColor)}>
                {node.status === "added" && "A"}
                {node.status === "modified" && "M"}
                {node.status === "deleted" && "D"}
              </span>
            )}
          </div>
        </ContextMenuTrigger>
        <FileContextMenu path={node.path} isDir={node.is_dir} onRefresh={onRefresh} />
      </ContextMenu>

      {/* Children */}
      {node.is_dir && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNodeComponent
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedFiles={selectedFiles}
              onSelect={onSelect}
              searchQuery={searchQuery}
              expandedState={expandedState}
              onToggleExpanded={onToggleExpanded}
              focusedPath={focusedPath}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "ts":
    case "tsx":
      return "◇";
    case "js":
    case "jsx":
      return "◆";
    case "rs":
      return "⚙";
    case "go":
      return "◈";
    case "py":
      return "◉";
    case "md":
      return "◎";
    case "json":
    case "yaml":
    case "yml":
      return "◌";
    case "css":
    case "scss":
      return "◍";
    default:
      return "○";
  }
}

function getStatusColor(status: string | null): string {
  switch (status) {
    case "added":
      return "text-[var(--text-secondary)]";
    case "modified":
      return "text-[var(--text-secondary)]";
    case "deleted":
      return "text-[var(--text-muted)] line-through";
    case "untracked":
      return "text-[var(--text-secondary)]";
    default:
      return "";
  }
}
