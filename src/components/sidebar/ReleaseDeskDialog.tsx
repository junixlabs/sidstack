import { AlertTriangle, GitBranch, RotateCcw } from "lucide-react";
import { memo, useState, useCallback } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useProjectStore } from "@/stores/projectStore";

// =============================================================================
// Types
// =============================================================================

interface ReleaseDeskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worktreeId: string;
  agentName: string;
  currentBranch: string;
  currentTaskTitle?: string;
  isDirty?: boolean;
}

// =============================================================================
// ReleaseDeskDialog Component
// =============================================================================

export const ReleaseDeskDialog = memo(function ReleaseDeskDialog({
  open,
  onOpenChange,
  worktreeId,
  agentName,
  currentBranch,
  currentTaskTitle,
  isDirty,
}: ReleaseDeskDialogProps) {
  const { releaseDesk } = useProjectStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forceRelease, setForceRelease] = useState(false);

  const handleRelease = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await releaseDesk(worktreeId, { force: forceRelease, deleteBranch: true });
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("uncommitted") || msg.includes("changes")) {
        setError("Desk has uncommitted changes. Enable force release to discard them.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [worktreeId, forceRelease, releaseDesk, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Release {agentName}</DialogTitle>
          <DialogDescription>
            Reset desk to main branch and mark as idle.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Current state summary */}
          <div className="rounded border border-[var(--border-muted)] p-3 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <GitBranch className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span className="text-[var(--text-muted)]">Branch:</span>
              <span className="font-mono text-[var(--text-primary)]">{currentBranch}</span>
            </div>
            {currentTaskTitle && (
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-muted)] ml-5">Task:</span>
                <span className="text-[var(--text-primary)]">{currentTaskTitle}</span>
              </div>
            )}
          </div>

          {/* Warning for dirty state */}
          {isDirty && (
            <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-400/10 rounded px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>This desk has uncommitted changes that will be lost.</span>
            </div>
          )}

          {/* What will happen */}
          <div className="text-xs text-[var(--text-muted)] space-y-1">
            <p>This will:</p>
            <ul className="list-disc list-inside pl-2 space-y-0.5">
              {isDirty && forceRelease && <li>Discard all uncommitted changes</li>}
              <li>Switch to <span className="font-mono">main</span> branch</li>
              <li>Pull latest from origin</li>
              {currentBranch !== "main" && (
                <li>Delete branch <span className="font-mono">{currentBranch}</span></li>
              )}
              <li>Mark desk as idle</li>
            </ul>
          </div>

          {/* Force toggle */}
          {isDirty && (
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={forceRelease}
                onChange={(e) => setForceRelease(e.target.checked)}
                className="rounded border-[var(--border-default)]"
              />
              <span className="text-amber-400">Force release (discard changes)</span>
            </label>
          )}

          {error && (
            <div className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleRelease}
            disabled={loading || (isDirty && !forceRelease)}
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            {loading ? "Releasing..." : "Release Desk"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export default ReleaseDeskDialog;
