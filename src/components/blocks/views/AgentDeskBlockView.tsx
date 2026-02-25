import { invoke } from "@tauri-apps/api/core";
import {
  ArrowLeft,
  Bot,
  GitBranch,
  RefreshCw,
  Zap,
  ListTodo,
  Terminal,
  Code2,
  Copy,
  Check,
  Plus,
} from "lucide-react";
import { memo, useEffect, useState, useCallback, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { AcquireDeskDialog } from "@/components/sidebar/AcquireDeskDialog";
import { PoolInitDialog } from "@/components/sidebar/PoolInitDialog";
import { ReleaseDeskDialog } from "@/components/sidebar/ReleaseDeskDialog";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import { useProjectStore } from "@/stores/projectStore";
import type { Worktree } from "@/types";
import type { BlockViewProps } from "@/types/block";

import { registerBlockView } from "../BlockRegistry";

// =============================================================================
// Status Configuration
// =============================================================================

const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  dotColor: string;
  borderColor: string;
  subtext: string;
  badgeBg: string;
  badgeText: string;
}> = {
  idle: {
    label: "Idle",
    color: "text-[var(--text-muted)]",
    bgColor: "bg-[var(--surface-2)]",
    dotColor: "bg-[var(--text-muted)]",
    borderColor: "border-[var(--border-muted)]",
    subtext: "Ready for task assignment",
    badgeBg: "bg-[var(--surface-2)]",
    badgeText: "text-[var(--text-muted)]",
  },
  assigned: {
    label: "Assigned",
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
    dotColor: "bg-amber-400",
    borderColor: "border-amber-400/20",
    subtext: "Task assigned, ready to acquire",
    badgeBg: "bg-amber-400/10",
    badgeText: "text-amber-400",
  },
  working: {
    label: "Working",
    color: "text-green-400",
    bgColor: "bg-green-400/10",
    dotColor: "bg-green-400",
    borderColor: "border-green-400/20",
    subtext: "Active development in progress",
    badgeBg: "bg-green-400/10",
    badgeText: "text-green-400",
  },
  review: {
    label: "In Review",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    dotColor: "bg-blue-400",
    borderColor: "border-blue-400/20",
    subtext: "PR under review",
    badgeBg: "bg-blue-400/10",
    badgeText: "text-blue-400",
  },
};

// =============================================================================
// Lifecycle Phases (Circular Stepper)
// =============================================================================

const LIFECYCLE_PHASES = [
  { key: "idle", label: "Idle", letter: "I" },
  { key: "acquire", label: "Acquire", letter: "A" },
  { key: "work", label: "Work", letter: "W" },
  { key: "review", label: "Review", letter: "R" },
  { key: "merge", label: "Merge", letter: "M" },
  { key: "release", label: "Release", letter: "R" },
] as const;

function getActivePhaseIndex(status: string): number {
  switch (status) {
    case "idle": return 0;
    case "assigned": return 1;
    case "working": return 2;
    case "review": return 3;
    default: return 0;
  }
}

// =============================================================================
// LifecycleTracker — Circular Stepper (matches mockup)
// =============================================================================

