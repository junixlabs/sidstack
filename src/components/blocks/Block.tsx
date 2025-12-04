import { useDroppable, useDndContext } from "@dnd-kit/core";
import { Loader2 } from "lucide-react";
import { memo, useCallback, Suspense } from "react";

import { cn } from "@/lib/utils";
import { useBlockStore } from "@/stores/blockStore";
import { useLayoutStore } from "@/stores/layoutStore";
import type { DropPosition } from "@/types/block";

import { BlockFrame } from "./BlockFrame";
import { getBlockView } from "./BlockRegistry";


interface BlockProps {
  blockId: string;
  blockIndex?: number;  // 1-based position for display and Cmd+N navigation
}

/**
 * Loading fallback for block content
 */
function BlockLoading() {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

/**
 * Error fallback for unknown block types
 */
function BlockError({ viewType }: { viewType: string }) {
  return (
    <div className="flex items-center justify-center h-full w-full text-muted-foreground">
      <p>Unknown block type: {viewType}</p>
    </div>
  );
}

/**
 * Drop zone indicator component
 * Only visible when actively dragging another block
 */
function DropZone({
  blockId,
  position,
  isActive,
}: {
  blockId: string;
  position: DropPosition;
  isActive: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${blockId}-${position}`,
    data: { blockId, position },
    disabled: !isActive, // Disable droppable when not dragging
  });

  // Don't render at all when not dragging
  // but adding as extra safety
  if (!isActive) return null;

  const positionClasses: Record<DropPosition, string> = {
    left: "left-0 top-0 w-1/3 h-full",
    right: "right-0 top-0 w-1/3 h-full",
    top: "top-0 left-0 w-full h-1/3",
    bottom: "bottom-0 left-0 w-full h-1/3",
    center: "inset-0",
  };

  // Use neutral colors for drop zones
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute z-50 transition-all duration-150 pointer-events-auto",
        positionClasses[position],
        isOver
          ? "bg-[var(--surface-3)] border-2 border-[var(--border-default)]"
          : "bg-[var(--surface-2)]/50 border border-dashed border-[var(--border-muted)]"
      )}
    />
  );
}

/**
 * Block component that renders a block with its frame and content.
 * Uses BlockRegistry to find the appropriate view component.
 * Supports drag-drop with drop zones on each side.
 */
export const Block = memo(function Block({ blockId, blockIndex }: BlockProps) {

  // Get block data and state
  const block = useBlockStore((state) => state.blocks[blockId]);
  const blockState = useBlockStore((state) => state.blockStates[blockId]);
  const setActiveBlock = useBlockStore((state) => state.setActiveBlock);
  const updateBlock = useBlockStore((state) => state.updateBlock);

  // Get layout actions
  const closeBlock = useLayoutStore((state) => state.closeBlock);
  const maximizeBlock = useLayoutStore((state) => state.maximizeBlock);
  const splitBlock = useLayoutStore((state) => state.splitBlock);
  const maximizedBlockId = useLayoutStore((state) => state.maximizedBlockId);

  // Get drag state from DndContext - show drop zones when dragging a different block
  const { active } = useDndContext();
  const isDragActive = active !== null && active.id !== blockId;

  // Handlers
  const handleFocus = useCallback(() => {
    setActiveBlock(blockId);
  }, [blockId, setActiveBlock]);

  const handleClose = useCallback(() => {
    closeBlock(blockId);
  }, [blockId, closeBlock]);

  const handleMaximize = useCallback(() => {
    maximizeBlock(blockId);
  }, [blockId, maximizeBlock]);

  const handleTitleChange = useCallback(
    (title: string) => {
      updateBlock(blockId, { title });
    },
    [blockId, updateBlock]
  );

  const handleSplitHorizontal = useCallback(() => {
    if (!block) return;
    splitBlock(blockId, "horizontal", {
      viewType: block.viewType,
      title: block.title || "Block",
      cwd: block.cwd,
    });
  }, [blockId, block, splitBlock]);

  const handleSplitVertical = useCallback(() => {
    if (!block) return;
    splitBlock(blockId, "vertical", {
      viewType: block.viewType,
      title: block.title || "Block",
      cwd: block.cwd,
    });
  }, [blockId, block, splitBlock]);

  const handleDuplicate = useCallback(() => {
    if (!block) return;
    splitBlock(blockId, "horizontal", {
      viewType: block.viewType,
      title: block.title || "Block",
      cwd: block.cwd,
    });
  }, [blockId, block, splitBlock]);

  // If block doesn't exist, render nothing
  if (!block) {
    return null;
  }

  // Get the view component from registry
  const ViewComponent = getBlockView(block.viewType);

  // If no view component registered, show error
  if (!ViewComponent) {
    return (
      <BlockFrame
        blockId={blockId}
        blockIndex={blockIndex}
        viewType={block.viewType}
        title={block.title}
        isFocused={blockState?.isFocused}
        isMaximized={maximizedBlockId === blockId}
        onClose={handleClose}
        onMaximize={handleMaximize}
        onFocus={handleFocus}
        onSplitHorizontal={handleSplitHorizontal}
        onSplitVertical={handleSplitVertical}
        onDuplicate={handleDuplicate}
      >
        <BlockError viewType={block.viewType} />
      </BlockFrame>
    );
  }

  // Render block with frame, content, and drop zones
  // The outer div handles focus when clicking anywhere in the block (including terminal content)
  return (
    <div className="relative h-full w-full" onMouseDown={handleFocus}>
      {/* Drop zones container - only interactive when actively dragging */}
      {isDragActive && (
        <div className="absolute inset-0 z-40 pointer-events-none">
          <DropZone blockId={blockId} position="left" isActive={isDragActive} />
          <DropZone blockId={blockId} position="right" isActive={isDragActive} />
          <DropZone blockId={blockId} position="top" isActive={isDragActive} />
          <DropZone blockId={blockId} position="bottom" isActive={isDragActive} />
        </div>
      )}

      <BlockFrame
        blockId={blockId}
        blockIndex={blockIndex}
        viewType={block.viewType}
        title={block.title}
        isFocused={blockState?.isFocused}
        isMaximized={maximizedBlockId === blockId}
        onClose={handleClose}
        onMaximize={handleMaximize}
        onFocus={handleFocus}
        onSplitHorizontal={handleSplitHorizontal}
        onSplitVertical={handleSplitVertical}
        onDuplicate={handleDuplicate}
      >
        <Suspense fallback={<BlockLoading />}>
          <ViewComponent
            block={block}
            blockState={blockState || { isFocused: false, isMaximized: false, isLoading: false }}
            onTitleChange={handleTitleChange}
          />
        </Suspense>
      </BlockFrame>
    </div>
  );
});

export default Block;
