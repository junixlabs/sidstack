/**
 * WorkspaceTileLayout - TileLayout that reads from WorkspaceContext
 *
 * This is a version of TileLayout that reads blocks and layout from
 * the WorkspaceContext instead of global stores. This allows multiple
 * workspaces to be rendered simultaneously without sharing state.
 */

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

import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";
import type { LayoutNode, DropPosition } from "@/types/block";

import { WorkspaceBlock } from "../WorkspaceBlock";


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
 * Drag preview
 */
function DragPreview({ blockId }: { blockId: string }) {
  const { getBlock } = useWorkspaceContext();
  const block = getBlock(blockId);

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
    const blockIndex = blockOrder.indexOf(node.blockId) + 1;

    return (
      <div className={cn("relative h-full w-full", isBeingDragged && "opacity-50")}>
        <WorkspaceBlock blockId={node.blockId} blockIndex={blockIndex} />
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

  return null;
});

/**
 * Single panel wrapper
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

/**
 * Main WorkspaceTileLayout component
 */
export const WorkspaceTileLayout = memo(function WorkspaceTileLayout() {
  const { rootNode, getBlockOrder, resizeNodes, moveBlock } = useWorkspaceContext();

  const [activeId, setActiveId] = useState<string | null>(null);

  const blockOrder = useMemo(() => getBlockOrder(), [getBlockOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  const handleResize = useCallback(
    (nodeId: string, sizes: number[]) => {
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

      if (draggedBlockId === targetBlockId) return;

      // Move block to new position
      moveBlock(draggedBlockId, targetBlockId, position);
    },
    [moveBlock]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

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

      <DragOverlay>
        {activeId && <DragPreview blockId={activeId} />}
      </DragOverlay>
    </DndContext>
  );
});

export default WorkspaceTileLayout;
