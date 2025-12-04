/**
 * BlockContainer Component
 *
 * Minimal wrapper for block content - no headers, just subtle styling.
 */

import { memo, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { Block } from "@/types/blocks";

export interface BlockContainerProps {
  block: Block;
  title?: string;
  children: ReactNode;
  collapsible?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  onCopy?: () => void;
  onRetry?: () => void;
  className?: string;
}

export const BlockContainer = memo(function BlockContainer({
  block,
  children,
  className,
}: BlockContainerProps) {
  // Different styling based on block type
  const isUser = block.type === "input";
  const isError = block.type === "error";

  return (
    <div
      className={cn(
        "py-2 px-3",
        // User messages: right-aligned, subtle background
        isUser && "bg-blue-500/5 border-l-2 border-blue-500/30",
        // Error messages: red tint
        isError && "bg-red-500/5 border-l-2 border-red-500/30",
        // Claude/other messages: no special styling, just content
        !isUser && !isError && "border-l-2 border-transparent",
        className
      )}
    >
      {children}
    </div>
  );
});

export default BlockContainer;
