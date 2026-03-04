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
import { useProjectStore } from "@/stores/projectStore";

// =============================================================================
// Types
// =============================================================================

interface CreateDeskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// =============================================================================
// CreateDeskDialog — Desk v2: create a persistent dev machine
// =============================================================================

export const CreateDeskDialog = memo(function CreateDeskDialog({
  open,
  onOpenChange,
}: CreateDeskDialogProps) {
  const { createDesk } = useProjectStore();

  const [name, setName] = useState("desk-1");
  const [baseBranch, setBaseBranch] = useState("main");
  const [bootstrap, setBootstrap] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName("desk-1");
      setBaseBranch("main");
      setBootstrap("");
      setError(null);
    }
  }, [open]);

  const isValidName = /^[a-zA-Z0-9_-]+$/.test(name);

  const handleCreate = useCallback(async () => {
    if (!name.trim() || !isValidName) return;

    setLoading(true);
    setError(null);

    try {
      await createDesk(name.trim(), {
        baseBranch: baseBranch.trim() || "main",
        bootstrap: bootstrap.trim() || undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [name, isValidName, baseBranch, bootstrap, createDesk, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Desk</DialogTitle>
          <DialogDescription>
            Create a persistent dev machine (git worktree).
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Desk Name */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[var(--text-secondary)]">
              Desk Name
            </Label>
            <Input
              className="font-mono text-[11px] h-9"
              placeholder="desk-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            {name && !isValidName && (
              <p className="text-[10px] text-red-400">
                Only alphanumeric, dash, and underscore allowed.
              </p>
            )}
          </div>

          {/* Base Branch */}
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

          {/* Bootstrap Command */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[var(--text-secondary)]">
              Bootstrap Command (optional)
            </Label>
            <Input
              className="font-mono text-[11px] h-9"
              placeholder="pnpm install"
              value={bootstrap}
              onChange={(e) => setBootstrap(e.target.value)}
            />
            <p className="text-[10px] text-[var(--text-placeholder)]">
              Runs after worktree creation. Non-blocking.
            </p>
          </div>

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
            onClick={handleCreate}
            disabled={!name.trim() || !isValidName || loading}
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {loading ? "Creating..." : "Create Desk"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export default CreateDeskDialog;
