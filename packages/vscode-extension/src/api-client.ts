import { getApiBaseUrl, getConfig, getProjectPath } from './config';

// ─── Response Types ──────────────────────────────────────────────────────────

export interface ApiTask {
  id: string;
  projectId: string;
  parentTaskId?: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  assignedAgent?: string;
  taskType?: string;
  moduleId?: string;
  governance?: string;
  acceptanceCriteria?: string;
  validation?: string;
  progress: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
}

export interface ApiTicket {
  id: string;
  projectId: string;
  externalId?: string;
  source: string;
  status: 'new' | 'reviewing' | 'approved' | 'in_progress' | 'completed' | 'rejected';
  type: 'bug' | 'feature' | 'improvement' | 'task' | 'epic';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description?: string;
  labels: string[];
  reporter?: string;
  assignee?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ApiKnowledgeDoc {
  id: string;
  title: string;
  type: string;
  status: string;
  module?: string;
  tags: string[];
  summary?: string;
  filePath?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiLesson {
  id: string;
  moduleId: string;
  title: string;
  problem: string;
  rootCause: string;
  solution: string;
  status: string;
  createdAt: number;
  updatedAt: number;
}

export interface ApiRule {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  level: string;
  enforcement: string;
  status: string;
  createdAt: number;
}

export interface ApiSkill {
  id: string;
  moduleId: string;
  name: string;
  description: string;
  type: string;
  status: string;
  createdAt: number;
}

export interface ApiImpactAnalysis {
  id: string;
  projectId: string;
  description: string;
  status: string;
  changeType?: string;
  riskLevel?: string;
  gateStatus?: string;
  createdAt: number;
  updatedAt: number;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
}

// ─── API Client ──────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000;

class ApiClient {
  private get baseUrl(): string {
    return getApiBaseUrl();
  }

  private get projectId(): string {
    return getConfig().projectId;
  }

  private get projectPath(): string {
    return getProjectPath() || '';
  }

  // BUG-6 FIX: Add AbortSignal timeout to prevent hanging fetches
  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`API ${response.status}: ${body}`);
      }

