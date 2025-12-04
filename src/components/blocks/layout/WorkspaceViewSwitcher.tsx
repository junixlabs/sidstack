/**
 * WorkspaceViewSwitcher - Single fullscreen view at a time
 *
 * Instead of tile layout, this component shows one view at a time:
 * - Project Hub view
 * - Task Manager view
 * - Knowledge Browser view
 * - Ticket Queue view
 * - Training Room view
 *
 * Views are hidden with visibility:hidden (not unmounted) so:
 * - State is preserved when switching views
 * - Fast switching between views
 */

import { memo, useEffect, useRef } from "react";

import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";
import type { BlockViewType } from "@/types/block";

import { WorkspaceBlock } from "../WorkspaceBlock";

// Sidebar item to view mapping
interface ViewConfig {
  id: string;
  blockType: BlockViewType;
  title: string;
}

const VIEW_CONFIGS: ViewConfig[] = [
  { id: "project-hub", blockType: "project-hub", title: "Project Hub" },
  { id: "knowledge", blockType: "knowledge-browser", title: "Knowledge" },
  { id: "task-manager", blockType: "task-manager", title: "Task Manager" },
  { id: "ticket-queue", blockType: "ticket-queue", title: "Ticket Queue" },
  { id: "specs", blockType: "specs-browser", title: "Specs" },
  { id: "training-room", blockType: "training-room", title: "Training Room" },
  { id: "settings", blockType: "settings", title: "Project Settings" },
];

interface WorkspaceViewSwitcherProps {
  activeViewId: string;
}

export const WorkspaceViewSwitcher = memo(function WorkspaceViewSwitcher({
  activeViewId,
}: WorkspaceViewSwitcherProps) {
  const {
    blocks,
    addBlock,
    closeBlock,
    setActiveBlock,
    findBlockBySidebarItemId,
    workspacePath,
  } = useWorkspaceContext();

  const migrationDoneRef = useRef(false);

  // Migration: Fix old blocks with wrong viewType (e.g., "preview" -> "specs-browser")
  useEffect(() => {
    if (migrationDoneRef.current) return;

    const blocksArray = Object.values(blocks);
    if (blocksArray.length === 0) return;

    let needsMigration = false;
    for (const block of blocksArray) {
      if (block.sidebarItemId) {
        const config = VIEW_CONFIGS.find((v) => v.id === block.sidebarItemId);
        if (config && block.viewType !== config.blockType) {
          needsMigration = true;
          closeBlock(block.id);
          addBlock({
            viewType: config.blockType,
            title: config.title,
            sidebarItemId: block.sidebarItemId,
            cwd: workspacePath,
          });
        }
      }
    }

    if (!needsMigration) {
      migrationDoneRef.current = true;
    }
  }, [blocks, closeBlock, addBlock, workspacePath]);

  // Create view block if doesn't exist when activeViewId changes
  useEffect(() => {
    if (!activeViewId) return;

    const existingBlockId = findBlockBySidebarItemId(activeViewId);
    if (existingBlockId) {
      // View exists, just focus it
      setActiveBlock(existingBlockId);
      return;
    }

    // Create new block for this view
    const viewConfig = VIEW_CONFIGS.find((v) => v.id === activeViewId);
    if (viewConfig) {
      const blockId = addBlock({
        viewType: viewConfig.blockType,
        title: viewConfig.title,
        sidebarItemId: activeViewId,
        cwd: workspacePath,
      });
      setActiveBlock(blockId);
    }
  }, [activeViewId, findBlockBySidebarItemId, addBlock, setActiveBlock, workspacePath]);

  // Get all view blocks (blocks with sidebarItemId)
  const viewBlocks = Object.values(blocks).filter((block) => block.sidebarItemId);

  if (viewBlocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full text-[var(--text-muted)]">
        <div className="text-center">
          <p className="text-lg font-medium mb-2 text-[var(--text-secondary)]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {viewBlocks.map((block, index) => {
        const isActive = block.sidebarItemId === activeViewId;

        return (
          <div
            key={block.id}
            className={cn(
              "absolute inset-0",
              // Use visibility instead of display for xterm.js compatibility
              isActive ? "visible z-10" : "invisible z-0"
            )}
            style={{
              // Ensure inactive views don't capture pointer events
              pointerEvents: isActive ? "auto" : "none",
            }}
          >
            <WorkspaceBlock blockId={block.id} blockIndex={index + 1} />
          </div>
        );
      })}
    </div>
  );
});

export default WorkspaceViewSwitcher;
