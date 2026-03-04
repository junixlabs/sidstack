/**
 * SidStack API Client
 *
 * Shared HTTP client for calling the SidStack API server.
 * Used by the MCP server (and other consumers) instead of direct SQLite access.
 * Uses native fetch() — no npm dependencies required.
 *
 * Usage:
 *   const client = createApiClient();
 *   const { tasks } = await client.tasks.list({ projectId: 'my-project' });
 *   const { task } = await client.tasks.get('task-123');
 */

import { API_SERVER_PORT } from './constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiClientOptions {
  baseUrl?: string;
  apiKey?: string;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const REQUEST_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class SidStackApiClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  // Domain namespaces (initialized in constructor)
  public readonly tasks: TasksApi;
  public readonly tickets: TicketsApi;
  public readonly knowledge: KnowledgeApi;
  public readonly training: TrainingApi;
  public readonly impact: ImpactApi;
  public readonly context: ContextApi;
  public readonly references: ReferencesApi;
  public readonly traceability: TraceabilityApi;
  public readonly projects: ProjectsApi;

  constructor(options?: ApiClientOptions) {
    this.baseUrl = (
      options?.baseUrl
      || process.env.SIDSTACK_API_URL
      || `http://localhost:${API_SERVER_PORT}`
    ).replace(/\/+$/, '');

    this.headers = { 'Content-Type': 'application/json' };
    const apiKey = options?.apiKey || process.env.SIDSTACK_API_KEY;
    if (apiKey) {
      this.headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // Bind domain namespaces
    this.tasks = new TasksApi(this);
    this.tickets = new TicketsApi(this);
    this.knowledge = new KnowledgeApi(this);
    this.training = new TrainingApi(this);
    this.impact = new ImpactApi(this);
    this.context = new ContextApi(this);
    this.references = new ReferencesApi(this);
    this.traceability = new TraceabilityApi(this);
    this.projects = new ProjectsApi(this);
  }

  /** Health check — GET /health */
  async health(): Promise<{ status: string; timestamp: string }> {
    return this.request('GET', '/health');
  }

  // ---------------------------------------------------------------------------
  // Core HTTP helper
  // ---------------------------------------------------------------------------

  /** @internal — exposed to domain helpers, not intended for external use. */
  async request<T = any>(
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown> | unknown,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const init: RequestInit = {
      method,
      headers: { ...this.headers },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    };

    if (body !== undefined && method !== 'GET') {
      init.body = JSON.stringify(body);
    }

    let res: Response;
    try {
      res = await fetch(url.toString(), init);
    } catch (err: any) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new ApiClientError(
          `Request timed out: ${method} ${path}`,
          0,
        );
      }
      throw new ApiClientError(
        `Network error: ${method} ${path} — ${err?.message ?? 'unknown'}`,
        0,
        err,
      );
    }

    // Empty body (204 No Content, etc.)
    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;

    if (!res.ok) {
      const message =
        data?.error
        ?? data?.message
        ?? `HTTP ${res.status} on ${method} ${path}`;
      throw new ApiClientError(message, res.status, data);
    }

    return data as T;
  }
}

// ---------------------------------------------------------------------------
// Domain APIs
// ---------------------------------------------------------------------------

class TasksApi {
  constructor(private c: SidStackApiClient) {}

  list(query?: { projectId?: string; status?: string }): Promise<any> {
    return this.c.request('GET', '/api/tasks', undefined, query as any);
  }

  get(id: string): Promise<any> {
    return this.c.request('GET', `/api/tasks/${id}`);
  }

  create(body: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', '/api/tasks', body);
  }

  update(id: string, body: Record<string, unknown>): Promise<any> {
    return this.c.request('PATCH', `/api/tasks/${id}`, body);
  }

  breakdown(id: string, body: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', `/api/tasks/${id}/breakdown`, body);
  }

  getProgress(id: string): Promise<any> {
    return this.c.request('GET', `/api/tasks/${id}/progress`);
  }

  getGovernance(id: string): Promise<any> {
    return this.c.request('GET', `/api/tasks/${id}/governance`);
  }

  check(id: string, body?: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', `/api/tasks/${id}/check`, body ?? {});
  }

