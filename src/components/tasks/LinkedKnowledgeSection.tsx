/**
 * LinkedKnowledgeSection Component
 *
 * Displays list of knowledge documents linked to a task.
 * Supports navigation and unlink actions.
 */

import { BookOpen, ChevronDown, ChevronRight, X, ExternalLink, Sparkles, Check } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type { TaskKnowledgeLink, LinkSuggestion } from "@/stores/unifiedContextStore";

interface LinkedKnowledgeSectionProps {
  links: TaskKnowledgeLink[];
  suggestions?: LinkSuggestion[];
  onNavigate: (knowledgePath: string) => void;
  onUnlink?: (linkId: string) => void;
  onAcceptSuggestion?: (suggestion: LinkSuggestion) => void;
  onDismissSuggestion?: (suggestion: LinkSuggestion) => void;
  isLoading?: boolean;
}

export function LinkedKnowledgeSection({
  links,
  suggestions,
  onNavigate,
  onUnlink,
  onAcceptSuggestion,
  onDismissSuggestion,
  isLoading,
}: LinkedKnowledgeSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const activeSuggestions = suggestions?.filter((s) => s.type === "knowledge") || [];

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
        <BookOpen className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        <span className="text-xs text-[var(--text-muted)]">
          Linked Knowledge {links.length > 0 && `(${links.length})`}
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
              No knowledge linked
            </div>
          ) : (
            links.map((link) => (
              <LinkedKnowledgeItem
                key={link.id}
                link={link}
                onNavigate={() => onNavigate(link.knowledgePath)}
                onUnlink={onUnlink ? () => onUnlink(link.id) : undefined}
              />
            ))
          )}

          {/* Suggestions */}
          {activeSuggestions.length > 0 && (
            <div className="mt-2 pt-2 border-t border-[var(--border-muted)]">
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-1.5">
                <Sparkles className="w-3 h-3" />
                <span>Suggested</span>
              </div>
              {activeSuggestions.map((suggestion) => {
                const fileName = suggestion.path.split("/").pop()?.replace(".md", "") || suggestion.path;
                return (
                  <div
                    key={suggestion.id}
                    className="flex items-center gap-2 group"
                  >
                    <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 bg-amber-400" />
                    <span
                      className="flex-1 text-xs text-[var(--text-muted)] truncate"
                      title={suggestion.reason}
                    >
                      {fileName}
                    </span>
                    {onAcceptSuggestion && (
                      <button
                        onClick={() => onAcceptSuggestion(suggestion)}
                        className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-green-400 flex-shrink-0"
                        title="Link this document"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    )}
                    {onDismissSuggestion && (
                      <button
                        onClick={() => onDismissSuggestion(suggestion)}
                        className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400 flex-shrink-0"
                        title="Dismiss suggestion"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface LinkedKnowledgeItemProps {
  link: TaskKnowledgeLink;
  onNavigate: () => void;
  onUnlink?: () => void;
}

function LinkedKnowledgeItem({ link, onNavigate, onUnlink }: LinkedKnowledgeItemProps) {
  const fileName = link.knowledgePath.split("/").pop() || link.knowledgePath;

  // Determine category from path for color coding
  const category = link.knowledgePath.includes("/business-logic/")
    ? "business"
    : link.knowledgePath.includes("/api/")
    ? "api"
    : link.knowledgePath.includes("/patterns/")
    ? "pattern"
    : link.knowledgePath.includes("/database/")
    ? "database"
    : "other";

  const categoryColor = {
    business: "bg-purple-400",
    api: "bg-blue-400",
    pattern: "bg-green-400",
    database: "bg-orange-400",
    other: "bg-gray-400",
  }[category];

  return (
    <div className="flex items-center gap-2 group">
      <span
        className={cn(
          "inline-block w-1.5 h-1.5 rounded-full flex-shrink-0",
          categoryColor
        )}
      />
      <button
        onClick={onNavigate}
        className="flex-1 text-left text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] truncate flex items-center gap-1"
        title={link.knowledgePath}
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
          title="Unlink knowledge"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
