/**
 * Gate Status
 *
 * Compact gate status indicator component.
 * Shows current gate status with blocker/warning counts.
 */

import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Lock,
  UserCheck,
} from "lucide-react";
import { memo } from "react";

import { cn } from "@/lib/utils";
import type { ImplementationGate, GateStatus as GateStatusType } from "@sidstack/shared";

// =============================================================================
// Types
// =============================================================================

interface GateStatusProps {
  gate: ImplementationGate;
  size?: "sm" | "md" | "lg";
  showDetails?: boolean;
  className?: string;
  onClick?: () => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getGateIcon(status: GateStatusType, size: "sm" | "md" | "lg") {
  const sizeClass = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  }[size];

  switch (status) {
    case "blocked":
      return <XCircle className={cn(sizeClass, "text-[var(--text-secondary)]")} />;
    case "warning":
      return <AlertTriangle className={cn(sizeClass, "text-[var(--text-secondary)]")} />;
    case "clear":
      return <CheckCircle className={cn(sizeClass, "text-[var(--text-secondary)]")} />;
  }
}

function getGateText(status: GateStatusType) {
  switch (status) {
    case "blocked":
      return "Blocked";
    case "warning":
      return "Warning";
    case "clear":
      return "Ready";
  }
}

function getGateBgColor(status: GateStatusType) {
  switch (status) {
    case "blocked":
      return "bg-[var(--surface-2)] border-[var(--border-default)] hover:bg-[var(--surface-3)]";
    case "warning":
      return "bg-[var(--surface-2)] border-[var(--border-default)] hover:bg-[var(--surface-3)]";
    case "clear":
      return "bg-[var(--surface-2)] border-[var(--border-default)] hover:bg-[var(--surface-3)]";
  }
}

function getGateTextColor(status: GateStatusType) {
  switch (status) {
    case "blocked":
      return "text-[var(--text-secondary)]";
    case "warning":
      return "text-[var(--text-secondary)]";
    case "clear":
      return "text-[var(--text-secondary)]";
  }
}

// =============================================================================
// Component
// =============================================================================

export const GateStatus = memo(function GateStatus({
  gate,
  size = "md",
  showDetails = true,
  className,
  onClick,
}: GateStatusProps) {
  const textSize = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }[size];

  const padding = {
    sm: "px-2 py-1",
    md: "px-3 py-1.5",
    lg: "px-4 py-2",
  }[size];

  const Component = onClick ? "button" : "div";

  return (
    <Component
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg border",
        getGateBgColor(gate.status),
        padding,
        onClick && "cursor-pointer",
        className
      )}
    >
      {getGateIcon(gate.status, size)}

      <span className={cn("font-medium", textSize, getGateTextColor(gate.status))}>
        {getGateText(gate.status)}
      </span>

      {showDetails && (
        <>
          {/* Blocker count */}
          {gate.blockers.length > 0 && (
            <span className="flex items-center gap-1 rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--text-secondary)]">
              <Lock className="h-3 w-3" />
              {gate.blockers.length}
            </span>
          )}

          {/* Warning count */}
          {gate.warnings.length > 0 && (
            <span className="flex items-center gap-1 rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--text-secondary)]">
              <AlertTriangle className="h-3 w-3" />
              {gate.warnings.length}
            </span>
          )}

          {/* Approval indicator */}
          {gate.approval && (
            <span className="flex items-center gap-1 rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--text-secondary)]">
              <UserCheck className="h-3 w-3" />
            </span>
          )}
        </>
      )}
    </Component>
  );
});

// =============================================================================
// Badge variant for inline use
// =============================================================================

export const GateStatusBadge = memo(function GateStatusBadge({
  status,
  className,
}: {
  status: GateStatusType;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        status === "blocked" && "bg-[var(--surface-2)] text-[var(--text-secondary)]",
        status === "warning" && "bg-[var(--surface-2)] text-[var(--text-secondary)]",
        status === "clear" && "bg-[var(--surface-2)] text-[var(--text-secondary)]",
        className
      )}
    >
      {status === "blocked" && <XCircle className="h-3 w-3" />}
      {status === "warning" && <AlertTriangle className="h-3 w-3" />}
      {status === "clear" && <CheckCircle className="h-3 w-3" />}
      {getGateText(status)}
    </span>
  );
});

export default GateStatus;
