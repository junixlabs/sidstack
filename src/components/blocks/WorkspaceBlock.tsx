/**
 * WorkspaceBlock - Block component that reads from WorkspaceContext
 *
 * Simplified version:
 * - Sidebar views (fullscreen): Render ViewComponent directly, no framing
 * - Tiled views: Use BlockFrame with drag-drop, split, etc.
 */

import { Loader2 } from "lucide-react";
import { memo, useCallback, Suspense } from "react";

import { useWorkspaceContext } from "@/contexts/WorkspaceContext";

import { getBlockView } from "./BlockRegistry";

// Import views to trigger block registration
import "./views";

interface WorkspaceBlockProps {
  blockId: string;
  blockIndex?: number;
}

function BlockLoading() {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function BlockError({ viewType }: { viewType: string }) {
  return (
    <div className="flex items-center justify-center h-full w-full text-muted-foreground">
      <p>Unknown block type: {viewType}</p>
    </div>
  );
}

export const WorkspaceBlock = memo(function WorkspaceBlock({
  blockId,
  blockIndex: _blockIndex,
}: WorkspaceBlockProps) {
  const {
    getBlock,
    getBlockState,
    setActiveBlock,
    updateBlock,
  } = useWorkspaceContext();

  const block = getBlock(blockId);
  const blockState = getBlockState(blockId);

  const handleFocus = useCallback(() => {
    setActiveBlock(blockId);
  }, [blockId, setActiveBlock]);

  const handleTitleChange = useCallback(
    (title: string) => {
      updateBlock(blockId, { title });
    },
    [blockId, updateBlock]
  );

  if (!block) {
    return null;
  }

  const ViewComponent = getBlockView(block.viewType);

  if (!ViewComponent) {
    return <BlockError viewType={block.viewType} />;
  }

  // Sidebar views: Render directly without BlockFrame
  // This is the simple, clean path for fullscreen single-view mode
  return (
    <div className="h-full w-full bg-[var(--surface-0)]" onMouseDown={handleFocus}>
      <Suspense fallback={<BlockLoading />}>
        <ViewComponent
          block={block}
          blockState={blockState || { isFocused: false, isMaximized: false, isLoading: false }}
          onTitleChange={handleTitleChange}
        />
      </Suspense>
    </div>
  );
});

export default WorkspaceBlock;
