import { invoke } from "@tauri-apps/api/core";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  GitBranch,
  Loader2,
  RefreshCw,
  Shield,
  Tag,
  Zap,
  Terminal,
  Code2,
  Copy,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { memo, useEffect, useState, useCallback, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { CreateDeskDialog } from "@/components/sidebar/CreateDeskDialog";
import { CheckoutDialog } from "@/components/sidebar/CheckoutDialog";
import { RemoveDeskDialog } from "@/components/sidebar/RemoveDeskDialog";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import { useProjectStore } from "@/stores/projectStore";
import type { BlockViewProps } from "@/types/block";

import { registerBlockView } from "../BlockRegistry";

// =============================================================================
// Status Configuration (Desk v2: idle | working only)
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
    subtext: "On main branch, ready for work",
    badgeBg: "bg-[var(--surface-2)]",
    badgeText: "text-[var(--text-muted)]",
  },
  working: {
    label: "Working",
    color: "text-green-400",
    bgColor: "bg-green-400/10",
    dotColor: "bg-green-400",
    borderColor: "border-green-400/20",
    subtext: "On feature branch",
    badgeBg: "bg-green-400/10",
    badgeText: "text-green-400",
  },
};

// =============================================================================
// Health Remediation Hints
// =============================================================================

const REMEDIATION_HINTS: Record<string, string> = {
  corrupted_session: "Delete and re-create session.json",
  dirty_state: "Commit or stash changes",
  stale_lock: "Remove .git/index.lock",
  orphan_worktree: "Run git worktree prune",
  missing_env: "Run desk health to regenerate",
  file_overlap: "Coordinate with other desk or resolve merge",
  port_conflict: "Stop the process using the port",
};

// =============================================================================
// Health Report Type (local UI state)
// =============================================================================

interface HealthIssue {
  desk: string;
  type: string;
  message: string;
}

interface HealthReport {
  healthy: boolean;
  desks: number;
  issues: HealthIssue[];
}

// =============================================================================
// DeskPoolOverview — Grid of all desks
// =============================================================================

interface DeskPoolOverviewProps {
  onDeskClick: (deskId: string) => void;
}

