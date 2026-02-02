import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { FolderOpen, GitBranch, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/stores/projectStore";


// =============================================================================
// Types
// =============================================================================

interface AddWorktreeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectPath: string;
}

interface BranchInfo {
  name: string;
  isRemote: boolean;
}

// =============================================================================
// AddWorktreeDialog Component
// =============================================================================

export const AddWorktreeDialog = memo(function AddWorktreeDialog({
  open,
  onOpenChange,
  projectId,
  projectPath,
}: AddWorktreeDialogProps) {
  const { addWorktree } = useProjectStore();

  // Form state
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [branchName, setBranchName] = useState("");
  const [worktreePath, setWorktreePath] = useState("");
  const [purpose, setPurpose] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available branches
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);

  // Load branches when dialog opens
  useEffect(() => {
    if (open && projectPath) {
      loadBranches();
    }
  }, [open, projectPath]);

  // Generate default worktree path when branch changes
  useEffect(() => {
    if (branchName && projectPath) {
      const basePath = projectPath.replace(/\/[^/]+$/, ""); // Parent directory
      const sanitizedBranch = branchName
        .replace(/\//g, "-")
        .replace(/[^a-z0-9-]/gi, "-")
        .toLowerCase();
      setWorktreePath(`${basePath}/${sanitizedBranch}`);
    }
  }, [branchName, projectPath]);

  const loadBranches = useCallback(async () => {
    setLoadingBranches(true);
    try {
      // Get local branches
      const localOutput = await invoke<string>("run_git_command", {
        cwd: projectPath,
        args: ["branch", "--format=%(refname:short)"],
      });
      const localBranches = localOutput
        .split("\n")
        .filter(Boolean)
        .map((name) => ({ name, isRemote: false }));

      // Get remote branches
      const remoteOutput = await invoke<string>("run_git_command", {
        cwd: projectPath,
        args: ["branch", "-r", "--format=%(refname:short)"],
      });
      const remoteBranches = remoteOutput
        .split("\n")
        .filter(Boolean)
        .filter((name) => !name.includes("HEAD"))
        .map((name) => ({ name: name.replace(/^origin\//, ""), isRemote: true }));

      // Merge, preferring local branches
      const allBranches = [...localBranches];
      for (const remote of remoteBranches) {
        if (!allBranches.some((b) => b.name === remote.name)) {
          allBranches.push(remote);
        }
      }

      setBranches(allBranches);
    } catch (err) {
      console.error("Failed to load branches:", err);
    } finally {
      setLoadingBranches(false);
    }
  }, [projectPath]);

  const handleBrowse = useCallback(async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select Worktree Location",
      });
      if (selected) {
        setWorktreePath(selected as string);
      }
    } catch (err) {
      console.error("Failed to open directory picker:", err);
    }
  }, []);

  const handleCreate = useCallback(async () => {
    if (!branchName || !worktreePath) {
      setError("Branch name and location are required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build git worktree add command
      const args = ["worktree", "add"];

      if (mode === "new") {
        // Create new branch: git worktree add -b <branch> <path>
        args.push("-b", branchName, worktreePath);
      } else {
        // Use existing branch: git worktree add <path> <branch>
        args.push(worktreePath, branchName);
      }

      await invoke<string>("run_git_command", {
        cwd: projectPath,
        args,
      });

      // Add to project store
      await addWorktree(projectId, worktreePath, purpose || undefined);

      // Reset form and close dialog
      setBranchName("");
      setWorktreePath("");
      setPurpose("");
      setMode("existing");
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to create worktree:", err);
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [branchName, worktreePath, purpose, mode, projectPath, projectId, addWorktree, onOpenChange]);

  const handleRegisterExisting = useCallback(async () => {
    if (!worktreePath) {
      setError("Worktree location is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Just register existing worktree without running git command
      await addWorktree(projectId, worktreePath, purpose || undefined);

      // Reset form and close dialog
      setWorktreePath("");
      setPurpose("");
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to register worktree:", err);
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [worktreePath, purpose, projectId, addWorktree, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Worktree</DialogTitle>
          <DialogDescription>
            Create a new git worktree or register an existing one.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Mode selection */}
          <div className="space-y-2">
            <Label>Mode</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={cn(
                  "flex-1 px-3 py-2 rounded-md text-sm border transition-colors",
                  mode === "existing"
                    ? "bg-[var(--surface-2)] border-[var(--accent-primary)] text-[var(--text-primary)]"
                    : "bg-[var(--surface-0)] border-[var(--surface-3)] text-[var(--text-secondary)] hover:bg-[var(--surface-1)]"
                )}
              >
                Use existing branch
              </button>
              <button
                type="button"
                onClick={() => setMode("new")}
                className={cn(
                  "flex-1 px-3 py-2 rounded-md text-sm border transition-colors",
                  mode === "new"
                    ? "bg-[var(--surface-2)] border-[var(--accent-primary)] text-[var(--text-primary)]"
                    : "bg-[var(--surface-0)] border-[var(--surface-3)] text-[var(--text-secondary)] hover:bg-[var(--surface-1)]"
                )}
              >
                Create new branch
              </button>
            </div>
          </div>

          {/* Branch selection/input */}
          <div className="space-y-2">
            <Label htmlFor="branch">
              <GitBranch className="w-3.5 h-3.5 inline mr-1.5" />
              Branch
            </Label>
            {mode === "existing" ? (
              <Select
                value={branchName || undefined}
                onValueChange={setBranchName}
                disabled={loadingBranches}
              >
                <SelectTrigger className="w-full h-9 text-[13px]">
                  <SelectValue placeholder="Select a branch..." />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.name} value={branch.name}>
                      {branch.name} {branch.isRemote && "(remote)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="branch"
                placeholder="feature/my-new-feature"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
              />
            )}
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">
              <FolderOpen className="w-3.5 h-3.5 inline mr-1.5" />
              Location
            </Label>
            <div className="flex gap-2">
              <Input
                id="location"
                placeholder="/path/to/worktree"
                value={worktreePath}
                onChange={(e) => setWorktreePath(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={handleBrowse}>
                Browse
              </Button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              The directory where the worktree will be created.
            </p>
          </div>

          {/* Purpose (optional) */}
          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose (optional)</Label>
            <Input
              id="purpose"
              placeholder="Working on authentication feature..."
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleRegisterExisting}
            disabled={!worktreePath || isLoading}
          >
            Register Existing
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!branchName || !worktreePath || isLoading}
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Worktree
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export default AddWorktreeDialog;
