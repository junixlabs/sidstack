/**
 * WorkspaceContext - Per-workspace state management
 *
 * This context provides workspace-specific blocks and layout state.
 * Each workspace has its own context, allowing multiple workspaces
 * to be rendered simultaneously without sharing state.
 */

import { createContext, useContext, ReactNode, useState, useCallback, useRef, useEffect } from "react";

import type { BlockData, BlockState, LayoutNode, BlockViewType } from "@/types/block";

// Generate unique IDs
function generateBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateNodeId(): string {
  return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Deep clone
function cloneNode(node: LayoutNode): LayoutNode {
  return JSON.parse(JSON.stringify(node));
}

// Find node by blockId
function findNodeByBlockId(root: LayoutNode, blockId: string): LayoutNode | null {
  if (root.type === "leaf" && root.blockId === blockId) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findNodeByBlockId(child, blockId);
      if (found) return found;
    }
  }
  return null;
}

// Find parent
function findParent(
  root: LayoutNode,
  nodeId: string
): { parent: LayoutNode; index: number } | null {
  if (root.children) {
    for (let i = 0; i < root.children.length; i++) {
      if (root.children[i].id === nodeId) {
        return { parent: root, index: i };
      }
      const found = findParent(root.children[i], nodeId);
      if (found) return found;
    }
  }
  return null;
}

// Collect blockIds
function collectBlockIds(node: LayoutNode | null): string[] {
  if (!node) return [];
  if (node.type === "leaf" && node.blockId) {
    return [node.blockId];
  }
  if (node.children) {
    return node.children.flatMap(collectBlockIds);
  }
  return [];
}

// Cleanup tree - remove empty branches, flatten single-child branches
function cleanupTree(node: LayoutNode, isRoot: boolean = true): LayoutNode | null {
  if (node.type === "leaf") {
    return node;
  }

  if (node.children) {
    // Recursively clean children (not root)
    const cleanedChildren = node.children
      .map((child) => cleanupTree(child, false))
      .filter((child): child is LayoutNode => child !== null);

    // If no children, remove this branch
    if (cleanedChildren.length === 0) {
      return null;
    }

    // Only promote if this is NOT the root and has only 1 child
    // At root level, keep the branch structure to avoid React remounting
    if (cleanedChildren.length === 1 && !isRoot) {
      return cleanedChildren[0];
    }

    // Update sizes
    const newSizes = cleanedChildren.map(() => 1 / cleanedChildren.length);

    return {
      ...node,
      children: cleanedChildren,
      sizes: newSizes,
    };
  }

  return node;
}

const defaultBlockState: BlockState = {
  isFocused: false,
  isMaximized: false,
  isLoading: false,
};

interface WorkspaceState {
  // Block data
  blocks: Record<string, BlockData>;
  blockStates: Record<string, BlockState>;
  activeBlockId: string | null;
  // Layout
  rootNode: LayoutNode | null;
}

interface WorkspaceContextValue extends WorkspaceState {
  workspacePath: string;
  isActive: boolean;
  // Block actions
  addBlock: (data: Partial<BlockData> & { viewType: BlockViewType }, reuseId?: string) => string;
  removeBlock: (id: string) => void;
  updateBlock: (id: string, data: Partial<BlockData>) => void;
  setActiveBlock: (id: string | null) => void;
  updateBlockState: (id: string, state: Partial<BlockState>) => void;
  getBlock: (id: string) => BlockData | undefined;
  getBlockState: (id: string) => BlockState;
  // Layout actions
  initLayout: (blockId: string) => void;
  splitBlock: (
    blockId: string,
    direction: "horizontal" | "vertical",
    newBlockData: Partial<BlockData> & { viewType: BlockViewType },
    reuseBlockId?: string
  ) => string | null;
  closeBlock: (blockId: string) => void;
  getBlockOrder: () => string[];
  resizeNodes: (nodeId: string, sizes: number[]) => void;
  moveBlock: (blockId: string, targetBlockId: string, position: "left" | "right" | "top" | "bottom" | "center") => void;
  // Sidebar navigation helpers
  findBlockBySidebarItemId: (sidebarItemId: string) => string | null;
  replaceActiveBlock: (newBlockData: Partial<BlockData> & { viewType: BlockViewType }) => string | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspaceContext() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspaceContext must be used within WorkspaceProvider");
  }
  return context;
}

