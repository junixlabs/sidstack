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
  list: (projectId: string, opts?: { preset?: string; status?: string; search?: string; fields?: string; limit?: number }) =>
    request<{ tasks: Task[] }>(`/tasks${qs({ projectId, ...opts })}`),
  get: (id: string) =>
    request<{ task: Task }>(`/tasks/${id}`),
  update: (id: string, data: Partial<TaskUpdate>) =>
    request<{ task: Task }>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

// Tickets
export const tickets = {
  list: (projectId: string, opts?: { status?: string; type?: string; priority?: string; limit?: number }) =>
    request<{ tickets: Ticket[]; total: number }>(`/tickets${qs({ projectId, ...opts })}`),
  get: (id: string) =>
    request<{ ticket: Ticket }>(`/tickets/${id}`),
  update: (id: string, data: Partial<TicketUpdate>) =>
    request<{ ticket: Ticket }>(`/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  convertToTask: (id: string) =>
    request<{ task: Task; ticket: Ticket }>(`/tickets/${id}/convert-to-task`, { method: 'POST' }),
};

// Projects
export const projects = {
  list: () => request<{ projects: Project[] }>('/projects'),
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
