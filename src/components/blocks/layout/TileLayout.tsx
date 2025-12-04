import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Terminal } from "lucide-react";
import { memo, useCallback, useState, useMemo } from "react";
import {
  PanelGroup,
  Panel,
  PanelResizeHandle,
} from "react-resizable-panels";

import { cn } from "@/lib/utils";
import { useBlockStore } from "@/stores/blockStore";
import { useLayoutStore } from "@/stores/layoutStore";
import type { LayoutNode, DropPosition } from "@/types/block";

import { Block } from "../Block";



/**
 * Resize handle between panels
 */
const ResizeHandle = memo(function ResizeHandle({
  direction,
}: {
  direction: "horizontal" | "vertical";
}) {
  return (
    <PanelResizeHandle
      className={cn(
        "relative group",
        direction === "horizontal" ? "w-1 hover:w-2" : "h-1 hover:h-2",
        "transition-all duration-150",
        "bg-transparent hover:bg-[var(--surface-2)]"
      )}
    >
      {/* Visual indicator */}
      <div
        className={cn(
          "absolute bg-[var(--border-muted)] group-hover:bg-[var(--border-default)] transition-colors",
          direction === "horizontal"
            ? "left-0 top-2 bottom-2 w-px"
            : "top-0 left-2 right-2 h-px"
        )}
      />
    </PanelResizeHandle>
  );
});

/**
 * Drag overlay preview
 */
function DragPreview({ blockId }: { blockId: string }) {
  const block = useBlockStore((state) => state.blocks[blockId]);

  if (!block) return null;

  return (
    <div className="w-64 h-32 rounded-lg border-2 border-[var(--border-default)] bg-[var(--surface-1)]/90 shadow-2xl p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
        <Terminal className="w-4 h-4 text-[var(--text-secondary)]" />
        <span>{block.title || "Terminal"}</span>
      </div>
    </div>
  );
}

/**
 * Drop zone overlay that shows when dragging
 * @unused - Reserved for future drag-drop visual feedback
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// @ts-expect-error Reserved for future drag-drop visual feedback
function _DropZoneOverlay({
  blockId: _blockId,
  position,
  isOver,
}: {
  blockId: string;
  position: DropPosition;
  isOver: boolean;
}) {
  const positionStyles: Record<DropPosition, string> = {
    left: "left-0 top-0 w-1/2 h-full",
    right: "right-0 top-0 w-1/2 h-full",
    top: "top-0 left-0 w-full h-1/2",
    bottom: "bottom-0 left-0 w-full h-1/2",
    center: "inset-0",
  };

  return (
    <div
      className={cn(
        "absolute z-50 pointer-events-none transition-all duration-150",
        positionStyles[position],
        isOver && "bg-[var(--surface-2)] border-2 border-[var(--border-default)] border-dashed"
      )}
    />
  );
}

/**
 * Recursive layout node renderer
 */
const LayoutNodeRenderer = memo(function LayoutNodeRenderer({
  node,
  onResize,
  isDragging,
  draggedBlockId,
  blockOrder,
}: {
  node: LayoutNode;
  onResize: (nodeId: string, sizes: number[]) => void;
  isDragging: boolean;
  draggedBlockId: string | null;
  blockOrder: string[];
}) {
  const handleResize = useCallback(
    (sizes: number[]) => {
      onResize(node.id, sizes);
    },
    [node.id, onResize]
  );

  // Leaf node - render block
  if (node.type === "leaf" && node.blockId) {
    const isBeingDragged = node.blockId === draggedBlockId;
    const blockIndex = blockOrder.indexOf(node.blockId) + 1; // 1-based

    return (
      <div className={cn("relative h-full w-full", isBeingDragged && "opacity-50")}>
        <Block blockId={node.blockId} blockIndex={blockIndex} />
      </div>
    );
  }

  // Branch node - render panel group with children
  if (node.type === "branch" && node.children && node.children.length > 0) {
    const direction = node.direction || "horizontal";

    return (
      <PanelGroup
        direction={direction}
        onLayout={handleResize}
        className="h-full w-full"
      >
        {node.children.map((child, index) => {
          // Use blockId/primaryBlockId as key to prevent React remounting blocks
          // when layout structure changes (split, maximize/restore, close).
          // For leaves: use blockId
          // For branches: use primaryBlockId (the original blockId when leaf was wrapped)
          const key = child.type === "leaf" && child.blockId
            ? child.blockId
            : child.primaryBlockId || child.id;
          return (
            <LayoutPanel
              key={key}
              node={child}
              index={index}
              isLast={index === node.children!.length - 1}
              defaultSize={node.sizes?.[index]}
              direction={direction}
              onResize={onResize}
              isDragging={isDragging}
              draggedBlockId={draggedBlockId}
              blockOrder={blockOrder}
            />
          );
        })}
      </PanelGroup>
    );
  }

  // Empty state
  return null;
});

