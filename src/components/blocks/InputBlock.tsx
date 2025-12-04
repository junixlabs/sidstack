/**
 * InputBlock Component
 *
 * Displays user input/prompts with user icon.
 */

import { memo } from "react";

import { cn } from "@/lib/utils";
import type { Block, InputContent } from "@/types/blocks";

import { BlockContainer } from "./BlockContainer";

export interface InputBlockProps {
  block: Block;
  onRetry?: (prompt: string) => void;
  onCopy?: () => void;
}

// User icon
const UserIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
    />
  </svg>
);

export const InputBlock = memo(function InputBlock({ block }: InputBlockProps) {
  const content = block.content.data as InputContent;

  return (
    <BlockContainer block={block}>
      <div className="flex gap-3">
        {/* User icon */}
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-6 h-6 rounded-full bg-[var(--surface-2)] flex items-center justify-center ring-1 ring-[var(--border-default)]">
            <UserIcon className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="text-[10px] text-[var(--text-muted)] mb-1 font-medium uppercase tracking-wide">
            You
          </div>
          <div className={cn(
            "text-[var(--text-primary)] whitespace-pre-wrap text-sm leading-relaxed"
          )}>
            {content.prompt}
          </div>
        </div>
      </div>
    </BlockContainer>
  );
});

export default InputBlock;
