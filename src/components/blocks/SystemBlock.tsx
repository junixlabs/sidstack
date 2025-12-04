/**
 * SystemBlock Component
 *
 * Shows session information with collapsible details.
 */

import { memo, useState } from "react";

import { cn } from "@/lib/utils";
import type { Block, SystemContent } from "@/types/blocks";

export interface SystemBlockProps {
  block: Block;
  onCopy?: () => void;
}

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

// Info icon
const InfoIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
    />
  </svg>
);

export const SystemBlock = memo(function SystemBlock({ block }: SystemBlockProps) {
  const content = block.content.data as SystemContent;
  const [isExpanded, setIsExpanded] = useState(false);

  // Get display info based on subtype
  const getDisplayInfo = () => {
    switch (content.subtype) {
      case "init":
        return {
          label: "Session started",
          icon: "info",
          showDetails: true,
        };
      case "session":
        return {
          label: `Session: ${content.sessionId?.substring(0, 8)}...`,
          icon: "info",
          showDetails: true,
        };
      default:
        return {
          label: content.subtype,
          icon: "info",
          showDetails: false,
        };
    }
  };

  const displayInfo = getDisplayInfo();

  // Hide completely for certain subtypes
  if (content.subtype === "init" && !content.tools?.length && !content.sessionId) {
    return null;
  }

  return (
    <div className="py-1 px-3">
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className={cn(
          "flex items-center gap-1.5 text-xs text-[var(--text-muted)]",
          "hover:text-[var(--text-secondary)] transition-colors"
        )}
      >
        <ChevronIcon expanded={isExpanded} />
        <InfoIcon className="w-3 h-3" />
        <span>{displayInfo.label}</span>
        {content.tools && content.tools.length > 0 && (
          <span className="text-[var(--text-muted)]">
            ({content.tools.length} tools)
          </span>
        )}
      </button>

      {/* Expanded details */}
      {isExpanded && displayInfo.showDetails && (
        <div className="mt-2 ml-5 p-2 rounded bg-[var(--surface-2)] text-xs space-y-1">
          {content.sessionId && (
            <div className="flex gap-2">
              <span className="text-[var(--text-muted)]">Session:</span>
              <span className="text-[var(--text-secondary)] font-mono">{content.sessionId}</span>
            </div>
          )}
          {content.tools && content.tools.length > 0 && (
            <div>
              <span className="text-[var(--text-muted)]">Tools:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {content.tools.map((tool, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 rounded bg-[var(--surface-3)] text-[var(--text-secondary)] font-mono"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default SystemBlock;
