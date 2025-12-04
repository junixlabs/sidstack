import { create } from "zustand";

import type { LayoutNode, DropPosition, BlockData, BlockViewType } from "@/types/block";

import { useBlockStore } from "./blockStore";

/**
 * Generate a unique layout node ID
 */
function generateNodeId(): string {
  return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Find a node in the tree by ID
 */
function findNode(root: LayoutNode, nodeId: string): LayoutNode | null {
  if (root.id === nodeId) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findNode(child, nodeId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Find parent of a node
 */
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

/**
 * Find node by block ID
 */
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

/**
 * Find first leaf node (for setting active block after close)
 */
function findFirstLeaf(node: LayoutNode): LayoutNode | null {
  if (node.type === "leaf") return node;
  if (node.children && node.children.length > 0) {
    return findFirstLeaf(node.children[0]);
  }
  return null;
}

/**
 * Collect all blockIds from the layout tree (DFS order)
 * Returns blockIds in left-to-right, top-to-bottom visual order
 */
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

/**
 * Get ordered list of blockIds for navigation (Cmd+1-9)
 * Same as collectBlockIds but exported for external use
 */
function getBlockOrder(node: LayoutNode | null): string[] {
  return collectBlockIds(node);
}

/**
 * Deep clone a layout node
 */
function cloneNode(node: LayoutNode): LayoutNode {
  return JSON.parse(JSON.stringify(node));
}

/**
 * Clean up empty branch nodes
 *
 * IMPORTANT: We intentionally do NOT promote single-child branches at the root level.
 * This is to prevent React from remounting all blocks when the layout structure changes.
 *
 * The problem: When we promote a child to replace its parent, React sees a completely
 * different tree structure and unmounts/remounts all components, killing all PTY processes.
 */
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

// Per-workspace layout storage
interface WorkspaceLayoutState {
  rootNode: LayoutNode | null;
  maximizedBlockId: string | null;
  savedLayout: LayoutNode | null;
}

interface LayoutStore {
  // Root layout node - current workspace
  rootNode: LayoutNode | null;

  // Per-workspace storage (for workspace switching)
  workspaceLayouts: Record<string, WorkspaceLayoutState>;

  // Actions
  initLayout: (blockId: string) => void;
  splitBlock: (
    blockId: string,
    direction: "horizontal" | "vertical",
    newBlockData: Partial<BlockData> & { viewType: BlockViewType },
    reuseBlockId?: string // Optional: reuse existing blockId (for PTY persistence)
  ) => string | null;
  closeBlock: (blockId: string) => void;
  moveBlock: (blockId: string, targetBlockId: string, position: DropPosition) => void;
  resizeNodes: (nodeId: string, sizes: number[]) => void;
  maximizeBlock: (blockId: string) => void;
  restoreLayout: () => void;
  validateAndCleanState: () => void;

  // State
  maximizedBlockId: string | null;
  savedLayout: LayoutNode | null;

  // Utilities
  getNodeByBlockId: (blockId: string) => LayoutNode | null;
  getBlockIdsFromLayout: () => string[];
  getBlockOrder: () => string[];

  // Clear
  clearLayout: () => void;

  // Workspace switching
  saveWorkspaceLayout: (workspacePath: string) => void;
  restoreWorkspaceLayout: (workspacePath: string) => boolean;
  hasWorkspaceLayout: (workspacePath: string) => boolean;
  clearWorkspaceLayout: (workspacePath: string) => void;
}

// NOTE: Layout persistence is handled by useWorkspacePersistence hook
// which saves/restores per-workspace sessions. Global persistence is disabled
// to prevent cross-workspace data accumulation.
export const useLayoutStore = create<LayoutStore>()((set, get) => ({
  rootNode: null,
      maximizedBlockId: null,
      savedLayout: null,
      workspaceLayouts: {},

      initLayout: (blockId) => {
        // IMPORTANT: Root is ALWAYS a branch, even for single block.
        // This prevents React from remounting blocks when splitting
        // because the tree structure remains consistent (PanelGroup > Panel > ...).
        set({
          rootNode: {
            id: generateNodeId(),
            type: "branch",
            direction: "horizontal",
            primaryBlockId: blockId, // For React key stability
            children: [
              {
                id: generateNodeId(),
                type: "leaf",
                blockId,
              },
            ],
            sizes: [1],
          },
        });
      },

      splitBlock: (blockId, direction, newBlockData, reuseBlockId) => {
        const { rootNode } = get();
        if (!rootNode) return null;

        // Create new block in block store (optionally reuse existing ID for PTY persistence)
        const newBlockId = useBlockStore.getState().addBlock(newBlockData, reuseBlockId);

        // Clone the tree for immutability
        const newRoot = cloneNode(rootNode);

        // Find the node to split
        const nodeToSplit = findNodeByBlockId(newRoot, blockId);
        if (!nodeToSplit) return newBlockId;

        // Find parent of node to split
        const parentInfo = findParent(newRoot, nodeToSplit.id);

        // Create new leaf for the new block
        const newLeaf: LayoutNode = {
          id: generateNodeId(),
          type: "leaf",
          blockId: newBlockId,
        };

        // OPTIMIZATION: If parent has the same direction, just add as sibling
        // instead of creating a nested branch. This keeps the tree flat.
        if (parentInfo && parentInfo.parent.direction === direction) {
          // Insert after the node being split
          const insertIndex = parentInfo.index + 1;
          parentInfo.parent.children!.splice(insertIndex, 0, newLeaf);

          // Recalculate sizes evenly
          const childCount = parentInfo.parent.children!.length;
          parentInfo.parent.sizes = parentInfo.parent.children!.map(() => 1 / childCount);

          set({ rootNode: newRoot });
          return newBlockId;
        }

        // Different direction or no parent: wrap in a new branch
        // IMPORTANT: Set primaryBlockId to prevent React from remounting the block
        // This keeps the React key stable when structure changes from leaf to branch
        const originalPrimaryBlockId = nodeToSplit.type === "leaf"
          ? nodeToSplit.blockId
          : nodeToSplit.primaryBlockId;

        const newBranch: LayoutNode = {
          id: generateNodeId(),
          type: "branch",
          direction,
          primaryBlockId: originalPrimaryBlockId, // For React key stability!
          children: [
            { ...nodeToSplit }, // Keep original ID!
            newLeaf,
          ],
          sizes: [0.5, 0.5],
        };

        if (parentInfo) {
          // Replace the node in parent's children
          parentInfo.parent.children![parentInfo.index] = newBranch;
          set({ rootNode: newRoot });
        } else {
          // Root is always a branch now, so this shouldn't happen
          // But keep as fallback for safety
          set({ rootNode: newBranch });
        }

        return newBlockId;
      },

      closeBlock: (blockId) => {
        const { rootNode } = get();
        if (!rootNode) return;

        // Remove block from block store
        useBlockStore.getState().removeBlock(blockId);

        // Find the node to close
        const node = findNodeByBlockId(rootNode, blockId);
        if (!node) return;

        // If this is the only block (root is branch with single leaf child), clear layout
        if (
          rootNode.type === "branch" &&
          rootNode.children?.length === 1 &&
          rootNode.children[0].blockId === blockId
        ) {
          set({ rootNode: null });
          return;
        }

        // Clone and modify
        const newRoot = cloneNode(rootNode);
        const parentInfo = findParent(newRoot, node.id);

        if (parentInfo) {
          // Remove from parent's children
          parentInfo.parent.children = parentInfo.parent.children!.filter(
            (c) => c.id !== node.id
          );

          // Adjust sizes
          if (parentInfo.parent.sizes) {
            parentInfo.parent.sizes.splice(parentInfo.index, 1);
            // Normalize sizes
            const total = parentInfo.parent.sizes.reduce((a, b) => a + b, 0);
            parentInfo.parent.sizes = parentInfo.parent.sizes.map((s) => s / total);
          }

          // Clean up tree
          const cleaned = cleanupTree(newRoot);
          set({ rootNode: cleaned });

          // Set activeBlockId to first remaining block in layout
          if (cleaned) {
            const firstLeaf = findFirstLeaf(cleaned);
            if (firstLeaf?.blockId) {
              useBlockStore.getState().setActiveBlock(firstLeaf.blockId);
            }
          }
        }
      },

      moveBlock: (blockId, targetBlockId, position) => {
        if (blockId === targetBlockId) return;
        if (position === "center") {
          // Swap blocks (not implemented yet)
          return;
        }

        const { rootNode } = get();
        if (!rootNode) return;

        const direction =
          position === "left" || position === "right" ? "horizontal" : "vertical";
        const insertBefore = position === "left" || position === "top";

        const block = useBlockStore.getState().getBlock(blockId);
        if (!block) return;

        // Clone the tree
        const newRoot = cloneNode(rootNode);

        // Find source and target nodes
        const sourceNode = findNodeByBlockId(newRoot, blockId);
        const targetNode = findNodeByBlockId(newRoot, targetBlockId);
        if (!sourceNode || !targetNode) return;

        // OPTIMIZATION: If source and target have the same parent with same direction,
        // just reorder children instead of creating new branch structures
        const sourceParentInfo = findParent(newRoot, sourceNode.id);
        const targetParentInfo = findParent(newRoot, targetNode.id);

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
          const newTargetIndex = children.findIndex(
            (c) => c.id === targetNode.id
          );

          // Insert at correct position
          const insertIndex = insertBefore ? newTargetIndex : newTargetIndex + 1;
          children.splice(insertIndex, 0, sourceNode);

          // Recalculate sizes
          parent.sizes = children.map(() => 1 / children.length);

          set({ rootNode: newRoot });
          return;
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
          // NOTE: Don't flatten here - let cleanupTree handle it
        }

        // Find target's parent after removal (may have changed)
        const targetParentAfterRemoval = findParent(newRoot, targetNode.id);

        // Keep original node IDs to prevent React from remounting blocks
        // Source node keeps its original ID (it's just moving, not being recreated)
        const draggedLeaf: LayoutNode = { ...sourceNode };

        // Create new branch containing target + dragged
        // Target node also keeps its original ID
        const children = insertBefore
          ? [draggedLeaf, { ...targetNode }]
          : [{ ...targetNode }, draggedLeaf];

        // For React key stability: use target's blockId/primaryBlockId since
        // the new branch replaces the target's position in the tree
        const targetPrimaryBlockId = targetNode.type === "leaf"
          ? targetNode.blockId
          : targetNode.primaryBlockId;

        const newBranch: LayoutNode = {
          id: generateNodeId(),
          type: "branch",
          direction,
          primaryBlockId: targetPrimaryBlockId, // For React key stability!
          children,
          sizes: [0.5, 0.5],
        };

        if (targetParentAfterRemoval) {
          targetParentAfterRemoval.parent.children![targetParentAfterRemoval.index] = newBranch;
        } else {
          // Target was root
          set({ rootNode: newBranch });
          return;
        }

        // Clean up and set
        const cleaned = cleanupTree(newRoot);
        set({ rootNode: cleaned });
      },

      resizeNodes: (nodeId, sizes) => {
        const { rootNode } = get();
        if (!rootNode) return;

        const newRoot = cloneNode(rootNode);
        const node = findNode(newRoot, nodeId);

        if (node && node.type === "branch") {
          node.sizes = sizes;
          set({ rootNode: newRoot });
        }
      },

      maximizeBlock: (blockId) => {
        const { rootNode, maximizedBlockId } = get();

        if (maximizedBlockId === blockId) {
          // Restore
          get().restoreLayout();
        } else {
          // Maximize - use branch structure for consistency
          // This prevents tree structure changes that could cause React remounting
          set({
            savedLayout: rootNode ? cloneNode(rootNode) : null,
            maximizedBlockId: blockId,
            rootNode: {
              id: generateNodeId(),
              type: "branch",
              direction: "horizontal",
              primaryBlockId: blockId, // For React key stability
              children: [
                {
                  id: generateNodeId(),
                  type: "leaf",
                  blockId,
                },
              ],
              sizes: [1],
            },
          });
        }
      },

      restoreLayout: () => {
        const { savedLayout } = get();
        if (savedLayout) {
          set({
            rootNode: savedLayout,
            savedLayout: null,
            maximizedBlockId: null,
          });
        }
      },

      getNodeByBlockId: (blockId) => {
        const { rootNode } = get();
        if (!rootNode) return null;
        return findNodeByBlockId(rootNode, blockId);
      },

      getBlockIdsFromLayout: () => {
        const { rootNode } = get();
        return collectBlockIds(rootNode);
      },

      getBlockOrder: () => {
        const { rootNode } = get();
        return getBlockOrder(rootNode);
      },

      clearLayout: () => {
        set({
          rootNode: null,
          maximizedBlockId: null,
          savedLayout: null,
        });
      },

  validateAndCleanState: () => {
    let { rootNode } = get();
    const blockStore = useBlockStore.getState();
    const { blocks, activeBlockId } = blockStore;

    // MIGRATION: Convert old root-as-leaf structure to root-as-branch
    if (rootNode && rootNode.type === "leaf" && rootNode.blockId) {
      console.log("[layoutStore] Migrating root from leaf to branch structure");
      rootNode = {
        id: generateNodeId(),
        type: "branch",
        direction: "horizontal",
        primaryBlockId: rootNode.blockId,
        children: [rootNode],
        sizes: [1],
      };
      set({ rootNode });
    }

    // Get blockIds from layout
    const layoutBlockIds = new Set(collectBlockIds(rootNode));

    // Collect exited block IDs to remove from layout
    const exitedBlockIds: string[] = [];

    // Remove orphaned blocks and collect exited blocks
    Object.keys(blocks).forEach((blockId) => {
      const block = blocks[blockId];
      if (!layoutBlockIds.has(blockId)) {
        blockStore.removeBlock(blockId);
        return;
      }
      if (block.title?.includes("(exited:")) {
        exitedBlockIds.push(blockId);
      }
    });

    // Remove exited blocks from layout
    exitedBlockIds.forEach((blockId) => {
      get().closeBlock(blockId);
    });

    // Validate activeBlockId
    if (activeBlockId && !layoutBlockIds.has(activeBlockId)) {
      const currentRoot = get().rootNode;
      if (currentRoot) {
        const firstLeaf = findFirstLeaf(currentRoot);
        blockStore.setActiveBlock(firstLeaf?.blockId ?? null);
      } else {
        blockStore.setActiveBlock(null);
      }
    }
  },

  // Save current layout to workspace storage
  saveWorkspaceLayout: (workspacePath) => {
    const { rootNode, maximizedBlockId, savedLayout } = get();
    // Only save if there's content
    if (rootNode) {
      set((state) => ({
        workspaceLayouts: {
          ...state.workspaceLayouts,
          [workspacePath]: {
            rootNode: cloneNode(rootNode),
            maximizedBlockId,
            savedLayout: savedLayout ? cloneNode(savedLayout) : null,
          },
        },
      }));
      console.log("[LayoutStore] Saved workspace layout:", workspacePath);
    }
  },

  // Restore layout from workspace storage
  restoreWorkspaceLayout: (workspacePath) => {
    const { workspaceLayouts } = get();
    const savedLayout = workspaceLayouts[workspacePath];
    if (savedLayout) {
      set({
        rootNode: savedLayout.rootNode ? cloneNode(savedLayout.rootNode) : null,
        maximizedBlockId: savedLayout.maximizedBlockId,
        savedLayout: savedLayout.savedLayout ? cloneNode(savedLayout.savedLayout) : null,
      });
      console.log("[LayoutStore] Restored workspace layout:", workspacePath);
      return true;
    }
    return false;
  },

  // Check if workspace has saved layout
  hasWorkspaceLayout: (workspacePath) => {
    return !!get().workspaceLayouts[workspacePath];
  },

  // Clear saved workspace layout
  clearWorkspaceLayout: (workspacePath) => {
    set((state) => {
      const { [workspacePath]: _, ...rest } = state.workspaceLayouts;
      return { workspaceLayouts: rest };
    });
  },
}));
