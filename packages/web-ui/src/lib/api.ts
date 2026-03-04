const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.details || `HTTP ${res.status}`);
  }
  return res.json();
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return '';
  return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

// Knowledge
export const knowledge = {
  list: (projectId: string, opts?: { type?: string; status?: string; search?: string; limit?: number; offset?: number; sortBy?: string; sortOrder?: string }) =>
    request<{ documents: KnowledgeDoc[]; total: number }>(`/knowledge${qs({ projectId, ...opts })}`),
  get: (id: string) =>
    request<KnowledgeDoc>(`/knowledge/doc/${id}`),
  search: (projectId: string, q: string, limit?: number) =>
    request<{ query: string; results: KnowledgeDoc[]; total: number }>(`/knowledge/search${qs({ projectId, q, limit })}`),
  tree: (projectId: string) =>
    request<TreeNode[]>(`/knowledge/tree${qs({ projectId })}`),
  stats: (projectId: string) =>
    request<KnowledgeStats>(`/knowledge/stats${qs({ projectId })}`),
  create: (data: CreateKnowledgeDoc) =>
    request<KnowledgeDoc>('/knowledge', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: UpdateKnowledgeDoc) =>
    request<KnowledgeDoc>(`/knowledge/doc/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/knowledge/doc/${id}`, { method: 'DELETE' }),
};

// Tasks
export const tasks = {
  list: (projectId: string, opts?: { preset?: string; status?: string; search?: string; fields?: string; limit?: number; taskType?: string; priority?: string }) =>
    request<{ tasks: Task[] }>(`/tasks${qs({ projectId, ...opts })}`),
  get: (id: string) =>
    request<{ task: Task }>(`/tasks/${id}`),
  create: (data: { title: string; description: string; projectId: string; priority?: string; taskType?: string; assignedAgent?: string }) =>
    request<{ task: Task }>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<TaskUpdate>) =>
    request<{ task: Task }>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  complete: (id: string, data?: { force?: boolean; reason?: string }) =>
    request<{ task: Task }>(`/tasks/${id}/complete`, { method: 'POST', body: JSON.stringify(data || {}) }),
};

// Tickets
export const tickets = {
  list: (projectId: string, opts?: { status?: string; type?: string; priority?: string; limit?: number }) =>
    request<{ tickets: Ticket[]; total: number }>(`/tickets${qs({ projectId, ...opts })}`),
  get: (id: string) =>
    request<{ ticket: Ticket }>(`/tickets/${id}`),
  create: (data: { projectId: string; title: string; description: string; type?: string; priority?: string; source?: string }) =>
    request<{ ticket: Ticket }>('/tickets', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<TicketUpdate>) =>
    request<{ ticket: Ticket }>(`/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  convertToTask: (id: string) =>
    request<{ task: Task; ticket: Ticket }>(`/tickets/${id}/convert-to-task`, { method: 'POST' }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/tickets/${id}`, { method: 'DELETE' }),
};

// Projects
export const projects = {
  list: () => request<{ projects: Project[] }>('/projects'),
  get: (id: string) => request<Project & { tasks: Task[] }>(`/projects/${id}`),
  okrs: (path: string) => request<{ okrs: OKR[] }>(`/projects/okrs${qs({ path })}`),
};

// Impact Analysis
export const impact = {
  list: (projectId: string, opts?: { status?: string; limit?: number }) =>
    request<{ analyses: ImpactAnalysis[] }>(`/impact/list/${projectId}${qs({ ...opts })}`),
  get: (id: string) =>
    request<ImpactAnalysis>(`/impact/${id}`),
  gate: (id: string) =>
    request<GateStatus>(`/impact/${id}/gate`),
  approve: (id: string, data: { approver: string; reason?: string; blockerIds?: string[] }) =>
    request<GateStatus>(`/impact/${id}/gate/approve`, { method: 'POST', body: JSON.stringify(data) }),
  resolve: (id: string, data: { riskId: string; mitigationNotes: string }) =>
    request<ImpactAnalysis>(`/impact/${id}/gate/resolve`, { method: 'POST', body: JSON.stringify(data) }),
};

// Training Room
export const training = {
  incidents: {
    list: (opts?: { projectPath?: string; type?: string; severity?: string; status?: string }) =>
      request<{ incidents: Incident[] }>(`/training/incidents${qs({ ...opts })}`),
    get: (id: string) =>
      request<Incident>(`/training/incidents/${id}`),
  },
  lessons: {
    list: (opts?: { projectPath?: string; status?: string }) =>
      request<{ lessons: Lesson[] }>(`/training/lessons${qs({ ...opts })}`),
    get: (id: string) =>
      request<Lesson>(`/training/lessons/${id}`),
    approve: (id: string, approver: string) =>
      request<Lesson>(`/training/lessons/${id}/approve`, { method: 'POST', body: JSON.stringify({ approver }) }),
  },
  skills: {
    list: (opts?: { projectPath?: string; type?: string; status?: string }) =>
      request<{ skills: Skill[] }>(`/training/skills${qs({ ...opts })}`),
  },
  rules: {
    list: (opts?: { projectPath?: string; level?: string; status?: string }) =>
      request<{ rules: Rule[] }>(`/training/rules${qs({ ...opts })}`),
  },
  stats: (opts?: { projectPath?: string }) =>
    request<TrainingStats>(`/training/stats${qs({ ...opts })}`),
};

