/**
 * SuggestionsSection
 *
 * Displays auto-link suggestions for the current task.
 */

import { Lightbulb, Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useUnifiedContextStore, LinkSuggestion } from "@/stores/unifiedContextStore";

interface SuggestionsSectionProps {
  className?: string;
}

export function SuggestionsSection({ className }: SuggestionsSectionProps) {
  const { suggestions, acceptSuggestion, dismissSuggestion } =
    useUnifiedContextStore();

  if (suggestions.length === 0) {
    return null;
  }

  const handleAccept = async (suggestion: LinkSuggestion) => {
    await acceptSuggestion(suggestion);
  };

  const handleDismiss = async (suggestion: LinkSuggestion) => {
    await dismissSuggestion(suggestion);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-[var(--text-primary)]";
    if (confidence >= 0.6) return "bg-[var(--text-secondary)]";
    return "bg-[var(--text-muted)]";
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Lightbulb className="w-4 h-4 text-[var(--text-secondary)]" />
        <span>Suggestions</span>
      </div>

      {/* Suggestions list */}
      <ul className="space-y-2 pl-6">
        {suggestions.map((suggestion) => (
          <li
            key={suggestion.id}
            className="flex items-start gap-2 text-sm bg-accent/30 rounded-lg p-2"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "px-1.5 py-0.5 text-[11px] font-medium rounded",
                    suggestion.type === "spec"
                      ? "bg-[var(--surface-2)] text-[var(--text-secondary)]"
                      : "bg-[var(--surface-2)] text-[var(--text-secondary)]"
                  )}
                >
                  {suggestion.type}
                </span>
                <span className="truncate text-foreground font-medium">
                  {suggestion.path.split("/").pop()?.replace(".md", "")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {suggestion.reason}
              </p>
              {/* Confidence indicator */}
              <div className="flex items-center gap-1 mt-1">
                <div className="h-1 w-16 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      getConfidenceColor(suggestion.confidence)
                    )}
                    style={{ width: `${suggestion.confidence * 100}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {Math.round(suggestion.confidence * 100)}%
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleAccept(suggestion)}
                className="p-1.5 rounded hover:bg-[var(--surface-2)] text-[var(--text-secondary)] transition-colors"
                title="Accept suggestion"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDismiss(suggestion)}
                className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                title="Dismiss suggestion"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SuggestionsSection;