  complete(id: string, body?: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', `/api/tasks/${id}/complete`, body ?? {});
  }
}

class TicketsApi {
  constructor(private c: SidStackApiClient) {}

  list(query?: { projectId?: string; status?: string; type?: string; priority?: string }): Promise<any> {
    return this.c.request('GET', '/api/tickets', undefined, query as any);
  }

  get(id: string): Promise<any> {
    return this.c.request('GET', `/api/tickets/${id}`);
  }

  create(body: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', '/api/tickets', body);
  }

  update(id: string, body: Record<string, unknown>): Promise<any> {
    return this.c.request('PATCH', `/api/tickets/${id}`, body);
  }

  delete(id: string): Promise<any> {
    return this.c.request('DELETE', `/api/tickets/${id}`);
  }

  convertToTask(id: string, body?: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', `/api/tickets/${id}/convert-to-task`, body ?? {});
  }
}

class KnowledgeApi {
  constructor(private c: SidStackApiClient) {}

  list(query?: Record<string, string | undefined>): Promise<any> {
    return this.c.request('GET', '/api/knowledge', undefined, query as any);
  }

  get(id: string, query?: Record<string, string | undefined>): Promise<any> {
    return this.c.request('GET', `/api/knowledge/doc/${id}`, undefined, query as any);
  }

  search(query: { projectPath: string; q: string } & Record<string, string | undefined>): Promise<any> {
    return this.c.request('GET', '/api/knowledge/search', undefined, query as any);
  }

  stats(query: { projectPath: string }): Promise<any> {
    return this.c.request('GET', '/api/knowledge/stats', undefined, query as any);
  }

  tree(query: { projectPath: string }): Promise<any> {
    return this.c.request('GET', '/api/knowledge/tree', undefined, query as any);
  }

  context(query?: Record<string, string | undefined>): Promise<any> {
    return this.c.request('GET', '/api/knowledge/context', undefined, query as any);
  }

  types(): Promise<any> {
    return this.c.request('GET', '/api/knowledge/types');
  }

  modules(query?: Record<string, string | undefined>): Promise<any> {
    return this.c.request('GET', '/api/knowledge/modules', undefined, query as any);
  }

  moduleOverview(query: { projectPath: string; moduleId: string }): Promise<any> {
    const { moduleId, ...rest } = query;
    return this.c.request('GET', `/api/knowledge/modules/${encodeURIComponent(moduleId)}/overview`, undefined, rest as any);
  }

  create(body: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', '/api/knowledge', body);
  }

  update(id: string, body: Record<string, unknown>, query?: Record<string, string | undefined>): Promise<any> {
    // PUT route accepts projectPath as query param or in body
    const mergedBody = query?.projectPath ? { ...body, projectPath: query.projectPath } : body;
    return this.c.request('PUT', `/api/knowledge/doc/${id}`, mergedBody, query as any);
  }

  delete(id: string, query?: Record<string, string | boolean | undefined>): Promise<any> {
    return this.c.request('DELETE', `/api/knowledge/doc/${id}`, undefined, query as any);
  }

  health(query?: Record<string, string | undefined>): Promise<any> {
    return this.c.request('GET', '/api/knowledge/health', undefined, query as any);
  }

  invalidateCache(body?: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', '/api/knowledge/cache/invalidate', body ?? {});
  }

  cacheStats(): Promise<any> {
    return this.c.request('GET', '/api/knowledge/cache/stats');
  }
}

class TrainingApi {
  constructor(private c: SidStackApiClient) {}

  // Sessions
  listSessions(query?: Record<string, string | undefined>): Promise<any> {
    return this.c.request('GET', '/api/training/sessions', undefined, query as any);
  }

  getSession(moduleId: string, query?: Record<string, string | undefined>): Promise<any> {
    return this.c.request('GET', `/api/training/sessions/${moduleId}`, undefined, query as any);
  }

  createSession(moduleId: string, body: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', `/api/training/sessions/${moduleId}`, body);
  }

  // Incidents
  listIncidents(query?: Record<string, string | undefined>): Promise<any> {
    return this.c.request('GET', '/api/training/incidents', undefined, query as any);
  }

  getIncident(id: string): Promise<any> {
    return this.c.request('GET', `/api/training/incidents/${id}`);
  }

