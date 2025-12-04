/**
 * Gate Footer
 *
 * Displays the implementation gate status and controls:
 * - Gate status (blocked, warning, clear)
 * - Blocker list with resolution hints
 * - Approval request button
 * - "Proceed anyway" with confirmation
 */

import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Lock,
  Unlock,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  UserCheck,
} from "lucide-react";
import { memo, useState, useCallback } from "react";

import { cn } from "@/lib/utils";
import type { ImplementationGate, GateBlocker, GateWarning, GateApproval } from "@sidstack/shared";

// =============================================================================
// Types
// =============================================================================

interface GateFooterProps {
  gate: ImplementationGate;
  analysisId: string;
  apiBaseUrl?: string;
  onApprove?: (approver: string, reason: string, blockerIds: string[]) => void;
  onRefresh?: () => void;
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getGateStatusIcon(status: ImplementationGate["status"]) {
  switch (status) {
    case "blocked":
      return <XCircle className="h-5 w-5 text-[var(--text-secondary)]" />;
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-[var(--text-secondary)]" />;
    case "clear":
      return <CheckCircle className="h-5 w-5 text-[var(--text-secondary)]" />;
  }
}

function getGateStatusText(status: ImplementationGate["status"]) {
  switch (status) {
    case "blocked":
      return "Implementation Blocked";
    case "warning":
      return "Proceed with Caution";
    case "clear":
      return "Ready to Implement";
  }
}

function getGateStatusColor(status: ImplementationGate["status"]) {
  switch (status) {
    case "blocked":
      return "border-[var(--border-default)] bg-[var(--surface-2)]";
    case "warning":
      return "border-[var(--border-default)] bg-[var(--surface-2)]";
    case "clear":
      return "border-[var(--border-default)] bg-[var(--surface-2)]";
  }
}

// =============================================================================
// Sub-components
// =============================================================================

const BlockerItem = memo(function BlockerItem({
  blocker,
}: {
  blocker: GateBlocker;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-2">
      <Lock className="h-4 w-4 text-[var(--text-secondary)] mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)]">{blocker.description}</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Resolution: {blocker.resolution}
        </p>
        <span className="text-xs text-[var(--text-muted)]">
          {blocker.type}: {blocker.itemId}
        </span>
      </div>
    </div>
  );
});

const WarningItem = memo(function WarningItem({
  warning,
}: {
  warning: GateWarning;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-2">
      <AlertTriangle className="h-4 w-4 text-[var(--text-secondary)] mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)]">{warning.description}</p>
        <span className="text-xs text-[var(--text-muted)]">
          {warning.type}: {warning.itemId}
        </span>
      </div>
    </div>
  );
});

const ApprovalInfo = memo(function ApprovalInfo({
  approval,
}: {
  approval: GateApproval;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-2">
      <UserCheck className="h-4 w-4 text-[var(--text-secondary)] mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-secondary)]">Approved by {approval.approver}</p>
        <p className="text-xs text-[var(--text-primary)] mt-1">{approval.reason}</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Approved: {new Date(approval.approvedAt).toLocaleString()}
        </p>
        {approval.approvedBlockers.length > 0 && (
          <p className="text-xs text-[var(--text-muted)]">
            Blockers approved: {approval.approvedBlockers.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
});

// =============================================================================
// Component
// =============================================================================

export const GateFooter = memo(function GateFooter({
  gate,
  analysisId,
  apiBaseUrl = "http://localhost:19432",
  onApprove,
  onRefresh,
  className,
}: GateFooterProps) {
  const [isExpanded, setIsExpanded] = useState(gate.status === "blocked");
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const [approver, setApprover] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApprove = useCallback(async () => {
    if (!approver.trim() || !reason.trim()) return;

    setIsSubmitting(true);
    try {
      if (onApprove) {
        onApprove(
          approver,
          reason,
          gate.blockers.map((b) => b.itemId)
        );
      } else {
        // Call API directly
        const response = await fetch(
          `${apiBaseUrl}/api/impact/${analysisId}/gate/approve`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              approver,
              reason,
              blockerIds: gate.blockers.map((b) => b.itemId),
            }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to approve");
        }

        onRefresh?.();
      }

      setShowApprovalDialog(false);
      setShowOverrideConfirm(false);
      setApprover("");
      setReason("");
    } catch (error) {
      console.error("Failed to approve:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [approver, reason, gate.blockers, onApprove, apiBaseUrl, analysisId, onRefresh]);

  return (
    <div
      className={cn(
        "border-t border-[var(--border-muted)]",
        getGateStatusColor(gate.status),
        className
      )}
    >
      {/* Gate status header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-black/10"
      >
        <div className="flex items-center gap-3">
          {getGateStatusIcon(gate.status)}
          <span className="font-medium text-[var(--text-primary)]">
            {getGateStatusText(gate.status)}
          </span>

          {/* Counts */}
          {gate.blockers.length > 0 && (
            <span className="flex items-center gap-1 rounded bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
              <Lock className="h-3 w-3" />
              {gate.blockers.length} blocker{gate.blockers.length > 1 ? "s" : ""}
            </span>
          )}
          {gate.warnings.length > 0 && (
            <span className="flex items-center gap-1 rounded bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
              <AlertTriangle className="h-3 w-3" />
              {gate.warnings.length} warning{gate.warnings.length > 1 ? "s" : ""}
            </span>
          )}

          {/* Approval badge */}
          {gate.approval && (
            <span className="flex items-center gap-1 rounded bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
              <UserCheck className="h-3 w-3" />
              Approved
            </span>
          )}
        </div>

        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="space-y-4 px-4 pb-4">
          {/* Approval info */}
          {gate.approval && <ApprovalInfo approval={gate.approval} />}

          {/* Blockers */}
          {gate.blockers.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
                <AlertOctagon className="h-4 w-4" />
                Blockers
              </h4>
              {gate.blockers.map((blocker) => (
                <BlockerItem key={blocker.itemId} blocker={blocker} />
              ))}
            </div>
          )}

          {/* Warnings */}
          {gate.warnings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Warnings
              </h4>
              {gate.warnings.map((warning) => (
                <WarningItem key={warning.itemId} warning={warning} />
              ))}
            </div>
          )}

          {/* Actions */}
          {gate.status !== "clear" && !gate.approval && (
            <div className="flex items-center gap-3 pt-2">
              {/* Request Approval button */}
              <button
                onClick={() => setShowApprovalDialog(true)}
                className="flex items-center gap-2 rounded-lg bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-3)]"
              >
                <UserCheck className="h-4 w-4" />
                Request Approval
              </button>

              {/* Proceed Anyway button (only for blockers) */}
              {gate.status === "blocked" && (
                <button
                  onClick={() => setShowOverrideConfirm(true)}
                  className="flex items-center gap-2 rounded-lg border border-[var(--surface-3)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
                >
                  <Unlock className="h-4 w-4" />
                  Proceed Anyway
                </button>
              )}
            </div>
          )}

          {/* Clear status message */}
          {gate.status === "clear" && !gate.approval && (
            <div className="flex items-center gap-2 text-[var(--text-secondary)]">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm">
                All checks passed. You can proceed with implementation.
              </span>
            </div>
          )}

          {/* Last evaluated */}
          <div className="text-xs text-[var(--text-muted)]">
            Last evaluated: {new Date(gate.evaluatedAt).toLocaleString()}
          </div>
        </div>
      )}

      {/* Approval Dialog */}
      {showApprovalDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-[var(--surface-3)] bg-[var(--surface-1)] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              Request Approval
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                  Approver Name
                </label>
                <input
                  type="text"
                  value={approver}
                  onChange={(e) => setApprover(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-lg border border-[var(--surface-3)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--border-default)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                  Reason for Approval
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this should be approved..."
                  className="w-full rounded-lg border border-[var(--surface-3)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--border-default)] focus:outline-none resize-none"
                  rows={3}
                />
              </div>

              <div className="text-xs text-[var(--text-muted)]">
                This will approve {gate.blockers.length} blocker
                {gate.blockers.length > 1 ? "s" : ""} and allow implementation to
                proceed.
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowApprovalDialog(false)}
                className="rounded-lg border border-[var(--surface-3)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={!approver.trim() || !reason.trim() || isSubmitting}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium",
                  approver.trim() && reason.trim() && !isSubmitting
                    ? "bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)]"
                    : "bg-[var(--surface-2)] text-[var(--text-muted)] cursor-not-allowed"
                )}
              >
                {isSubmitting ? "Submitting..." : "Submit Approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Override Confirmation Dialog */}
      {showOverrideConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-[var(--border-default)] bg-[var(--surface-1)] p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertOctagon className="h-6 w-6 text-[var(--text-secondary)]" />
              <h3 className="text-lg font-semibold text-[var(--text-secondary)]">
                Override Blockers?
              </h3>
            </div>

            <p className="text-sm text-[var(--text-primary)] mb-4">
              You are about to proceed despite {gate.blockers.length} blocking
              issue{gate.blockers.length > 1 ? "s" : ""}. This may result in:
            </p>

            <ul className="list-disc list-inside text-sm text-[var(--text-muted)] mb-4 space-y-1">
              <li>Data corruption or inconsistencies</li>
              <li>Breaking changes to existing functionality</li>
              <li>Security vulnerabilities</li>
              <li>Failed deployments</li>
            </ul>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                  Your Name (for audit)
                </label>
                <input
                  type="text"
                  value={approver}
                  onChange={(e) => setApprover(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-lg border border-[var(--surface-3)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--border-default)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                  Justification
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why are you overriding these blockers?"
                  className="w-full rounded-lg border border-[var(--surface-3)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--border-default)] focus:outline-none resize-none"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowOverrideConfirm(false)}
                className="rounded-lg border border-[var(--surface-3)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={!approver.trim() || !reason.trim() || isSubmitting}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium",
                  approver.trim() && reason.trim() && !isSubmitting
                    ? "bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-3)]"
                    : "bg-[var(--surface-2)] text-[var(--text-muted)] cursor-not-allowed"
                )}
              >
                {isSubmitting ? "Processing..." : "Override & Proceed"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default GateFooter;
