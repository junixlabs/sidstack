/**
 * Training Room Store - Lessons-Learned System
 *
 * Manages training sessions, incidents, lessons, skills, and rules.
 * Fetches data from API server and provides filtering/selection.
 */

import { create } from "zustand";
import type {
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
  LessonStatus,
  SkillType,
  SkillStatus,
  RuleLevel,
  RuleEnforcement,
  RuleStatus,
  FeedbackOutcome,
} from "@/types/trainingRoom";

export type {
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
  LessonStatus,
  SkillType,
  SkillStatus,
  RuleLevel,
  RuleEnforcement,
  RuleStatus,
  FeedbackOutcome,
};

export interface IncidentContext {
  taskId?: string;
  sessionId?: string;
  filePath?: string;
  errorMessage?: string;
  stackTrace?: string;
  [key: string]: unknown;
}

export interface Applicability {
  modules?: string[];
  roles?: string[];
  taskTypes?: string[];
  filePatterns?: string[];
}

export interface TriggerConfig {
  auto?: boolean;
  keywords?: string[];
  filePatterns?: string[];
}

export interface TrainingSession {
  id: string;
  moduleId: string;
  status: "active" | "archived";
  totalIncidents: number;
  totalLessons: number;
  totalSkills: number;
  createdAt: number;
  updatedAt: number;
}

export interface Incident {
  id: string;
  sessionId: string;
  type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description: string;
  context: IncidentContext | null;
  resolution?: string;
  status: IncidentStatus;
  createdAt: number;
  updatedAt: number;
}

export interface Lesson {
  id: string;
  sessionId: string;
  incidentIds: string[];
  title: string;
  problem: string;
  rootCause: string;
  solution: string;
  applicability: Applicability | null;
  status: LessonStatus;
  approvedBy?: string;
  approvedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  lessonIds: string[];
  type: SkillType;
  content: string;
  triggerConfig: TriggerConfig | null;
  applicability: Applicability | null;
  status: SkillStatus;
  usageCount: number;
  successRate: number;
  lastUsed?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  skillIds: string[];
  level: RuleLevel;
  enforcement: RuleEnforcement;
  content: string;
  applicability: Applicability | null;
  status: RuleStatus;
  violationCount: number;
  lastViolation?: number;
  createdAt: number;
  updatedAt: number;
}

export interface TrainingFeedback {
  id: string;
  entityType: "skill" | "rule";
  entityId: string;
  taskId?: string;
  sessionId?: string;
  outcome: FeedbackOutcome;
  rating?: number;
  comment?: string;
  createdAt: number;
}

export interface TrainingStats {
  moduleId: string;
  hasSession: boolean;
  sessionId?: string;
  sessionStatus?: string;
  incidents: {
    total: number;
    byStatus: Record<IncidentStatus, number>;
    bySeverity: Record<IncidentSeverity, number>;
  };
  lessons: {
    total: number;
    byStatus: Record<LessonStatus, number>;
  };
  skills: {
    total: number;
    active: number;
    totalUsage: number;
    avgSuccessRate: number;
  };
  rules: {
    total: number;
    active: number;
    totalViolations: number;
  };
}

export interface TrainingContext {
  moduleId: string;
  skills: Array<{
    id: string;
    name: string;
    content: string;
    type: string;
    usageCount: number;
    successRate: number;
  }>;
  rules: Array<{
    id: string;
    name: string;
    content: string;
    level: string;
    enforcement: string;
  }>;
  recentIncidents: Array<{
    id: string;
    title: string;
    type: string;
    severity: string;
  }>;
}

// Filters
export type TabType = "incidents" | "lessons" | "skills" | "rules" | "analytics";

interface TrainingFilters {
  projectPath: string;
  moduleId: string;
  incidentStatus?: IncidentStatus;
  incidentSeverity?: IncidentSeverity;
  lessonStatus?: LessonStatus;
  skillStatus?: SkillStatus;
  ruleStatus?: RuleStatus;
  searchQuery: string;
}

// ============================================================================
// Store Interface
// ============================================================================

