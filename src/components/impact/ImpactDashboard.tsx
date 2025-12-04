/**
 * Impact Dashboard
 *
 * Main container component for displaying impact analysis results.
 * Shows scope, data flows, risks, validations, and gate status.
 */

import {
  Activity,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  FileCode,
  GitBranch,
  Loader2,
  RefreshCw,
  Shield,
  XCircle,
} from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import type {
  ImpactAnalysis,
  GateStatus,
  RiskSeverity,
} from "@sidstack/shared";

import { DataFlowSection } from "./DataFlowSection";
import { GateFooter } from "./GateFooter";
import { RisksSection } from "./RisksSection";
import { ScopeSection } from "./ScopeSection";
import { ValidationsSection } from "./ValidationsSection";

// =============================================================================
// Types
// =============================================================================

interface ImpactDashboardProps {
  /** Analysis ID to display */
  analysisId?: string;
  /** Pre-loaded analysis data */
  analysis?: ImpactAnalysis;
  /** API base URL */
  apiBaseUrl?: string;
  /** Callback when analysis is refreshed */
  onRefresh?: () => void;
  /** Callback when gate is approved */
  onGateApprove?: (approver: string, reason: string, blockerIds: string[]) => void;
  /** Whether component is in compact mode */
  compact?: boolean;
  /** Custom className */
  className?: string;
}

type SectionId = "scope" | "dataFlows" | "risks" | "validations";

// =============================================================================
// Helper Functions
// =============================================================================

function getGateStatusIcon(status: GateStatus) {
  switch (status) {
    case "blocked":
      return <XCircle className="h-5 w-5 text-[var(--text-secondary)]" />;
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-[var(--text-secondary)]" />;
    case "clear":
      return <CheckCircle className="h-5 w-5 text-[var(--text-secondary)]" />;
  }
}

function getGateStatusText(status: GateStatus) {
  switch (status) {
    case "blocked":
      return "Implementation Blocked";
    case "warning":
      return "Warnings Present";
    case "clear":
      return "Ready to Implement";
  }
}

function getGateStatusColor(status: GateStatus) {
  switch (status) {
    case "blocked":
      return "border-[var(--border-default)] bg-[var(--surface-2)]";
    case "warning":
      return "border-[var(--border-default)] bg-[var(--surface-2)]";
    case "clear":
      return "border-[var(--border-default)] bg-[var(--surface-2)]";
  }
}

function getSeverityStats(analysis: ImpactAnalysis) {
  const stats: Record<RiskSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const risk of analysis.risks) {
    stats[risk.severity]++;
  }

  return stats;
}

// =============================================================================
// Component
// =============================================================================