      return response.json() as Promise<T>;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── Health ──────────────────────────────────────────────────────────────

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }

  async isServerRunning(): Promise<boolean> {
    try {
      await this.health();
      return true;
    } catch {
      return false;
    }
  }

  // ─── Tasks ───────────────────────────────────────────────────────────────

  async listTasks(status?: string): Promise<ApiTask[]> {
    const params = new URLSearchParams({ projectId: this.projectId });
    if (status) { params.set('status', status); }
    const result = await this.request<{ tasks: ApiTask[] }>(`/api/tasks?${params}`);
    return result.tasks;
  }

  async getTask(id: string): Promise<ApiTask> {
    const result = await this.request<{ task: ApiTask }>(`/api/tasks/${id}`);
    return result.task;
  }

  async createTask(data: {
    title: string;
    description: string;
    priority?: string;
    taskType?: string;
    moduleId?: string;
  }): Promise<ApiTask> {
    const result = await this.request<{ task: ApiTask }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ ...data, projectId: this.projectId }),
    });
    return result.task;
  }

  async updateTask(id: string, data: Record<string, unknown>): Promise<ApiTask> {
    const result = await this.request<{ task: ApiTask }>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return result.task;
  }

  async completeTask(id: string, force?: boolean): Promise<unknown> {
    return this.request(`/api/tasks/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ force }),
    });
  }

  // ─── Knowledge ───────────────────────────────────────────────────────────

  async listKnowledge(options?: {
    type?: string;
    module?: string;
    search?: string;
    limit?: number;
  }): Promise<ApiKnowledgeDoc[]> {
    const params = new URLSearchParams({ projectPath: this.projectPath });
    if (options?.type) { params.set('type', options.type); }
    if (options?.module) { params.set('module', options.module); }
    if (options?.search) { params.set('search', options.search); }
    if (options?.limit) { params.set('limit', String(options.limit)); }
    const result = await this.request<{ documents: ApiKnowledgeDoc[] }>(`/api/knowledge?${params}`);
    return result.documents;
  }

  async getKnowledgeDoc(docId: string): Promise<{ document: ApiKnowledgeDoc; content?: string }> {
    const params = new URLSearchParams({ projectPath: this.projectPath });
    return this.request(`/api/knowledge/${docId}?${params}`);
  }

  async searchKnowledge(query: string): Promise<ApiKnowledgeDoc[]> {
    const params = new URLSearchParams({ projectPath: this.projectPath, query });
    const result = await this.request<{ results: ApiKnowledgeDoc[] }>(`/api/knowledge/search?${params}`);
    return result.results;
  }

  // ─── Tickets ─────────────────────────────────────────────────────────────

  async listTickets(status?: string): Promise<ApiTicket[]> {
    const params = new URLSearchParams({ projectId: this.projectId });
    if (status) { params.set('status', status); }
    const result = await this.request<{ tickets: ApiTicket[] }>(`/api/tickets?${params}`);
    return result.tickets;
  }

  async getTicket(id: string): Promise<ApiTicket> {
    const result = await this.request<{ ticket: ApiTicket }>(`/api/tickets/${id}`);
    return result.ticket;
  }

  async createTicket(data: {
    title: string;
    description?: string;
    type?: string;
    priority?: string;
    labels?: string[];
  }): Promise<ApiTicket> {
    const result = await this.request<{ ticket: ApiTicket }>('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({ ...data, projectId: this.projectId }),
    });
    return result.ticket;
  }

  async updateTicket(id: string, data: Record<string, unknown>): Promise<ApiTicket> {
    const result = await this.request<{ ticket: ApiTicket }>(`/api/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return result.ticket;
  }

  async convertTicketToTask(ticketId: string): Promise<ApiTask> {
    const result = await this.request<{ task: ApiTask }>(`/api/tickets/${ticketId}/convert`, {
      method: 'POST',
    });
    return result.task;
  }

  // ─── Training ────────────────────────────────────────────────────────────

  async listLessons(moduleId?: string): Promise<ApiLesson[]> {
    const params = new URLSearchParams();
    if (this.projectPath) { params.set('projectPath', this.projectPath); }
    if (moduleId) { params.set('moduleId', moduleId); }
    const result = await this.request<{ lessons: ApiLesson[] }>(`/api/training/lessons?${params}`);
    return result.lessons;
  }

  async listRules(moduleId?: string): Promise<ApiRule[]> {
    const params = new URLSearchParams();
    if (this.projectPath) { params.set('projectPath', this.projectPath); }
    if (moduleId) { params.set('moduleId', moduleId); }
    const result = await this.request<{ rules: ApiRule[] }>(`/api/training/rules?${params}`);
    return result.rules;
  }

  async listSkills(moduleId?: string): Promise<ApiSkill[]> {
    const params = new URLSearchParams();
    if (this.projectPath) { params.set('projectPath', this.projectPath); }
    if (moduleId) { params.set('moduleId', moduleId); }
    const result = await this.request<{ skills: ApiSkill[] }>(`/api/training/skills?${params}`);
    return result.skills;
  }

  // ─── Impact ──────────────────────────────────────────────────────────────

  async listImpactAnalyses(): Promise<ApiImpactAnalysis[]> {
    const params = new URLSearchParams({ projectId: this.projectId });
    const result = await this.request<{ analyses: ApiImpactAnalysis[] }>(`/api/impact?${params}`);
    return result.analyses;
  }

  async runImpactAnalysis(description: string, changeType?: string): Promise<ApiImpactAnalysis> {
    const result = await this.request<{ analysis: ApiImpactAnalysis }>('/api/impact', {
      method: 'POST',
      body: JSON.stringify({
        projectId: this.projectId,
        description,
        changeType,
        projectPath: this.projectPath,
      }),
    });
    return result.analysis;
  }

  async checkGate(analysisId: string): Promise<{ gateStatus: string; blockers: unknown[]; warnings: unknown[] }> {
    return this.request(`/api/impact/${analysisId}/gate`);
  }
}

export const apiClient = new ApiClient();
