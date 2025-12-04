/**
 * ThinkingBlock Component
 *
 * Full display of Claude's extended thinking with collapse/expand.
 * Shows animated indicator while thinking, full content when expanded.
 */

import { memo, useState, useMemo } from "react";

import { cn } from "@/lib/utils";
import type { Block, ThinkingContent } from "@/types/blocks";

import { BlockContainer } from "./BlockContainer";

export interface ThinkingBlockProps {
  block: Block;
  onCopy?: () => void;
}

// Chevron icon for expand/collapse
const ChevronIcon = ({ expanded, className }: { expanded: boolean; className?: string }) => (
  <svg
    className={cn("w-4 h-4 transition-transform duration-200", expanded && "rotate-90", className)}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

// Brain icon for thinking
const BrainIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
    />
  </svg>
);

export const ThinkingBlock = memo(function ThinkingBlock({ block }: ThinkingBlockProps) {
  const content = block.content.data as ThinkingContent;
  const [isExpanded, setIsExpanded] = useState(false);

  const isStreaming = content.isPartial || block.status === "streaming";

  // Parse thinking content
  const thinkingStats = useMemo(() => {
    const text = content.thinking || "";
    const lines = text.split("\n");
    const words = text.split(/\s+/).filter(Boolean).length;
    const preview = lines[0]?.substring(0, 100) || "";
    return { lines: lines.length, words, preview };
  }, [content.thinking]);

  // Format thinking text with basic structure detection
  const formattedThinking = useMemo(() => {
    const text = content.thinking || "";
    if (!text) return [];

    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let key = 0;

    for (const line of lines) {
      // Empty line
      if (!line.trim()) {
        elements.push(<div key={key++} className="h-2" />);
        continue;
      }

      // Headers (lines that look like section headers)
      if (line.match(/^[A-Z][A-Za-z\s]+:$/)) {
        elements.push(
          <div key={key++} className="font-medium text-[var(--text-primary)] mt-3 mb-1">
            {line}
          </div>
        );
        continue;
      }

      // Numbered items
      if (line.match(/^\d+\.\s/)) {
        elements.push(
          <div key={key++} className="pl-4 text-[var(--text-secondary)]">
            {line}
          </div>
        );
        continue;
      }

      // Bullet points
      if (line.match(/^[-*]\s/)) {
        elements.push(
          <div key={key++} className="pl-4 text-[var(--text-secondary)]">
            {line}
          </div>
        );
        continue;
      }

      // Regular paragraph
      elements.push(
        <div key={key++} className="text-[var(--text-secondary)]">
          {line}
        </div>
      );
    }

    return elements;
  }, [content.thinking]);

  return (
    <BlockContainer block={block}>
      <div className="space-y-1">
        {/* Header row - clickable to expand */}
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className={cn(
            "flex items-center gap-2 w-full text-left group",
            "hover:bg-[var(--surface-2)] rounded px-1 -mx-1 py-0.5 transition-colors"
          )}
        >
          {/* Expand chevron */}
          <ChevronIcon expanded={isExpanded} className="text-[var(--text-muted)] flex-shrink-0" />

          {/* Thinking icon */}
          <BrainIcon
            className={cn(
              "w-4 h-4 flex-shrink-0 text-violet-400",
              isStreaming && "animate-pulse"
            )}
          />

          {/* Label */}
          <span className="font-medium text-sm text-violet-400">Thinking</span>

          {/* Preview or streaming indicator */}
          {isStreaming ? (
            <span className="flex items-center gap-2 text-xs text-violet-400">
              <span className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "100ms" }} />
                <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "200ms" }} />
              </span>
            </span>
          ) : (
            <span className="text-sm text-[var(--text-muted)] truncate flex-1 italic">
              {thinkingStats.preview}
              {thinkingStats.preview.length >= 100 && "..."}
            </span>
          )}

          {/* Stats */}
          {!isStreaming && (
            <span className="text-xs text-[var(--text-muted)] flex-shrink-0">
              {thinkingStats.words} words
            </span>
          )}
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="mt-2 pl-7">
            <div
              className={cn(
                "p-3 rounded-lg text-sm leading-relaxed",
                "bg-violet-500/5 border border-violet-500/20",
                "max-h-[400px] overflow-y-auto"
              )}
            >
              {isStreaming && !content.thinking ? (
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span>Processing...</span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {formattedThinking}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </BlockContainer>
  );
});

export default ThinkingBlock;