export const ImpactDashboard = memo(function ImpactDashboard({
  analysisId,
  analysis: initialAnalysis,
  apiBaseUrl = "http://localhost:19432",
  onRefresh,
  onGateApprove,
  compact = false,
  className,
}: ImpactDashboardProps) {
  const [analysis, setAnalysis] = useState<ImpactAnalysis | null>(
    initialAnalysis || null
  );
  const [isLoading, setIsLoading] = useState(!initialAnalysis && !!analysisId);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(
    new Set(["scope", "risks", "validations"])
  );

  // Fetch analysis data if analysisId provided
  useEffect(() => {
    if (analysisId && !initialAnalysis) {
      fetchAnalysis();
    }
  }, [analysisId]);

  const fetchAnalysis = useCallback(async () => {
    if (!analysisId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/impact/${analysisId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch analysis: ${response.statusText}`);
      }
      const data = await response.json();
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch analysis");
    } finally {
      setIsLoading(false);
    }
  }, [analysisId, apiBaseUrl]);

  const handleRefresh = useCallback(() => {
    fetchAnalysis();
    onRefresh?.();
  }, [fetchAnalysis, onRefresh]);

  const toggleSection = useCallback((sectionId: SectionId) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const handleValidationUpdate = useCallback(
    async (validationId: string, status: "passed" | "failed" | "skipped") => {
      if (!analysis) return;

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/impact/${analysis.id}/validations/${validationId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to update validation");
        }

        // Refresh to get updated gate status
        fetchAnalysis();
      } catch (err) {
        console.error("Failed to update validation:", err);
      }
    },
    [analysis, apiBaseUrl, fetchAnalysis]
  );

  const handleRunValidation = useCallback(
    async (validationId: string) => {
      if (!analysis) return;

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/impact/${analysis.id}/validations/${validationId}/run`,
          { method: "POST" }
        );

        if (!response.ok) {
          throw new Error("Failed to run validation");
        }

        // Refresh to get updated results
        fetchAnalysis();
      } catch (err) {
        console.error("Failed to run validation:", err);
      }
    },
    [analysis, apiBaseUrl, fetchAnalysis]
  );

  // Loading state
  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center p-8",
          "rounded-xl border border-[var(--border-muted)] bg-[var(--surface-1)]",
          className
        )}
      >
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-secondary)]" />
        <span className="ml-3 text-[var(--text-muted)]">Loading analysis...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-8",
          "rounded-xl border border-[var(--border-default)] bg-[var(--surface-2)]",
          className
        )}
      >
        <XCircle className="h-8 w-8 text-[var(--text-secondary)]" />
        <span className="mt-2 text-[var(--text-secondary)]">{error}</span>
        <button
          onClick={handleRefresh}
          className="mt-4 flex items-center gap-2 rounded-lg bg-[var(--surface-2)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-3)]"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  // No analysis state
  if (!analysis) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-8",
          "rounded-xl border border-[var(--border-muted)] bg-[var(--surface-1)]",
          className
        )}
      >
        <Activity className="h-8 w-8 text-[var(--text-muted)]" />
        <span className="mt-2 text-[var(--text-muted)]">No analysis available</span>
      </div>
    );
  }

  const severityStats = getSeverityStats(analysis);
  const validationStats = {
    total: analysis.validations.length,
    passed: analysis.validations.filter((v) => v.status === "passed").length,
    failed: analysis.validations.filter((v) => v.status === "failed").length,
    pending: analysis.validations.filter((v) => v.status === "pending").length,
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-[var(--border-muted)] bg-[var(--surface-1)]",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-muted)] px-4 py-3">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-[var(--text-secondary)]" />
          <div>
            <h2 className="font-semibold text-[var(--text-primary)]">Impact Analysis</h2>
            <p className="text-xs text-[var(--text-muted)]">
              {analysis.input.description.slice(0, 60)}
              {analysis.input.description.length > 60 ? "..." : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Gate status badge */}
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5",
              getGateStatusColor(analysis.gate.status)
            )}
          >
            {getGateStatusIcon(analysis.gate.status)}
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {getGateStatusText(analysis.gate.status)}
            </span>
          </div>

          <button
            onClick={handleRefresh}
            className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
            title="Refresh analysis"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-px border-b border-[var(--border-muted)] bg-[var(--border-muted)]">
        {/* Scope */}
        <div className="flex items-center gap-3 bg-[var(--surface-1)] px-4 py-3">
          <FileCode className="h-5 w-5 text-[var(--text-secondary)]" />
          <div>
            <div className="text-lg font-semibold text-[var(--text-primary)]">
              {analysis.scope.primaryModules.length +
                analysis.scope.dependentModules.length}
            </div>
            <div className="text-xs text-[var(--text-muted)]">Modules</div>
          </div>
        </div>

        {/* Data Flows */}
        <div className="flex items-center gap-3 bg-[var(--surface-1)] px-4 py-3">
          <GitBranch className="h-5 w-5 text-[var(--text-secondary)]" />
          <div>
            <div className="text-lg font-semibold text-[var(--text-primary)]">
              {analysis.dataFlows.length}
            </div>
            <div className="text-xs text-[var(--text-muted)]">Data Flows</div>
          </div>
        </div>

        {/* Risks */}
        <div className="flex items-center gap-3 bg-[var(--surface-1)] px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-[var(--text-secondary)]" />
          <div>
            <div className="flex items-center gap-1.5 text-lg font-semibold text-[var(--text-primary)]">
              {analysis.risks.length}
              {severityStats.critical > 0 && (
                <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--text-secondary)]">
                  {severityStats.critical} critical
                </span>
              )}
            </div>
            <div className="text-xs text-[var(--text-muted)]">Risks</div>
          </div>
        </div>

        {/* Validations */}
        <div className="flex items-center gap-3 bg-[var(--surface-1)] px-4 py-3">
          <Shield className="h-5 w-5 text-[var(--text-secondary)]" />
          <div>
            <div className="flex items-center gap-1.5 text-lg font-semibold text-[var(--text-primary)]">
              {validationStats.passed}/{validationStats.total}
              {validationStats.failed > 0 && (
                <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--text-secondary)]">
                  {validationStats.failed} failed
                </span>
              )}
            </div>
            <div className="text-xs text-[var(--text-muted)]">Validations</div>
          </div>
        </div>
      </div>

      {/* Collapsible sections */}
      <div className="flex-1 overflow-auto">
        {/* Scope Section */}
        <div className="border-b border-[var(--border-muted)]">
          <button
            onClick={() => toggleSection("scope")}
            className="flex w-full items-center justify-between px-4 py-3 hover:bg-[var(--surface-2)]/50"
          >
            <div className="flex items-center gap-2">
              {expandedSections.has("scope") ? (
                <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
              ) : (
                <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
              )}
              <FileCode className="h-4 w-4 text-[var(--text-secondary)]" />
              <span className="font-medium text-[var(--text-primary)]">Scope</span>
              <span className="text-sm text-[var(--text-muted)]">
                ({analysis.scope.primaryFiles.length} files,{" "}
                {analysis.scope.primaryModules.length} modules)
              </span>
            </div>
          </button>
          {expandedSections.has("scope") && (
            <ScopeSection scope={analysis.scope} compact={compact} />
          )}
        </div>

        {/* Data Flows Section */}
        <div className="border-b border-[var(--border-muted)]">
          <button
            onClick={() => toggleSection("dataFlows")}
            className="flex w-full items-center justify-between px-4 py-3 hover:bg-[var(--surface-2)]/50"
          >
            <div className="flex items-center gap-2">
              {expandedSections.has("dataFlows") ? (
                <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
              ) : (
                <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
              )}
              <GitBranch className="h-4 w-4 text-[var(--text-secondary)]" />
              <span className="font-medium text-[var(--text-primary)]">Data Flows</span>
              <span className="text-sm text-[var(--text-muted)]">
                ({analysis.dataFlows.length} flows)
              </span>
            </div>
          </button>
          {expandedSections.has("dataFlows") && (
            <DataFlowSection dataFlows={analysis.dataFlows} compact={compact} />
          )}
        </div>

        {/* Risks Section */}
        <div className="border-b border-[var(--border-muted)]">
          <button
            onClick={() => toggleSection("risks")}
            className="flex w-full items-center justify-between px-4 py-3 hover:bg-[var(--surface-2)]/50"
          >
            <div className="flex items-center gap-2">
              {expandedSections.has("risks") ? (
                <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
              ) : (
                <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
              )}
              <AlertTriangle className="h-4 w-4 text-[var(--text-secondary)]" />
              <span className="font-medium text-[var(--text-primary)]">Risks</span>
              <span className="text-sm text-[var(--text-muted)]">
                ({analysis.risks.length} identified)
              </span>
            </div>
          </button>
          {expandedSections.has("risks") && (
            <RisksSection risks={analysis.risks} compact={compact} />
          )}
        </div>

        {/* Validations Section */}
        <div className="border-b border-[var(--border-muted)]">
          <button
            onClick={() => toggleSection("validations")}
            className="flex w-full items-center justify-between px-4 py-3 hover:bg-[var(--surface-2)]/50"
          >
            <div className="flex items-center gap-2">
              {expandedSections.has("validations") ? (
                <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
              ) : (
                <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
              )}
              <Shield className="h-4 w-4 text-[var(--text-secondary)]" />
              <span className="font-medium text-[var(--text-primary)]">Validations</span>
              <span className="text-sm text-[var(--text-muted)]">
                ({validationStats.passed}/{validationStats.total} passed)
              </span>
            </div>
          </button>
          {expandedSections.has("validations") && (
            <ValidationsSection
              validations={analysis.validations}
              onUpdateStatus={handleValidationUpdate}
              onRunValidation={handleRunValidation}
              compact={compact}
            />
          )}
        </div>
      </div>

      {/* Gate Footer */}
      <GateFooter
        gate={analysis.gate}
        onApprove={onGateApprove}
        apiBaseUrl={apiBaseUrl}
        analysisId={analysis.id}
        onRefresh={fetchAnalysis}
      />
    </div>
  );
});

export default ImpactDashboard;
