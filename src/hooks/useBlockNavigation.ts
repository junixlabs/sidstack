/**
 * useBlockNavigation Hook
 *
 * Provides navigation helpers for opening block views from other blocks.
 * Uses WorkspaceContext to manage blocks.
 */

import { useCallback } from "react";

import { useOptionalWorkspaceContext } from "@/contexts/WorkspaceContext";
import type { BlockViewType } from "@/types/block";

interface BlockNavigationOptions {
  /** If true, replace the current active block. If false (default), split or find existing. */
  replace?: boolean;
  /** Spec path for specs-browser view */
  selectedSpecPath?: string;
  /** Knowledge path for knowledge-browser view */
  selectedKnowledgePath?: string;
  /** Task ID for task-manager view */
  taskId?: string;
  /** Task ID to select in task-manager */
  selectedTaskId?: string;
  /** Filter tasks by module in task-manager */
  filterByModule?: string;
}

/**
 * Hook for navigating between block views
 */
export function useBlockNavigation() {
  const workspace = useOptionalWorkspaceContext();

  /**
   * Open or navigate to a block view
   */
  const navigateToBlockView = useCallback(
    (viewType: BlockViewType, options: BlockNavigationOptions = {}) => {
      if (!workspace) {
        console.warn("[useBlockNavigation] No workspace context available");
        return null;
      }

      const {
        replace = false,
        selectedSpecPath,
        selectedKnowledgePath,
        selectedTaskId,
        filterByModule,
      } = options;

      // Build block data based on viewType
      const blockData: Parameters<typeof workspace.addBlock>[0] = {
        viewType,
        title: getBlockTitle(viewType),
      };

      // Add view-specific data
      if (viewType === "specs-browser" && selectedSpecPath) {
        blockData.selectedDocPath = selectedSpecPath;
      }
      if (viewType === "knowledge-browser" && selectedKnowledgePath) {
        blockData.knowledgePath = selectedKnowledgePath;
      }
      if (viewType === "task-manager") {
        if (selectedTaskId) blockData.selectedTaskId = selectedTaskId;
        if (filterByModule) blockData.filterByModule = filterByModule;
      }
      // Check if a block of this type already exists
      const existingBlockId = findBlockByViewType(workspace.blocks, viewType);

      if (existingBlockId) {
        // Focus existing block and update its data
        workspace.setActiveBlock(existingBlockId);
        workspace.updateBlock(existingBlockId, {
          // Pass additional props that might help the view select the right item
          sidebarItemId: blockData.sidebarItemId,
          selectedDocPath: blockData.selectedDocPath,
          knowledgePath: blockData.knowledgePath,
          selectedTaskId: blockData.selectedTaskId,
          filterByModule: blockData.filterByModule,
        });
        return existingBlockId;
      }

      if (replace && workspace.activeBlockId) {
        // Replace active block
        return workspace.replaceActiveBlock(blockData);
      }

      // Split current block horizontally to add new block
      if (workspace.activeBlockId) {
        return workspace.splitBlock(workspace.activeBlockId, "horizontal", blockData);
      }

      // No active block, just add
      return workspace.addBlock(blockData);
    },
    [workspace]
  );

  /**
   * Navigate to Specs Browser with a specific spec selected
   */
  const navigateToSpecsBrowser = useCallback(
    (specPath: string) => {
      return navigateToBlockView("specs-browser", { selectedSpecPath: specPath });
    },
    [navigateToBlockView]
  );

  /**
   * Navigate to Knowledge Browser with a specific doc selected
   */
  const navigateToKnowledgeBrowser = useCallback(
    (knowledgePath: string) => {
      return navigateToBlockView("knowledge-browser", { selectedKnowledgePath: knowledgePath });
    },
    [navigateToBlockView]
  );

  /**
   * Navigate to Task Manager, optionally selecting a task or filtering by module
   */
  const navigateToTaskManager = useCallback(
    (options?: { selectedTaskId?: string; filterByModule?: string }) => {
      return navigateToBlockView("task-manager", options || {});
    },
    [navigateToBlockView]
  );

  return {
    navigateToBlockView,
    navigateToSpecsBrowser,
    navigateToKnowledgeBrowser,
    navigateToTaskManager,
  };
}

/**
 * Find first block matching a view type
 */
function findBlockByViewType(
  blocks: Record<string, { viewType: BlockViewType }>,
  viewType: BlockViewType
): string | null {
  for (const [blockId, block] of Object.entries(blocks)) {
    if (block.viewType === viewType) {
      return blockId;
    }
  }
  return null;
}

/**
 * Get default title for block type
 */
function getBlockTitle(viewType: BlockViewType): string {
  const titles: Record<BlockViewType, string> = {
    preview: "Preview",
    webview: "Web View",
    settings: "Project Settings",
    "specs-browser": "Specs Browser",
    "knowledge-browser": "Knowledge Browser",
    "training-room": "Training Room",
    "task-manager": "Task Manager",
    "worktree-status": "Worktree Status",
    "ticket-queue": "Ticket Queue",
    "project-hub": "Project Hub",
  };
  return titles[viewType] || viewType;
}
