/**
 * Test Setup - Mock @sidstack/shared API client layer
 *
 * All handlers use createApiClient() from @sidstack/shared which returns
 * a SidStackApiClient with domain namespaces (tickets, references, training, etc.).
 * We mock this at the module level so handlers receive a mock API client.
 */
import { vi } from 'vitest';

// Mock API client with all domain namespaces and methods as vi.fn()
export const mockApiClient = {
  // Tickets namespace
  tickets: {
    create: vi.fn().mockResolvedValue({
      success: true,
      ticket: {
        id: 'ticket-1', projectId: 'test-project', title: 'Test Ticket',
        description: '', type: 'task', priority: 'medium', status: 'new',
        source: 'api', labels: [], attachments: [], linkedIssues: [],
        externalUrls: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      },
    }),
    list: vi.fn().mockResolvedValue({ tickets: [], total: 0 }),
    get: vi.fn().mockResolvedValue({
      success: true,
      ticket: {
        id: 'ticket-1', title: 'Test Ticket', type: 'task', priority: 'medium',
        status: 'new', labels: [], attachments: [], linkedIssues: [], externalUrls: [],
      },
    }),
    update: vi.fn().mockResolvedValue({
      success: true,
      ticket: { id: 'ticket-1', title: 'Test Ticket', status: 'approved' },
    }),
    delete: vi.fn().mockResolvedValue({ success: true }),
    convertToTask: vi.fn().mockResolvedValue({
      success: true,
      task: { id: 'task-new', title: '[BUGFIX] Test', status: 'pending' },
      ticket: { id: 'ticket-1', taskId: 'task-new', status: 'in_progress' },
    }),
  },

  // References namespace
  references: {
    create: vi.fn().mockResolvedValue({
      success: true,
      reference: {
        id: 'ref-1', sourceType: 'task', sourceId: 'task-1',
        targetType: 'session', targetId: 'session-1',
        relationship: 'creates', createdAt: new Date().toISOString(),
      },
    }),
    deleteByLink: vi.fn().mockResolvedValue({ success: true }),
    query: vi.fn().mockResolvedValue({ references: [], total: 0 }),
    getRelated: vi.fn().mockResolvedValue({ references: [], total: 0 }),
    get: vi.fn().mockResolvedValue(null),
    deleteById: vi.fn().mockResolvedValue({ success: true }),
    createBulk: vi.fn().mockResolvedValue({ success: true }),
  },

  // Training namespace
  training: {
    createSession: vi.fn().mockResolvedValue({
      session: {
        id: 'ts-1', projectPath: '/tmp/test', moduleId: 'test-module',
        status: 'active', createdAt: new Date().toISOString(),
      },
    }),
    listSessions: vi.fn().mockResolvedValue({ sessions: [], total: 0 }),
    getSession: vi.fn().mockResolvedValue({ session: null }),
    createIncident: vi.fn().mockResolvedValue({
      incident: {
        id: 'inc-1', title: 'Test Incident', type: 'bug_fix', severity: 'medium',
        status: 'open', createdAt: new Date().toISOString(),
      },
    }),
    updateIncident: vi.fn().mockResolvedValue({
      incident: { id: 'inc-1', status: 'analyzed' },
    }),
    listIncidents: vi.fn().mockResolvedValue({ incidents: [], total: 0 }),
    getIncident: vi.fn().mockResolvedValue({ incident: null }),
    deleteIncident: vi.fn().mockResolvedValue({ success: true }),
    createLesson: vi.fn().mockResolvedValue({
      lesson: {
        id: 'lesson-1', title: 'Test Lesson', status: 'draft',
        problem: 'problem', rootCause: 'cause', solution: 'solution',
        createdAt: new Date().toISOString(),
      },
    }),
    approveLesson: vi.fn().mockResolvedValue({
      lesson: { id: 'lesson-1', title: 'Test Lesson', status: 'approved' },
    }),
    listLessons: vi.fn().mockResolvedValue({ lessons: [], total: 0 }),
    getLesson: vi.fn().mockResolvedValue({ lesson: null }),
    updateLesson: vi.fn().mockResolvedValue({ lesson: null }),
    createSkill: vi.fn().mockResolvedValue({
      skill: {
        id: 'skill-1', name: 'test-skill', type: 'checklist', status: 'active',
        content: 'test content', createdAt: new Date().toISOString(),
      },
    }),
    updateSkill: vi.fn().mockResolvedValue({
      skill: { id: 'skill-1', name: 'test-skill' },
    }),
    listSkills: vi.fn().mockResolvedValue({ skills: [], total: 0 }),
    getSkill: vi.fn().mockResolvedValue({ skill: null }),
    activateSkill: vi.fn().mockResolvedValue({ skill: null }),
    deprecateSkill: vi.fn().mockResolvedValue({ skill: null }),
    recordSkillUsage: vi.fn().mockResolvedValue({ success: true }),
    createRule: vi.fn().mockResolvedValue({
      rule: {
        id: 'rule-1', name: 'test-rule', level: 'should', enforcement: 'manual',
        status: 'active', content: 'test content', createdAt: new Date().toISOString(),
      },
    }),
    updateRule: vi.fn().mockResolvedValue({
      rule: { id: 'rule-1', name: 'test-rule' },
    }),
    listRules: vi.fn().mockResolvedValue({ rules: [], total: 0 }),
    getRule: vi.fn().mockResolvedValue({ rule: null }),
    deprecateRule: vi.fn().mockResolvedValue({ rule: null }),
    recordRuleViolation: vi.fn().mockResolvedValue({ success: true }),
    checkRules: vi.fn().mockResolvedValue({ rules: [], total: 0 }),
    getContext: vi.fn().mockResolvedValue({
      context: { skills: [], rules: [], recentLessons: [] },
    }),
    buildContext: vi.fn().mockResolvedValue({ context: null }),
    createFeedback: vi.fn().mockResolvedValue({
      feedback: { id: 'fb-1', createdAt: new Date().toISOString() },
    }),
    getFeedback: vi.fn().mockResolvedValue({ feedback: null }),
  },

  // Tasks namespace (for completeness)
  tasks: {
    list: vi.fn().mockResolvedValue({ tasks: [], total: 0 }),
    get: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ task: { id: 'task-1', title: 'Test Task' } }),
    update: vi.fn().mockResolvedValue({ task: null }),
    breakdown: vi.fn().mockResolvedValue({ success: true }),
    getProgress: vi.fn().mockResolvedValue({ progress: null }),
    getGovernance: vi.fn().mockResolvedValue({ governance: null }),
    check: vi.fn().mockResolvedValue({ success: true }),
    complete: vi.fn().mockResolvedValue({ success: true }),
  },

  // Knowledge namespace (for completeness)
  knowledge: {
    list: vi.fn().mockResolvedValue({ docs: [], total: 0 }),
    get: vi.fn().mockResolvedValue(null),
    search: vi.fn().mockResolvedValue({ results: [] }),
    create: vi.fn().mockResolvedValue({ doc: null }),
    update: vi.fn().mockResolvedValue({ doc: null }),
    delete: vi.fn().mockResolvedValue({ success: true }),
    stats: vi.fn().mockResolvedValue({ stats: {} }),
    tree: vi.fn().mockResolvedValue({ tree: [] }),
    context: vi.fn().mockResolvedValue({ context: null }),
    types: vi.fn().mockResolvedValue({ types: [] }),
    modules: vi.fn().mockResolvedValue({ modules: [] }),
    health: vi.fn().mockResolvedValue({ healthy: true }),
    invalidateCache: vi.fn().mockResolvedValue({ success: true }),
    cacheStats: vi.fn().mockResolvedValue({ stats: {} }),
  },

  // Impact namespace (for completeness)
  impact: {
    analyze: vi.fn().mockResolvedValue({ analysis: null }),
    get: vi.fn().mockResolvedValue(null),
    getByTask: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue({ analyses: [] }),
    getGate: vi.fn().mockResolvedValue({ gate: null }),
  },

  // Context namespace (for completeness)
  context: {
    getEntityContext: vi.fn().mockResolvedValue({ context: null }),
    getStartContext: vi.fn().mockResolvedValue({ context: null }),
    getTaskContext: vi.fn().mockResolvedValue({ context: null }),
  },

  // Projects namespace (for completeness)
  projects: {
    list: vi.fn().mockResolvedValue({ projects: [] }),
    get: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ project: null }),
    update: vi.fn().mockResolvedValue({ project: null }),
    delete: vi.fn().mockResolvedValue({ success: true }),
  },

  // Traceability namespace (for completeness)
  traceability: {
    getMatrix: vi.fn().mockResolvedValue({ matrix: [] }),
  },

  // Health
  health: vi.fn().mockResolvedValue({ status: 'ok' }),
};