interface TrainingRoomState {
  // Current session
  currentSession: TrainingSession | null;
  sessions: TrainingSession[];

  // Data
  incidents: Incident[];
  lessons: Lesson[];
  skills: Skill[];
  rules: Rule[];
  stats: TrainingStats | null;
  context: TrainingContext | null;

  // Selection
  selectedIncidentId: string | null;
  selectedLessonId: string | null;
  selectedSkillId: string | null;
  selectedRuleId: string | null;

  // UI State
  activeTab: TabType;
  filters: TrainingFilters;
  isLoading: boolean;
  error: string | null;

  // Session Actions
  fetchSession: (moduleId: string, projectPath?: string) => Promise<void>;
  getOrCreateSession: (moduleId: string, projectPath?: string) => Promise<TrainingSession | null>;
  fetchSessions: (projectPath?: string) => Promise<void>;

  // Incident Actions
  fetchIncidents: (sessionId?: string) => Promise<void>;
  createIncident: (data: Partial<Incident>) => Promise<Incident | null>;
  updateIncident: (id: string, data: Partial<Incident>) => Promise<Incident | null>;
  deleteIncident: (id: string) => Promise<boolean>;
  selectIncident: (id: string | null) => void;

  // Lesson Actions
  fetchLessons: (sessionId?: string) => Promise<void>;
  createLesson: (data: Partial<Lesson>) => Promise<Lesson | null>;
  updateLesson: (id: string, data: Partial<Lesson>) => Promise<Lesson | null>;
  approveLesson: (id: string, approver?: string) => Promise<Lesson | null>;
  selectLesson: (id: string | null) => void;

  // Skill Actions
  fetchSkills: (moduleId?: string, projectPath?: string) => Promise<void>;
  createSkill: (data: Partial<Skill>) => Promise<Skill | null>;
  updateSkill: (id: string, data: Partial<Skill>) => Promise<Skill | null>;
  activateSkill: (id: string) => Promise<Skill | null>;
  deprecateSkill: (id: string) => Promise<Skill | null>;
  selectSkill: (id: string | null) => void;

  // Rule Actions
  fetchRules: (moduleId?: string, projectPath?: string) => Promise<void>;
  createRule: (data: Partial<Rule>) => Promise<Rule | null>;
  updateRule: (id: string, data: Partial<Rule>) => Promise<Rule | null>;
  deprecateRule: (id: string) => Promise<Rule | null>;
  selectRule: (id: string | null) => void;

  // Context & Stats
  fetchStats: (moduleId: string, projectPath?: string) => Promise<void>;
  fetchContext: (moduleId: string, projectPath?: string, role?: string, taskType?: string) => Promise<void>;
  buildContextPrompt: (moduleId: string, projectPath?: string, role?: string, taskType?: string) => Promise<string | null>;

  // Feedback
  submitFeedback: (data: {
    entityType: "skill" | "rule";
    entityId: string;
    outcome: FeedbackOutcome;
    rating?: number;
    comment?: string;
  }) => Promise<boolean>;

  // UI Actions
  setActiveTab: (tab: TabType) => void;
  setProjectPath: (projectPath: string) => void;
  setModuleFilter: (moduleId: string) => void;
  setSearchQuery: (query: string) => void;
  setIncidentStatusFilter: (status: IncidentStatus | undefined) => void;
  setIncidentSeverityFilter: (severity: IncidentSeverity | undefined) => void;
  setLessonStatusFilter: (status: LessonStatus | undefined) => void;
  setSkillStatusFilter: (status: SkillStatus | undefined) => void;
  setRuleStatusFilter: (status: RuleStatus | undefined) => void;
  clearError: () => void;
  reset: () => void;
}

// ============================================================================
// Implementation
// ============================================================================

const API_BASE = "http://localhost:19432";

const initialFilters: TrainingFilters = {
  projectPath: "",
  moduleId: "",
  searchQuery: "",
};

