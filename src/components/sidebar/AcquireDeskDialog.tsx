import { memo, useState, useCallback, useEffect, useMemo } from "react";

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
import { useProjectStore } from "@/stores/projectStore";
import { useTaskStore } from "@/stores/taskStore";

// =============================================================================
// Types
// =============================================================================

interface AcquireDeskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worktreeId: string;
  deskName: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Generate a branch name from task ID and title.
 * Infers prefix from task title's [TYPE] tag.
 */
function generateBranchName(taskId: string, taskTitle: string): string {
  let prefix = "feat";
  const lower = taskTitle.toLowerCase();
  if (lower.startsWith("[bugfix]") || lower.startsWith("[fix]")) prefix = "fix";
  else if (lower.startsWith("[refactor]")) prefix = "refactor";
  else if (lower.startsWith("[docs]")) prefix = "docs";
  else if (lower.startsWith("[perf]")) prefix = "perf";

  const slug = taskTitle
    .replace(/^\[[^\]]+\]\s*/, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40)
    .replace(/-$/, "");

  const id = taskId.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return `${prefix}/${id}-${slug}`;
}

// =============================================================================
// AcquireDeskDialog — Mockup Screen 3
// =============================================================================

export const AcquireDeskDialog = memo(function AcquireDeskDialog({
  open,
  onOpenChange,
  worktreeId,
  deskName,
}: AcquireDeskDialogProps) {
  const { acquireDesk } = useProjectStore();
  const { tasks, fetchTasks } = useTaskStore();

  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [branchName, setBranchName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch tasks when dialog opens
  useEffect(() => {
    if (open) {
      fetchTasks("sidstack");
      setSelectedTaskId("");
      setBranchName("");
      setError(null);
    }
  }, [open, fetchTasks]);

  // Pending tasks available for selection
  const pendingTasks = useMemo(() => {
    return tasks.filter((t) => t.status === "pending" || t.status === "in_progress");
  }, [tasks]);

  // Auto-generate branch name when task selection changes
  const selectedTask = useMemo(() => {
    return tasks.find((t) => t.id === selectedTaskId);
  }, [tasks, selectedTaskId]);

  useEffect(() => {
    if (selectedTask) {
      setBranchName(generateBranchName(selectedTask.id, selectedTask.title));
    }
  }, [selectedTask]);

  const handleAcquire = useCallback(async () => {
    if (!selectedTaskId || !branchName.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const title = selectedTask?.title || "Untitled";
      await acquireDesk(worktreeId, selectedTaskId, title, branchName.trim());
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [worktreeId, selectedTaskId, branchName, selectedTask, acquireDesk, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Acquire Desk</DialogTitle>
          <DialogDescription>
            Assign a task and create a feature branch for {deskName}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Task dropdown */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[var(--text-secondary)]">
              Task
            </Label>
            <Select value={selectedTaskId || undefined} onValueChange={setSelectedTaskId}>
              <SelectTrigger className="w-full h-9 text-[12px]">
                <SelectValue placeholder="Select a task..." />
              </SelectTrigger>
              <SelectContent>
                {pendingTasks.length > 0 ? (
                  pendingTasks.map((task) => (
                    <SelectItem key={task.id} value={task.id} className="text-[12px]">
                      {task.id} — {task.title.replace(/^\[[^\]]+\]\s*/, "")}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-3 py-2 text-[11px] text-[var(--text-muted)]">
                    No pending tasks found
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Branch Name */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[var(--text-secondary)]">
              Branch Name
            </Label>
            <Input
              className="font-mono text-[11px] h-9"
              placeholder="feat/task-123-auth-module"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAcquire()}
            />
            <p className="text-[10px] text-[var(--text-placeholder)]">
              Auto-generated from task. You can edit this.
            </p>
          </div>

          {/* Base Branch (read-only) */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[var(--text-secondary)]">
              Base Branch
            </Label>
            <Input
              className="font-mono text-[11px] h-9 text-[var(--text-muted)]"
              style={{ background: "var(--surface-1)" }}
              value="main"
              disabled
            />
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
            onClick={handleAcquire}
            disabled={!selectedTaskId || !branchName.trim() || loading}
          >
            {loading ? "Acquiring..." : "Acquire"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export default AcquireDeskDialog;