/**
 * Single panel wrapper with optional resize handle
 */
const LayoutPanel = memo(function LayoutPanel({
  node,
  index,
  isLast,
  defaultSize,
  direction,
  onResize,
  isDragging,
  draggedBlockId,
  blockOrder,
}: {
  node: LayoutNode;
  index: number;
  isLast: boolean;
  defaultSize?: number;
  direction: "horizontal" | "vertical";
  onResize: (nodeId: string, sizes: number[]) => void;
  isDragging: boolean;
  draggedBlockId: string | null;
  blockOrder: string[];
}) {
  // Use blockId for leaf nodes to maintain Panel identity across layout changes
  // This prevents react-resizable-panels from treating it as a new panel
  const panelId = node.type === "leaf" && node.blockId ? node.blockId : node.id;

  return (
    <>
      <Panel
        id={panelId}
        order={index}
        defaultSize={defaultSize ? defaultSize * 100 : undefined}
        minSize={10}
        className="relative"
      >
        <LayoutNodeRenderer
          node={node}
          onResize={onResize}
          isDragging={isDragging}
          draggedBlockId={draggedBlockId}
          blockOrder={blockOrder}
        />
      </Panel>
      {!isLast && <ResizeHandle direction={direction} />}
    </>
  );
});

interface TileLayoutProps {
  /** Optional workspace path - if provided, reads from per-workspace state */
  workspacePath?: string;
}

/**
 * Main TileLayout component - renders the layout tree with drag-drop support
 */
export const TileLayout = memo(function TileLayout({ workspacePath }: TileLayoutProps) {
  // Read from per-workspace state if workspacePath provided, otherwise global
  const rootNode = useLayoutStore((state) => {
    if (workspacePath && state.workspaceLayouts[workspacePath]) {
      return state.workspaceLayouts[workspacePath].rootNode;
    }
    return state.rootNode;
  });
  const resizeNodes = useLayoutStore((state) => state.resizeNodes);
  const moveBlock = useLayoutStore((state) => state.moveBlock);
  const getBlockOrder = useLayoutStore((state) => state.getBlockOrder);

  const [activeId, setActiveId] = useState<string | null>(null);

  // Compute block order for displaying position numbers (1, 2, 3...)
  const blockOrder = useMemo(() => getBlockOrder(), [getBlockOrder, rootNode]);

  // Custom sensors for drag-drop
  // Uses distance constraint to avoid interfering with clicks
  // Only use PointerSensor (handles both mouse and touch)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // Reduced from 5px for easier activation
      },
    })
  );

  const handleResize = useCallback(
    (nodeId: string, sizes: number[]) => {
      // Convert percentage to 0-1 range
      const normalizedSizes = sizes.map((s) => s / 100);
      resizeNodes(nodeId, normalizedSizes);
    },
    [resizeNodes]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const draggedBlockId = active.id as string;
      const overData = over.data.current as { blockId: string; position: DropPosition } | undefined;

      if (!overData) return;

      const { blockId: targetBlockId, position } = overData;

      // Don't drop on self
      if (draggedBlockId === targetBlockId) return;

      // Move the block
      moveBlock(draggedBlockId, targetBlockId, position);
    },
    [moveBlock]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  // Empty state
  if (!rootNode) {
    return (
      <div className="flex items-center justify-center h-full w-full text-[var(--text-muted)]">
        <div className="text-center">
          <p className="text-lg font-medium mb-2 text-[var(--text-secondary)]">No blocks open</p>
          <p className="text-sm opacity-70">
            Select a view from the sidebar
          </p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="h-full w-full p-1">
        <LayoutNodeRenderer
          node={rootNode}
          onResize={handleResize}
          isDragging={!!activeId}
          draggedBlockId={activeId}
          blockOrder={blockOrder}
        />
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeId && <DragPreview blockId={activeId} />}
      </DragOverlay>
    </DndContext>
  );
});

export default TileLayout;
