/**
 * LinkedSpecsSection Component
 *
 * Displays list of specs linked to a task.
 * Supports navigation and unlink actions.
 */

import { FileText, ChevronDown, ChevronRight, X, ExternalLink } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type { TaskSpecLink } from "@/stores/unifiedContextStore";

interface LinkedSpecsSectionProps {
  links: TaskSpecLink[];
  onNavigate: (specPath: string) => void;
  onUnlink?: (linkId: string) => void;
  isLoading?: boolean;
}

export function LinkedSpecsSection({
  links,
  onNavigate,
  onUnlink,
  isLoading,
}: LinkedSpecsSectionProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left group"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
        ) : (
          <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
        )}
        <FileText className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        <span className="text-xs text-[var(--text-muted)]">
          Linked Specs {links.length > 0 && `(${links.length})`}
        </span>
      </button>

      {expanded && (
        <div className="mt-2 ml-5 space-y-1">
          {isLoading ? (
            <div className="text-xs text-[var(--text-muted)] italic">
              Loading...
            </div>
          ) : links.length === 0 ? (
            <div className="text-xs text-[var(--text-muted)] italic">
              No specs linked
            </div>
          ) : (
            links.map((link) => (
              <LinkedSpecItem
                key={link.id}
                link={link}
                onNavigate={() => onNavigate(link.specPath)}
                onUnlink={onUnlink ? () => onUnlink(link.id) : undefined}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface LinkedSpecItemProps {
  link: TaskSpecLink;
  onNavigate: () => void;
  onUnlink?: () => void;
}

function LinkedSpecItem({ link, onNavigate, onUnlink }: LinkedSpecItemProps) {
  const fileName = link.specPath.split("/").pop() || link.specPath;
  const typeColor =
    link.specType === "change"
      ? "bg-blue-400"
      : link.specType === "module"
      ? "bg-purple-400"
      : "bg-gray-400";

  return (
    <div className="flex items-center gap-2 group">
      <span
        className={cn(
          "inline-block w-1.5 h-1.5 rounded-full flex-shrink-0",
          typeColor
        )}
      />
      <button
        onClick={onNavigate}
        className="flex-1 text-left text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] truncate flex items-center gap-1"
        title={link.specPath}
      >
        <span className="truncate">{fileName}</span>
        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 flex-shrink-0" />
      </button>
      {onUnlink && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUnlink();
          }}
          className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400 flex-shrink-0"
          title="Unlink spec"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