  createIncident(body: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', '/api/training/incidents', body);
  }

  updateIncident(id: string, body: Record<string, unknown>): Promise<any> {
    return this.c.request('PATCH', `/api/training/incidents/${id}`, body);
  }

  deleteIncident(id: string): Promise<any> {
    return this.c.request('DELETE', `/api/training/incidents/${id}`);
  }

  // Lessons
  listLessons(query?: Record<string, string | undefined>): Promise<any> {
    return this.c.request('GET', '/api/training/lessons', undefined, query as any);
  }

  getLesson(id: string): Promise<any> {
    return this.c.request('GET', `/api/training/lessons/${id}`);
  }

  createLesson(body: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', '/api/training/lessons', body);
  }

  updateLesson(id: string, body: Record<string, unknown>): Promise<any> {
    return this.c.request('PATCH', `/api/training/lessons/${id}`, body);
  }

  approveLesson(id: string, body?: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', `/api/training/lessons/${id}/approve`, body ?? {});
  }

  // Skills
  listSkills(query?: Record<string, string | undefined>): Promise<any> {
    return this.c.request('GET', '/api/training/skills', undefined, query as any);
  }

  getSkill(id: string): Promise<any> {
    return this.c.request('GET', `/api/training/skills/${id}`);
  }

  createSkill(body: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', '/api/training/skills', body);
  }

  updateSkill(id: string, body: Record<string, unknown>): Promise<any> {
    return this.c.request('PATCH', `/api/training/skills/${id}`, body);
  }

  activateSkill(id: string, body?: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', `/api/training/skills/${id}/activate`, body ?? {});
  }

  deprecateSkill(id: string, body?: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', `/api/training/skills/${id}/deprecate`, body ?? {});
  }

  recordSkillUsage(id: string, body: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', `/api/training/skills/${id}/usage`, body);
  }

  // Rules
  listRules(query?: Record<string, string | undefined>): Promise<any> {
    return this.c.request('GET', '/api/training/rules', undefined, query as any);
  }

  getRule(id: string): Promise<any> {
    return this.c.request('GET', `/api/training/rules/${id}`);
  }

  createRule(body: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', '/api/training/rules', body);
  }

  updateRule(id: string, body: Record<string, unknown>): Promise<any> {
    return this.c.request('PATCH', `/api/training/rules/${id}`, body);
  }

  deprecateRule(id: string, body?: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', `/api/training/rules/${id}/deprecate`, body ?? {});
  }

  recordRuleViolation(id: string, body: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', `/api/training/rules/${id}/violation`, body);
  }

  checkRules(body: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', '/api/training/rules/check', body);
  }

  // Context
  getContext(moduleId: string, query?: Record<string, string | undefined>): Promise<any> {
    return this.c.request('GET', `/api/training/context/${moduleId}`, undefined, query as any);
  }

  buildContext(body: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', '/api/training/context/build', body);
  }

  // Feedback
  createFeedback(body: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', '/api/training/feedback', body);
  }

  getFeedback(entityType: string, entityId: string): Promise<any> {
    return this.c.request('GET', `/api/training/feedback/${entityType}/${entityId}`);
  }
}

class ImpactApi {
  constructor(private c: SidStackApiClient) {}

  analyze(body: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', '/api/impact/analyze', body);
  }

  get(id: string): Promise<any> {
    return this.c.request('GET', `/api/impact/${id}`);
  }

  getByTask(taskId: string): Promise<any> {
    return this.c.request('GET', `/api/impact/by-task/${taskId}`);
  }

  getBySpec(specId: string): Promise<any> {
    return this.c.request('GET', `/api/impact/by-spec/${specId}`);
  }

  list(projectId: string): Promise<any> {
    return this.c.request('GET', `/api/impact/list/${projectId}`);
  }

  getValidations(id: string): Promise<any> {
    return this.c.request('GET', `/api/impact/${id}/validations`);
  }

  runValidation(id: string, validationId: string, body?: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', `/api/impact/${id}/validations/${validationId}/run`, body ?? {});
  }

  updateValidation(id: string, validationId: string, body: Record<string, unknown>): Promise<any> {
    return this.c.request('PUT', `/api/impact/${id}/validations/${validationId}`, body);
  }

