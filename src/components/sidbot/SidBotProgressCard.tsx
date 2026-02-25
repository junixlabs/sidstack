import { Loader2, CheckCircle2, XCircle, X, Terminal } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ClaudeStatus } from "@/stores/sidBotStore";

interface SidBotProgressCardProps {
  status: ClaudeStatus;
  step: string;
  detail: string;
  elapsed: number;
  onCancel: () => void;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function SidBotProgressCard({
  status,
  step,
  detail,
  elapsed,
  onCancel,
}: SidBotProgressCardProps) {
  if (status === "idle") return null;

  const isActive = status === "starting" || status === "working";
  const isDone = status === "done";
  const isError = status === "error";

  return (
    <div
      className={cn(
        "mx-3 rounded-lg border p-3 transition-all duration-300",
        "bg-[var(--surface-2)]",
        isActive && "border-[var(--accent-primary)]/40 shadow-[0_0_8px_rgba(var(--accent-primary-rgb,99,102,241),0.1)]",
        isDone && "border-[var(--color-success)]/30",
        isError && "border-[var(--color-error)]/30",
        !isActive && !isDone && !isError && "border-[var(--border-muted)]",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className={cn(
          "w-5 h-5 rounded flex-none flex items-center justify-center",
          isActive && "bg-[var(--accent-primary)]/10",
          isDone && "bg-[var(--color-success)]/10",
          isError && "bg-[var(--color-error)]/10",
        )}>
          {isActive && (
            <Terminal className="w-3 h-3 text-[var(--accent-primary)]" />
          )}
          {isDone && (
            <CheckCircle2 className="w-3 h-3 text-[var(--color-success)]" />
          )}
          {isError && (
            <XCircle className="w-3 h-3 text-[var(--color-error)]" />
          )}
        </div>
        <span className="text-xs font-semibold text-[var(--text-primary)] flex-1 truncate">
          Claude Code
        </span>
        {elapsed > 0 && (
          <span className={cn(
            "text-[10px] font-mono px-1.5 py-0.5 rounded",
            isActive && "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]",
            isDone && "bg-[var(--color-success)]/10 text-[var(--color-success)]",
            isError && "bg-[var(--color-error)]/10 text-[var(--color-error)]",
          )}>
            {formatElapsed(elapsed)}
          </span>
        )}
        {isActive && (
          <button
            onClick={onCancel}
            className="text-[var(--text-muted)] hover:text-[var(--color-error)] transition-colors"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Step label */}
      {step && (
        <div className="flex items-center gap-1.5 mb-2">
          {isActive && (
            <Loader2 className="w-3 h-3 text-[var(--accent-primary)] animate-spin flex-none" />
          )}
          <span className="text-[11px] text-[var(--text-secondary)] truncate">
            {step}
          </span>
        </div>
      )}

      {/* Progress bar (indeterminate) */}
      {isActive && (
        <div className="h-1 rounded-full bg-[var(--surface-3)] overflow-hidden mb-2">
          <div
            className="h-full w-1/3 rounded-full bg-[var(--accent-primary)]"
            style={{ animation: "sidbot-progress 1.5s ease-in-out infinite" }}
          />
        </div>
      )}

      {/* Detail */}
      {detail && (
        <div className="text-[11px] text-[var(--text-muted)] truncate font-mono bg-[var(--surface-3)] rounded px-2 py-1">
          {detail}
        </div>
      )}
    </div>
  );
}