const DeskPoolOverview = memo(function DeskPoolOverview({
  onDeskClick,
}: DeskPoolOverviewProps) {
  const { projects, refreshDesks } = useProjectStore();
  const { projectPath } = useAppStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [healthChecking, setHealthChecking] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const idle = desks.filter((d) => d.agentStatus === "idle").length;
    const working = desks.filter((d) => d.agentStatus === "working").length;
    return { total: desks.length, idle, working };
  }, [desks]);

  // Conflict count from health report
  const conflictCount = useMemo(() => {
    if (!healthReport) return 0;
    return healthReport.issues.filter(i => i.type === "file_overlap").length;
  }, [healthReport]);

  // Health check
  const handleHealthCheck = useCallback(async () => {
    if (!activeProject?.worktrees[0]?.path) return;
    setHealthChecking(true);
    try {
      const result = await invoke<{ healthy: boolean; desks: number; issues: HealthIssue[] }>(
        "run_desk_health",
        { workspacePath: activeProject.worktrees[0].path }
      ).catch(() => null);

      if (result) {
        setHealthReport(result);
      }
    } finally {
      setHealthChecking(false);
    }
  }, [activeProject]);

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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshDesks();
      setLastRefreshed(new Date());
    } finally {
      setRefreshing(false);
    }
  }, [refreshDesks]);

  // Auto-refresh polling (10s)
  useEffect(() => {
    if (desks.length === 0) return;

    intervalRef.current = setInterval(() => {
      refreshDesks().then(() => setLastRefreshed(new Date())).catch(() => {});
    }, 10_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [desks.length, refreshDesks]);

  // Desks with conflict indicators
  const deskConflicts = useMemo(() => {
    if (!healthReport) return new Set<string>();
    const set = new Set<string>();
    for (const issue of healthReport.issues) {
      if (issue.type === "file_overlap") set.add(issue.desk);
    }
    return set;
  }, [healthReport]);

  if (desks.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <EmptyState
          icon={<Bot className="w-full h-full" />}
          title="No Agent Desks"
          description="Create a desk to start parallel development."
          actions={
            activeProject ? [
              { label: "Create Desk", onClick: () => setCreateOpen(true), icon: <Plus className="w-3.5 h-3.5" /> },
            ] : undefined
          }
        />
        <CreateDeskDialog open={createOpen} onOpenChange={setCreateOpen} />
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
        {stats.working > 0 && (
          <>
            <span className="text-[var(--text-placeholder)]">&middot;</span>
            <span className="text-green-400">{stats.working} working</span>
          </>
        )}
        {stats.idle > 0 && (
          <>
            <span className="text-[var(--text-placeholder)]">&middot;</span>
            <span>{stats.idle} idle</span>
          </>
        )}

        {/* Health indicator */}
        {healthReport && (
          <>
            <span className="text-[var(--text-placeholder)]">&middot;</span>
            <button
              onClick={() => setShowIssues(!showIssues)}
              className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              {healthReport.healthy ? (
                <CheckCircle2 className="w-3 h-3 text-green-400" />
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span className="text-amber-400">{healthReport.issues.length} issues</span>
                </>
              )}
            </button>
          </>
        )}

        {/* Conflict badge */}
        {conflictCount > 0 && (
          <>
            <span className="text-[var(--text-placeholder)]">&middot;</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-400/10 text-red-400 text-[10px] font-medium">
              {conflictCount} conflicts
            </span>
          </>
        )}

        <span className="flex-1" />

        {lastRefreshed && (
          <span className="text-[10px] text-[var(--text-placeholder)] mr-2">
            {lastRefreshed.toLocaleTimeString()}
          </span>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={handleHealthCheck}
          disabled={healthChecking}
          title="Run Health Check"
        >
          <Shield className={cn("w-3 h-3", healthChecking && "animate-pulse")} />
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={cn("w-3 h-3", refreshing && "animate-spin")} />
        </Button>
        <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1" onClick={() => setCreateOpen(true)}>
          <Plus className="w-3 h-3" />
          Create Desk
        </Button>
      </div>

      {/* Health Issues Panel */}
      {showIssues && healthReport && !healthReport.healthy && (
        <div className="px-5 py-3 border-b border-[var(--border-muted)] bg-amber-400/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-amber-400">Health Issues</span>
            <button onClick={() => setShowIssues(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <XCircle className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-1.5">
            {healthReport.issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-[10px]">
                <span className="text-[var(--text-muted)] shrink-0 w-16 font-mono">{issue.desk}</span>
                <span className={cn(
                  "shrink-0 px-1 py-0.5 rounded text-[9px] font-medium",
                  issue.type === "file_overlap" || issue.type === "port_conflict"
                    ? "bg-red-400/10 text-red-400"
                    : "bg-amber-400/10 text-amber-400"
                )}>
                  {issue.type}
                </span>
                <span className="text-[var(--text-secondary)] flex-1">{issue.message}</span>
                <span className="text-[var(--text-placeholder)] italic shrink-0">{REMEDIATION_HINTS[issue.type] || ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Desk Grid */}
      <div className="flex-1 overflow-auto p-5">
        <div className="grid grid-cols-3 gap-3">
          {desks.map((desk) => {
            const status = desk.agentStatus || "idle";
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
            const hasConflict = deskConflicts.has(desk.id);

            return (
              <div
                key={desk.id}
                onClick={() => onDeskClick(desk.id)}
                className={cn(
                  "bg-[var(--surface-1)] border rounded-md p-4 cursor-pointer transition-all hover:border-[var(--border-emphasis)] hover:bg-[#1c1c1f]",
                  hasConflict ? "border-red-400/30" : "border-[var(--border-muted)]"
                )}
              >
                {/* Card Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold text-[var(--text-primary)]">{desk.id}</span>
                    {hasConflict && (
                      <span title="File overlap with another desk">
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                      </span>
                    )}
                  </div>
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

                {/* Branch */}
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <GitBranch className="w-3 h-3 text-[var(--text-muted)]" />
                    <span className="font-mono text-[11px] truncate text-[var(--text-secondary)]">
                      {desk.branch}
                    </span>
                  </div>
                </div>

                {/* Tags */}
                {desk.tags && desk.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {desk.tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-400/10 text-blue-400">
                        <Tag className="w-2 h-2" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Bootstrap status */}
                {desk.bootstrapStatus && desk.bootstrapStatus !== "done" && (
                  <div className="flex items-center gap-1 text-[10px] mb-3">
                    {desk.bootstrapStatus === "running" && <Loader2 className="w-2.5 h-2.5 animate-spin text-blue-400" />}
                    {desk.bootstrapStatus === "failed" && <XCircle className="w-2.5 h-2.5 text-red-400" />}
                    {desk.bootstrapStatus === "pending" && <Loader2 className="w-2.5 h-2.5 text-[var(--text-muted)]" />}
                    <span className={cn(
                      desk.bootstrapStatus === "running" && "text-blue-400",
                      desk.bootstrapStatus === "failed" && "text-red-400",
                      desk.bootstrapStatus === "pending" && "text-[var(--text-muted)]",
                    )}>
                      bootstrap {desk.bootstrapStatus}
                    </span>
                  </div>
                )}

                {/* Card Actions */}
                <div className="flex gap-1.5 pt-3 border-t border-[var(--border-muted)]">
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

      {/* Create Desk Dialog */}
      <CreateDeskDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
});

// =============================================================================
// DeskDetailView — Single desk detail
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
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      setLastRefreshed(new Date());
    } catch {
      setGitStatus(null);
    } finally {
      setLoading(false);
    }
  }, [worktree?.path]);

  useEffect(() => {
    loadGitStatus();
  }, [loadGitStatus]);

  // Auto-refresh polling (5s)
  useEffect(() => {
    if (!worktree?.path) return;

    intervalRef.current = setInterval(() => {
      loadGitStatus();
    }, 5_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [worktree?.path, loadGitStatus]);

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
        title="Desk Not Found"
        description="This desk no longer exists or has been removed."
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
            {worktree.id}
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
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-7 text-[12px]" onClick={() => setCheckoutOpen(true)}>
                  <GitBranch className="w-3 h-3 mr-1" />
                  Checkout
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[12px] text-red-400 border-red-400/30 hover:bg-red-400/10"
                  onClick={() => setRemoveOpen(true)}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Remove
                </Button>
              </div>
            </div>
          </div>

          {/* Tags */}
          {worktree.tags && worktree.tags.length > 0 && (
            <div className="rounded-md border border-[var(--border-muted)] bg-[var(--surface-1)] p-4">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-primary)] mb-3">
                <Tag className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                Tags
              </div>
              <div className="flex flex-wrap gap-1.5">
                {worktree.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-400/10 text-blue-400">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Bootstrap Status */}
          {worktree.bootstrapStatus && (
            <div className="rounded-md border border-[var(--border-muted)] bg-[var(--surface-1)] p-4">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-primary)] mb-3">
                {worktree.bootstrapStatus === "done" && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
                {worktree.bootstrapStatus === "running" && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />}
                {worktree.bootstrapStatus === "failed" && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                {worktree.bootstrapStatus === "pending" && <Loader2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                Bootstrap
              </div>
              <div className="flex items-center justify-between">
                <span className={cn("text-[11px]",
                  worktree.bootstrapStatus === "done" && "text-green-400",
                  worktree.bootstrapStatus === "running" && "text-blue-400",
                  worktree.bootstrapStatus === "failed" && "text-red-400",
                  worktree.bootstrapStatus === "pending" && "text-[var(--text-muted)]",
                )}>
                  {worktree.bootstrapStatus}
                </span>
                {worktree.bootstrapStatus === "failed" && (
                  <Button variant="outline" size="sm" className="h-6 text-[11px]">
                    Re-run Bootstrap
                  </Button>
                )}
              </div>
              {worktree.bootstrapError && (
                <div className="mt-2 text-[10px] text-red-400 font-mono bg-red-400/5 rounded p-2 max-h-20 overflow-auto">
                  {worktree.bootstrapError}
                </div>
              )}
            </div>
          )}

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
          <div className="rounded-md border border-[var(--border-muted)] bg-[var(--surface-1)] p-4">
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-primary)] mb-3">
              <Zap className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              Ports
            </div>
            <div className="flex gap-6 text-[11px]">
              <div>
                <span className="text-[10px] text-[var(--text-muted)]">API</span>
                <div className="font-mono text-[var(--text-primary)]">:{worktree.ports.api}</div>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)]">MCP</span>
                <div className="font-mono text-[var(--text-primary)]">:{worktree.ports.mcp}</div>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)]">Web</span>
                <div className="font-mono text-[var(--text-primary)]">:{worktree.ports.web}</div>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)]">Dev</span>
                <div className="font-mono text-[var(--text-primary)]">:{worktree.ports.dev}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-[var(--border-muted)] bg-[var(--surface-0)] text-[10px] text-[var(--text-muted)]">
        <span>{worktree.id}</span>
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span>Refreshed: {lastRefreshed.toLocaleTimeString()}</span>
          )}
          <span>Last active: {new Date(worktree.lastActive).toLocaleString()}</span>
        </div>
      </div>

      {/* Dialogs */}
      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        deskId={worktree.id}
        deskName={worktree.id}
        currentBranch={worktree.branch}
      />
      <RemoveDeskDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        deskId={worktree.id}
        deskName={worktree.id}
        currentBranch={worktree.branch}
        isDirty={isDirty}
      />
    </div>
  );
});

// =============================================================================
// AgentDeskBlockView — Smooth slide drill-down (overview <-> detail)
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