// Helper to reset all mocks in the API client
export function resetMockApiClient() {
  function resetNested(obj: Record<string, unknown>) {
    for (const value of Object.values(obj)) {
      if (typeof value === 'function' && 'mockClear' in value) {
        (value as ReturnType<typeof vi.fn>).mockClear();
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        resetNested(value as Record<string, unknown>);
      }
    }
  }
  resetNested(mockApiClient);
}

// Mock @sidstack/shared - createApiClient returns our mock
// Also mock file-based test result functions as vi.fn() so tests can override them
vi.mock('@sidstack/shared', async () => {
  const actual = await vi.importActual('@sidstack/shared') as Record<string, unknown>;
  return {
    ...actual,
    createApiClient: vi.fn().mockReturnValue(mockApiClient),
    detectWorkspace: vi.fn().mockReturnValue(null),
    createTestResult: vi.fn(),
    getTestResult: vi.fn(),
    listTestResults: vi.fn().mockReturnValue([]),
  };
});

// Mock validateProjectPath to skip filesystem check
vi.mock('../src/tools/handlers/validate-path', () => ({
  validateProjectPath: vi.fn().mockReturnValue('/tmp/test'),
}));

// Mock memory module to prevent dynamic import issues in training-room
// Use importOriginal to preserve exports like memoryTools for tool-definitions test
vi.mock('../src/tools/handlers/memory.js', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    getMem0ClientIfAvailable: vi.fn().mockResolvedValue(null),
  };
});
