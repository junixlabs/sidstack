/**
 * Risks Section
 *
 * Displays identified risks from impact analysis including:
 * - Risk severity and category
 * - Blocking status
 * - Affected areas
 * - Mitigation steps
 */

import {
  AlertTriangle,
  AlertOctagon,
  Info,
  ChevronDown,
  ChevronRight,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
} from "lucide-react";
import { memo, useState } from "react";

import { cn } from "@/lib/utils";
import type { IdentifiedRisk, RiskSeverity, RiskCategory } from "@sidstack/shared";

// =============================================================================
// Types
// =============================================================================

interface RisksSectionProps {
  risks: IdentifiedRisk[];
  compact?: boolean;
  className?: string;
  onMitigate?: (riskId: string, notes: string) => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getSeverityIcon(severity: RiskSeverity) {
  switch (severity) {
    case "critical":
      return <AlertOctagon className="h-4 w-4 text-[var(--text-secondary)]" />;
    case "high":
      return <AlertTriangle className="h-4 w-4 text-[var(--text-secondary)]" />;
    case "medium":
      return <Info className="h-4 w-4 text-[var(--text-secondary)]" />;
    case "low":
      return <Info className="h-4 w-4 text-[var(--text-muted)]" />;
  }
}

function getSeverityColor(severity: RiskSeverity) {
  switch (severity) {
    case "critical":
      return "border-[var(--border-default)] bg-[var(--surface-2)]";
    case "high":
      return "border-[var(--border-default)] bg-[var(--surface-2)]";
    case "medium":
      return "border-[var(--border-default)] bg-[var(--surface-2)]";
    case "low":
      return "border-[var(--border-muted)] bg-[var(--surface-0)]";
  }
}

function getSeverityBadgeColor(severity: RiskSeverity) {
  switch (severity) {
    case "critical":
      return "text-[var(--text-secondary)] bg-[var(--surface-2)]";
    case "high":
      return "text-[var(--text-secondary)] bg-[var(--surface-2)]";
    case "medium":
      return "text-[var(--text-secondary)] bg-[var(--surface-2)]";
    case "low":
      return "text-[var(--text-muted)] bg-[var(--surface-2)]";
  }
}

function getCategoryIcon(category: RiskCategory) {
  switch (category) {
    case "security":
      return <ShieldAlert className="h-3 w-3" />;
    case "data-corruption":
      return <AlertOctagon className="h-3 w-3" />;
    case "breaking-change":
      return <AlertTriangle className="h-3 w-3" />;
    case "performance":
      return <Info className="h-3 w-3" />;
    case "compatibility":
      return <Shield className="h-3 w-3" />;
    case "testing":
      return <ShieldCheck className="h-3 w-3" />;
    case "deployment":
      return <Info className="h-3 w-3" />;
  }
}

function formatCategory(category: RiskCategory): string {
  return category.split("-").map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(" ");
}

// =============================================================================
// Sub-components
// =============================================================================

const RiskItem = memo(function RiskItem({
  risk,
  onMitigate,
}: {
  risk: IdentifiedRisk;
  onMitigate?: (riskId: string, notes: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mitigationNotes, setMitigationNotes] = useState("");

  const handleMitigate = () => {
    if (onMitigate && mitigationNotes.trim()) {
      onMitigate(risk.id, mitigationNotes);
      setMitigationNotes("");
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border",
        getSeverityColor(risk.severity)
      )}
    >
      {/* Risk header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-3 py-2 hover:bg-black/10"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
          )}

          {getSeverityIcon(risk.severity)}

          <span className="text-sm font-medium text-[var(--text-primary)]">{risk.name}</span>

          {/* Severity badge */}
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-xs font-medium",
              getSeverityBadgeColor(risk.severity)
            )}
          >
            {risk.severity}
          </span>

          {/* Blocking indicator */}
          {risk.isBlocking && (
            <span className="flex items-center gap-1 rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--text-secondary)]">
              <Lock className="h-3 w-3" />
              blocking
            </span>
          )}

          {/* Mitigated indicator */}
          {risk.mitigationApplied && (
            <span className="flex items-center gap-1 rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--text-secondary)]">
              <ShieldCheck className="h-3 w-3" />
              mitigated
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          {getCategoryIcon(risk.category)}
          {formatCategory(risk.category)}
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-[var(--border-muted)]/50 px-3 py-3 pl-10 space-y-3">
          {/* Description */}
          <div>
            <div className="text-xs font-medium text-[var(--text-muted)] mb-1">
              Description
            </div>
            <p className="text-sm text-[var(--text-primary)]">{risk.description}</p>
          </div>

          {/* Affected Areas */}
          {risk.affectedAreas.length > 0 && (
            <div>
              <div className="text-xs font-medium text-[var(--text-muted)] mb-1">
                Affected Areas
              </div>
              <div className="flex flex-wrap gap-1">
                {risk.affectedAreas.map((area) => (
                  <span
                    key={area}
                    className="rounded bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--text-primary)]"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Mitigation */}
          <div>
            <div className="text-xs font-medium text-[var(--text-muted)] mb-1">
              Recommended Mitigation
            </div>
            <p className="text-sm text-[var(--text-primary)] bg-[var(--surface-2)]/50 rounded px-2 py-1.5">
              {risk.mitigation}
            </p>
          </div>

          {/* Mitigation notes (if applied) */}
          {risk.mitigationApplied && risk.mitigationNotes && (
            <div className="rounded border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-2">
              <div className="text-xs font-medium text-[var(--text-secondary)] mb-1">
                Mitigation Applied
              </div>
              <p className="text-sm text-[var(--text-primary)]">{risk.mitigationNotes}</p>
            </div>
          )}

          {/* Mitigation input (if not yet mitigated) */}
          {!risk.mitigationApplied && onMitigate && (
            <div className="space-y-2">
              <textarea
                value={mitigationNotes}
                onChange={(e) => setMitigationNotes(e.target.value)}
                placeholder="Describe how you've mitigated this risk..."
                className="w-full rounded-lg border border-[var(--surface-3)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--border-default)] focus:outline-none resize-none"
                rows={2}
              />
              <button
                onClick={handleMitigate}
                disabled={!mitigationNotes.trim()}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium",
                  mitigationNotes.trim()
                    ? "bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)]"
                    : "bg-[var(--surface-2)] text-[var(--text-muted)] cursor-not-allowed"
                )}
              >
                <Unlock className="h-4 w-4" />
                Mark as Mitigated
              </button>
            </div>
          )}

          {/* Rule ID */}
          <div className="text-xs text-[var(--text-muted)]">Rule: {risk.ruleId}</div>
        </div>
      )}
    </div>
  );
});

// =============================================================================
// Component
// =============================================================================

export const RisksSection = memo(function RisksSection({
  risks,
  compact = false,
  className,
  onMitigate,
}: RisksSectionProps) {
  if (risks.length === 0) {
    return (
      <div className={cn("px-4 py-6 text-center", className)}>
        <ShieldCheck className="h-8 w-8 text-[var(--text-secondary)] mx-auto mb-2" />
        <p className="text-[var(--text-muted)]">No risks identified</p>
      </div>
    );
  }

  // Group by severity
  const criticalRisks = risks.filter((r) => r.severity === "critical");
  const highRisks = risks.filter((r) => r.severity === "high");
  const mediumRisks = risks.filter((r) => r.severity === "medium");
  const lowRisks = risks.filter((r) => r.severity === "low");

  const blockingCount = risks.filter((r) => r.isBlocking && !r.mitigationApplied).length;
  const mitigatedCount = risks.filter((r) => r.mitigationApplied).length;

  // In compact mode, show only critical and high
  const displayRisks = compact
    ? [...criticalRisks, ...highRisks.slice(0, 2)]
    : risks;

  return (
    <div className={cn("space-y-4 px-4 pb-4", className)}>
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        {criticalRisks.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--text-secondary)]" />
            <span className="text-[var(--text-secondary)]">{criticalRisks.length} critical</span>
          </div>
        )}
        {highRisks.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--text-secondary)]" />
            <span className="text-[var(--text-secondary)]">{highRisks.length} high</span>
          </div>
        )}
        {mediumRisks.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--text-secondary)]" />
            <span className="text-[var(--text-secondary)]">{mediumRisks.length} medium</span>
          </div>
        )}
        {lowRisks.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--text-muted)]" />
            <span className="text-[var(--text-muted)]">{lowRisks.length} low</span>
          </div>
        )}
      </div>

      {/* Blocking alert */}
      {blockingCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-2">
          <Lock className="h-4 w-4 text-[var(--text-secondary)]" />
          <span className="text-sm text-[var(--text-secondary)]">
            {blockingCount} blocking risk{blockingCount > 1 ? "s" : ""} must be
            resolved before implementation
          </span>
        </div>
      )}

      {/* Mitigated summary */}
      {mitigatedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-2">
          <ShieldCheck className="h-4 w-4 text-[var(--text-secondary)]" />
          <span className="text-sm text-[var(--text-secondary)]">
            {mitigatedCount} risk{mitigatedCount > 1 ? "s" : ""} mitigated
          </span>
        </div>
      )}

      {/* Risk list */}
      <div className="space-y-2">
        {displayRisks.map((risk) => (
          <RiskItem
            key={risk.id}
            risk={risk}
            onMitigate={onMitigate}
          />
        ))}
      </div>

      {/* Show more indicator in compact mode */}
      {compact && risks.length > displayRisks.length && (
        <div className="text-sm text-[var(--text-muted)]">
          +{risks.length - displayRisks.length} more risks
        </div>
      )}
    </div>
  );
});

export default RisksSection;
