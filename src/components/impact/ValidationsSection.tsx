/**
 * Validations Section
 *
 * Displays validation checklist for impact analysis:
 * - Validation status (pending, running, passed, failed, skipped)
 * - Auto-verifiable vs manual checks
 * - Run validation capability
 * - Manual completion toggle
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
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { memo, useState } from "react";

import { cn } from "@/lib/utils";
import type { ValidationItem, ValidationStatus, ValidationCategory } from "@sidstack/shared";

// =============================================================================
// Types
// =============================================================================

interface ValidationsSectionProps {
  validations: ValidationItem[];
  compact?: boolean;
  className?: string;
  onUpdateStatus?: (validationId: string, status: "passed" | "failed" | "skipped") => void;
  onRunValidation?: (validationId: string) => void;
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
// Sub-components
// =============================================================================

const ValidationItemComponent = memo(function ValidationItemComponent({
  validation,
  onUpdateStatus,
  onRunValidation,
}: {
  validation: ValidationItem;
  onUpdateStatus?: (validationId: string, status: "passed" | "failed" | "skipped") => void;
  onRunValidation?: (validationId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
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
        getStatusColor(validation.status)
      )}
    >
      {/* Validation header */}
      <div className="flex items-center justify-between px-3 py-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex flex-1 items-center gap-3 hover:opacity-80"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
          )}

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
        </button>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Category badge */}
          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
            {getCategoryIcon(validation.category)}
            {formatCategory(validation.category)}
          </span>

          {/* Run button for auto-verifiable */}
          {validation.autoVerifiable && validation.status !== "running" && (
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
          {!validation.autoVerifiable && validation.status === "pending" && onUpdateStatus && (
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

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-[var(--border-muted)]/50 px-3 py-3 pl-10 space-y-3">
          {/* Description */}
          <div>
            <div className="text-xs font-medium text-[var(--text-muted)] mb-1">
              Description
            </div>
            <p className="text-sm text-[var(--text-primary)]">{validation.description}</p>
          </div>

          {/* Verify command */}
          {validation.verifyCommand && (
            <div>
              <div className="text-xs font-medium text-[var(--text-muted)] mb-1">
                Verify Command
              </div>
              <code className="block rounded bg-[var(--surface-0)] px-2 py-1.5 text-xs text-[var(--text-primary)] font-mono">
                {validation.verifyCommand}
              </code>
            </div>
          )}

          {/* Expected pattern */}
          {validation.expectedPattern && (
            <div>
              <div className="text-xs font-medium text-[var(--text-muted)] mb-1">
                Expected Pattern
              </div>
              <code className="block rounded bg-[var(--surface-0)] px-2 py-1.5 text-xs text-[var(--text-primary)] font-mono">
                {validation.expectedPattern}
              </code>
            </div>
          )}

          {/* Result */}
          {validation.result && (
            <div
              className={cn(
                "rounded-lg border px-3 py-2",
                validation.result.passed
                  ? "border-[var(--border-default)] bg-[var(--surface-2)]"
                  : "border-[var(--border-default)] bg-[var(--surface-2)]"
              )}
            >
              <div className="text-xs font-medium text-[var(--text-muted)] mb-1">
                Result ({validation.result.verifiedBy === "auto" ? "Auto" : "Manual"})
              </div>
              {validation.result.output && (
                <pre className="text-xs text-[var(--text-primary)] whitespace-pre-wrap">
                  {validation.result.output}
                </pre>
              )}
              {validation.result.error && (
                <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">
                  {validation.result.error}
                </pre>
              )}
              <div className="text-xs text-[var(--text-muted)] mt-1">
                Verified at: {new Date(validation.result.verifiedAt).toLocaleString()}
              </div>
            </div>
          )}

          {/* Related IDs */}
          <div className="flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
            {validation.riskId && <span>Risk: {validation.riskId}</span>}
            {validation.dataFlowId && <span>Flow: {validation.dataFlowId}</span>}
            {validation.moduleId && <span>Module: {validation.moduleId}</span>}
          </div>
        </div>
      )}
    </div>
  );
});

// =============================================================================
// Component
// =============================================================================

export const ValidationsSection = memo(function ValidationsSection({
  validations,
  compact = false,
  className,
  onUpdateStatus,
  onRunValidation,
}: ValidationsSectionProps) {
  if (validations.length === 0) {
    return (
      <div className={cn("px-4 py-6 text-center", className)}>
        <FlaskConical className="h-8 w-8 text-[var(--text-muted)] mx-auto mb-2" />
        <p className="text-[var(--text-muted)]">No validations required</p>
      </div>
    );
  }

  // Group by status
  const pending = validations.filter((v) => v.status === "pending");
  const passed = validations.filter((v) => v.status === "passed");
  const failed = validations.filter((v) => v.status === "failed");
  const running = validations.filter((v) => v.status === "running");
  const skipped = validations.filter((v) => v.status === "skipped");

  const blockingPending = pending.filter((v) => v.isBlocking);

  // Sort: blocking pending first, then by category
  const sortedValidations = [
    ...blockingPending,
    ...pending.filter((v) => !v.isBlocking),
    ...running,
    ...failed,
    ...passed,
    ...skipped,
  ];

  // In compact mode, show limited
  const displayValidations = compact
    ? sortedValidations.slice(0, 5)
    : sortedValidations;

  return (
    <div className={cn("space-y-4 px-4 pb-4", className)}>
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <Check className="h-4 w-4 text-[var(--text-secondary)]" />
          <span className="text-[var(--text-secondary)]">{passed.length} passed</span>
        </div>
        {failed.length > 0 && (
          <div className="flex items-center gap-1">
            <X className="h-4 w-4 text-[var(--text-secondary)]" />
            <span className="text-[var(--text-secondary)]">{failed.length} failed</span>
          </div>
        )}
        {pending.length > 0 && (
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-[var(--text-muted)]" />
            <span className="text-[var(--text-muted)]">{pending.length} pending</span>
          </div>
        )}
        {running.length > 0 && (
          <div className="flex items-center gap-1">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--text-secondary)]" />
            <span className="text-[var(--text-secondary)]">{running.length} running</span>
          </div>
        )}
      </div>

      {/* Blocking alert */}
      {blockingPending.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-2">
          <Clock className="h-4 w-4 text-[var(--text-secondary)]" />
          <span className="text-sm text-[var(--text-secondary)]">
            {blockingPending.length} blocking validation{blockingPending.length > 1 ? "s" : ""} pending
          </span>
        </div>
      )}

      {/* Failed alert */}
      {failed.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-2">
          <X className="h-4 w-4 text-[var(--text-secondary)]" />
          <span className="text-sm text-[var(--text-secondary)]">
            {failed.length} validation{failed.length > 1 ? "s" : ""} failed
          </span>
        </div>
      )}

      {/* Validation list */}
      <div className="space-y-2">
        {displayValidations.map((validation) => (
          <ValidationItemComponent
            key={validation.id}
            validation={validation}
            onUpdateStatus={onUpdateStatus}
            onRunValidation={onRunValidation}
          />
        ))}
      </div>

      {/* Show more indicator in compact mode */}
      {compact && validations.length > displayValidations.length && (
        <div className="text-sm text-[var(--text-muted)]">
          +{validations.length - displayValidations.length} more validations
        </div>
      )}
    </div>
  );
});

export default ValidationsSection;