const LifecycleTracker = memo(function LifecycleTracker({ status }: { status: string }) {
  const activeIdx = getActivePhaseIndex(status);

  return (
    <div className="flex items-start">
      {LIFECYCLE_PHASES.map((phase, idx) => {
        const isDone = idx < activeIdx;
        const isActive = idx === activeIdx;

        return (
          <div key={phase.key} className="flex items-start">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold border-2",
                  isDone && "border-[var(--text-muted)] bg-[var(--text-muted)] text-[var(--surface-1)]",
                  isActive && "border-green-400 bg-green-400/10 text-green-400",
                  !isDone && !isActive && "border-[var(--border-default)] bg-[var(--surface-1)] text-[var(--text-muted)]",
                )}
              >
                {isDone ? (
                  <Check className="w-2.5 h-2.5" strokeWidth={3} />
                ) : (
                  phase.letter
                )}
              </div>
              <span
                className={cn(
                  "text-[9px] font-medium uppercase tracking-wide mt-1",
                  isActive ? "text-green-400" : "text-[var(--text-muted)]",
                )}
              >
                {phase.label}
              </span>
            </div>
            {idx < LIFECYCLE_PHASES.length - 1 && (
              <div
                className={cn(
                  "w-6 h-0.5 mt-[13px]",
                  isDone ? "bg-[var(--text-muted)]" : "bg-[var(--border-default)]",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
});

// =============================================================================
// DeskPoolOverview — Mockup Screen 1
// =============================================================================

interface DeskPoolOverviewProps {
  onDeskClick: (deskId: string) => void;
}

const DeskPoolOverview = memo(function DeskPoolOverview({
  onDeskClick,
}: DeskPoolOverviewProps) {
  const { projects } = useProjectStore();
  const { projectPath } = useAppStore();
  const [poolInitOpen, setPoolInitOpen] = useState(false);
  const [acquireOpen, setAcquireOpen] = useState(false);
  const [acquireTarget, setAcquireTarget] = useState<{ id: string; name: string } | null>(null);

  // Find active project
  const activeProject = useMemo(() => {
    if (!projectPath) return null;
    return projects.find((p) =>
      p.worktrees.some((w) => w.path === projectPath)
    ) || projects[0] || null;
  }, [projects, projectPath]);

  const desks = activeProject?.worktrees || [];

  // Stats
  const stats = useMemo(() => {
    const workers = desks.filter((d) => d.agentRole === "worker").length;
    const reviewers = desks.filter((d) => d.agentRole === "reviewer").length;
    const idle = desks.filter((d) => !d.agentStatus || d.agentStatus === "idle").length;
    const working = desks.filter((d) => d.agentStatus === "working").length;
    const review = desks.filter((d) => d.agentStatus === "review").length;
    return { total: desks.length, workers, reviewers, idle, working, review };
  }, [desks]);

  // Quick actions
  const handleOpenTerminal = useCallback(async (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("run_shell_command", { command: "open", args: ["-a", "Terminal", path] });
    } catch { /* ignore */ }
  }, []);

  const handleOpenIDE = useCallback(async (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("run_shell_command", { command: "code", args: [path] });
    } catch { /* ignore */ }
  }, []);

  const handleAcquireClick = useCallback((worktree: Worktree, e: React.MouseEvent) => {
    e.stopPropagation();
    setAcquireTarget({ id: worktree.id, name: worktree.id });
    setAcquireOpen(true);
  }, []);

  if (desks.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <EmptyState
          icon={<Bot className="w-full h-full" />}
          title="No Agent Desks"
          description="Initialize a desk pool to start parallel development."
          actions={
            activeProject ? [
              { label: "Initialize Pool", onClick: () => setPoolInitOpen(true), icon: <Plus className="w-3.5 h-3.5" /> },
            ] : undefined
          }
        />
        {activeProject && (
          <PoolInitDialog
            open={poolInitOpen}
            onOpenChange={setPoolInitOpen}
            projectId={activeProject.id}
            projectPath={activeProject.worktrees[0]?.path || ""}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Stats Bar */}
      <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-[var(--border-muted)] text-[11px] text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--surface-2)]">
          <span className="w-[5px] h-[5px] rounded-full bg-[var(--text-muted)]" />
          {stats.total} desks
        </span>
        <span className="text-[var(--text-placeholder)]">&middot;</span>
        <span>{stats.workers} workers</span>
        <span className="text-[var(--text-placeholder)]">&middot;</span>
        <span>{stats.reviewers} reviewers</span>
        <span className="text-[var(--text-placeholder)]">&middot;</span>
        {stats.working > 0 && (
          <span className="text-green-400">{stats.working} working</span>
        )}
        {stats.working > 0 && stats.idle > 0 && (
          <span className="text-[var(--text-placeholder)]">&middot;</span>
        )}
        {stats.idle > 0 && <span>{stats.idle} idle</span>}
        {stats.review > 0 && (
          <>
            <span className="text-[var(--text-placeholder)]">&middot;</span>
            <span className="text-blue-400">{stats.review} review</span>
          </>
        )}
        <span className="flex-1" />
        <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1" onClick={() => setPoolInitOpen(true)}>
          <Plus className="w-3 h-3" />
          Add Desk
        </Button>
      </div>

      {/* Desk Grid */}
      <div className="flex-1 overflow-auto p-5">
        <div className="grid grid-cols-3 gap-3">
          {desks.map((desk) => {
            const status = desk.agentStatus || "idle";
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
            const isIdle = status === "idle";

            return (
              <div
                key={desk.id}
                onClick={() => onDeskClick(desk.id)}
                className="bg-[var(--surface-1)] border border-[var(--border-muted)] rounded-md p-4 cursor-pointer transition-all hover:border-[var(--border-emphasis)] hover:bg-[#1c1c1f]"
              >
                {/* Card Header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">{desk.agentName || desk.id}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded",
                      desk.agentRole === "reviewer"
                        ? "bg-purple-500/15 text-purple-400"
                        : "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                    )}>
                      {desk.agentRole || "worker"}
                    </span>
                    <span className={cn(
                      "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded",
                      cfg.badgeBg, cfg.badgeText
                    )}>
                      <span className={cn(
                        "w-[5px] h-[5px] rounded-full",
                        cfg.dotColor,
                        status === "working" && "animate-pulse"
                      )} />
                      {cfg.label.toLowerCase()}
                    </span>
                  </div>
                </div>

                {/* Card Rows */}
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-[var(--text-muted)] w-12 shrink-0">Branch</span>
                    <span className={cn(
                      "font-mono text-[11px] truncate",
                      isIdle ? "text-[var(--text-muted)]" : "text-[var(--text-secondary)]"
                    )}>
                      {desk.branch}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-[var(--text-muted)] w-12 shrink-0">Task</span>
                    <span className={cn(
                      "text-[11px] truncate max-w-[200px]",
                      desk.currentTaskTitle
                        ? "text-[var(--text-secondary)]"
                        : "text-[var(--text-placeholder)]"
                    )}>
                      {desk.currentTaskTitle || "No task assigned"}
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex gap-1.5 pt-3 border-t border-[var(--border-muted)]">
                  {isIdle ? (
                    <Button
                      size="sm"
                      className="h-6 text-[11px] gap-1"
                      onClick={(e) => handleAcquireClick(desk, e)}
                    >
                      <Plus className="w-3 h-3" />
                      Acquire
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-[var(--text-secondary)] gap-1"
                    onClick={(e) => handleOpenTerminal(desk.path, e)}
                  >
                    <Terminal className="w-3 h-3" />
                    Terminal
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-[var(--text-secondary)] gap-1"
                    onClick={(e) => handleOpenIDE(desk.path, e)}
                  >
                    <Code2 className="w-3 h-3" />
                    VS Code
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pool Init Dialog */}
      {activeProject && (
        <PoolInitDialog
          open={poolInitOpen}
          onOpenChange={setPoolInitOpen}
          projectId={activeProject.id}
          projectPath={activeProject.worktrees[0]?.path || ""}
        />
      )}

      {/* Acquire Dialog */}
      {acquireTarget && (
        <AcquireDeskDialog
          open={acquireOpen}
          onOpenChange={setAcquireOpen}
          worktreeId={acquireTarget.id}
          deskName={acquireTarget.name}
        />
      )}
    </div>
  );
});

// =============================================================================
// DeskDetailView — Mockup Screen 2
// =============================================================================

interface DeskDetailViewProps {
  deskId: string;
  onBack: () => void;
}

const DeskDetailView = memo(function DeskDetailView({
  deskId,
  onBack,
}: DeskDetailViewProps) {
  const { projects } = useProjectStore();
  const [gitStatus, setGitStatus] = useState<{ branch: string; is_clean: boolean; modified: string[]; staged: string[]; untracked: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [acquireDialogOpen, setAcquireDialogOpen] = useState(false);
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);

  const worktree = useMemo(() => {
    for (const project of projects) {
      const wt = project.worktrees.find((w) => w.id === deskId);
      if (wt) return wt;
    }
    return null;
  }, [projects, deskId]);

  const loadGitStatus = useCallback(async () => {
    if (!worktree?.path) return;
    setLoading(true);
    try {
      const status = await invoke<{ branch: string; is_clean: boolean; modified: string[]; staged: string[]; untracked: string[] }>(
        "get_repo_status",
        { repoPath: worktree.path }
      );
      setGitStatus(status);
    } catch {
      setGitStatus(null);
    } finally {
      setLoading(false);
    }
  }, [worktree?.path]);

  useEffect(() => {
    loadGitStatus();
  }, [loadGitStatus]);

  const handleOpenTerminal = useCallback(async () => {
    if (!worktree?.path) return;
    try {
      await invoke("run_shell_command", { command: "open", args: ["-a", "Terminal", worktree.path] });
    } catch { /* ignore */ }
  }, [worktree?.path]);

  const handleOpenIDE = useCallback(async () => {
    if (!worktree?.path) return;
    try {
      await invoke("run_shell_command", { command: "code", args: [worktree.path] });
    } catch { /* ignore */ }
  }, [worktree?.path]);

  const handleCopyPath = useCallback(() => {
    if (!worktree?.path) return;
    navigator.clipboard.writeText(worktree.path);
  }, [worktree?.path]);

  if (!worktree) {
    return (
      <EmptyState
        icon={<Bot className="w-full h-full" />}
        title="Agent Desk Not Found"
        description="This agent desk no longer exists or has been removed."
        actions={[{ label: "Back to Overview", onClick: onBack }]}
      />
    );
  }

  const status = worktree.agentStatus || "idle";
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const isDirty = gitStatus ? !gitStatus.is_clean : false;

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-muted)] bg-[var(--surface-1)]">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-[var(--text-secondary)]" onClick={onBack}>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Button>
          <Bot className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          <span className="text-[13px] font-medium text-[var(--text-primary)]">
            {worktree.agentName}
          </span>
          <span className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 rounded",
            worktree.agentRole === "reviewer"
              ? "bg-purple-500/15 text-purple-400"
              : "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
          )}>
            {worktree.agentRole}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 text-[11px] text-[var(--text-secondary)] gap-1.5" onClick={handleOpenTerminal}>
            <Terminal className="w-3 h-3" />
            Terminal
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[11px] text-[var(--text-secondary)] gap-1.5" onClick={handleOpenIDE}>
            <Code2 className="w-3 h-3" />
            VS Code
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[11px] text-[var(--text-secondary)] gap-1.5" onClick={handleCopyPath}>
            <Copy className="w-3 h-3" />
            Copy Path
          </Button>
          <div className="w-px h-4 bg-[var(--border-muted)] mx-1" />
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={loadGitStatus} disabled={loading}>
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-[640px] mx-auto flex flex-col gap-4">
          {/* Status Card */}
          <div className={cn("rounded-md border p-4", config.bgColor, config.borderColor)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("w-2.5 h-2.5 rounded-full", config.dotColor, status === "working" && "animate-pulse")} />
                <div>
                  <div className={cn("text-[13px] font-medium", config.color)}>{config.label}</div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{config.subtext}</div>
                </div>
              </div>
              {status === "idle" && (
                <Button size="sm" className="h-7 text-[12px]" onClick={() => setAcquireDialogOpen(true)}>
                  Acquire Desk
                </Button>
              )}
              {(status === "working" || status === "review") && (
                <Button variant="outline" size="sm" className="h-7 text-[12px] text-red-400 border-red-400 hover:bg-red-400/10" onClick={() => setReleaseDialogOpen(true)}>
                  Release Desk
                </Button>
              )}
            </div>
          </div>

          {/* Task Info */}
          {worktree.currentTaskId && (
            <div className="rounded-md border border-[var(--border-muted)] bg-[var(--surface-1)] p-4">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-primary)] mb-3">
                <ListTodo className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                Current Task
              </div>
              <div className="mb-2.5">
                <div className="text-[13px] font-medium text-[var(--text-primary)]">{worktree.currentTaskTitle || "Untitled Task"}</div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  {worktree.currentTaskId} &middot; <span className="font-mono">{worktree.branch}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1 bg-[var(--surface-2)] rounded-sm overflow-hidden">
                  <div className="h-full bg-[var(--accent-primary)] rounded-sm" style={{ width: "0%" }} />
                </div>
                <span className="font-mono text-[10px] text-[var(--text-muted)]">0%</span>
              </div>
            </div>
          )}

          {/* Lifecycle Tracker */}
          <div className="rounded-md border border-[var(--border-muted)] bg-[var(--surface-1)] p-4">
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-primary)] mb-3">
              <GitBranch className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              Branch Lifecycle
            </div>
            <LifecycleTracker status={status} />
          </div>

          {/* Git Status */}
          <div className="rounded-md border border-[var(--border-muted)] bg-[var(--surface-1)] p-4">
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-primary)] mb-3">
              <GitBranch className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              Git Status
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-[var(--text-muted)] w-[72px] shrink-0">Branch</span>
                <span className="text-[var(--text-primary)] font-mono text-[11px]">{worktree.branch}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-[var(--text-muted)] w-[72px] shrink-0">Path</span>
                <span className="text-[var(--text-primary)] font-mono text-[11px] truncate">{worktree.path}</span>
              </div>
              {gitStatus && (
                <>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-[var(--text-muted)] w-[72px] shrink-0">Status</span>
                    <span className={cn("text-[11px]", gitStatus.is_clean ? "text-green-400" : "text-amber-400")}>
                      {gitStatus.is_clean ? "Clean" : `${gitStatus.modified.length + gitStatus.staged.length + gitStatus.untracked.length} changes`}
                    </span>
                  </div>
                  {!gitStatus.is_clean && (
                    <div className="ml-[80px] mt-1">
                      <div className="text-[10px] text-[var(--text-muted)] border-l border-[var(--border-muted)] pl-2 leading-relaxed">
                        {gitStatus.staged.length > 0 && <div>{gitStatus.staged.length} staged</div>}
                        {gitStatus.modified.length > 0 && <div>{gitStatus.modified.length} modified</div>}
                        {gitStatus.untracked.length > 0 && <div>{gitStatus.untracked.length} untracked</div>}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Ports Info */}
          {worktree.ports.dev > 0 && (
            <div className="rounded-md border border-[var(--border-muted)] bg-[var(--surface-1)] p-4">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-primary)] mb-3">
                <Zap className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                Ports
              </div>
              <div className="flex gap-6 text-[11px]">
                <div>
                  <span className="text-[10px] text-[var(--text-muted)]">Dev</span>
                  <div className="font-mono text-[var(--text-primary)]">:{worktree.ports.dev}</div>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)]">API</span>
                  <div className="font-mono text-[var(--text-primary)]">:{worktree.ports.api}</div>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)]">Preview</span>
                  <div className="font-mono text-[var(--text-primary)]">:{worktree.ports.preview}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-[var(--border-muted)] bg-[var(--surface-0)] text-[10px] text-[var(--text-muted)]">
        <span>{worktree.agentRole} desk &middot; {worktree.id}</span>
        <span>⌘R to refresh</span>
      </div>

      {/* Dialogs */}
      <AcquireDeskDialog
        open={acquireDialogOpen}
        onOpenChange={setAcquireDialogOpen}
        worktreeId={worktree.id}
        deskName={worktree.id}
      />
      <ReleaseDeskDialog
        open={releaseDialogOpen}
        onOpenChange={setReleaseDialogOpen}
        worktreeId={worktree.id}
        agentName={worktree.agentName || worktree.id}
        currentBranch={worktree.branch}
        currentTaskTitle={worktree.currentTaskTitle}
        isDirty={isDirty}
      />
    </div>
  );
});