// Traceability
export const traceability = {
  matrix: (projectId: string) =>
    request<{ matrix: TraceabilityRow[] }>(`/traceability/matrix${qs({ projectId })}`),
};

// Types
export interface KnowledgeDoc {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: string;
  content: string;
  summary?: string;
  module?: string;
  tags?: string[];
  category?: string;
  owner?: string;
  related?: string[];
  dependsOn?: string[];
  covers?: string[];
  createdAt: string;
  updatedAt: string;
  projectId?: string;
}

export interface CreateKnowledgeDoc {
  projectId: string;
  title: string;
  type: string;
  content: string;
  status?: string;
  summary?: string;
  module?: string;
  tags?: string[];
  category?: string;
  owner?: string;
  related?: string[];
  dependsOn?: string[];
  covers?: string[];
}

export interface UpdateKnowledgeDoc {
  title?: string;
  content?: string;
  status?: string;
  summary?: string;
  module?: string;
  tags?: string[];
  category?: string;
  owner?: string;
  related?: string[];
  dependsOn?: string[];
  covers?: string[];
}

export interface TreeNode {
  id: string;
  name: string;
  type: 'folder' | 'document';
  path: string;
  children?: TreeNode[];
  documentCount?: number;
  documentType?: string;
  status?: string;
}

export interface KnowledgeStats {
  totalDocuments: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byModule: Record<string, number>;
  needsReview: { id: string; title: string }[];
}

export interface Task {
  id: string;
  projectId: string;
  parentTaskId?: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignedAgent?: string;
  createdBy?: string;
  createdAt: number;
  updatedAt: number;
  progress: number;
  notes?: string;
  taskType?: string;
  moduleId?: string;
  branch?: string;
  solutionPlan?: string;
  planStatus?: string;
  implementSummary?: string;
  governance?: string;
  acceptanceCriteria?: string;
  validation?: string;
}

export interface TaskUpdate {
  status: string;
  progress: number;
  notes: string;
  assignedAgent: string;
  branch: string;
  solutionPlan: string;
  planStatus: string;
  planReviewNotes: string;
  implementSummary: string;
}

export interface Ticket {
  id: string;
  projectId: string;
  externalId?: string;
  source: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  labels: string[];
  attachments: string[];
  linkedIssues: string[];
  externalUrls: string[];
  reporter?: string;
  assignee?: string;
  taskId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TicketUpdate {
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  labels: string[];
  assignee: string;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  status: string;
}

export interface OKR {
  id: string;
  objective: string;
  progress: number;
  keyResults: { id: string; title: string; progress: number }[];
}

export interface ImpactAnalysis {
  id: string;
  projectId: string;
  taskId?: string;
  description: string;
  changeType?: string;
  status: string;
  riskLevel?: string;
  risks?: { id: string; description: string; severity: string; mitigated?: boolean; mitigationNotes?: string }[];
  blockers?: { id: string; description: string; resolved?: boolean }[];
  createdAt: number;
  updatedAt: number;
}

export interface GateStatus {
  status: string;
  blockers: { id: string; description: string; resolved: boolean }[];
  approvals: { approver: string; reason?: string; timestamp: number }[];
}

export interface Incident {
  id: string;
  sessionId?: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  context?: string;
  resolution?: string;
  status: string;
  createdAt: number;
  updatedAt: number;
}

export interface Lesson {
  id: string;
  sessionId?: string;
  title: string;
  problem: string;
  rootCause: string;
  solution: string;
  applicability?: string;
  status: string;
  createdAt: number;
  updatedAt: number;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  usageCount?: number;
  createdAt: number;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  level: string;
  enforcement: string;
  status: string;
  violationCount?: number;
  createdAt: number;
}

export interface TrainingStats {
  totalIncidents: number;
  totalLessons: number;
  totalSkills: number;
  totalRules: number;
  activeSkills: number;
  activeRules: number;
  pendingLessons: number;
  recentViolations: number;
}

export interface TraceabilityRow {
  specId: string;
  specTitle: string;
  specType?: string;
  tasks: { id: string; title: string; status: string }[];
  testResults: { id: string; name: string; status: string }[];
  coverage: number;
}