  getGate(id: string): Promise<any> {
    return this.c.request('GET', `/api/impact/${id}/gate`);
  }

  approveGate(id: string, body?: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', `/api/impact/${id}/gate/approve`, body ?? {});
  }

  resolveGate(id: string, body?: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', `/api/impact/${id}/gate/resolve`, body ?? {});
  }
}

class ContextApi {
  constructor(private c: SidStackApiClient) {}

  // Spec links
  linkSpec(body: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', '/api/context/links/spec', body);
  }

  unlinkSpec(id: string): Promise<any> {
    return this.c.request('DELETE', `/api/context/links/spec/${id}`);
  }

  getTaskSpecs(taskId: string): Promise<any> {
    return this.c.request('GET', `/api/context/task/${taskId}/specs`);
  }

  // Knowledge links
  linkKnowledge(body: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', '/api/context/links/knowledge', body);
  }

  unlinkKnowledge(id: string): Promise<any> {
    return this.c.request('DELETE', `/api/context/links/knowledge/${id}`);
  }

  getTaskKnowledge(taskId: string): Promise<any> {
    return this.c.request('GET', `/api/context/task/${taskId}/knowledge`);
  }

  // Entity context
  getEntityContext(entityType: string, entityId: string, query?: Record<string, string | number | boolean | undefined>): Promise<any> {
    return this.c.request('GET', `/api/context/entity/${entityType}/${entityId}`, undefined, query);
  }

  // Task context
  getStartContext(taskId: string, query?: Record<string, string | number | boolean | undefined>): Promise<any> {
    return this.c.request('GET', `/api/context/task/${taskId}/start-context`, undefined, query);
  }

  completeContext(taskId: string, body: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', `/api/context/task/${taskId}/complete-context`, body);
  }

  getTaskContext(taskId: string): Promise<any> {
    return this.c.request('GET', `/api/context/task/${taskId}`);
  }

  // Suggestions
  dismissSuggestion(body: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', '/api/context/suggestions/dismiss', body);
  }

  getDismissedSuggestions(query?: Record<string, string | undefined>): Promise<any> {
    return this.c.request('GET', '/api/context/suggestions/dismissed', undefined, query as any);
  }
}

class ReferencesApi {
  constructor(private c: SidStackApiClient) {}

  create(body: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', '/api/references', body);
  }

  createBulk(body: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', '/api/references/bulk', body);
  }

  deleteByLink(query: Record<string, string>): Promise<any> {
    // DELETE with query params (the route uses query-based deletion)
    return this.c.request('DELETE', '/api/references', undefined, query);
  }

  deleteById(id: string): Promise<any> {
    return this.c.request('DELETE', `/api/references/${id}`);
  }

  query(query: Record<string, string | undefined>): Promise<any> {
    return this.c.request('GET', '/api/references', undefined, query as any);
  }

  getRelated(entityType: string, entityId: string, query?: Record<string, string | number | boolean | undefined>): Promise<any> {
    return this.c.request('GET', `/api/references/related/${entityType}/${entityId}`, undefined, query);
  }

  get(id: string): Promise<any> {
    return this.c.request('GET', `/api/references/${id}`);
  }
}

class TraceabilityApi {
  constructor(private c: SidStackApiClient) {}

  getMatrix(query?: Record<string, string | undefined>): Promise<any> {
    return this.c.request('GET', '/api/traceability/matrix', undefined, query as any);
  }
}

class ProjectsApi {
  constructor(private c: SidStackApiClient) {}

  list(query?: Record<string, string | undefined>): Promise<any> {
    return this.c.request('GET', '/api/projects', undefined, query as any);
  }

  get(id: string): Promise<any> {
    return this.c.request('GET', `/api/projects/${id}`);
  }

  create(body: Record<string, unknown>): Promise<any> {
    return this.c.request('POST', '/api/projects', body);
  }

  update(id: string, body: Record<string, unknown>): Promise<any> {
    return this.c.request('PATCH', `/api/projects/${id}`, body);
  }

  delete(id: string): Promise<any> {
    return this.c.request('DELETE', `/api/projects/${id}`);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createApiClient(options?: ApiClientOptions): SidStackApiClient {
  return new SidStackApiClient(options);
}