// =============================================================================
// AgentDeskBlockView — Smooth slide drill-down (overview ↔ detail)
// =============================================================================

export const AgentDeskBlockView = memo(function AgentDeskBlockView({
  onTitleChange,
}: BlockViewProps) {
  const [currentView, setCurrentView] = useState<"overview" | "detail">("overview");
  const [deskId, setDeskId] = useState<string | null>(null);

  // Forward: mount detail off-screen, then slide in on next frame
  const handleDeskClick = useCallback((id: string) => {
    setDeskId(id);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setCurrentView("detail");
      });
    });
  }, []);

  // Backward: slide detail out, overview slides back
  const handleBack = useCallback(() => {
    setCurrentView("overview");
  }, []);

  // Unmount detail after backward transition ends
  const handleDetailTransitionEnd = useCallback(() => {
    if (currentView === "overview") {
      setDeskId(null);
    }
  }, [currentView]);

  useEffect(() => {
    onTitleChange?.(currentView === "detail" ? "Agent Desk" : "Agent Desks");
  }, [currentView, onTitleChange]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Overview — parallax shift left + fade when detail is active */}
      <div
        className={cn(
          "absolute inset-0 transition-all duration-200 ease-out",
          currentView === "detail"
            ? "-translate-x-[30%] opacity-0 pointer-events-none"
            : "translate-x-0 opacity-100",
        )}
      >
        <DeskPoolOverview onDeskClick={handleDeskClick} />
      </div>

      {/* Detail — slides in from right */}
      {deskId && (
        <div
          className={cn(
            "absolute inset-0 transition-all duration-200 ease-out",
            currentView === "detail"
              ? "translate-x-0 opacity-100"
              : "translate-x-full opacity-0 pointer-events-none",
          )}
          onTransitionEnd={handleDetailTransitionEnd}
        >
          <DeskDetailView deskId={deskId} onBack={handleBack} />
        </div>
      )}
    </div>
  );
});

// Register the block view
registerBlockView("agent-desk", AgentDeskBlockView);

export default AgentDeskBlockView;
