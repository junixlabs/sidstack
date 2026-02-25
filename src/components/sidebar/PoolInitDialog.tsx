import { invoke } from "@tauri-apps/api/core";
import { Loader2 } from "lucide-react";
import { memo, useState, useCallback, useMemo } from "react";

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

interface PoolInitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectPath: string;
}

// =============================================================================
// PoolInitDialog — Mockup Screen 4
// =============================================================================

export const PoolInitDialog = memo(function PoolInitDialog({
  open,
  onOpenChange,
  projectId,
  projectPath,
}: PoolInitDialogProps) {
  const { createAgentDesk } = useProjectStore();

  const [poolSize, setPoolSize] = useState(3);
  const [bootstrapCmd, setBootstrapCmd] = useState("pnpm install");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Role distribution: 1 reviewer if pool >= 2, rest are workers
  const reviewerCount = poolSize >= 2 ? 1 : 0;
  const workerCount = poolSize - reviewerCount;

  // Parent directory for desk paths
  const parentDir = useMemo(() => {
    return projectPath.replace(/\/[^/]+$/, "");
  }, [projectPath]);

  // Generate desk names and preview
  const deskPlan = useMemo(() => {
    const desks: Array<{ name: string; role: "worker" | "reviewer"; label: string }> = [];
    for (let i = 1; i <= workerCount; i++) {
      desks.push({ name: `desk-${i}`, role: "worker", label: `Worker ${i}` });
    }
    if (reviewerCount > 0) {
      desks.push({ name: "desk-review", role: "reviewer", label: "Reviewer" });
    }
    return desks;
  }, [workerCount, reviewerCount]);

  // Extract project folder name for preview
  const projectFolder = useMemo(() => {
    const parts = projectPath.split("/").filter(Boolean);
    return parts[parts.length - 1] || "project";
  }, [projectPath]);

  const handleInit = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      for (const desk of deskPlan) {
        const deskPath = `${parentDir}/${desk.name}`;
        const branch = desk.name; // Each desk gets its own branch

        // Create git worktree
        await invoke<string>("run_git_command", {
          cwd: projectPath,
          args: ["worktree", "add", "-b", branch, deskPath],
        });

        // Register in store
        createAgentDesk(projectId, deskPath, branch, desk.role, desk.label);

        // Run bootstrap command (non-blocking, ignore errors)
        if (bootstrapCmd.trim()) {
          const [cmd, ...cmdArgs] = bootstrapCmd.trim().split(/\s+/);
          try {
            await invoke("run_shell_command", { command: cmd, args: cmdArgs, cwd: deskPath });
          } catch {
            // Bootstrap failure is non-fatal
          }
        }
      }

      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [deskPlan, parentDir, projectPath, projectId, bootstrapCmd, createAgentDesk, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Initialize Desk Pool</DialogTitle>
          <DialogDescription>
            Set up isolated workspaces for parallel development
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Pool Size - number selector */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[var(--text-secondary)]">
              Pool Size
            </Label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPoolSize(n)}
                  className={cn(
                    "w-9 h-8 flex items-center justify-center rounded text-[13px] font-medium border transition-colors",
                    poolSize === n
                      ? "border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--accent-primary)]/8"
                      : "border-[var(--border-default)] text-[var(--text-secondary)] bg-[var(--surface-0)] hover:border-[var(--border-emphasis)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Role Distribution */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[var(--text-secondary)]">
              Role Distribution
            </Label>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
                  worker
                </span>
                <span className="text-[20px] font-semibold text-[var(--text-primary)]">
                  &times; {workerCount}
                </span>
              </div>
              {reviewerCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">
                    reviewer
                  </span>
                  <span className="text-[20px] font-semibold text-[var(--text-primary)]">
                    &times; {reviewerCount}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bootstrap Command */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[var(--text-secondary)]">
              Bootstrap Command
            </Label>
            <Input
              className="font-mono text-[11px] h-9"
              value={bootstrapCmd}
              onChange={(e) => setBootstrapCmd(e.target.value)}
              placeholder="pnpm install"
            />
          </div>

          {/* Preview */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-[var(--text-secondary)]">
              Preview
            </Label>
            <div
              className="rounded border border-[var(--border-muted)] bg-[var(--surface-0)] p-3 font-mono text-[11px] leading-relaxed"
            >
              <div className="text-[var(--text-placeholder)]">{projectFolder}/</div>
              <div>
                <span className="text-[var(--text-placeholder)]">{"  \u251C\u2500\u2500 "}</span>
                <span className="text-[var(--accent-primary)]">.sidstack/</span>
                <span className="text-[var(--text-placeholder)]">{"          shared knowledge"}</span>
              </div>
              <div>
                <span className="text-[var(--text-placeholder)]">{"  \u251C\u2500\u2500 "}</span>
                <span className="text-[var(--text-secondary)]">main/</span>
                <span className="text-[var(--text-placeholder)]">{"               reference"}</span>
              </div>
              {deskPlan.map((desk, idx) => (
                <div key={desk.name}>
                  <span className="text-[var(--text-placeholder)]">
                    {idx === deskPlan.length - 1 ? "  \u2514\u2500\u2500 " : "  \u251C\u2500\u2500 "}
                  </span>
                  <span className="text-green-400">{desk.name}/</span>
                  <span className="text-[var(--text-placeholder)]">
                    {"             ".slice(0, Math.max(1, 16 - desk.name.length))}{desk.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleInit} disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isLoading ? "Initializing..." : "Initialize Pool"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export default PoolInitDialog;
