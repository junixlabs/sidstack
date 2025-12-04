/**
 * Data Flow Section
 *
 * Displays data flows impacted by a change including:
 * - Flow direction and type
 * - Strength and criticality
 * - Affected operations
 * - Suggested tests
 */

import {
  ArrowRight,
  ArrowLeftRight,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  FlaskConical,
  Zap,
} from "lucide-react";
import { memo, useState } from "react";

import { cn } from "@/lib/utils";
import type { ImpactDataFlow, ImpactLevel } from "@sidstack/shared";

// =============================================================================
// Types
// =============================================================================

interface DataFlowSectionProps {
  dataFlows: ImpactDataFlow[];
  compact?: boolean;
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getFlowIcon(flowType: ImpactDataFlow["flowType"]) {
  switch (flowType) {
    case "read":
      return <ArrowDown className="h-4 w-4 text-[var(--text-secondary)]" />;
    case "write":
      return <ArrowRight className="h-4 w-4 text-[var(--text-secondary)]" />;
    case "bidirectional":
      return <ArrowLeftRight className="h-4 w-4 text-[var(--text-secondary)]" />;
  }
}

function getStrengthColor(strength: ImpactDataFlow["strength"]) {
  switch (strength) {
    case "critical":
      return "text-[var(--text-secondary)] bg-[var(--surface-2)] border-[var(--border-default)]";
    case "important":
      return "text-[var(--text-secondary)] bg-[var(--surface-2)] border-[var(--border-default)]";
    case "optional":
      return "text-[var(--text-muted)] bg-[var(--surface-2)] border-[var(--surface-3)]";
  }
}

function getImpactLevelColor(level: ImpactLevel) {
  switch (level) {
    case "direct":
      return "text-[var(--text-secondary)]";
    case "indirect":
      return "text-[var(--text-secondary)]";
    case "cascade":
      return "text-[var(--text-secondary)]";
  }
}

// =============================================================================
// Sub-components
// =============================================================================

const DataFlowItem = memo(function DataFlowItem({
  flow,
}: {
  flow: ImpactDataFlow;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--border-muted)] bg-[var(--surface-0)]">
      {/* Flow header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-3 py-2 hover:bg-[var(--surface-1)]"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
          )}

          {/* Flow visualization */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {flow.from}
            </span>
            {getFlowIcon(flow.flowType)}
            <span className="text-sm font-medium text-[var(--text-primary)]">{flow.to}</span>
          </div>

          {/* Strength badge */}
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-xs font-medium border",
              getStrengthColor(flow.strength)
            )}
          >
            {flow.strength}
          </span>

          {/* Validation required indicator */}
          {flow.validationRequired && (
            <span title="Validation required">
              <AlertCircle className="h-4 w-4 text-[var(--text-secondary)]" />
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Impact level */}
          <span
            className={cn("text-xs font-medium", getImpactLevelColor(flow.impactLevel))}
          >
            {flow.impactLevel}
          </span>

          {/* Flow type label */}
          <span className="text-xs text-[var(--text-muted)]">{flow.flowType}</span>
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-[var(--border-muted)] px-3 py-3 pl-10 space-y-3">
          {/* Entities */}
          {flow.entities.length > 0 && (
            <div>
              <div className="text-xs font-medium text-[var(--text-muted)] mb-1">
                Entities
              </div>
              <div className="flex flex-wrap gap-1">
                {flow.entities.map((entity) => (
                  <span
                    key={entity}
                    className="rounded bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--text-primary)]"
                  >
                    {entity}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Relationships */}
          {flow.relationships.length > 0 && (
            <div>
              <div className="text-xs font-medium text-[var(--text-muted)] mb-1">
                Relationships
              </div>
              <div className="flex flex-wrap gap-1">
                {flow.relationships.map((rel) => (
                  <span
                    key={rel}
                    className="rounded bg-[var(--surface-2)] border border-[var(--border-default)] px-2 py-0.5 text-xs text-[var(--text-secondary)]"
                  >
                    {rel}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Affected Operations */}
          {flow.affectedOperations.length > 0 && (
            <div>
              <div className="text-xs font-medium text-[var(--text-muted)] mb-1 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Affected Operations
              </div>
              <div className="flex flex-wrap gap-1">
                {flow.affectedOperations.map((op) => (
                  <span
                    key={op}
                    className="rounded bg-[var(--surface-2)] border border-[var(--border-default)] px-2 py-0.5 text-xs text-[var(--text-secondary)]"
                  >
                    {op}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Tests */}
          {flow.suggestedTests.length > 0 && (
            <div>
              <div className="text-xs font-medium text-[var(--text-muted)] mb-1 flex items-center gap-1">
                <FlaskConical className="h-3 w-3" />
                Suggested Tests
              </div>
              <ul className="list-disc list-inside space-y-1">
                {flow.suggestedTests.map((test, idx) => (
                  <li key={idx} className="text-xs text-[var(--text-primary)]">
                    {test}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// =============================================================================
// Component
// =============================================================================

export const DataFlowSection = memo(function DataFlowSection({
  dataFlows,
  compact = false,
  className,
}: DataFlowSectionProps) {
  if (dataFlows.length === 0) {
    return (
      <div className={cn("px-4 py-6 text-center text-[var(--text-muted)]", className)}>
        No data flows detected
      </div>
    );
  }

  // Group by strength
  const criticalFlows = dataFlows.filter((f) => f.strength === "critical");
  const importantFlows = dataFlows.filter((f) => f.strength === "important");
  const optionalFlows = dataFlows.filter((f) => f.strength === "optional");

  // In compact mode, only show critical and some important
  const displayFlows = compact
    ? [...criticalFlows, ...importantFlows.slice(0, 2)]
    : dataFlows;

  return (
    <div className={cn("space-y-4 px-4 pb-4", className)}>
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        {criticalFlows.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--text-secondary)]" />
            <span className="text-[var(--text-secondary)]">{criticalFlows.length} critical</span>
          </div>
        )}
        {importantFlows.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--text-secondary)]" />
            <span className="text-[var(--text-secondary)]">{importantFlows.length} important</span>
          </div>
        )}
        {optionalFlows.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--text-muted)]" />
            <span className="text-[var(--text-muted)]">{optionalFlows.length} optional</span>
          </div>
        )}
      </div>

      {/* Flow list */}
      <div className="space-y-2">
        {displayFlows.map((flow) => (
          <DataFlowItem key={flow.id} flow={flow} />
        ))}
      </div>

      {/* Show more indicator in compact mode */}
      {compact && dataFlows.length > displayFlows.length && (
        <div className="text-sm text-[var(--text-muted)]">
          +{dataFlows.length - displayFlows.length} more data flows
        </div>
      )}

      {/* Validation required summary */}
      {dataFlows.filter((f) => f.validationRequired).length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-2">
          <AlertCircle className="h-4 w-4 text-[var(--text-secondary)]" />
          <span className="text-sm text-[var(--text-secondary)]">
            {dataFlows.filter((f) => f.validationRequired).length} flows require
            validation before implementation
          </span>
        </div>
      )}
    </div>
  );
});

export default DataFlowSection;
