import { ClipboardCheck, GitBranch, AlertTriangle, AlertCircle, Loader2 } from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";

interface NewTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewTaskDialog({ isOpen, onClose }: NewTaskDialogProps) {
  const [taskId, setTaskId] = useState("");
  const [branchName, setBranchName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { createWorkspace } = useWorkspace();
  const { projectPath, setWorkspaces, setActiveWorkspace, addTab } = useAppStore();

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setTaskId("");
      setBranchName("");
      setError(null);
    }
  }, [isOpen]);

  const handleCreate = useCallback(async () => {
    if (!taskId.trim()) {
      setError("Task ID is required");
      return;
    }

    if (!projectPath) {
      setError("Please open a project first");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const workspace = await createWorkspace(
        projectPath,
        taskId.trim(),
        branchName.trim() || undefined
      );

      setWorkspaces([...useAppStore.getState().workspaces, workspace]);
      setActiveWorkspace(workspace);

      addTab({
        id: `task-${workspace.task_id}`,
        type: "task",
        title: `Task ${workspace.task_id}`,
        data: workspace,
      });

      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setIsCreating(false);
    }
  }, [taskId, branchName, projectPath, createWorkspace, setWorkspaces, setActiveWorkspace, addTab, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && projectPath && taskId.trim()) {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--surface-2)]">
              <ClipboardCheck className="w-5 h-5 text-[var(--text-secondary)]" />
            </div>
            <div>
              <DialogTitle>Create New Task</DialogTitle>
              <DialogDescription>
                Create an isolated workspace for your task
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-muted)]">
              <AlertCircle className="w-5 h-5 text-[var(--text-secondary)] shrink-0" />
              <span className="text-sm text-[var(--text-secondary)]">{error}</span>
            </div>
          )}

          {/* Warning: No project */}
          {!projectPath && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-muted)]">
              <AlertTriangle className="w-5 h-5 text-[var(--text-secondary)] shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--text-secondary)]">No project open</p>
                <p className="text-xs mt-0.5 text-[var(--text-muted)]">
                  Please open a project first before creating a task
                </p>
              </div>
            </div>
          )}

          {/* Task ID Input */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-[var(--text-muted)]" />
              Task ID
              <span className="text-[var(--text-secondary)]">*</span>
            </Label>
            <Input
              ref={inputRef}
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., TASK-123 or feature-login"
              disabled={!projectPath}
              className={cn(!projectPath && "opacity-50 cursor-not-allowed")}
            />
            <p className="text-xs text-[var(--text-muted)]">
              This will create a git worktree and branch for this task
            </p>
          </div>

          {/* Branch Name Input */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[var(--text-muted)]" />
              Branch Name
              <span className="text-xs font-normal text-[var(--text-muted)]">(optional)</span>
            </Label>
            <Input
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={taskId ? `task/${taskId}` : "Auto-generated from Task ID"}
              disabled={!projectPath}
              className={cn(!projectPath && "opacity-50 cursor-not-allowed")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !projectPath || !taskId.trim()}
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Task"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