// Optional hook that returns null if not in context (for components that work both ways)
export function useOptionalWorkspaceContext() {
  return useContext(WorkspaceContext);
}

// Ref type for exposing workspace methods to parent
export interface WorkspaceRef {
  addBlock: (data: Partial<BlockData> & { viewType: BlockViewType }, reuseId?: string) => string;
  splitBlock: (
    blockId: string,
    direction: "horizontal" | "vertical",
    newBlockData: Partial<BlockData> & { viewType: BlockViewType },
    reuseBlockId?: string
  ) => string | null;
  closeBlock: (blockId: string) => void;
  setActiveBlock: (id: string | null) => void;
  getActiveBlockId: () => string | null;
  getBlocks: () => Record<string, BlockData>;
  getRootNode: () => LayoutNode | null;
  initLayout: (blockId: string) => void;
  // Sidebar navigation helpers
  findBlockBySidebarItemId: (sidebarItemId: string) => string | null;
  replaceActiveBlock: (newBlockData: Partial<BlockData> & { viewType: BlockViewType }) => string | null;
}

interface WorkspaceProviderProps {
  workspacePath: string;
  isActive: boolean;
  children: ReactNode;
  workspaceRef?: React.MutableRefObject<WorkspaceRef | null>;
}

export function WorkspaceProvider({ workspacePath, isActive, children, workspaceRef }: WorkspaceProviderProps) {
  const [blocks, setBlocks] = useState<Record<string, BlockData>>({});
  const [blockStates, setBlockStates] = useState<Record<string, BlockState>>({});
  const [activeBlockId, setActiveBlockIdState] = useState<string | null>(null);
  const [rootNode, setRootNode] = useState<LayoutNode | null>(null);

  const sessionInitializedRef = useRef(false);
  const wasActiveRef = useRef(isActive);

  // Track active state changes
  useEffect(() => {
    wasActiveRef.current = isActive;
  }, [isActive]);

  // Block actions
  const addBlock = useCallback((data: Partial<BlockData> & { viewType: BlockViewType }, reuseId?: string) => {
    const id = reuseId || generateBlockId();
    const block: BlockData = {
      id,
      viewType: data.viewType,
      title: data.title,
      sidebarItemId: data.sidebarItemId,
      cwd: data.cwd,
      filePath: data.filePath,
      url: data.url,
      knowledgePath: data.knowledgePath,
      selectedDocPath: data.selectedDocPath,
      worktreePath: data.worktreePath,
      createdAt: Date.now(),
    };

    setBlocks((prev) => ({ ...prev, [id]: block }));
    setBlockStates((prev) => ({ ...prev, [id]: { ...defaultBlockState } }));
    setActiveBlockIdState(id);

    return id;
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    setBlockStates((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    setActiveBlockIdState((prev) => {
      if (prev === id) {
        const remaining = Object.keys(blocks).filter((k) => k !== id);
        return remaining.length > 0 ? remaining[0] : null;
      }
      return prev;
    });
  }, [blocks]);

  const updateBlock = useCallback((id: string, data: Partial<BlockData>) => {
    setBlocks((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...data },
    }));
  }, []);

  const setActiveBlock = useCallback((id: string | null) => {
    setActiveBlockIdState(id);
    setBlockStates((prev) => {
      const newStates = { ...prev };
      Object.keys(newStates).forEach((blockId) => {
        newStates[blockId] = { ...newStates[blockId], isFocused: blockId === id };
      });
      return newStates;
    });
  }, []);

  const updateBlockState = useCallback((id: string, state: Partial<BlockState>) => {
    setBlockStates((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || defaultBlockState), ...state },
    }));
  }, []);

  const getBlock = useCallback((id: string) => blocks[id], [blocks]);

  const getBlockState = useCallback((id: string) => blockStates[id] || defaultBlockState, [blockStates]);

  // Layout actions
  const initLayout = useCallback((blockId: string) => {
    setRootNode({
      id: generateNodeId(),
      type: "branch",
      direction: "horizontal",
      primaryBlockId: blockId,
      children: [
        {
          id: generateNodeId(),
          type: "leaf",
          blockId,
        },
      ],
      sizes: [1],
    });
  }, []);

  const splitBlock = useCallback((
    blockId: string,
    direction: "horizontal" | "vertical",
    newBlockData: Partial<BlockData> & { viewType: BlockViewType },
    reuseBlockId?: string
  ) => {
    const newBlockId = addBlock(newBlockData, reuseBlockId);

    setRootNode((current) => {
      if (!current) return current;

      const newRoot = cloneNode(current);
      const nodeToSplit = findNodeByBlockId(newRoot, blockId);
      if (!nodeToSplit) return current;

      const parentInfo = findParent(newRoot, nodeToSplit.id);

      const newLeaf: LayoutNode = {
        id: generateNodeId(),
        type: "leaf",
        blockId: newBlockId,
      };

      if (parentInfo && parentInfo.parent.direction === direction) {
        const insertIndex = parentInfo.index + 1;
        parentInfo.parent.children!.splice(insertIndex, 0, newLeaf);
        const childCount = parentInfo.parent.children!.length;
        parentInfo.parent.sizes = parentInfo.parent.children!.map(() => 1 / childCount);
        return newRoot;
      }

      const originalPrimaryBlockId =
        nodeToSplit.type === "leaf" ? nodeToSplit.blockId : nodeToSplit.primaryBlockId;

      const newBranch: LayoutNode = {
        id: generateNodeId(),
        type: "branch",
        direction,
        primaryBlockId: originalPrimaryBlockId,
        children: [{ ...nodeToSplit }, newLeaf],
        sizes: [0.5, 0.5],
      };

      if (parentInfo) {
        parentInfo.parent.children![parentInfo.index] = newBranch;
        return newRoot;
      }

      return newBranch;
    });

    return newBlockId;
  }, [addBlock]);

  const closeBlock = useCallback((blockId: string) => {
    removeBlock(blockId);

    setRootNode((current) => {
      if (!current) return null;

      const node = findNodeByBlockId(current, blockId);
      if (!node) return current;

      if (
        current.type === "branch" &&
        current.children?.length === 1 &&
        current.children[0].blockId === blockId
      ) {
        return null;
      }

      const newRoot = cloneNode(current);
      const parentInfo = findParent(newRoot, node.id);

      if (parentInfo) {
        parentInfo.parent.children = parentInfo.parent.children!.filter(
          (c) => c.id !== node.id
        );
        if (parentInfo.parent.sizes) {
          parentInfo.parent.sizes.splice(parentInfo.index, 1);
          const total = parentInfo.parent.sizes.reduce((a, b) => a + b, 0);
          parentInfo.parent.sizes = parentInfo.parent.sizes.map((s) => s / total);
        }
        return newRoot;
      }

      return current;
    });
  }, [removeBlock]);

  const getBlockOrder = useCallback(() => collectBlockIds(rootNode), [rootNode]);

  const resizeNodes = useCallback((nodeId: string, sizes: number[]) => {
    setRootNode((current) => {
      if (!current) return current;

      const newRoot = cloneNode(current);

      function findAndUpdate(node: LayoutNode): boolean {
        if (node.id === nodeId && node.type === "branch") {
          node.sizes = sizes;
          return true;
        }
        if (node.children) {
          for (const child of node.children) {
            if (findAndUpdate(child)) return true;
          }
        }
        return false;
      }

      findAndUpdate(newRoot);
      return newRoot;
    });
  }, []);

  // Move block via drag-drop
  const moveBlock = useCallback((blockId: string, targetBlockId: string, position: "left" | "right" | "top" | "bottom" | "center") => {
    if (blockId === targetBlockId) return;
    if (position === "center") {
      // Swap blocks (not implemented yet)
      return;
    }

    setRootNode((current) => {
      if (!current) return current;

      const direction = position === "left" || position === "right" ? "horizontal" : "vertical";
      const insertBefore = position === "left" || position === "top";

      // Clone the tree
      const newRoot = cloneNode(current);

      // Find source and target nodes
      const sourceNode = findNodeByBlockId(newRoot, blockId);
      const targetNode = findNodeByBlockId(newRoot, targetBlockId);
      if (!sourceNode || !targetNode) return current;

      // Find parents
      const sourceParentInfo = findParent(newRoot, sourceNode.id);
      const targetParentInfo = findParent(newRoot, targetNode.id);

      // OPTIMIZATION: If source and target have the same parent with same direction,
      // just reorder children instead of creating new branch structures
      if (
        sourceParentInfo &&
        targetParentInfo &&
        sourceParentInfo.parent.id === targetParentInfo.parent.id &&
        sourceParentInfo.parent.direction === direction
      ) {
        // Same parent, same direction - just reorder
        const parent = sourceParentInfo.parent;
        const children = parent.children!;

        // Remove source
        children.splice(sourceParentInfo.index, 1);

        // Find new target index (may have shifted after removal)
        const newTargetIndex = children.findIndex((c) => c.id === targetNode.id);

        // Insert at correct position
        const insertIndex = insertBefore ? newTargetIndex : newTargetIndex + 1;
        children.splice(insertIndex, 0, sourceNode);

        // Recalculate sizes
        parent.sizes = children.map(() => 1 / children.length);

        return newRoot;
      }

      // Different parents or different direction - need to restructure
      // Remove source from its current position
      if (sourceParentInfo) {
        sourceParentInfo.parent.children!.splice(sourceParentInfo.index, 1);
        // Recalculate sizes for source parent
        if (sourceParentInfo.parent.children!.length > 0) {
          sourceParentInfo.parent.sizes = sourceParentInfo.parent.children!.map(
            () => 1 / sourceParentInfo.parent.children!.length
          );
        }
      }

      // Find target's parent after removal (may have changed)
      const targetParentAfterRemoval = findParent(newRoot, targetNode.id);

      // Keep original node IDs to prevent React from remounting terminals
      const draggedLeaf: LayoutNode = { ...sourceNode };

      // Create new branch containing target + dragged
      const children = insertBefore
        ? [draggedLeaf, { ...targetNode }]
        : [{ ...targetNode }, draggedLeaf];

      // For React key stability: use target's blockId/primaryBlockId
      const targetPrimaryBlockId = targetNode.type === "leaf"
        ? targetNode.blockId
        : targetNode.primaryBlockId;

      const newBranch: LayoutNode = {
        id: generateNodeId(),
        type: "branch",
        direction,
        primaryBlockId: targetPrimaryBlockId,
        children,
        sizes: [0.5, 0.5],
      };

      if (targetParentAfterRemoval) {
        targetParentAfterRemoval.parent.children![targetParentAfterRemoval.index] = newBranch;
      } else {
        // Target was root
        return newBranch;
      }

      // Clean up and return
      const cleaned = cleanupTree(newRoot);
      return cleaned || current;
    });
  }, []);

  // Find block by sidebar item ID (used for sidebar navigation)
  const findBlockBySidebarItemId = useCallback((sidebarItemId: string): string | null => {
    for (const [blockId, block] of Object.entries(blocks)) {
      if (block.sidebarItemId === sidebarItemId) {
        return blockId;
      }
    }
    return null;
  }, [blocks]);

  // Replace active block with a new block (in-place replacement)
  const replaceActiveBlock = useCallback((newBlockData: Partial<BlockData> & { viewType: BlockViewType }): string | null => {
    if (!activeBlockId || !rootNode) return null;

    // Find the node for the active block
    const activeNode = findNodeByBlockId(rootNode, activeBlockId);
    if (!activeNode) return null;

    // Generate new block ID
    const newBlockId = generateBlockId();
    const newBlock: BlockData = {
      id: newBlockId,
      viewType: newBlockData.viewType,
      title: newBlockData.title,
      sidebarItemId: newBlockData.sidebarItemId,
      cwd: newBlockData.cwd,
      filePath: newBlockData.filePath,
      url: newBlockData.url,
      knowledgePath: newBlockData.knowledgePath,
      selectedDocPath: newBlockData.selectedDocPath,
      worktreePath: newBlockData.worktreePath,
      createdAt: Date.now(),
    };

    // Update blocks state - remove old, add new
    setBlocks((prev) => {
      const { [activeBlockId]: _, ...rest } = prev;
      return { ...rest, [newBlockId]: newBlock };
    });

    // Update block states
    setBlockStates((prev) => {
      const { [activeBlockId]: _, ...rest } = prev;
      return { ...rest, [newBlockId]: { ...defaultBlockState, isFocused: true } };
    });

    // Update layout - replace blockId in the leaf node
    setRootNode((current) => {
      if (!current) return current;
      const newRoot = cloneNode(current);

      function updateBlockIdInNode(node: LayoutNode): boolean {
        if (node.type === "leaf" && node.blockId === activeBlockId) {
          node.blockId = newBlockId;
          return true;
        }
        if (node.children) {
          for (const child of node.children) {
            if (updateBlockIdInNode(child)) return true;
          }
        }
        return false;
      }

      updateBlockIdInNode(newRoot);
      return newRoot;
    });

    // Set new block as active
    setActiveBlockIdState(newBlockId);

    return newBlockId;
  }, [activeBlockId, rootNode]);

  // Workspace initialization (ensure workspace exists in backend)
  // Note: Block creation is handled by ViewSwitcher component
  useEffect(() => {
    if (sessionInitializedRef.current) return;
    if (!isActive) return;

    const init = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");

        const exists = await invoke<boolean>("workspace_exists", { workspacePath });

        if (!exists) {
          const name = workspacePath.split("/").pop() || "workspace";
          await invoke("workspace_init", { workspacePath, name });
        }

        // Register project in SQLite database (for MCP tools)
        // This ensures task_create and other MCP tools can find the project
        const projectName = workspacePath.split("/").pop() || "unknown";
        try {
          const res = await fetch("http://localhost:19432/api/projects/by-path?path=" + encodeURIComponent(workspacePath));
          if (res.status === 404) {
            // Project not registered, try to create with folder name as ID
            let projectId = projectName;
            let createRes = await fetch("http://localhost:19432/api/projects", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: projectId,
                name: projectName,
                path: workspacePath,
                status: "active",
              }),
            });

            // If 409 conflict (same ID exists with different path), add path hash suffix
            if (createRes.status === 409) {
              const pathHash = Math.abs(workspacePath.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0)).toString(16).slice(0, 6);
              projectId = `${projectName}-${pathHash}`;
              createRes = await fetch("http://localhost:19432/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  id: projectId,
                  name: projectName,
                  path: workspacePath,
                  status: "active",
                }),
              });
            }

            if (createRes.ok) {
              console.log("[WorkspaceProvider] Project registered:", projectId);
            }
          }
        } catch (apiError) {
          // API server may not be running, that's okay
          console.debug("[WorkspaceProvider] Could not register project (API may be offline):", apiError);
        }

        sessionInitializedRef.current = true;
      } catch (e) {
        console.error("[WorkspaceProvider] Init error:", e);
        sessionInitializedRef.current = true;
      }
    };

    init();
  }, [isActive, workspacePath]);

  // Expose methods to parent via ref
  useEffect(() => {
    if (workspaceRef && isActive) {
      workspaceRef.current = {
        addBlock,
        splitBlock,
        closeBlock,
        setActiveBlock,
        getActiveBlockId: () => activeBlockId,
        getBlocks: () => blocks,
        getRootNode: () => rootNode,
        initLayout,
        findBlockBySidebarItemId,
        replaceActiveBlock,
      };
    }
    return () => {
      if (workspaceRef && workspaceRef.current) {
        // Don't clear if another workspace took over
      }
    };
  }, [isActive, workspaceRef, addBlock, splitBlock, closeBlock, setActiveBlock, activeBlockId, blocks, rootNode, initLayout, findBlockBySidebarItemId, replaceActiveBlock]);

  const value: WorkspaceContextValue = {
    workspacePath,
    isActive,
    blocks,
    blockStates,
    activeBlockId,
    rootNode,
    addBlock,
    removeBlock,
    updateBlock,
    setActiveBlock,
    updateBlockState,
    getBlock,
    getBlockState,
    initLayout,
    splitBlock,
    closeBlock,
    getBlockOrder,
    resizeNodes,
    moveBlock,
    findBlockBySidebarItemId,
    replaceActiveBlock,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
