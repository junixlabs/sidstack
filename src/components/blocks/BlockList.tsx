/**
 * BlockList Component
 *
 * Virtualized list of blocks with auto-scroll and keyboard navigation.
 */

import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useRef, useEffect, useCallback } from "react";

import { cn } from "@/lib/utils";
import type { Block } from "@/types/blocks";

import { ErrorBlock } from "./ErrorBlock";
import { InputBlock } from "./InputBlock";
import { OutputBlock } from "./OutputBlock";
import { SystemBlock } from "./SystemBlock";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolBlock } from "./ToolBlock";

export interface BlockListProps {
  blocks: Block[];
  className?: string;
  autoScroll?: boolean;
  onRetry?: (prompt: string) => void;
  onBlockCopy?: (block: Block) => void;
  selectedBlockId?: string;
  onSelectBlock?: (blockId: string) => void;
}

// Estimated heights for different block types
const ESTIMATED_HEIGHTS: Record<string, number> = {
  input: 80,
  thinking: 60, // Collapsed
  tool: 120,
  output: 200,
  error: 100,
  system: 60, // Collapsed
};

function getEstimatedHeight(block: Block): number {
  const base = ESTIMATED_HEIGHTS[block.type] || 100;
  // Collapsed blocks are smaller
  if (block.isCollapsed) {
    return 48;
  }
  return base;
}

// Block renderer
function renderBlock(
  block: Block,
  onRetry?: (prompt: string) => void,
  onCopy?: () => void
): React.ReactNode {
  switch (block.type) {
    case "input":
      return <InputBlock block={block} onRetry={onRetry} onCopy={onCopy} />;
    case "thinking":
      return <ThinkingBlock block={block} onCopy={onCopy} />;
    case "tool":
      return <ToolBlock block={block} onCopy={onCopy} />;
    case "output":
      return <OutputBlock block={block} onCopy={onCopy} />;
    case "error":
      return <ErrorBlock block={block} onRetry={onRetry ? () => onRetry("") : undefined} onCopy={onCopy} />;
    case "system":
      return <SystemBlock block={block} onCopy={onCopy} />;
    default:
      return null;
  }
}

export const BlockList = memo(function BlockList({
  blocks,
  className,
  autoScroll = true,
  onRetry,
  onBlockCopy,
  selectedBlockId,
  onSelectBlock,
}: BlockListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const lastBlockCountRef = useRef(blocks.length);

  // Virtualizer setup
  const virtualizer = useVirtualizer({
    count: blocks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => getEstimatedHeight(blocks[index]),
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Auto-scroll when new blocks are added
  useEffect(() => {
    if (!autoScroll) return;

    const hasNewBlocks = blocks.length > lastBlockCountRef.current;
    lastBlockCountRef.current = blocks.length;

    if (hasNewBlocks && !isUserScrollingRef.current) {
      // Scroll to bottom
      virtualizer.scrollToIndex(blocks.length - 1, {
        align: "end",
        behavior: "smooth",
      });
    }
  }, [blocks.length, autoScroll, virtualizer]);

  // Detect user scrolling
  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;

    let scrollTimeout: ReturnType<typeof setTimeout>;

    const handleScroll = () => {
      // Check if user scrolled away from bottom
      const isAtBottom =
        element.scrollHeight - element.scrollTop - element.clientHeight < 100;

      isUserScrollingRef.current = !isAtBottom;

      // Reset after a short delay
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (isAtBottom) {
          isUserScrollingRef.current = false;
        }
      }, 150);
    };

    element.addEventListener("scroll", handleScroll);
    return () => {
      element.removeEventListener("scroll", handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!onSelectBlock || blocks.length === 0) return;

      const currentIndex = selectedBlockId
        ? blocks.findIndex((b) => b.id === selectedBlockId)
        : -1;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = Math.min(currentIndex + 1, blocks.length - 1);
        onSelectBlock(blocks[nextIndex].id);
        virtualizer.scrollToIndex(nextIndex, { align: "center" });
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex = Math.max(currentIndex - 1, 0);
        onSelectBlock(blocks[prevIndex].id);
        virtualizer.scrollToIndex(prevIndex, { align: "center" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [blocks, selectedBlockId, onSelectBlock, virtualizer]);

  // Handle copy
  const handleBlockCopy = useCallback(
    (block: Block) => {
      onBlockCopy?.(block);
    },
    [onBlockCopy]
  );

  // Empty state - welcoming and informative
  if (blocks.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full px-6", className)}>
        {/* Claude sparkle icon */}
        <div className="w-16 h-16 mb-6 rounded-2xl bg-[var(--surface-2)] flex items-center justify-center border border-[var(--border-default)]">
          <svg className="w-8 h-8 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
            />
          </svg>
        </div>

        <h3 className="text-[var(--text-primary)] font-medium mb-2">Ready to assist</h3>
        <p className="text-sm text-[var(--text-muted)] text-center max-w-xs mb-6">
          Type a prompt below to start a conversation with Claude
        </p>

        {/* Quick hints */}
        <div className="flex flex-wrap justify-center gap-2 max-w-md">
          <div className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-default)] text-xs text-[var(--text-secondary)]">
            <span className="text-[var(--text-secondary)] font-mono">/help</span> commands
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-default)] text-xs text-[var(--text-secondary)]">
            <span className="text-[var(--text-secondary)] font-mono">!bash</span> execute
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-default)] text-xs text-[var(--text-secondary)]">
            <span className="text-[var(--text-muted)]">Shift+Enter</span> new line
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={cn("h-full overflow-auto", className)}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualItem) => {
          const block = blocks[virtualItem.index];
          const isSelected = selectedBlockId === block.id;

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
              onClick={() => onSelectBlock?.(block.id)}
              className={cn(
                "px-2 py-1",
                isSelected && "ring-2 ring-[var(--accent-blue)] ring-inset rounded-lg"
              )}
            >
              {renderBlock(
                block,
                onRetry,
                () => handleBlockCopy(block)
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default BlockList;
