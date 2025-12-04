/**
 * ValidationItem Component
 *
 * Standalone validation item component for use outside ValidationsSection.
 * Shows validation status, controls, and results.
 */

import {
  Check,
  X,
  Clock,
  Play,
  Loader2,
  SkipForward,
  Terminal,
  FlaskConical,
  GitBranch,
  Server,
  Eye,
  Hand,
} from "lucide-react";
import { memo, useState } from "react";

import { cn } from "@/lib/utils";
import type { ValidationItem as ValidationItemType, ValidationStatus, ValidationCategory } from "@sidstack/shared";

// =============================================================================
// Types
// =============================================================================

interface ValidationItemProps {
  validation: ValidationItemType;
  onUpdateStatus?: (validationId: string, status: "passed" | "failed" | "skipped") => void;
  onRunValidation?: (validationId: string) => Promise<void> | void;
  showDetails?: boolean;
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getStatusIcon(status: ValidationStatus, isRunning?: boolean) {
  if (isRunning) {
    return <Loader2 className="h-4 w-4 animate-spin text-[var(--text-secondary)]" />;
  }

  switch (status) {
    case "pending":
      return <Clock className="h-4 w-4 text-[var(--text-muted)]" />;
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-[var(--text-secondary)]" />;
    case "passed":
      return <Check className="h-4 w-4 text-[var(--text-secondary)]" />;
    case "failed":
      return <X className="h-4 w-4 text-[var(--text-secondary)]" />;
    case "skipped":
      return <SkipForward className="h-4 w-4 text-[var(--text-muted)]" />;
  }
}

function getStatusColor(status: ValidationStatus) {
  switch (status) {
    case "pending":
      return "border-[var(--border-muted)] bg-[var(--surface-0)]";
    case "running":
      return "border-[var(--border-default)] bg-[var(--surface-2)]";
    case "passed":
      return "border-[var(--border-default)] bg-[var(--surface-2)]";
    case "failed":
      return "border-[var(--border-default)] bg-[var(--surface-2)]";
    case "skipped":
      return "border-[var(--border-muted)] bg-[var(--surface-0)]";
  }
}

function getCategoryIcon(category: ValidationCategory) {
  switch (category) {
    case "test":
      return <FlaskConical className="h-3 w-3" />;
    case "data-flow":
      return <GitBranch className="h-3 w-3" />;
    case "api":
      return <Server className="h-3 w-3" />;
    case "migration":
      return <Terminal className="h-3 w-3" />;
    case "manual":
      return <Hand className="h-3 w-3" />;
    case "review":
      return <Eye className="h-3 w-3" />;
  }
}

function formatCategory(category: ValidationCategory): string {
  return category.split("-").map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(" ");
}

// =============================================================================
// Component
// =============================================================================

export const ValidationItem = memo(function ValidationItem({
  validation,
  onUpdateStatus,
  onRunValidation,
  showDetails = false,
  className,
}: ValidationItemProps) {
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = async () => {
    if (onRunValidation && validation.autoVerifiable) {
      setIsRunning(true);
      try {
        await onRunValidation(validation.id);
      } finally {
        setIsRunning(false);
      }
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border",
        getStatusColor(validation.status),
        className
      )}
    >
      {/* Main row */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-3">
          {getStatusIcon(validation.status, isRunning)}

          <span className="text-sm text-[var(--text-primary)]">{validation.title}</span>

          {/* Blocking indicator */}
          {validation.isBlocking && validation.status !== "passed" && (
            <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--text-secondary)]">
              blocking
            </span>
          )}

          {/* Auto-verifiable indicator */}
          {validation.autoVerifiable && (
            <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--text-secondary)]">
              auto
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Category badge */}
          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
            {getCategoryIcon(validation.category)}
            {formatCategory(validation.category)}
          </span>

          {/* Run button for auto-verifiable */}
          {validation.autoVerifiable &&
            validation.status !== "running" &&
            onRunValidation && (
              <button
                onClick={handleRun}
                disabled={isRunning}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium",
                  isRunning
                    ? "bg-[var(--surface-2)] text-[var(--text-muted)] cursor-wait"
                    : "bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)]"
                )}
              >
                {isRunning ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                Run
              </button>
            )}

          {/* Manual status buttons */}
          {!validation.autoVerifiable &&
            validation.status === "pending" &&
            onUpdateStatus && (
              <>
                <button
                  onClick={() => onUpdateStatus(validation.id, "passed")}
                  className="flex items-center gap-1 rounded-lg bg-[var(--surface-2)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-3)]"
                >
                  <Check className="h-3 w-3" />
                  Pass
                </button>
                <button
                  onClick={() => onUpdateStatus(validation.id, "failed")}
                  className="flex items-center gap-1 rounded-lg bg-[var(--surface-2)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-3)]"
                >
                  <X className="h-3 w-3" />
                  Fail
                </button>
                <button
                  onClick={() => onUpdateStatus(validation.id, "skipped")}
                  className="flex items-center gap-1 rounded-lg bg-[var(--surface-2)] px-2 py-1 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
                >
                  <SkipForward className="h-3 w-3" />
                  Skip
                </button>
              </>
            )}
        </div>
      </div>

      {/* Details section */}
      {showDetails && (
        <div className="border-t border-[var(--border-muted)]/50 px-3 py-2 space-y-2">
          {/* Description */}
          <p className="text-xs text-[var(--text-muted)]">{validation.description}</p>

          {/* Verify command */}
          {validation.verifyCommand && (
            <div>
              <span className="text-xs text-[var(--text-muted)]">Command: </span>
              <code className="text-xs text-[var(--text-primary)] font-mono">
                {validation.verifyCommand}
              </code>
            </div>
          )}

          {/* Result */}
          {validation.result && (
            <div
              className={cn(
                "rounded px-2 py-1 text-xs",
                validation.result.passed ? "bg-[var(--surface-2)]" : "bg-[var(--surface-2)]"
              )}
            >
              {validation.result.output && (
                <pre className="text-[var(--text-primary)] whitespace-pre-wrap">
                  {validation.result.output.slice(0, 200)}
                  {validation.result.output.length > 200 && "..."}
                </pre>
              )}
              {validation.result.error && (
                <pre className="text-[var(--text-secondary)] whitespace-pre-wrap">
                  {validation.result.error}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default ValidationItem;
