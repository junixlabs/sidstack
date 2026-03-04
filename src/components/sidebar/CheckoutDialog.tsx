import { Loader2 } from "lucide-react";
import { memo, useState, useCallback, useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/stores/projectStore";

// =============================================================================
// Types
// =============================================================================

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deskId: string;
  deskName: string;
  currentBranch: string;
}

type CheckoutMode = "existing" | "create";

// =============================================================================
// CheckoutDialog — Switch or create branch on a desk
// =============================================================================

export const CheckoutDialog = memo(function CheckoutDialog({
  open,
  onOpenChange,
  deskId,
  deskName,
  currentBranch,
}: CheckoutDialogProps) {
  const { checkoutDesk, checkoutCreateDesk } = useProjectStore();

  const [mode, setMode] = useState<CheckoutMode>("create");
  const [branchName, setBranchName] = useState("");
  const [baseBranch, setBaseBranch] = useState("main");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setMode("create");
      setBranchName("");
      setBaseBranch("main");
      setError(null);
    }
  }, [open]);

  const handleCheckout = useCallback(async () => {
    if (!branchName.trim()) return;

    setLoading(true);
    setError(null);

    try {
      if (mode === "create") {
        await checkoutCreateDesk(deskId, branchName.trim(), baseBranch.trim() || undefined);
      } else {
        await checkoutDesk(deskId, branchName.trim());
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [mode, deskId, branchName, baseBranch, checkoutDesk, checkoutCreateDesk, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Checkout Branch</DialogTitle>
          <DialogDescription>
            Switch branch on {deskName} (currently on <span className="font-mono">{currentBranch}</span>)
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-1.5">
            {(["create", "existing"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 h-8 flex items-center justify-center rounded text-[12px] font-medium border transition-colors",
                  mode === m
                    ? "border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--accent-primary)]/8"
                    : "border-[var(--border-default)] text-[var(--text-secondary)] bg-[var(--surface-0)] hover:border-[var(--border-emphasis)]"
                )}
              >
                {m === "create" ? "New Branch" : "Existing Branch"}
              </button>
            ))}
          </div>

          {/* Branch Name */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[var(--text-secondary)]">
              Branch Name
            </Label>
            <Input
              className="font-mono text-[11px] h-9"
              placeholder={mode === "create" ? "feat/my-feature" : "main"}
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCheckout()}
            />
          </div>

          {/* Base Branch (only for create mode) */}
          {mode === "create" && (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-[var(--text-secondary)]">
                Base Branch
              </Label>
              <Input
                className="font-mono text-[11px] h-9"
                placeholder="main"
                value={baseBranch}
                onChange={(e) => setBaseBranch(e.target.value)}
              />
            </div>
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
            onClick={handleCheckout}
            disabled={!branchName.trim() || loading}
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {loading ? "Switching..." : mode === "create" ? "Create & Checkout" : "Checkout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export default CheckoutDialog;