export const useTrainingRoomStore = create<TrainingRoomState>((set, get) => ({
  // Initial State
  currentSession: null,
  sessions: [],
  incidents: [],
  lessons: [],
  skills: [],
  rules: [],
  stats: null,
  context: null,

  selectedIncidentId: null,
  selectedLessonId: null,
  selectedSkillId: null,
  selectedRuleId: null,

  activeTab: "incidents",
  filters: initialFilters,
  isLoading: false,
  error: null,

  // ==========================================================================
  // Session Actions
  // ==========================================================================

  fetchSession: async (moduleId, projectPath) => {
    const pp = projectPath ?? get().filters.projectPath;
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (pp) params.append("projectPath", pp);
      const response = await fetch(`${API_BASE}/api/training/sessions/${moduleId}?${params}`);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          set({ currentSession: null, isLoading: false });
          return;
        }
        throw new Error(data.error || "Failed to fetch session");
      }

      set({
        currentSession: data.session,
        filters: { ...get().filters, moduleId, projectPath: pp },
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  getOrCreateSession: async (moduleId, projectPath) => {
    const pp = projectPath ?? get().filters.projectPath;
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (pp) params.append("projectPath", pp);
      const response = await fetch(`${API_BASE}/api/training/sessions/${moduleId}?${params}`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create session");
      }

      set({
        currentSession: data.session,
        filters: { ...get().filters, moduleId, projectPath: pp },
        isLoading: false,
      });

      return data.session;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  },

  fetchSessions: async (projectPath) => {
    const pp = projectPath ?? get().filters.projectPath;
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (pp) params.append("projectPath", pp);
      const response = await fetch(`${API_BASE}/api/training/sessions?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch sessions");
      }

      set({ sessions: data.sessions, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  // ==========================================================================
  // Incident Actions
  // ==========================================================================

  fetchIncidents: async (sessionId) => {
    const { currentSession, filters } = get();
    const sid = sessionId || currentSession?.id;

    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters.projectPath) params.append("projectPath", filters.projectPath);
      if (sid) params.append("sessionId", sid);
      if (filters.moduleId) params.append("moduleId", filters.moduleId);
      if (filters.incidentStatus) params.append("status", filters.incidentStatus);
      if (filters.incidentSeverity) params.append("severity", filters.incidentSeverity);

      const response = await fetch(`${API_BASE}/api/training/incidents?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch incidents");
      }

      set({ incidents: data.incidents, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  createIncident: async (data) => {
    const { currentSession } = get();
    if (!currentSession) {
      set({ error: "No active training session" });
      return null;
    }

    try {
      const response = await fetch(`${API_BASE}/api/training/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, sessionId: currentSession.id }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create incident");
      }

      set((state) => ({
        incidents: [result.incident, ...state.incidents],
      }));

      return result.incident;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unknown error" });
      return null;
    }
  },

  updateIncident: async (id, data) => {
    try {
      const response = await fetch(`${API_BASE}/api/training/incidents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update incident");
      }

      set((state) => ({
        incidents: state.incidents.map((inc) =>
          inc.id === id ? result.incident : inc
        ),
      }));

      return result.incident;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unknown error" });
      return null;
    }
  },

  deleteIncident: async (id) => {
    try {
      const response = await fetch(`${API_BASE}/api/training/incidents/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete incident");
      }

      set((state) => ({
        incidents: state.incidents.filter((inc) => inc.id !== id),
        selectedIncidentId: state.selectedIncidentId === id ? null : state.selectedIncidentId,
      }));

      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unknown error" });
      return false;
    }
  },

  selectIncident: (id) => set({ selectedIncidentId: id }),

  // ==========================================================================
  // Lesson Actions
  // ==========================================================================

  fetchLessons: async (sessionId) => {
    const { currentSession, filters } = get();
    const sid = sessionId || currentSession?.id;

    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters.projectPath) params.append("projectPath", filters.projectPath);
      if (sid) params.append("sessionId", sid);
      if (filters.moduleId) params.append("moduleId", filters.moduleId);
      if (filters.lessonStatus) params.append("status", filters.lessonStatus);

      const response = await fetch(`${API_BASE}/api/training/lessons?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch lessons");
      }

      set({ lessons: data.lessons, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  createLesson: async (data) => {
    const { currentSession } = get();
    if (!currentSession) {
      set({ error: "No active training session" });
      return null;
    }

    try {
      const response = await fetch(`${API_BASE}/api/training/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, sessionId: currentSession.id }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create lesson");
      }

      set((state) => ({
        lessons: [result.lesson, ...state.lessons],
      }));

      return result.lesson;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unknown error" });
      return null;
    }
  },

  updateLesson: async (id, data) => {
    try {
      const response = await fetch(`${API_BASE}/api/training/lessons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update lesson");
      }

      set((state) => ({
        lessons: state.lessons.map((l) => (l.id === id ? result.lesson : l)),
      }));

      return result.lesson;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unknown error" });
      return null;
    }
  },

  approveLesson: async (id, approver = "user") => {
    try {
      const response = await fetch(`${API_BASE}/api/training/lessons/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approver }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to approve lesson");
      }

      set((state) => ({
        lessons: state.lessons.map((l) => (l.id === id ? result.lesson : l)),
      }));

      return result.lesson;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unknown error" });
      return null;
    }
  },

  selectLesson: (id) => set({ selectedLessonId: id }),

  // ==========================================================================
  // Skill Actions
  // ==========================================================================

  fetchSkills: async (moduleId, projectPath) => {
    const { filters } = get();
    const mid = moduleId || filters.moduleId;
    const pp = projectPath ?? filters.projectPath;

    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (pp) params.append("projectPath", pp);
      if (mid) params.append("module", mid);
      if (filters.skillStatus) params.append("status", filters.skillStatus);

      const response = await fetch(`${API_BASE}/api/training/skills?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch skills");
      }

      set({ skills: data.skills, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  createSkill: async (data) => {
    const { filters } = get();
    try {
      const response = await fetch(`${API_BASE}/api/training/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, projectPath: filters.projectPath }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create skill");
      }

      set((state) => ({
        skills: [result.skill, ...state.skills],
      }));

      return result.skill;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unknown error" });
      return null;
    }
  },

  updateSkill: async (id, data) => {
    try {
      const response = await fetch(`${API_BASE}/api/training/skills/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update skill");
      }

      set((state) => ({
        skills: state.skills.map((s) => (s.id === id ? result.skill : s)),
      }));

      return result.skill;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unknown error" });
      return null;
    }
  },

  activateSkill: async (id) => {
    try {
      const response = await fetch(`${API_BASE}/api/training/skills/${id}/activate`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to activate skill");
      }

      set((state) => ({
        skills: state.skills.map((s) => (s.id === id ? result.skill : s)),
      }));

      return result.skill;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unknown error" });
      return null;
    }
  },

  deprecateSkill: async (id) => {
    try {
      const response = await fetch(`${API_BASE}/api/training/skills/${id}/deprecate`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to deprecate skill");
      }

      set((state) => ({
        skills: state.skills.map((s) => (s.id === id ? result.skill : s)),
      }));

      return result.skill;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unknown error" });
      return null;
    }
  },

  selectSkill: (id) => set({ selectedSkillId: id }),

  // ==========================================================================
  // Rule Actions
  // ==========================================================================

  fetchRules: async (moduleId, projectPath) => {
    const { filters } = get();
    const mid = moduleId || filters.moduleId;
    const pp = projectPath ?? filters.projectPath;

    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (pp) params.append("projectPath", pp);
      if (mid) params.append("module", mid);
      if (filters.ruleStatus) params.append("status", filters.ruleStatus);

      const response = await fetch(`${API_BASE}/api/training/rules?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch rules");
      }

      set({ rules: data.rules, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  createRule: async (data) => {
    const { filters } = get();
    try {
      const response = await fetch(`${API_BASE}/api/training/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, projectPath: filters.projectPath }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create rule");
      }

      set((state) => ({
        rules: [result.rule, ...state.rules],
      }));

      return result.rule;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unknown error" });
      return null;
    }
  },

  updateRule: async (id, data) => {
    try {
      const response = await fetch(`${API_BASE}/api/training/rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update rule");
      }

      set((state) => ({
        rules: state.rules.map((r) => (r.id === id ? result.rule : r)),
      }));

      return result.rule;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unknown error" });
      return null;
    }
  },

  deprecateRule: async (id) => {
    try {
      const response = await fetch(`${API_BASE}/api/training/rules/${id}/deprecate`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to deprecate rule");
      }

      set((state) => ({
        rules: state.rules.map((r) => (r.id === id ? result.rule : r)),
      }));

      return result.rule;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unknown error" });
      return null;
    }
  },

  selectRule: (id) => set({ selectedRuleId: id }),

  // ==========================================================================
  // Context & Stats
  // ==========================================================================

  fetchStats: async (moduleId, projectPath) => {
    const pp = projectPath ?? get().filters.projectPath;
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (pp) params.append("projectPath", pp);
      const response = await fetch(`${API_BASE}/api/training/stats/${moduleId}?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch stats");
      }

      set({ stats: data.stats, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  fetchContext: async (moduleId, projectPath, role, taskType) => {
    const pp = projectPath ?? get().filters.projectPath;
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (pp) params.append("projectPath", pp);
      if (role) params.append("role", role);
      if (taskType) params.append("taskType", taskType);

      const response = await fetch(
        `${API_BASE}/api/training/context/${moduleId}?${params}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch context");
      }

      set({ context: data.context, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  buildContextPrompt: async (moduleId, projectPath, role, taskType) => {
    const pp = projectPath ?? get().filters.projectPath;
    try {
      const response = await fetch(`${API_BASE}/api/training/context/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath: pp, moduleId, role, taskType }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to build context prompt");
      }

      set({ context: data.context });
      return data.prompt;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unknown error" });
      return null;
    }
  },

  // ==========================================================================
  // Feedback
  // ==========================================================================

  submitFeedback: async (data) => {
    try {
      const response = await fetch(`${API_BASE}/api/training/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit feedback");
      }

      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unknown error" });
      return false;
    }
  },

  // ==========================================================================
  // UI Actions
  // ==========================================================================

  setActiveTab: (tab) => set({ activeTab: tab }),

  setProjectPath: (projectPath) => {
    const currentProjectPath = get().filters.projectPath;
    // Reset all data when project changes
    if (currentProjectPath !== projectPath) {
      set({
        currentSession: null,
        sessions: [],
        incidents: [],
        lessons: [],
        skills: [],
        rules: [],
        stats: null,
        context: null,
        selectedIncidentId: null,
        selectedLessonId: null,
        selectedSkillId: null,
        selectedRuleId: null,
        filters: { ...get().filters, projectPath },
      });
    }
  },

  setModuleFilter: (moduleId) => {
    set((state) => ({
      filters: { ...state.filters, moduleId },
    }));
  },

  setSearchQuery: (query) => {
    set((state) => ({
      filters: { ...state.filters, searchQuery: query },
    }));
  },

  setIncidentStatusFilter: (status) => {
    set((state) => ({
      filters: { ...state.filters, incidentStatus: status },
    }));
    get().fetchIncidents();
  },

  setIncidentSeverityFilter: (severity) => {
    set((state) => ({
      filters: { ...state.filters, incidentSeverity: severity },
    }));
    get().fetchIncidents();
  },

  setLessonStatusFilter: (status) => {
    set((state) => ({
      filters: { ...state.filters, lessonStatus: status },
    }));
    get().fetchLessons();
  },

  setSkillStatusFilter: (status) => {
    set((state) => ({
      filters: { ...state.filters, skillStatus: status },
    }));
    get().fetchSkills();
  },

  setRuleStatusFilter: (status) => {
    set((state) => ({
      filters: { ...state.filters, ruleStatus: status },
    }));
    get().fetchRules();
  },

  clearError: () => set({ error: null }),

  reset: () =>
    set({
      currentSession: null,
      sessions: [],
      incidents: [],
      lessons: [],
      skills: [],
      rules: [],
      stats: null,
      context: null,
      selectedIncidentId: null,
      selectedLessonId: null,
      selectedSkillId: null,
      selectedRuleId: null,
      activeTab: "incidents",
      filters: initialFilters,
      isLoading: false,
      error: null,
    }),
}));

// ============================================================================
// Selectors
// ============================================================================

export const useCurrentSession = () =>
  useTrainingRoomStore((state) => state.currentSession);

export const useTrainingSessions = () =>
  useTrainingRoomStore((state) => state.sessions);

export const useIncidents = () =>
  useTrainingRoomStore((state) => state.incidents);

export const useLessons = () =>
  useTrainingRoomStore((state) => state.lessons);

export const useSkills = () =>
  useTrainingRoomStore((state) => state.skills);

export const useRules = () =>
  useTrainingRoomStore((state) => state.rules);

export const useTrainingStats = () =>
  useTrainingRoomStore((state) => state.stats);

export const useTrainingContext = () =>
  useTrainingRoomStore((state) => state.context);

export const useSelectedIncident = () => {
  const incidents = useTrainingRoomStore((state) => state.incidents);
  const selectedId = useTrainingRoomStore((state) => state.selectedIncidentId);
  return incidents.find((i) => i.id === selectedId) || null;
};

export const useSelectedLesson = () => {
  const lessons = useTrainingRoomStore((state) => state.lessons);
  const selectedId = useTrainingRoomStore((state) => state.selectedLessonId);
  return lessons.find((l) => l.id === selectedId) || null;
};

export const useSelectedSkill = () => {
  const skills = useTrainingRoomStore((state) => state.skills);
  const selectedId = useTrainingRoomStore((state) => state.selectedSkillId);
  return skills.find((s) => s.id === selectedId) || null;
};

export const useSelectedRule = () => {
  const rules = useTrainingRoomStore((state) => state.rules);
  const selectedId = useTrainingRoomStore((state) => state.selectedRuleId);
  return rules.find((r) => r.id === selectedId) || null;
};

export const useTrainingFilters = () =>
  useTrainingRoomStore((state) => state.filters);

export const useTrainingLoading = () =>
  useTrainingRoomStore((state) => state.isLoading);

export const useTrainingError = () =>
  useTrainingRoomStore((state) => state.error);

export const useActiveTab = () =>
  useTrainingRoomStore((state) => state.activeTab);

// Filtered selectors with search
export const useFilteredIncidents = () => {
  const incidents = useTrainingRoomStore((state) => state.incidents);
  const searchQuery = useTrainingRoomStore((state) => state.filters.searchQuery);

  if (!searchQuery) return incidents;

  const query = searchQuery.toLowerCase();
  return incidents.filter(
    (i) =>
      i.title.toLowerCase().includes(query) ||
      i.description.toLowerCase().includes(query)
  );
};

export const useFilteredLessons = () => {
  const lessons = useTrainingRoomStore((state) => state.lessons);
  const searchQuery = useTrainingRoomStore((state) => state.filters.searchQuery);

  if (!searchQuery) return lessons;

  const query = searchQuery.toLowerCase();
  return lessons.filter(
    (l) =>
      l.title.toLowerCase().includes(query) ||
      l.problem.toLowerCase().includes(query) ||
      l.solution.toLowerCase().includes(query)
  );
};

export const useFilteredSkills = () => {
  const skills = useTrainingRoomStore((state) => state.skills);
  const searchQuery = useTrainingRoomStore((state) => state.filters.searchQuery);

  if (!searchQuery) return skills;

  const query = searchQuery.toLowerCase();
  return skills.filter(
    (s) =>
      s.name.toLowerCase().includes(query) ||
      s.description.toLowerCase().includes(query) ||
      s.content.toLowerCase().includes(query)
  );
};

export const useFilteredRules = () => {
  const rules = useTrainingRoomStore((state) => state.rules);
  const searchQuery = useTrainingRoomStore((state) => state.filters.searchQuery);

  if (!searchQuery) return rules;

  const query = searchQuery.toLowerCase();
  return rules.filter(
    (r) =>
      r.name.toLowerCase().includes(query) ||
      r.description.toLowerCase().includes(query) ||
      r.content.toLowerCase().includes(query)
  );
};
