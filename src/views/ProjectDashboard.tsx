/**
 * ProjectDashboard (⌘1) - Project overview with stats and quick actions
 */

import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Home,
  FolderOpen,
  GitBranch,
  FileText,
  Users,
  LayoutGrid,
  Plus,
  RefreshCw,
  Clock,
  Sparkles,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";

import { RequestInputPanel } from "@/components/RequestInputPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";

interface RepoStatus {
  branch: string;
  is_clean: boolean;
  staged: string[];
  modified: string[];
  untracked: string[];
}

interface ProjectDashboardProps {
  isDark?: boolean;
  className?: string;
}

export function ProjectDashboard({ isDark = true, className }: ProjectDashboardProps) {
  const { projectPath, tabs, setProjectPath, setActiveView, setActiveTab, addTab } = useAppStore();
  const [repoStatus, setRepoStatus] = useState<RepoStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const projectName = projectPath?.split("/").pop() || "No Project";

  const fetchData = useCallback(async () => {
    if (!projectPath) return;

    setLoading(true);
    try {
      // Fetch git status
      const status = await invoke<RepoStatus>("get_repo_status", {
        repoPath: projectPath,
      });
      setRepoStatus(status);
    } catch {
      // Not a git repo or error
      setRepoStatus(null);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenProject = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Directory",
      });
      if (selected) {
        setProjectPath(selected as string);
      }
    } catch (e) {
      console.error("Failed to open project:", e);
    }
  };

  // Get recent files from tabs
  const recentFiles = tabs
    .filter((t) => t.type === "file" && t.data)
    .slice(-5)
    .reverse();

  // Navigate to view - clear active tab first so view renders
  const navigateToView = (view: "specs" | "tasks" | "agents") => {
    setActiveTab(null as unknown as string);
    setActiveView(view);
  };

  // Open recent file
  const openRecentFile = (filePath: string, title: string) => {
    const tabId = `file-${Date.now()}`;
    addTab({
      id: tabId,
      type: "file",
      title,
      data: filePath,
    });
    setActiveTab(tabId);
  };

  // ==========================================================================
  // NO PROJECT STATE
  // ==========================================================================
  if (!projectPath) {
    return (
      <div
        className={cn(
          "flex-1 flex items-center justify-center overflow-auto",
          isDark ? "bg-[var(--surface-0)]" : "bg-gray-50",
          className
        )}
      >
        <div className="text-center max-w-md px-8 py-12">
          <div className="mb-8 flex justify-center">
            <div
              className={cn(
                "relative p-6 rounded-2xl",
                isDark
                  ? "bg-[var(--surface-1)] shadow-xl shadow-black/20"
                  : "bg-white shadow-lg shadow-gray-200/50"
              )}
            >
              <Sparkles
                className={cn("w-16 h-16", isDark ? "text-[var(--text-secondary)]" : "text-blue-600")}
                strokeWidth={1.5}
              />
            </div>
          </div>

          <h1
            className={cn(
              "text-2xl font-semibold tracking-tight mb-2",
              isDark ? "text-[var(--text-primary)]" : "text-gray-900"
            )}
          >
            Welcome to SidStack
          </h1>
          <p
            className={cn(
              "text-[13px] leading-relaxed mb-8",
              isDark ? "text-[var(--text-muted)]" : "text-gray-500"
            )}
          >
            Lightweight prompt manager and O2A workflow tool for AI-assisted development.
          </p>

          <Button onClick={handleOpenProject} size="lg" className="px-6">
            <FolderOpen className="w-4 h-4" />
            <span>Open Project</span>
          </Button>

          <p className={cn("mt-4 text-[12px]", isDark ? "text-[var(--text-muted)]" : "text-gray-500")}>
            or press{" "}
            <kbd
              className={cn(
                "inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium",
                isDark
                  ? "bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border-muted)]"
                  : "bg-gray-100 text-gray-700 border border-gray-200"
              )}
            >
              ⌘O
            </kbd>
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // PROJECT DASHBOARD
  // ==========================================================================
  return (
    <div
      className={cn(
        "flex-1 flex flex-col overflow-auto",
        isDark ? "bg-[var(--surface-0)]" : "bg-gray-50",
        className
      )}
    >
      {/* Header */}
      <header
        className={cn(
          "flex-none flex items-center justify-between px-6 py-4 border-b",
          isDark ? "border-[var(--border-muted)]" : "border-gray-200"
        )}
      >
        <div className="flex items-center gap-3">
          <Home className={cn("w-5 h-5", isDark ? "text-[var(--text-secondary)]" : "text-blue-600")} />
          <div>
            <h1
              className={cn(
                "text-[16px] font-semibold",
                isDark ? "text-[var(--text-primary)]" : "text-gray-900"
              )}
            >
              {projectName}
            </h1>
            <p
              className={cn(
                "text-[11px] font-mono truncate max-w-md",
                isDark ? "text-[var(--text-muted)]" : "text-gray-500"
              )}
            >
              {projectPath}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {repoStatus && (
            <Badge variant="outline" className="text-[11px]">
              <GitBranch className="w-3 h-3 mr-1" />
              {repoStatus.branch}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            isDark={isDark}
            icon={<LayoutGrid className="w-5 h-5 text-[var(--text-secondary)]" />}
            label="Tasks"
            value={"-"}
            onClick={() => navigateToView("tasks")}
          />
          <StatCard
            isDark={isDark}
            icon={<Users className="w-5 h-5 text-[var(--text-secondary)]" />}
            label="Agents"
            value={"-"}
            onClick={() => navigateToView("agents")}
          />
          <StatCard
            isDark={isDark}
            icon={<GitBranch className="w-5 h-5 text-[var(--text-secondary)]" />}
            label="Git Status"
            value={
              repoStatus
                ? repoStatus.is_clean
                  ? "Clean"
                  : `${repoStatus.modified.length + repoStatus.staged.length} changes`
                : "N/A"
            }
          />
        </div>

        {/* Request Input - O2A Workflow */}
        <RequestInputPanel
          projectPath={projectPath}
          isDark={isDark}
          onRequestSubmitted={() => {
            fetchData();
          }}
        />

        {/* Quick Actions */}
        <section>
          <h2
            className={cn(
              "text-[12px] font-semibold uppercase tracking-wider mb-3",
              isDark ? "text-[var(--text-muted)]" : "text-gray-500"
            )}
          >
            Quick Actions
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigateToView("specs")}>
              <Plus className="w-3.5 h-3.5" />
              New Spec
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigateToView("tasks")}>
              <LayoutGrid className="w-3.5 h-3.5" />
              View Tasks
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigateToView("agents")}>
              <Users className="w-3.5 h-3.5" />
              Manage Agents
            </Button>
          </div>
        </section>

        {/* Recent Files */}
        {recentFiles.length > 0 && (
          <section>
            <h2
              className={cn(
                "text-[12px] font-semibold uppercase tracking-wider mb-3",
                isDark ? "text-[var(--text-muted)]" : "text-gray-500"
              )}
            >
              Recent Files
            </h2>
            <div className="space-y-1">
              {recentFiles.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => openRecentFile(tab.data as string, tab.title)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors text-left",
                    isDark
                      ? "hover:bg-[var(--surface-1)]"
                      : "hover:bg-gray-100"
                  )}
                >
                  <FileText
                    className={cn("w-4 h-4 flex-shrink-0", isDark ? "text-[var(--text-muted)]" : "text-gray-500")}
                  />
                  <span
                    className={cn(
                      "text-[13px] flex-1 truncate",
                      isDark ? "text-[var(--text-primary)]" : "text-gray-900"
                    )}
                  >
                    {tab.title}
                  </span>
                  <Clock
                    className={cn("w-3 h-3 flex-shrink-0", isDark ? "text-[var(--text-muted)]" : "text-gray-400")}
                  />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface StatCardProps {
  isDark: boolean;
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subValue?: string;
  onClick?: () => void;
}

function StatCard({ isDark, icon, label, value, subValue, onClick }: StatCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "p-4 transition-colors",
        onClick && "cursor-pointer",
        isDark
          ? "bg-[var(--surface-1)] border-[var(--border-muted)] hover:bg-[var(--surface-2)]"
          : "bg-white border-gray-200 hover:bg-gray-50"
      )}
    >
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span
          className={cn(
            "text-[11px] uppercase tracking-wider font-medium",
            isDark ? "text-[var(--text-muted)]" : "text-gray-500"
          )}
        >
          {label}
        </span>
      </div>
      <div
        className={cn(
          "text-2xl font-bold",
          isDark ? "text-[var(--text-primary)]" : "text-gray-900"
        )}
      >
        {value}
      </div>
      {subValue && (
        <div
          className={cn("text-[11px] mt-1", isDark ? "text-[var(--text-muted)]" : "text-gray-500")}
        >
          {subValue}
        </div>
      )}
    </Card>
  );
}

export default ProjectDashboard;
