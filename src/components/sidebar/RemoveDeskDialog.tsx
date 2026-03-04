import { AlertTriangle, Trash2 } from "lucide-react";
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

interface RemoveDeskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deskId: string;
  deskName: string;
  currentBranch: string;
  isDirty?: boolean;
}

// =============================================================================
// RemoveDeskDialog — Permanently remove a desk worktree
// =============================================================================

export const RemoveDeskDialog = memo(function RemoveDeskDialog({
  open,
  onOpenChange,
  deskId,
  deskName,
  currentBranch,
  isDirty,
}: RemoveDeskDialogProps) {
  const { removeDesk } = useProjectStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forceRemove, setForceRemove] = useState(false);

  const handleRemove = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await removeDesk(deskId, { force: forceRemove });
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("uncommitted") || msg.includes("changes")) {
        setError("Desk has uncommitted changes. Enable force to discard them.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [deskId, forceRemove, removeDesk, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Remove {deskName}</DialogTitle>
          <DialogDescription>
            Permanently remove this desk and its git worktree.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Current state */}
          <div className="rounded border border-[var(--border-muted)] p-3 text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)]">Desk:</span>
              <span className="font-mono text-[var(--text-primary)]">{deskName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)]">Branch:</span>
              <span className="font-mono text-[var(--text-primary)]">{currentBranch}</span>
            </div>
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
              <li>Remove the git worktree</li>
              <li>Delete the desk directory</li>
              {isDirty && forceRemove && <li>Discard all uncommitted changes</li>}
            </ul>
          </div>

          {/* Force toggle */}
          {isDirty && (
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={forceRemove}
                onChange={(e) => setForceRemove(e.target.checked)}
                className="rounded border-[var(--border-default)]"
              />
              <span className="text-amber-400">Force remove (discard changes)</span>
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
            onClick={handleRemove}
            disabled={loading || (isDirty && !forceRemove)}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            {loading ? "Removing..." : "Remove Desk"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export default RemoveDeskDialog;
