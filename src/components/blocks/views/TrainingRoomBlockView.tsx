/**
 * Training Room Block View
 *
 * Lessons-learned system for training agents.
 * Manages incidents, lessons, skills, rules, and analytics.
 */

import {
  RotateCw,
  GraduationCap,
  AlertCircle,
  BookOpen,
  Sparkles,
  Scale,
  BarChart3,
  Plus,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Eye,
  Trash2,
} from "lucide-react";
import { memo, useEffect, useCallback, useState } from "react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
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
  type TabType,
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

// =============================================================================
// Main Block View
// =============================================================================

export const TrainingRoomBlockView = memo(function TrainingRoomBlockView(
  props: BlockViewProps
) {
  const moduleId = props.block?.trainingModuleId || "default";
  const { workspacePath, isActive } = useWorkspaceContext();

  const {
    isLoading,
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

  // Set project path when workspace changes (resets store data if project changed)
  // Only when this workspace is active
  useEffect(() => {
    if (!isActive || !workspacePath) return;
    setProjectPath(workspacePath);
  }, [isActive, workspacePath, setProjectPath]);

  // Initialize session and fetch data - only when active
  useEffect(() => {
    if (!isActive || !workspacePath) return;
    const init = async () => {
      await getOrCreateSession(moduleId, workspacePath);
    };
    init();
  }, [isActive, moduleId, workspacePath, getOrCreateSession]);

  // Fetch data when session or tab changes - only when active
  useEffect(() => {
    if (!isActive || !currentSession || !workspacePath) return;

    switch (activeTab) {
      case "incidents":
        fetchIncidents(currentSession.id);
        break;
      case "lessons":
        fetchLessons(currentSession.id);
        break;
      case "skills":
        fetchSkills(moduleId, workspacePath);
        break;
      case "rules":
        fetchRules(moduleId, workspacePath);
        break;
      case "analytics":
        fetchStats(moduleId, workspacePath);
        break;
    }
  }, [isActive, currentSession, activeTab, moduleId, workspacePath, fetchIncidents, fetchLessons, fetchSkills, fetchRules, fetchStats]);

  const handleRefresh = useCallback(() => {
    if (!isActive || !currentSession || !workspacePath) return;
    switch (activeTab) {
      case "incidents":
        fetchIncidents(currentSession.id);
        break;
      case "lessons":
        fetchLessons(currentSession.id);
        break;
      case "skills":
        fetchSkills(moduleId, workspacePath);
        break;
      case "rules":
        fetchRules(moduleId, workspacePath);
        break;
      case "analytics":
        fetchStats(moduleId, workspacePath);
        break;
    }
  }, [isActive, currentSession, activeTab, moduleId, workspacePath, fetchIncidents, fetchLessons, fetchSkills, fetchRules, fetchStats]);

  const tabItems: { value: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { value: "incidents", label: "Incidents", icon: <AlertCircle className="w-4 h-4" />, count: stats?.incidents.total },
    { value: "lessons", label: "Lessons", icon: <BookOpen className="w-4 h-4" />, count: stats?.lessons.total },
    { value: "skills", label: "Skills", icon: <Sparkles className="w-4 h-4" />, count: stats?.skills.total },
    { value: "rules", label: "Rules", icon: <Scale className="w-4 h-4" />, count: stats?.rules.total },
    { value: "analytics", label: "Analytics", icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-sm font-medium">Training Room</h2>
            <Badge variant="secondary" className="text-xs">
              {moduleId}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RotateCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </Button>
        </div>

        {/* Stats summary */}
        {stats?.hasSession && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="text-[var(--color-error)]">{stats.incidents.total} incidents</span>
            <span className="text-[var(--color-warning)]">{stats.lessons.total} lessons</span>
            <span className="text-[var(--color-success)]">{stats.skills.active} active skills</span>
            <span className="text-[var(--accent-primary)]">{stats.rules.active} active rules</span>
          </div>
        )}

        {/* Search */}
        <Input
          placeholder="Search..."
          value={filters.searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      {/* Error display */}
      {error && (
        <div className="p-3 bg-red-500/10 border-b border-red-500/20">
          <div className="flex items-center gap-2 text-sm text-red-400">
            <AlertTriangle className="w-4 h-4" />
            {error}
            <Button variant="ghost" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabType)}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="flex-shrink-0 w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
          {tabItems.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex items-center gap-1.5 px-4 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--accent-primary)] data-[state=active]:bg-transparent"
            >
              {tab.icon}
              <span className="text-xs">{tab.label}</span>
              {tab.count !== undefined && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                  {tab.count}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="incidents" className="flex-1 min-h-0 m-0">
          <IncidentsTab moduleId={moduleId} projectPath={workspacePath} />
        </TabsContent>

        <TabsContent value="lessons" className="flex-1 min-h-0 m-0">
          <LessonsTab moduleId={moduleId} projectPath={workspacePath} />
        </TabsContent>

        <TabsContent value="skills" className="flex-1 min-h-0 m-0">
          <SkillsTab moduleId={moduleId} projectPath={workspacePath} />
        </TabsContent>

        <TabsContent value="rules" className="flex-1 min-h-0 m-0">
          <RulesTab moduleId={moduleId} projectPath={workspacePath} />
        </TabsContent>

        <TabsContent value="analytics" className="flex-1 min-h-0 m-0">
          <AnalyticsTab moduleId={moduleId} projectPath={workspacePath} />
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
}

const IncidentsTab = memo(function IncidentsTab({ moduleId: _moduleId, projectPath: _projectPath }: TabProps) {
  const {
    isLoading,
    createIncident,
    updateIncident,
    deleteIncident,
    selectIncident,
    setIncidentStatusFilter,
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

  const handleCreate = async () => {
    if (!formData.title) return;
    await createIncident(formData);
    setFormData({ title: "", description: "", type: "mistake", severity: "medium" });
    setShowForm(false);
  };

  const statusFilters: { value: IncidentStatus | undefined; label: string }[] = [
    { value: undefined, label: "All" },
    { value: "open", label: "Open" },
    { value: "analyzed", label: "Analyzed" },
    { value: "lesson_created", label: "Lesson Created" },
    { value: "closed", label: "Closed" },
  ];

  const severityColors: Record<string, string> = {
    low: "bg-[var(--surface-2)] text-[var(--text-muted)]",
    medium: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
    high: "bg-[var(--color-error)]/15 text-[var(--color-error)]",
    critical: "bg-red-500/20 text-red-400",
  };

  const statusIcons: Record<string, React.ReactNode> = {
    open: <AlertCircle className="w-3.5 h-3.5 text-[var(--color-error)]" />,
    analyzed: <Eye className="w-3.5 h-3.5 text-[var(--color-warning)]" />,
    lesson_created: <BookOpen className="w-3.5 h-3.5 text-[var(--color-success)]" />,
    closed: <CheckCircle className="w-3.5 h-3.5 text-[var(--text-muted)]" />,
  };

  return (
    <div className="flex h-full">
      {/* List */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">
        {/* Toolbar */}
        <div className="flex items-center gap-2 p-2 border-b border-border">
          <Select
            value={filters.incidentStatus || "all"}
            onValueChange={(v) => setIncidentStatusFilter(v === "all" ? undefined : v as IncidentStatus)}
          >
            <SelectTrigger className="h-7 w-32 text-xs">
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
            className="h-7 text-xs"
            onClick={() => setShowForm(true)}
            disabled={!currentSession}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            New Incident
          </Button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="p-3 border-b border-border bg-muted/30 space-y-2">
            <label htmlFor="incident-title" className="sr-only">Incident title</label>
            <Input
              id="incident-title"
              placeholder="Incident title..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="h-8 text-xs"
            />
            <label htmlFor="incident-description" className="sr-only">Incident description</label>
            <textarea
              id="incident-description"
              placeholder="Description..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full h-20 px-3 py-2 text-xs rounded-md border border-input bg-background resize-none"
            />
            <div className="flex items-center gap-2">
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v as typeof formData.type })}
              >
                <SelectTrigger className="h-7 w-28 text-xs" aria-label="Incident type">
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
              <Select
                value={formData.severity}
                onValueChange={(v) => setFormData({ ...formData, severity: v as typeof formData.severity })}
              >
                <SelectTrigger className="h-7 w-24 text-xs" aria-label="Incident severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleCreate}>
                Create
              </Button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && incidents.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Loading...
            </div>
          ) : incidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
              <p>No incidents found</p>
              <p className="text-xs mt-1">Record mistakes to create lessons</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {incidents.map((incident) => (
                <div
                  key={incident.id}
                  className={cn(
                    "p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                    selectedIncident?.id === incident.id && "bg-muted/50 border-l-2 border-l-[var(--accent-primary)]"
                  )}
                  onClick={() => selectIncident(incident.id)}
                >
                  <div className="flex items-start gap-2">
                    {statusIcons[incident.status]}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-[10px] px-1.5 py-0", severityColors[incident.severity])}>
                          {incident.severity}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{incident.type}</span>
                      </div>
                      <h4 className="text-sm font-medium mt-1 line-clamp-1">{incident.title}</h4>
                      {incident.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {incident.description}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedIncident && (
        <div className="w-80 flex-shrink-0 overflow-y-auto">
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
    await createLesson({
      title: `Lesson from: ${incident.title}`,
      problem: incident.description || incident.title,
      rootCause: "",
      solution: incident.resolution || "",
      incidentIds: [incident.id],
    });
    onUpdate({ status: "lesson_created" });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium">{incident.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {incident.type} - {incident.severity}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Status</label>
        <Select
          value={incident.status}
          onValueChange={(v) => onUpdate({ status: v as IncidentStatus })}
        >
          <SelectTrigger className="h-8 text-xs mt-1">
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

      <div>
        <label className="text-xs text-muted-foreground">Description</label>
        <p className="text-sm mt-1 whitespace-pre-wrap">
          {incident.description || "No description"}
        </p>
      </div>

      {incident.resolution && (
        <div>
          <label className="text-xs text-muted-foreground">Resolution</label>
          <p className="text-sm mt-1 whitespace-pre-wrap">{incident.resolution}</p>
        </div>
      )}

      {incident.context && (
        <div>
          <label className="text-xs text-muted-foreground">Context</label>
          <div className="text-xs mt-1 p-2 bg-[var(--surface-1)] rounded space-y-1">
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

      <div className="pt-2 border-t border-border">
        {incident.status !== "lesson_created" && incident.status !== "closed" && (
          <Button className="w-full" size="sm" onClick={handleCreateLesson}>
            <BookOpen className="w-4 h-4 mr-2" />
            Create Lesson
          </Button>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        Created: {new Date(incident.createdAt).toLocaleString()}
      </div>
    </div>
  );
});

// =============================================================================
// Lessons Tab
// =============================================================================

const LessonsTab = memo(function LessonsTab({ moduleId: _moduleId, projectPath: _projectPath }: TabProps) {
  const {
    isLoading,
    createLesson,
    updateLesson,
    approveLesson,
    selectLesson,
    setLessonStatusFilter,
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
    await createLesson(formData);
    setFormData({ title: "", problem: "", rootCause: "", solution: "" });
    setShowForm(false);
  };

  const statusFilters: { value: LessonStatus | undefined; label: string }[] = [
    { value: undefined, label: "All" },
    { value: "draft", label: "Draft" },
    { value: "reviewed", label: "Reviewed" },
    { value: "approved", label: "Approved" },
    { value: "archived", label: "Archived" },
  ];

  const statusColors: Record<string, string> = {
    draft: "bg-[var(--surface-2)] text-[var(--text-muted)]",
    reviewed: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
    approved: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
    archived: "bg-[var(--text-muted)]/15 text-[var(--text-muted)]",
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">
        <div className="flex items-center gap-2 p-2 border-b border-border">
          <Select
            value={filters.lessonStatus || "all"}
            onValueChange={(v) => setLessonStatusFilter(v === "all" ? undefined : v as LessonStatus)}
          >
            <SelectTrigger className="h-7 w-28 text-xs">
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
            className="h-7 text-xs"
            onClick={() => setShowForm(true)}
            disabled={!currentSession}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            New Lesson
          </Button>
        </div>

        {showForm && (
          <div className="p-3 border-b border-border bg-muted/30 space-y-2">
            <Input
              placeholder="Lesson title..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="h-8 text-xs"
            />
            <textarea
              placeholder="Problem..."
              value={formData.problem}
              onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
              className="w-full h-16 px-3 py-2 text-xs rounded-md border border-input bg-background resize-none"
            />
            <textarea
              placeholder="Root cause..."
              value={formData.rootCause}
              onChange={(e) => setFormData({ ...formData, rootCause: e.target.value })}
              className="w-full h-12 px-3 py-2 text-xs rounded-md border border-input bg-background resize-none"
            />
            <textarea
              placeholder="Solution..."
              value={formData.solution}
              onChange={(e) => setFormData({ ...formData, solution: e.target.value })}
              className="w-full h-16 px-3 py-2 text-xs rounded-md border border-input bg-background resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleCreate}>
                Create
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {isLoading && lessons.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Loading...
            </div>
          ) : lessons.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <BookOpen className="w-12 h-12 mb-4 opacity-50" />
              <p>No lessons found</p>
              <p className="text-xs mt-1">Create lessons from incidents</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className={cn(
                    "p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                    selectedLesson?.id === lesson.id && "bg-muted/50 border-l-2 border-l-[var(--accent-primary)]"
                  )}
                  onClick={() => selectLesson(lesson.id)}
                >
                  <div className="flex items-start gap-2">
                    <BookOpen className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-[10px] px-1.5 py-0", statusColors[lesson.status])}>
                          {lesson.status}
                        </Badge>
                      </div>
                      <h4 className="text-sm font-medium mt-1 line-clamp-1">{lesson.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {lesson.problem}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedLesson && (
        <div className="w-80 flex-shrink-0 overflow-y-auto">
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
      <h3 className="text-sm font-medium">{lesson.title}</h3>

      <div>
        <label className="text-xs text-muted-foreground">Status</label>
        <Select
          value={lesson.status}
          onValueChange={(v) => onUpdate({ status: v as LessonStatus })}
        >
          <SelectTrigger className="h-8 text-xs mt-1">
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

      <div>
        <label className="text-xs text-muted-foreground">Problem</label>
        <p className="text-sm mt-1 whitespace-pre-wrap">{lesson.problem}</p>
      </div>

      {lesson.rootCause && (
        <div>
          <label className="text-xs text-muted-foreground">Root Cause</label>
          <p className="text-sm mt-1 whitespace-pre-wrap">{lesson.rootCause}</p>
        </div>
      )}

      <div>
        <label className="text-xs text-muted-foreground">Solution</label>
        <p className="text-sm mt-1 whitespace-pre-wrap">{lesson.solution}</p>
      </div>

      <div className="pt-2 border-t border-border space-y-2">
        {lesson.status === "reviewed" && (
          <Button className="w-full" size="sm" onClick={onApprove}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Approve Lesson
          </Button>
        )}
        {lesson.status === "approved" && (
          <Button className="w-full" variant="secondary" size="sm" onClick={handleCreateSkill}>
            <Sparkles className="w-4 h-4 mr-2" />
            Create Skill
          </Button>
        )}
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <div>Created: {new Date(lesson.createdAt).toLocaleString()}</div>
        {lesson.approvedBy && (
          <div>Approved by: {lesson.approvedBy}</div>
        )}
      </div>
    </div>
  );
});

// =============================================================================
// Skills Tab
// =============================================================================

const SkillsTab = memo(function SkillsTab({ moduleId: _moduleId, projectPath: _projectPath }: TabProps) {
  const {
    isLoading,
    createSkill,
    updateSkill,
    activateSkill,
    deprecateSkill,
    selectSkill,
    setSkillStatusFilter,
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
    await createSkill(formData);
    setFormData({ name: "", description: "", content: "", type: "procedure" });
    setShowForm(false);
  };

  const statusFilters: { value: SkillStatus | undefined; label: string }[] = [
    { value: undefined, label: "All" },
    { value: "draft", label: "Draft" },
    { value: "active", label: "Active" },
    { value: "deprecated", label: "Deprecated" },
  ];

  const statusColors: Record<string, string> = {
    draft: "bg-[var(--surface-2)] text-[var(--text-muted)]",
    active: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
    deprecated: "bg-[var(--text-muted)]/15 text-[var(--text-muted)]",
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">
        <div className="flex items-center gap-2 p-2 border-b border-border">
          <Select
            value={filters.skillStatus || "all"}
            onValueChange={(v) => setSkillStatusFilter(v === "all" ? undefined : v as SkillStatus)}
          >
            <SelectTrigger className="h-7 w-28 text-xs">
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
          <Button size="sm" className="h-7 text-xs" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            New Skill
          </Button>
        </div>

        {showForm && (
          <div className="p-3 border-b border-border bg-muted/30 space-y-2">
            <Input
              placeholder="Skill name..."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-8 text-xs"
            />
            <Input
              placeholder="Description..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="h-8 text-xs"
            />
            <textarea
              placeholder="Content (markdown)..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full h-24 px-3 py-2 text-xs rounded-md border border-input bg-background resize-none font-mono"
            />
            <div className="flex items-center gap-2">
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v as typeof formData.type })}
              >
                <SelectTrigger className="h-7 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="procedure">Procedure</SelectItem>
                  <SelectItem value="checklist">Checklist</SelectItem>
                  <SelectItem value="template">Template</SelectItem>
                  <SelectItem value="rule">Rule</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleCreate}>
                Create
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {isLoading && skills.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Loading...
            </div>
          ) : skills.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Sparkles className="w-12 h-12 mb-4 opacity-50" />
              <p>No skills found</p>
              <p className="text-xs mt-1">Create skills from lessons</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {skills.map((skill) => (
                <div
                  key={skill.id}
                  className={cn(
                    "p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                    selectedSkill?.id === skill.id && "bg-muted/50 border-l-2 border-l-[var(--accent-primary)]"
                  )}
                  onClick={() => selectSkill(skill.id)}
                >
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-[10px] px-1.5 py-0", statusColors[skill.status])}>
                          {skill.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{skill.type}</span>
                        {skill.usageCount > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {skill.usageCount} uses
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-medium mt-1 line-clamp-1">{skill.name}</h4>
                      {skill.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {skill.description}
                        </p>
                      )}
                    </div>
                    {skill.successRate > 0 && (
                      <span className="text-xs text-[var(--color-success)]">{skill.successRate}%</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedSkill && (
        <div className="w-80 flex-shrink-0 overflow-y-auto">
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
      enforcement: "warn",
      skillIds: [skill.id],
    });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium">{skill.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{skill.type}</p>
        </div>
      </div>

      {skill.description && (
        <div>
          <label className="text-xs text-muted-foreground">Description</label>
          <p className="text-sm mt-1">{skill.description}</p>
        </div>
      )}

      <div>
        <label className="text-xs text-muted-foreground">Content</label>
        <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-x-auto whitespace-pre-wrap">
          {skill.content}
        </pre>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground">Usage</label>
          <p className="text-lg font-medium">{skill.usageCount}</p>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Success Rate</label>
          <p className="text-lg font-medium text-[var(--color-success)]">{skill.successRate}%</p>
        </div>
      </div>

      <div className="pt-2 border-t border-border space-y-2">
        {skill.status === "draft" && (
          <Button className="w-full" size="sm" onClick={onActivate}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Activate Skill
          </Button>
        )}
        {skill.status === "active" && (
          <>
            <Button className="w-full" variant="secondary" size="sm" onClick={handleCreateRule}>
              <Scale className="w-4 h-4 mr-2" />
              Create Rule
            </Button>
            <Button className="w-full" variant="outline" size="sm" onClick={onDeprecate}>
              <XCircle className="w-4 h-4 mr-2" />
              Deprecate
            </Button>
          </>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        Created: {new Date(skill.createdAt).toLocaleString()}
      </div>
    </div>
  );
});

// =============================================================================
// Rules Tab
// =============================================================================

const RulesTab = memo(function RulesTab({ moduleId: _moduleId, projectPath: _projectPath }: TabProps) {
  const {
    isLoading,
    createRule,
    updateRule,
    deprecateRule,
    selectRule,
    setRuleStatusFilter,
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
    enforcement: "warn" as const,
  });

  const handleCreate = async () => {
    if (!formData.name || !formData.content) return;
    await createRule(formData);
    setFormData({ name: "", description: "", content: "", level: "should", enforcement: "warn" });
    setShowForm(false);
  };

  const statusFilters: { value: RuleStatus | undefined; label: string }[] = [
    { value: undefined, label: "All" },
    { value: "draft", label: "Draft" },
    { value: "active", label: "Active" },
    { value: "deprecated", label: "Deprecated" },
  ];

  const levelColors: Record<string, string> = {
    must: "bg-[var(--color-error)]/15 text-[var(--color-error)]",
    should: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
    may: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">
        <div className="flex items-center gap-2 p-2 border-b border-border">
          <Select
            value={filters.ruleStatus || "all"}
            onValueChange={(v) => setRuleStatusFilter(v === "all" ? undefined : v as RuleStatus)}
          >
            <SelectTrigger className="h-7 w-28 text-xs">
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
          <Button size="sm" className="h-7 text-xs" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            New Rule
          </Button>
        </div>

        {showForm && (
          <div className="p-3 border-b border-border bg-muted/30 space-y-2">
            <Input
              placeholder="Rule name..."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-8 text-xs"
            />
            <Input
              placeholder="Description..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="h-8 text-xs"
            />
            <textarea
              placeholder="Rule content..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full h-20 px-3 py-2 text-xs rounded-md border border-input bg-background resize-none"
            />
            <div className="flex items-center gap-2">
              <Select
                value={formData.level}
                onValueChange={(v) => setFormData({ ...formData, level: v as typeof formData.level })}
              >
                <SelectTrigger className="h-7 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="must">MUST</SelectItem>
                  <SelectItem value="should">SHOULD</SelectItem>
                  <SelectItem value="may">MAY</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={formData.enforcement}
                onValueChange={(v) => setFormData({ ...formData, enforcement: v as typeof formData.enforcement })}
              >
                <SelectTrigger className="h-7 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="block">Block</SelectItem>
                  <SelectItem value="warn">Warn</SelectItem>
                  <SelectItem value="log">Log</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleCreate}>
                Create
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {isLoading && rules.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Loading...
            </div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Scale className="w-12 h-12 mb-4 opacity-50" />
              <p>No rules found</p>
              <p className="text-xs mt-1">Create rules from skills</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={cn(
                    "p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                    selectedRule?.id === rule.id && "bg-muted/50 border-l-2 border-l-[var(--accent-primary)]"
                  )}
                  onClick={() => selectRule(rule.id)}
                >
                  <div className="flex items-start gap-2">
                    <Scale className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-[10px] px-1.5 py-0", levelColors[rule.level])}>
                          {rule.level.toUpperCase()}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{rule.enforcement}</span>
                      </div>
                      <h4 className="text-sm font-medium mt-1 line-clamp-1">{rule.name}</h4>
                      {rule.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {rule.description}
                        </p>
                      )}
                    </div>
                    {rule.violationCount > 0 && (
                      <span className="text-xs text-[var(--color-error)]">{rule.violationCount}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedRule && (
        <div className="w-80 flex-shrink-0 overflow-y-auto">
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
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium">{rule.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {rule.level.toUpperCase()} - {rule.enforcement}
          </p>
        </div>
      </div>

      {rule.description && (
        <div>
          <label className="text-xs text-muted-foreground">Description</label>
          <p className="text-sm mt-1">{rule.description}</p>
        </div>
      )}

      <div>
        <label className="text-xs text-muted-foreground">Content</label>
        <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-x-auto whitespace-pre-wrap">
          {rule.content}
        </pre>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Violations</label>
        <p className="text-lg font-medium text-[var(--color-error)]">{rule.violationCount}</p>
      </div>

      <div className="pt-2 border-t border-border">
        {rule.status === "active" && (
          <Button className="w-full" variant="outline" size="sm" onClick={onDeprecate}>
            <XCircle className="w-4 h-4 mr-2" />
            Deprecate
          </Button>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        Created: {new Date(rule.createdAt).toLocaleString()}
      </div>
    </div>
  );
});

// =============================================================================
// Analytics Tab
// =============================================================================

const AnalyticsTab = memo(function AnalyticsTab({ moduleId, projectPath }: TabProps) {
  const { fetchStats } = useTrainingRoomStore();
  const stats = useTrainingStats();

  useEffect(() => {
    if (projectPath) {
      fetchStats(moduleId, projectPath);
    }
  }, [moduleId, projectPath, fetchStats]);

  if (!stats?.hasSession) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
        <p>No training data yet</p>
        <p className="text-xs mt-1">Start by recording incidents</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 overflow-y-auto">
      <h3 className="text-sm font-medium">Training Analytics</h3>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-muted/50">
          <div className="text-xs text-muted-foreground">Total Incidents</div>
          <div className="text-2xl font-bold mt-1">{stats.incidents.total}</div>
          <div className="text-xs text-muted-foreground mt-2 space-x-2">
            {Object.entries(stats.incidents.byStatus).map(([status, count]) => (
              <span key={status}>{status}: {count}</span>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-muted/50">
          <div className="text-xs text-muted-foreground">Lessons Learned</div>
          <div className="text-2xl font-bold mt-1">{stats.lessons.total}</div>
          <div className="text-xs text-muted-foreground mt-2 space-x-2">
            {Object.entries(stats.lessons.byStatus).map(([status, count]) => (
              <span key={status}>{status}: {count}</span>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-muted/50">
          <div className="text-xs text-muted-foreground">Active Skills</div>
          <div className="text-2xl font-bold mt-1 text-[var(--color-success)]">{stats.skills.active}</div>
          <div className="text-xs text-muted-foreground mt-2">
            <span>Total: {stats.skills.total}</span>
            <span className="ml-2">Usage: {stats.skills.totalUsage}</span>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-muted/50">
          <div className="text-xs text-muted-foreground">Active Rules</div>
          <div className="text-2xl font-bold mt-1 text-[var(--accent-primary)]">{stats.rules.active}</div>
          <div className="text-xs text-muted-foreground mt-2">
            <span>Total: {stats.rules.total}</span>
            <span className="ml-2 text-[var(--color-error)]">Violations: {stats.rules.totalViolations}</span>
          </div>
        </div>
      </div>

      {/* Effectiveness */}
      <div className="p-4 rounded-lg bg-muted/50">
        <div className="text-xs text-muted-foreground">Skill Effectiveness</div>
        <div className="flex items-center gap-4 mt-2">
          <div className="text-3xl font-bold text-[var(--color-success)]">{stats.skills.avgSuccessRate}%</div>
          <div className="text-xs text-muted-foreground">
            Average success rate across {stats.skills.active} active skills
          </div>
        </div>
        <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-success)] transition-all"
            style={{ width: `${stats.skills.avgSuccessRate}%` }}
          />
        </div>
      </div>

      {/* Severity distribution */}
      {stats.incidents.total > 0 && (
        <div className="p-4 rounded-lg bg-muted/50">
          <div className="text-xs text-muted-foreground mb-3">Incidents by Severity</div>
          <div className="space-y-2">
            {(["critical", "high", "medium", "low"] as const).map((severity) => {
              const count = stats.incidents.bySeverity[severity] || 0;
              const percent = stats.incidents.total > 0 ? (count / stats.incidents.total) * 100 : 0;
              const colors: Record<string, string> = {
                critical: "bg-red-500",
                high: "bg-[var(--color-error)]",
                medium: "bg-[var(--color-warning)]",
                low: "bg-[var(--text-muted)]",
              };
              return (
                <div key={severity} className="flex items-center gap-2">
                  <span className="text-xs w-16 capitalize">{severity}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full transition-all", colors[severity])} style={{ width: `${percent}%` }} />
                  </div>
                  <span className="text-xs w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

// Register the block view
registerBlockView("training-room", TrainingRoomBlockView);
