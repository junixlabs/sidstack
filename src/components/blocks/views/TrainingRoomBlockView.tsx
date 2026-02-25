/**
 * Training Room Block View
 *
 * Lessons-learned system for training agents.
 * Manages incidents, lessons, skills, rules with dashboard overview.
 *
 * Pipeline: Incidents → Lessons → Skills → Rules
 */

import {
  GraduationCap,
  AlertCircle,
  BookOpen,
  Sparkles,
  Scale,
  Plus,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Eye,
  Trash2,
  ArrowRight,
  Zap,
  Search,
  X,
} from "lucide-react";
import { memo, useEffect, useCallback, useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { cn } from "@/lib/utils";
import {
  useTrainingRoomStore,
  useCurrentSession,
  useFilteredIncidents,
  useFilteredLessons,
  useFilteredSkills,
  useFilteredRules,
  useTrainingStats,
  useSelectedIncident,
  useSelectedLesson,
  useSelectedSkill,
  useSelectedRule,
  type Incident,
  type Lesson,
  type Skill,
  type Rule,
  type IncidentStatus,
  type LessonStatus,
  type SkillStatus,
  type RuleStatus,
} from "@/stores/trainingRoomStore";
import type { BlockViewProps } from "@/types/block";

import { registerBlockView } from "../BlockRegistry";

// Tab type without analytics
type TrainingTab = "incidents" | "lessons" | "skills" | "rules";

// =============================================================================
// Severity / Status color utilities
// =============================================================================

const severityBorderColor: Record<string, string> = {
  critical: "border-l-[var(--color-error)]",
  high: "border-l-[var(--color-error)]/70",
  medium: "border-l-[var(--color-warning)]",
  low: "border-l-[var(--text-muted)]",
};

const severityBadgeStyle: Record<string, string> = {
  critical: "bg-[var(--color-error)]/20 text-[var(--color-error)]",
  high: "bg-[var(--color-error)]/15 text-[var(--color-error)]",
  medium: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
  low: "bg-[var(--surface-2)] text-[var(--text-muted)]",
};

const statusIcon: Record<string, React.ReactNode> = {
  open: <AlertCircle className="w-3.5 h-3.5 text-[var(--color-error)]" />,
  analyzed: <Eye className="w-3.5 h-3.5 text-[var(--color-warning)]" />,
  lesson_created: <BookOpen className="w-3.5 h-3.5 text-[var(--color-success)]" />,
  closed: <CheckCircle className="w-3.5 h-3.5 text-[var(--text-muted)]" />,
};

const lessonStatusStyle: Record<string, string> = {
  draft: "bg-[var(--surface-2)] text-[var(--text-muted)]",
  reviewed: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
  approved: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
  archived: "bg-[var(--text-muted)]/15 text-[var(--text-muted)]",
};

const skillStatusStyle: Record<string, string> = {
  draft: "bg-[var(--surface-2)] text-[var(--text-muted)]",
  active: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
  deprecated: "bg-[var(--text-muted)]/15 text-[var(--text-muted)]",
};

const ruleLevelStyle: Record<string, string> = {
  must: "bg-[var(--color-error)]/15 text-[var(--color-error)]",
  should: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
  may: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
};

// =============================================================================
// Format helpers
// =============================================================================

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// =============================================================================
// Pipeline Overview (replaces Analytics tab)
// =============================================================================

interface PipelineOverviewProps {
  stats: {
    incidents: { total: number; byStatus: Record<string, number>; bySeverity: Record<string, number> };
    lessons: { total: number; byStatus: Record<string, number> };
    skills: { total: number; active: number; totalUsage: number; avgSuccessRate: number };
    rules: { total: number; active: number; totalViolations: number };
    hasSession: boolean;
  } | null;
  activeTab: TrainingTab;
  onTabChange: (tab: TrainingTab) => void;
  onNewIncident: () => void;
}

const PipelineOverview = memo(function PipelineOverview({
  stats,
  activeTab,
  onTabChange,
  onNewIncident,
}: PipelineOverviewProps) {
  if (!stats?.hasSession) return null;

  const stages = [
    {
      key: "incidents" as TrainingTab,
      label: "Incidents",
      count: stats.incidents.total,
      activeCount: stats.incidents.byStatus.open || 0,
      activeLabel: "open",
      icon: <AlertCircle className="w-4 h-4" />,
      color: "var(--color-error)",
    },
    {
      key: "lessons" as TrainingTab,
      label: "Lessons",
      count: stats.lessons.total,
      activeCount: stats.lessons.byStatus.approved || 0,
      activeLabel: "approved",
      icon: <BookOpen className="w-4 h-4" />,
      color: "var(--color-warning)",
    },
    {
      key: "skills" as TrainingTab,
      label: "Skills",
      count: stats.skills.total,
      activeCount: stats.skills.active,
      activeLabel: "active",
      icon: <Sparkles className="w-4 h-4" />,
      color: "var(--color-success)",
    },
    {
      key: "rules" as TrainingTab,
      label: "Rules",
      count: stats.rules.total,
      activeCount: stats.rules.active,
      activeLabel: "active",
      icon: <Scale className="w-4 h-4" />,
      color: "var(--accent-primary)",
    },
  ];

  return (
    <div className="flex-shrink-0 border-b border-border">
      {/* Pipeline flow */}
      <div className="flex items-stretch gap-0">
        {stages.map((stage, index) => (
          <div key={stage.key} className="flex items-stretch flex-1 min-w-0">
            <button
              className={cn(
                "flex-1 flex items-center gap-2 px-3 py-2.5 border-b-2 transition-colors cursor-pointer",
                "hover:bg-[var(--surface-2)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-primary)]",
                activeTab === stage.key
                  ? "border-b-[var(--accent-primary)] bg-[var(--surface-2)]/50"
                  : "border-b-transparent",
              )}
              onClick={() => onTabChange(stage.key)}
            >
              <span style={{ color: stage.color }} className="flex-shrink-0">{stage.icon}</span>
              <div className="flex flex-col items-start min-w-0">
                <span className="text-lg font-semibold leading-tight" style={{ color: stage.color }}>
                  {stage.count}
                </span>
                <span className="text-[11px] text-[var(--text-muted)] leading-tight truncate">
                  {stage.activeCount > 0 && (
                    <span>{stage.activeCount} {stage.activeLabel}</span>
                  )}
                  {stage.activeCount === 0 && stage.label}
                </span>
              </div>
            </button>
            {index < stages.length - 1 && (
              <div className="flex items-center px-1 text-[var(--text-muted)]">
                <ArrowRight className="w-3 h-3 opacity-40" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick actions row */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50">
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-[11px] gap-1"
          onClick={onNewIncident}
        >
          <Plus className="w-3 h-3" />
          Record Incident
        </Button>

        {stats.skills.active > 0 && stats.skills.avgSuccessRate > 0 && (
          <div className="ml-auto flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <Zap className="w-3 h-3 text-[var(--color-success)]" />
            <span>
              {stats.skills.avgSuccessRate}% skill effectiveness
            </span>
            <span className="text-[var(--text-muted)]/50">|</span>
            <span>{stats.skills.totalUsage} uses</span>
          </div>
        )}

        {stats.rules.totalViolations > 0 && (
          <div className="ml-auto flex items-center gap-1.5 text-[11px]">
            <AlertTriangle className="w-3 h-3 text-[var(--color-error)]" />
            <span className="text-[var(--color-error)]">
              {stats.rules.totalViolations} violations
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

// =============================================================================
// Main Block View
// =============================================================================

export const TrainingRoomBlockView = memo(function TrainingRoomBlockView(
  props: BlockViewProps
) {
  const moduleId = props.block?.trainingModuleId || "default";
  const { workspacePath, isActive } = useWorkspaceContext();

  const {
    error,
    activeTab,
    filters,
    getOrCreateSession,
    fetchIncidents,
    fetchLessons,
    fetchSkills,
    fetchRules,
    fetchStats,
    setActiveTab,
    setProjectPath,
    setSearchQuery,
    clearError,
  } = useTrainingRoomStore();

  const currentSession = useCurrentSession();
  const stats = useTrainingStats();

  // Track if we should show the new-incident form in the incidents tab
  const [showNewIncident, setShowNewIncident] = useState(false);

  // Map our TrainingTab to the store's TabType
  const currentTab = activeTab === "analytics" ? "incidents" : activeTab;

  useEffect(() => {
    if (!isActive || !workspacePath) return;
    setProjectPath(workspacePath);
  }, [isActive, workspacePath, setProjectPath]);

  useEffect(() => {
    if (!isActive || !workspacePath) return;
    const init = async () => {
      await getOrCreateSession(moduleId, workspacePath);
    };
    init();
  }, [isActive, moduleId, workspacePath, getOrCreateSession]);

  // Fetch data when session or tab changes
  // For "default" module, fetch all data across sessions (no sessionId filter)
  const sessionIdForFetch = moduleId === "default" ? undefined : currentSession?.id;

  useEffect(() => {
    if (!isActive || !workspacePath) return;
    // For specific modules, wait for session; for "default", fetch all
    if (moduleId !== "default" && !currentSession) return;

    switch (currentTab) {
      case "incidents":
        fetchIncidents(sessionIdForFetch);
        break;
      case "lessons":
        fetchLessons(sessionIdForFetch);
        break;
      case "skills":
        fetchSkills(moduleId, workspacePath);
        break;
      case "rules":
        fetchRules(moduleId, workspacePath);
        break;
    }
  }, [isActive, currentSession, currentTab, moduleId, workspacePath, sessionIdForFetch, fetchIncidents, fetchLessons, fetchSkills, fetchRules]);

  // Always fetch stats for pipeline overview
  useEffect(() => {
    if (!isActive || !workspacePath) return;
    fetchStats(moduleId, workspacePath);
  }, [isActive, moduleId, workspacePath, fetchStats]);

  const handleRefresh = useCallback(() => {
    if (!isActive || !workspacePath) return;
    if (moduleId !== "default" && !currentSession) return;
    fetchStats(moduleId, workspacePath);
    switch (currentTab) {
      case "incidents":
        fetchIncidents(sessionIdForFetch);
        break;
      case "lessons":
        fetchLessons(sessionIdForFetch);
        break;
      case "skills":
        fetchSkills(moduleId, workspacePath);
        break;
      case "rules":
        fetchRules(moduleId, workspacePath);
        break;
    }
  }, [isActive, currentSession, currentTab, moduleId, workspacePath, sessionIdForFetch, fetchIncidents, fetchLessons, fetchSkills, fetchRules, fetchStats]);

  // Auto-refresh based on project settings (pauses when workspace is inactive)
  useAutoRefresh({ onRefresh: handleRefresh, enabled: isActive });

  const handleTabChange = useCallback((tab: TrainingTab) => {
    setActiveTab(tab);
    setShowNewIncident(false);
  }, [setActiveTab]);

  const handleNewIncident = useCallback(() => {
    setActiveTab("incidents");
    setShowNewIncident(true);
  }, [setActiveTab]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-[var(--text-muted)]" />
            <h2 className="text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
              Training Room
            </h2>
            <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
              {moduleId}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                placeholder="Search..."
                value={filters.searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 text-[11px] pl-7 pr-7 w-44"
              />
              {filters.searchQuery && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 bg-[var(--color-error)]/10 border-b border-[var(--color-error)]/20">
          <div className="flex items-center gap-2 text-[var(--text-xs)] text-[var(--color-error)]">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={clearError}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Pipeline overview */}
      <PipelineOverview
        stats={stats}
        activeTab={currentTab}
        onTabChange={handleTabChange}
        onNewIncident={handleNewIncident}
      />

      {/* Tabs */}
      <Tabs
        value={currentTab}
        onValueChange={(v) => handleTabChange(v as TrainingTab)}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsContent value="incidents" className="flex-1 min-h-0 m-0">
          <IncidentsTab moduleId={moduleId} projectPath={workspacePath} sessionId={sessionIdForFetch} showFormInitially={showNewIncident} onFormShown={() => setShowNewIncident(false)} />
        </TabsContent>
        <TabsContent value="lessons" className="flex-1 min-h-0 m-0">
          <LessonsTab moduleId={moduleId} projectPath={workspacePath} sessionId={sessionIdForFetch} />
        </TabsContent>
        <TabsContent value="skills" className="flex-1 min-h-0 m-0">
          <SkillsTab moduleId={moduleId} projectPath={workspacePath} />
        </TabsContent>
        <TabsContent value="rules" className="flex-1 min-h-0 m-0">
          <RulesTab moduleId={moduleId} projectPath={workspacePath} />
        </TabsContent>
      </Tabs>
    </div>
  );
});

// =============================================================================
// Incidents Tab
// =============================================================================

interface TabProps {
  moduleId: string;
  projectPath: string;
  sessionId?: string; // undefined = fetch all sessions (aggregate)
}

interface IncidentsTabProps extends TabProps {
  showFormInitially?: boolean;
  onFormShown?: () => void;
}

const IncidentsTab = memo(function IncidentsTab({ moduleId: _moduleId, projectPath: _projectPath, sessionId: sessionIdProp, showFormInitially, onFormShown }: IncidentsTabProps) {
  const {
    isLoading,
    createIncident,
    updateIncident,
    deleteIncident,
    selectIncident,
    setIncidentStatusFilter,
    fetchIncidents,
    filters,
  } = useTrainingRoomStore();

  const incidents = useFilteredIncidents();
  const selectedIncident = useSelectedIncident();
  const currentSession = useCurrentSession();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "mistake" as const,
    severity: "medium" as const,
  });

  // Handle external trigger to show form
  useEffect(() => {
    if (showFormInitially) {
      setShowForm(true);
      onFormShown?.();
    }
  }, [showFormInitially, onFormShown]);

  const handleCreate = async () => {
    if (!formData.title) return;
    const result = await createIncident(formData);
    if (result) {
      setFormData({ title: "", description: "", type: "mistake", severity: "medium" });
      setShowForm(false);
      fetchIncidents(sessionIdProp);
    }
  };

  const statusFilters: { value: IncidentStatus | undefined; label: string }[] = [
    { value: undefined, label: "All" },
    { value: "open", label: "Open" },
    { value: "analyzed", label: "Analyzed" },
    { value: "lesson_created", label: "Lesson Created" },
    { value: "closed", label: "Closed" },
  ];

  return (
    <div className="flex h-full">
      {/* List */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <Select
            value={filters.incidentStatus || "all"}
            onValueChange={(v) => setIncidentStatusFilter(v === "all" ? undefined : v as IncidentStatus)}
          >
            <SelectTrigger className="h-7 w-32 text-[11px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statusFilters.map((f) => (
                <SelectItem key={f.value || "all"} value={f.value || "all"}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button
            size="sm"
            className="h-7 text-[11px] gap-1"
            onClick={() => setShowForm(true)}
            disabled={!currentSession}
          >
            <Plus className="w-3.5 h-3.5" />
            New Incident
          </Button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="p-3 border-b border-border bg-[var(--surface-1)] space-y-2">
            <label htmlFor="incident-title" className="sr-only">Incident title</label>
            <Input
              id="incident-title"
              placeholder="What happened?"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="h-8 text-[var(--text-xs)]"
              autoFocus
            />
            <label htmlFor="incident-description" className="sr-only">Incident description</label>
            <textarea
              id="incident-description"
              placeholder="Describe the incident, what went wrong, and the impact..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full h-20 px-3 py-2 text-[var(--text-xs)] rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
            />
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Type</label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v as typeof formData.type })}
                >
                  <SelectTrigger className="h-7 w-28 text-[11px]" aria-label="Incident type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mistake">Mistake</SelectItem>
                    <SelectItem value="failure">Failure</SelectItem>
                    <SelectItem value="confusion">Confusion</SelectItem>
                    <SelectItem value="slow">Slow</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Severity</label>
                <Select
                  value={formData.severity}
                  onValueChange={(v) => setFormData({ ...formData, severity: v as typeof formData.severity })}
                >
                  <SelectTrigger className="h-7 w-24 text-[11px]" aria-label="Incident severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button size="sm" className="h-7 text-[11px]" onClick={handleCreate} disabled={!formData.title}>
                Create
              </Button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && incidents.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-[var(--text-xs)]">
              Loading...
            </div>
          ) : incidents.length === 0 ? (
            <EmptyState
              icon={<AlertCircle className="w-full h-full" />}
              title="No incidents yet"
              description="Record mistakes, failures, and confusion to start learning. Incidents become lessons, which become skills and rules."
              actions={currentSession ? [{
                label: "Record First Incident",
                onClick: () => setShowForm(true),
                icon: <Plus className="w-4 h-4" />,
              }] : []}
              tips={[
                "Pipeline: Incidents → Lessons → Skills → Rules",
                "Each incident can be analyzed to extract a lesson",
              ]}
              compact
            />
          ) : (
            <div>
              {incidents.map((incident) => (
                <div
                  key={incident.id}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "px-3 py-2.5 cursor-pointer transition-colors border-l-2 border-b border-b-border/50",
                    "hover:bg-[var(--surface-2)]/50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-primary)]",
                    selectedIncident?.id === incident.id
                      ? "bg-[var(--surface-2)] border-l-[var(--accent-primary)]"
                      : severityBorderColor[incident.severity] || "border-l-transparent"
                  )}
                  onClick={() => selectIncident(incident.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectIncident(incident.id); } }}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      {statusIcon[incident.status]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[var(--text-sm)] font-medium text-[var(--text-primary)] line-clamp-1">
                        {incident.title}
                      </h4>
                      {incident.description && (
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-1">
                          {incident.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={cn("text-[10px] px-1 py-0 border-0", severityBadgeStyle[incident.severity])}>
                          {incident.severity}
                        </Badge>
                        <span className="text-[10px] text-[var(--text-muted)]">{incident.type}</span>
                        <span className="text-[10px] text-[var(--text-muted)] ml-auto">
                          {formatTimeAgo(incident.createdAt)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0 mt-1 opacity-40" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedIncident && (
        <div className="w-80 flex-shrink-0 overflow-y-auto bg-[var(--surface-1)]">
          <IncidentDetailPanel
            incident={selectedIncident}
            onUpdate={(data) => updateIncident(selectedIncident.id, data)}
            onDelete={() => deleteIncident(selectedIncident.id)}
          />
        </div>
      )}
    </div>
  );
});

// =============================================================================
// Incident Detail Panel
// =============================================================================

interface IncidentDetailPanelProps {
  incident: Incident;
  onUpdate: (data: Partial<Incident>) => void;
  onDelete: () => void;
}

const IncidentDetailPanel = memo(function IncidentDetailPanel({
  incident,
  onUpdate,
  onDelete,
}: IncidentDetailPanelProps) {
  const { createLesson } = useTrainingRoomStore();
  const currentSession = useCurrentSession();

  const handleCreateLesson = async () => {
    if (!currentSession) return;
    const context = incident.context;
    const rootCause = context?.errorMessage || '';
    await createLesson({
      title: `Lesson from: ${incident.title}`,
      problem: incident.description || incident.title,
      rootCause,
      solution: incident.resolution || "",
      incidentIds: [incident.id],
    });
    onUpdate({ status: "lesson_created" });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">
            {incident.title}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={cn("text-[10px] px-1 py-0 border-0", severityBadgeStyle[incident.severity])}>
              {incident.severity}
            </Badge>
            <span className="text-[10px] text-[var(--text-muted)]">{incident.type}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive flex-shrink-0" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Status */}
      <div className="space-y-1">
        <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Status</label>
        <Select
          value={incident.status}
          onValueChange={(v) => onUpdate({ status: v as IncidentStatus })}
        >
          <SelectTrigger className="h-8 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="analyzed">Analyzed</SelectItem>
            <SelectItem value="lesson_created">Lesson Created</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Description</label>
        <p className="text-[var(--text-xs)] text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
          {incident.description || "No description provided"}
        </p>
      </div>

      {/* Resolution */}
      {incident.resolution && (
        <div className="space-y-1">
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Resolution</label>
          <p className="text-[var(--text-xs)] text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
            {incident.resolution}
          </p>
        </div>
      )}

      {/* Context */}
      {incident.context && (
        <div className="space-y-1">
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Context</label>
          <div className="text-[11px] p-2 bg-[var(--surface-2)] rounded-md space-y-1">
            {Object.entries(
              typeof incident.context === 'string'
                ? JSON.parse(incident.context)
                : incident.context
            ).map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <span className="text-[var(--text-muted)] font-mono flex-shrink-0">{key}:</span>
                <span className="text-[var(--text-secondary)] break-all">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {incident.status !== "lesson_created" && incident.status !== "closed" && (
        <div className="pt-3 border-t border-border">
          <Button className="w-full gap-2" size="sm" onClick={handleCreateLesson}>
            <BookOpen className="w-3.5 h-3.5" />
            Extract Lesson
          </Button>
        </div>
      )}

      {/* Metadata */}
      <div className="pt-3 border-t border-border text-[10px] text-[var(--text-muted)]">
        Created {formatTimeAgo(incident.createdAt)}
      </div>
    </div>
  );
});

// =============================================================================
// Lessons Tab
// =============================================================================

const LessonsTab = memo(function LessonsTab({ moduleId: _moduleId, projectPath: _projectPath, sessionId: sessionIdProp }: TabProps) {
  const {
    isLoading,
    createLesson,
    updateLesson,
    approveLesson,
    selectLesson,
    setLessonStatusFilter,
    fetchLessons,
    filters,
  } = useTrainingRoomStore();

  const lessons = useFilteredLessons();
  const selectedLesson = useSelectedLesson();
  const currentSession = useCurrentSession();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    problem: "",
    rootCause: "",
    solution: "",
  });

  const handleCreate = async () => {
    if (!formData.title || !formData.problem || !formData.solution) return;
    const result = await createLesson(formData);
    if (result) {
      setFormData({ title: "", problem: "", rootCause: "", solution: "" });
      setShowForm(false);
      fetchLessons(sessionIdProp);
    }
  };

  const statusFilters: { value: LessonStatus | undefined; label: string }[] = [
    { value: undefined, label: "All" },
    { value: "draft", label: "Draft" },
    { value: "reviewed", label: "Reviewed" },
    { value: "approved", label: "Approved" },
    { value: "archived", label: "Archived" },
  ];

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <Select
            value={filters.lessonStatus || "all"}
            onValueChange={(v) => setLessonStatusFilter(v === "all" ? undefined : v as LessonStatus)}
          >
            <SelectTrigger className="h-7 w-28 text-[11px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statusFilters.map((f) => (
                <SelectItem key={f.value || "all"} value={f.value || "all"}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button
            size="sm"
            className="h-7 text-[11px] gap-1"
            onClick={() => setShowForm(true)}
            disabled={!currentSession}
          >
            <Plus className="w-3.5 h-3.5" />
            New Lesson
          </Button>
        </div>

        {showForm && (
          <div className="p-3 border-b border-border bg-[var(--surface-1)] space-y-2">
            <div className="space-y-0.5">
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Title</label>
              <Input
                placeholder="What did you learn?"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="h-8 text-[var(--text-xs)]"
                autoFocus
              />
            </div>
            <div className="space-y-0.5">
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Problem</label>
              <textarea
                placeholder="What was the problem?"
                value={formData.problem}
                onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
                className="w-full h-16 px-3 py-2 text-[var(--text-xs)] rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              />
            </div>
            <div className="space-y-0.5">
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Root Cause</label>
              <textarea
                placeholder="Why did it happen?"
                value={formData.rootCause}
                onChange={(e) => setFormData({ ...formData, rootCause: e.target.value })}
                className="w-full h-12 px-3 py-2 text-[var(--text-xs)] rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              />
            </div>
            <div className="space-y-0.5">
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Solution</label>
              <textarea
                placeholder="How to prevent it next time?"
                value={formData.solution}
                onChange={(e) => setFormData({ ...formData, solution: e.target.value })}
                className="w-full h-16 px-3 py-2 text-[var(--text-xs)] rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 text-[11px]"
                onClick={handleCreate}
                disabled={!formData.title || !formData.problem || !formData.solution}
              >
                Create
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {isLoading && lessons.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-[var(--text-xs)]">
              Loading...
            </div>
          ) : lessons.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="w-full h-full" />}
              title="No lessons yet"
              description="Lessons capture what you learned from incidents. Analyze incidents to extract reusable knowledge."
              actions={currentSession ? [{
                label: "Create Lesson",
                onClick: () => setShowForm(true),
                icon: <Plus className="w-4 h-4" />,
              }] : []}
              tips={[
                "Lessons can be extracted from incidents automatically",
                "Approved lessons can become skills",
              ]}
              compact
            />
          ) : (
            <div>
              {lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "px-3 py-2.5 cursor-pointer transition-colors border-l-2 border-b border-b-border/50",
                    "hover:bg-[var(--surface-2)]/50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-primary)]",
                    selectedLesson?.id === lesson.id
                      ? "bg-[var(--surface-2)] border-l-[var(--accent-primary)]"
                      : lesson.status === "approved"
                        ? "border-l-[var(--color-success)]"
                        : lesson.status === "reviewed"
                          ? "border-l-[var(--color-warning)]"
                          : "border-l-transparent"
                  )}
                  onClick={() => selectLesson(lesson.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectLesson(lesson.id); } }}
                >
                  <div className="flex items-start gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[var(--text-sm)] font-medium text-[var(--text-primary)] line-clamp-1">
                        {lesson.title}
                      </h4>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-1">
                        {lesson.problem}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={cn("text-[10px] px-1 py-0 border-0", lessonStatusStyle[lesson.status])}>
                          {lesson.status}
                        </Badge>
                        {lesson.incidentIds.length > 0 && (
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {lesson.incidentIds.length} incident{lesson.incidentIds.length > 1 ? 's' : ''}
                          </span>
                        )}
                        <span className="text-[10px] text-[var(--text-muted)] ml-auto">
                          {formatTimeAgo(lesson.createdAt)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0 mt-1 opacity-40" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedLesson && (
        <div className="w-80 flex-shrink-0 overflow-y-auto bg-[var(--surface-1)]">
          <LessonDetailPanel
            lesson={selectedLesson}
            onUpdate={(data) => updateLesson(selectedLesson.id, data)}
            onApprove={() => approveLesson(selectedLesson.id)}
          />
        </div>
      )}
    </div>
  );
});

// =============================================================================
// Lesson Detail Panel
// =============================================================================

interface LessonDetailPanelProps {
  lesson: Lesson;
  onUpdate: (data: Partial<Lesson>) => void;
  onApprove: () => void;
}

const LessonDetailPanel = memo(function LessonDetailPanel({
  lesson,
  onUpdate,
  onApprove,
}: LessonDetailPanelProps) {
  const { createSkill } = useTrainingRoomStore();

  const handleCreateSkill = async () => {
    await createSkill({
      name: lesson.title,
      description: lesson.problem,
      content: lesson.solution,
      type: "procedure",
      lessonIds: [lesson.id],
    });
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">
        {lesson.title}
      </h3>

      {/* Status */}
      <div className="space-y-1">
        <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Status</label>
        <Select
          value={lesson.status}
          onValueChange={(v) => onUpdate({ status: v as LessonStatus })}
        >
          <SelectTrigger className="h-8 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Problem */}
      <div className="space-y-1">
        <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Problem</label>
        <p className="text-[var(--text-xs)] text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
          {lesson.problem}
        </p>
      </div>

      {/* Root Cause */}
      {lesson.rootCause && (
        <div className="space-y-1">
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Root Cause</label>
          <p className="text-[var(--text-xs)] text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
            {lesson.rootCause}
          </p>
        </div>
      )}

      {/* Solution */}
      <div className="space-y-1">
        <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Solution</label>
        <p className="text-[var(--text-xs)] text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
          {lesson.solution}
        </p>
      </div>

      {/* Actions */}
      <div className="pt-3 border-t border-border space-y-2">
        {lesson.status === "reviewed" && (
          <Button className="w-full gap-2" size="sm" onClick={onApprove}>
            <CheckCircle className="w-3.5 h-3.5" />
            Approve Lesson
          </Button>
        )}
        {lesson.status === "approved" && (
          <Button className="w-full gap-2" variant="secondary" size="sm" onClick={handleCreateSkill}>
            <Sparkles className="w-3.5 h-3.5" />
            Create Skill
          </Button>
        )}
      </div>

      {/* Metadata */}
      <div className="pt-3 border-t border-border text-[10px] text-[var(--text-muted)] space-y-0.5">
        <div>Created {formatTimeAgo(lesson.createdAt)}</div>
        {lesson.approvedBy && <div>Approved by {lesson.approvedBy}</div>}
        {lesson.incidentIds.length > 0 && (
          <div>{lesson.incidentIds.length} linked incident{lesson.incidentIds.length > 1 ? 's' : ''}</div>
        )}
      </div>
    </div>
  );
});

// =============================================================================
// Skills Tab
// =============================================================================

const SkillsTab = memo(function SkillsTab({ moduleId, projectPath }: TabProps) {
  const {
    isLoading,
    createSkill,
    updateSkill,
    activateSkill,
    deprecateSkill,
    selectSkill,
    setSkillStatusFilter,
    fetchSkills,
    filters,
  } = useTrainingRoomStore();

  const skills = useFilteredSkills();
  const selectedSkill = useSelectedSkill();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    content: "",
    type: "procedure" as const,
  });

  const handleCreate = async () => {
    if (!formData.name || !formData.content) return;
    const result = await createSkill(formData);
    if (result) {
      setFormData({ name: "", description: "", content: "", type: "procedure" });
      setShowForm(false);
      fetchSkills(moduleId, projectPath);
    }
  };

  const statusFilters: { value: SkillStatus | undefined; label: string }[] = [
    { value: undefined, label: "All" },
    { value: "draft", label: "Draft" },
    { value: "active", label: "Active" },
    { value: "deprecated", label: "Deprecated" },
  ];

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <Select
            value={filters.skillStatus || "all"}
            onValueChange={(v) => setSkillStatusFilter(v === "all" ? undefined : v as SkillStatus)}
          >
            <SelectTrigger className="h-7 w-28 text-[11px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statusFilters.map((f) => (
                <SelectItem key={f.value || "all"} value={f.value || "all"}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button size="sm" className="h-7 text-[11px] gap-1" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5" />
            New Skill
          </Button>
        </div>

        {showForm && (
          <div className="p-3 border-b border-border bg-[var(--surface-1)] space-y-2">
            <div className="space-y-0.5">
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Name</label>
              <Input
                placeholder="Skill name..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-8 text-[var(--text-xs)]"
                autoFocus
              />
            </div>
            <div className="space-y-0.5">
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Description</label>
              <Input
                placeholder="What does this skill do?"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="h-8 text-[var(--text-xs)]"
              />
            </div>
            <div className="space-y-0.5">
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Content</label>
              <textarea
                placeholder="Skill content (markdown)..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full h-24 px-3 py-2 text-[var(--text-xs)] rounded-md border border-input bg-background resize-none font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Type</label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v as typeof formData.type })}
                >
                  <SelectTrigger className="h-7 w-28 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="procedure">Procedure</SelectItem>
                    <SelectItem value="checklist">Checklist</SelectItem>
                    <SelectItem value="template">Template</SelectItem>
                    <SelectItem value="rule">Rule</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button size="sm" className="h-7 text-[11px]" onClick={handleCreate} disabled={!formData.name || !formData.content}>
                Create
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {isLoading && skills.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-[var(--text-xs)]">
              Loading...
            </div>
          ) : skills.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="w-full h-full" />}
              title="No skills yet"
              description="Skills are reusable procedures extracted from lessons. Approve lessons to generate skills."
              actions={[{
                label: "Create Skill",
                onClick: () => setShowForm(true),
                icon: <Plus className="w-4 h-4" />,
              }]}
              tips={[
                "Skills track usage count and success rate",
                "Active skills can be converted to rules",
              ]}
              compact
            />
          ) : (
            <div>
              {skills.map((skill) => (
                <div
                  key={skill.id}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "px-3 py-2.5 cursor-pointer transition-colors border-l-2 border-b border-b-border/50",
                    "hover:bg-[var(--surface-2)]/50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-primary)]",
                    selectedSkill?.id === skill.id
                      ? "bg-[var(--surface-2)] border-l-[var(--accent-primary)]"
                      : skill.status === "active"
                        ? "border-l-[var(--color-success)]"
                        : "border-l-transparent"
                  )}
                  onClick={() => selectSkill(skill.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectSkill(skill.id); } }}
                >
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[var(--text-sm)] font-medium text-[var(--text-primary)] line-clamp-1">
                        {skill.name}
                      </h4>
                      {skill.description && (
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-1">
                          {skill.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={cn("text-[10px] px-1 py-0 border-0", skillStatusStyle[skill.status])}>
                          {skill.status}
                        </Badge>
                        <span className="text-[10px] text-[var(--text-muted)]">{skill.type}</span>
                        {skill.usageCount > 0 && (
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {skill.usageCount} uses
                          </span>
                        )}
                        {skill.successRate > 0 && (
                          <span className="text-[10px] text-[var(--color-success)] ml-auto">
                            {skill.successRate}%
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0 mt-1 opacity-40" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedSkill && (
        <div className="w-80 flex-shrink-0 overflow-y-auto bg-[var(--surface-1)]">
          <SkillDetailPanel
            skill={selectedSkill}
            onUpdate={(data) => updateSkill(selectedSkill.id, data)}
            onActivate={() => activateSkill(selectedSkill.id)}
            onDeprecate={() => deprecateSkill(selectedSkill.id)}
          />
        </div>
      )}
    </div>
  );
});

// =============================================================================
// Skill Detail Panel
// =============================================================================

interface SkillDetailPanelProps {
  skill: Skill;
  onUpdate: (data: Partial<Skill>) => void;
  onActivate: () => void;
  onDeprecate: () => void;
}

const SkillDetailPanel = memo(function SkillDetailPanel({
  skill,
  onUpdate: _onUpdate,
  onActivate,
  onDeprecate,
}: SkillDetailPanelProps) {
  const { createRule } = useTrainingRoomStore();

  const handleCreateRule = async () => {
    await createRule({
      name: `Rule: ${skill.name}`,
      description: skill.description,
      content: skill.content,
      level: "should",
      enforcement: "manual",
      skillIds: [skill.id],
    });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">
          {skill.name}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <Badge className={cn("text-[10px] px-1 py-0 border-0", skillStatusStyle[skill.status])}>
            {skill.status}
          </Badge>
          <span className="text-[10px] text-[var(--text-muted)]">{skill.type}</span>
        </div>
      </div>

      {/* Description */}
      {skill.description && (
        <div className="space-y-1">
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Description</label>
          <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">{skill.description}</p>
        </div>
      )}

      {/* Content */}
      <div className="space-y-1">
        <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Content</label>
        <pre className="text-[11px] p-2.5 bg-[var(--surface-2)] rounded-md overflow-x-auto whitespace-pre-wrap text-[var(--text-secondary)] leading-relaxed">
          {skill.content}
        </pre>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-2.5 bg-[var(--surface-2)] rounded-md">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Usage</div>
          <div className="text-base font-semibold text-[var(--text-primary)] mt-0.5">{skill.usageCount}</div>
        </div>
        <div className="p-2.5 bg-[var(--surface-2)] rounded-md">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Success</div>
          <div className="text-base font-semibold text-[var(--color-success)] mt-0.5">{skill.successRate}%</div>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-3 border-t border-border space-y-2">
        {skill.status === "draft" && (
          <Button className="w-full gap-2" size="sm" onClick={onActivate}>
            <CheckCircle className="w-3.5 h-3.5" />
            Activate Skill
          </Button>
        )}
        {skill.status === "active" && (
          <>
            <Button className="w-full gap-2" variant="secondary" size="sm" onClick={handleCreateRule}>
              <Scale className="w-3.5 h-3.5" />
              Create Rule
            </Button>
            <Button className="w-full gap-2" variant="outline" size="sm" onClick={onDeprecate}>
              <XCircle className="w-3.5 h-3.5" />
              Deprecate
            </Button>
          </>
        )}
      </div>

      {/* Metadata */}
      <div className="pt-3 border-t border-border text-[10px] text-[var(--text-muted)] space-y-0.5">
        <div>Created {formatTimeAgo(skill.createdAt)}</div>
        {skill.lastUsed && <div>Last used {formatTimeAgo(skill.lastUsed)}</div>}
        {skill.lessonIds.length > 0 && (
          <div>{skill.lessonIds.length} linked lesson{skill.lessonIds.length > 1 ? 's' : ''}</div>
        )}
      </div>
    </div>
  );
});

// =============================================================================
// Rules Tab
// =============================================================================

const RulesTab = memo(function RulesTab({ moduleId, projectPath }: TabProps) {
  const {
    isLoading,
    createRule,
    updateRule,
    deprecateRule,
    selectRule,
    setRuleStatusFilter,
    fetchRules,
    filters,
  } = useTrainingRoomStore();

  const rules = useFilteredRules();
  const selectedRule = useSelectedRule();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    content: "",
    level: "should" as const,
    enforcement: "manual" as const,
  });

  const handleCreate = async () => {
    if (!formData.name || !formData.content) return;
    const result = await createRule(formData);
    if (result) {
      setFormData({ name: "", description: "", content: "", level: "should", enforcement: "manual" });
      setShowForm(false);
      fetchRules(moduleId, projectPath);
    }
  };

  const statusFilters: { value: RuleStatus | undefined; label: string }[] = [
    { value: undefined, label: "All" },
    { value: "active", label: "Active" },
    { value: "deprecated", label: "Deprecated" },
  ];

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <Select
            value={filters.ruleStatus || "all"}
            onValueChange={(v) => setRuleStatusFilter(v === "all" ? undefined : v as RuleStatus)}
          >
            <SelectTrigger className="h-7 w-28 text-[11px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statusFilters.map((f) => (
                <SelectItem key={f.value || "all"} value={f.value || "all"}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button size="sm" className="h-7 text-[11px] gap-1" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5" />
            New Rule
          </Button>
        </div>

        {showForm && (
          <div className="p-3 border-b border-border bg-[var(--surface-1)] space-y-2">
            <div className="space-y-0.5">
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Name</label>
              <Input
                placeholder="Rule name..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-8 text-[var(--text-xs)]"
                autoFocus
              />
            </div>
            <div className="space-y-0.5">
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Description</label>
              <Input
                placeholder="What does this rule enforce?"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="h-8 text-[var(--text-xs)]"
              />
            </div>
            <div className="space-y-0.5">
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Content</label>
              <textarea
                placeholder="Rule content..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full h-20 px-3 py-2 text-[var(--text-xs)] rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Level</label>
                <Select
                  value={formData.level}
                  onValueChange={(v) => setFormData({ ...formData, level: v as typeof formData.level })}
                >
                  <SelectTrigger className="h-7 w-24 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="must">MUST</SelectItem>
                    <SelectItem value="should">SHOULD</SelectItem>
                    <SelectItem value="may">MAY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Enforcement</label>
                <Select
                  value={formData.enforcement}
                  onValueChange={(v) => setFormData({ ...formData, enforcement: v as typeof formData.enforcement })}
                >
                  <SelectTrigger className="h-7 w-24 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="hook">Hook</SelectItem>
                    <SelectItem value="gate">Gate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button size="sm" className="h-7 text-[11px]" onClick={handleCreate} disabled={!formData.name || !formData.content}>
                Create
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {isLoading && rules.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-[var(--text-xs)]">
              Loading...
            </div>
          ) : rules.length === 0 ? (
            <EmptyState
              icon={<Scale className="w-full h-full" />}
              title="No rules yet"
              description="Rules enforce standards learned from experience. Create rules from active skills to codify best practices."
              actions={[{
                label: "Create Rule",
                onClick: () => setShowForm(true),
                icon: <Plus className="w-4 h-4" />,
              }]}
              tips={[
                "Rules support MUST, SHOULD, and MAY levels",
                "Enforcement modes: manual, hook, or gate",
              ]}
              compact
            />
          ) : (
            <div>
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "px-3 py-2.5 cursor-pointer transition-colors border-l-2 border-b border-b-border/50",
                    "hover:bg-[var(--surface-2)]/50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-primary)]",
                    selectedRule?.id === rule.id
                      ? "bg-[var(--surface-2)] border-l-[var(--accent-primary)]"
                      : rule.level === "must"
                        ? "border-l-[var(--color-error)]"
                        : rule.level === "should"
                          ? "border-l-[var(--color-warning)]"
                          : "border-l-transparent"
                  )}
                  onClick={() => selectRule(rule.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectRule(rule.id); } }}
                >
                  <div className="flex items-start gap-2">
                    <Scale className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[var(--text-sm)] font-medium text-[var(--text-primary)] line-clamp-1">
                        {rule.name}
                      </h4>
                      {rule.description && (
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-1">
                          {rule.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={cn("text-[10px] px-1 py-0 border-0", ruleLevelStyle[rule.level])}>
                          {rule.level.toUpperCase()}
                        </Badge>
                        <span className="text-[10px] text-[var(--text-muted)]">{rule.enforcement}</span>
                        {rule.violationCount > 0 && (
                          <span className="text-[10px] text-[var(--color-error)] ml-auto">
                            {rule.violationCount} violation{rule.violationCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0 mt-1 opacity-40" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedRule && (
        <div className="w-80 flex-shrink-0 overflow-y-auto bg-[var(--surface-1)]">
          <RuleDetailPanel
            rule={selectedRule}
            onUpdate={(data) => updateRule(selectedRule.id, data)}
            onDeprecate={() => deprecateRule(selectedRule.id)}
          />
        </div>
      )}
    </div>
  );
});

// =============================================================================
// Rule Detail Panel
// =============================================================================

interface RuleDetailPanelProps {
  rule: Rule;
  onUpdate: (data: Partial<Rule>) => void;
  onDeprecate: () => void;
}

const RuleDetailPanel = memo(function RuleDetailPanel({
  rule,
  onUpdate: _onUpdate,
  onDeprecate,
}: RuleDetailPanelProps) {
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">
          {rule.name}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <Badge className={cn("text-[10px] px-1 py-0 border-0", ruleLevelStyle[rule.level])}>
            {rule.level.toUpperCase()}
          </Badge>
          <span className="text-[10px] text-[var(--text-muted)]">{rule.enforcement}</span>
          <Badge
            className={cn(
              "text-[10px] px-1 py-0 border-0",
              rule.status === "active"
                ? "bg-[var(--color-success)]/15 text-[var(--color-success)]"
                : "bg-[var(--text-muted)]/15 text-[var(--text-muted)]"
            )}
          >
            {rule.status}
          </Badge>
        </div>
      </div>

      {/* Description */}
      {rule.description && (
        <div className="space-y-1">
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Description</label>
          <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">{rule.description}</p>
        </div>
      )}

      {/* Content */}
      <div className="space-y-1">
        <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Content</label>
        <pre className="text-[11px] p-2.5 bg-[var(--surface-2)] rounded-md overflow-x-auto whitespace-pre-wrap text-[var(--text-secondary)] leading-relaxed">
          {rule.content}
        </pre>
      </div>

      {/* Violations */}
      <div className="p-2.5 bg-[var(--surface-2)] rounded-md">
        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Violations</div>
        <div className={cn(
          "text-base font-semibold mt-0.5",
          rule.violationCount > 0 ? "text-[var(--color-error)]" : "text-[var(--text-primary)]"
        )}>
          {rule.violationCount}
        </div>
        {rule.lastViolation && (
          <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
            Last: {formatTimeAgo(rule.lastViolation)}
          </div>
        )}
      </div>

      {/* Actions */}
      {rule.status === "active" && (
        <div className="pt-3 border-t border-border">
          <Button className="w-full gap-2" variant="outline" size="sm" onClick={onDeprecate}>
            <XCircle className="w-3.5 h-3.5" />
            Deprecate
          </Button>
        </div>
      )}

      {/* Metadata */}
      <div className="pt-3 border-t border-border text-[10px] text-[var(--text-muted)] space-y-0.5">
        <div>Created {formatTimeAgo(rule.createdAt)}</div>
        {rule.skillIds.length > 0 && (
          <div>{rule.skillIds.length} linked skill{rule.skillIds.length > 1 ? 's' : ''}</div>
        )}
      </div>
    </div>
  );
});

// Register the block view
registerBlockView("training-room", TrainingRoomBlockView);
