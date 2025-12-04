/**
 * ErrorBlock Component
 *
 * Displays error messages with icon and optional details.
 */

import { memo, useState } from "react";

import { cn } from "@/lib/utils";
import type { Block, ErrorContent } from "@/types/blocks";

import { BlockContainer } from "./BlockContainer";

export interface ErrorBlockProps {
  block: Block;
  onRetry?: () => void;
  onCopy?: () => void;
}

// Error icon
const ErrorIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
    />
  </svg>
);

// Chevron icon for expand/collapse
const ChevronIcon = ({ expanded, className }: { expanded: boolean; className?: string }) => (
  <svg
    className={cn("w-3 h-3 transition-transform duration-200", expanded && "rotate-90", className)}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

export const ErrorBlock = memo(function ErrorBlock({ block }: ErrorBlockProps) {
  const content = block.content.data as ErrorContent;
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDetails = !!content.details;

  return (
    <BlockContainer block={block}>
      <div className="space-y-1">
        {/* Main error row */}
        <button
          onClick={() => hasDetails && setIsExpanded((prev) => !prev)}
          className={cn(
            "flex items-center gap-2 w-full text-left",
            hasDetails && "hover:bg-[var(--surface-2)] rounded px-1 -mx-1 py-0.5 transition-colors"
          )}
          disabled={!hasDetails}
        >
          {/* Chevron (only if has details) */}
          {hasDetails && (
            <ChevronIcon expanded={isExpanded} className="text-[var(--text-secondary)] flex-shrink-0" />
          )}

          {/* Error icon */}
          <div className="flex-shrink-0">
            <div className="w-6 h-6 rounded-full bg-[var(--surface-2)] flex items-center justify-center ring-1 ring-[var(--border-default)]">
              <ErrorIcon className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            </div>
          </div>

          {/* Message */}
          <span className="text-sm text-[var(--text-secondary)] flex-1">
            {content.message}
          </span>

          {/* Error code */}
          {content.code && (
            <span className="text-xs text-[var(--text-muted)] font-mono">
              {content.code}
            </span>
          )}
        </button>

        {/* Expanded details */}
        {isExpanded && hasDetails && (
          <div className="mt-2 ml-7 p-2 rounded bg-[var(--surface-2)] border border-[var(--border-default)] text-xs text-[var(--text-secondary)] font-mono whitespace-pre-wrap">
            {content.details}
          </div>
        )}
      </div>
    </BlockContainer>
  );
});

export default ErrorBlock;
