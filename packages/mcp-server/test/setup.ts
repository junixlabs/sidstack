/**
 * Test Setup - Mock @sidstack/shared database layer
 *
 * All handlers use a lazy-loaded getDB() singleton from @sidstack/shared.
 * We mock this at the module level so handlers receive a mock DB.
 */
import { vi } from 'vitest';

// Mock database methods - returns empty/default values
export const mockDB = {
  // Tickets
  getTicketByExternalId: vi.fn().mockReturnValue(null),
  getProject: vi.fn().mockReturnValue({ id: 'test-project', name: 'Test', path: '/tmp/test', status: 'active' }),
  createProject: vi.fn().mockReturnValue({ id: 'test-project', name: 'Test', path: '/tmp/test', status: 'active' }),
  createTicket: vi.fn().mockReturnValue({
    id: 'ticket-1', projectId: 'test-project', title: 'Test Ticket',
    description: '', type: 'task', priority: 'medium', status: 'new',
    source: 'api', labels: '[]', attachments: '[]', linkedIssues: '[]',
    externalUrls: '[]', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }),
  listTickets: vi.fn().mockReturnValue([]),
  countTickets: vi.fn().mockReturnValue(0),
  getTicket: vi.fn().mockReturnValue(null),
  updateTicket: vi.fn().mockReturnValue(undefined),

  // Tasks
  getTask: vi.fn().mockReturnValue(null),
  updateTask: vi.fn().mockReturnValue(undefined),
  createTask: vi.fn().mockReturnValue({ id: 'task-1', title: 'Test Task' }),

  // Sessions
  createClaudeSession: vi.fn().mockReturnValue({ id: 'session-1' }),
  logSessionEvent: vi.fn().mockReturnValue(undefined),

  // Training Room
  getOrCreateTrainingSession: vi.fn().mockReturnValue({
    id: 'ts-1', projectPath: '/tmp/test', moduleId: 'test-module',
    status: 'active', createdAt: new Date().toISOString(),
  }),
  createIncident: vi.fn().mockReturnValue({
    id: 'inc-1', title: 'Test Incident', type: 'bug_fix', severity: 'medium',
    status: 'open', projectPath: '/tmp/test', createdAt: new Date().toISOString(),
  }),
  updateIncident: vi.fn().mockReturnValue(undefined),
  listIncidents: vi.fn().mockReturnValue([]),
  getIncident: vi.fn().mockReturnValue(null),
  createLesson: vi.fn().mockReturnValue({
    id: 'lesson-1', title: 'Test Lesson', status: 'draft',
    projectPath: '/tmp/test', createdAt: new Date().toISOString(),
  }),
  approveLesson: vi.fn().mockReturnValue(undefined),
  getLesson: vi.fn().mockReturnValue(null),
  listLessons: vi.fn().mockReturnValue([]),
  getSkillByName: vi.fn().mockReturnValue(null),
  createSkill: vi.fn().mockReturnValue({
    id: 'skill-1', name: 'test-skill', type: 'checklist', status: 'active',
    projectPath: '/tmp/test', createdAt: new Date().toISOString(),
  }),
  updateSkill: vi.fn().mockReturnValue(undefined),
  getSkill: vi.fn().mockReturnValue(null),
  listSkills: vi.fn().mockReturnValue([]),
  getRuleByName: vi.fn().mockReturnValue(null),
  createRule: vi.fn().mockReturnValue({
    id: 'rule-1', name: 'test-rule', level: 'should', enforcement: 'manual',
    status: 'active', projectPath: '/tmp/test', createdAt: new Date().toISOString(),
  }),
  updateRule: vi.fn().mockReturnValue(undefined),
  getRule: vi.fn().mockReturnValue(null),
  listRules: vi.fn().mockReturnValue([]),
  getTrainingContext: vi.fn().mockReturnValue({ rules: [], skills: [], recentLessons: [] }),
  listTrainingSessions: vi.fn().mockReturnValue([]),
  incrementSkillUsage: vi.fn().mockReturnValue(undefined),
  createTrainingFeedback: vi.fn().mockReturnValue({
    id: 'fb-1', createdAt: new Date().toISOString(),
  }),
  getTrainingSessionByModule: vi.fn().mockReturnValue(null),

  // Entity References
  createEntityReference: vi.fn().mockReturnValue({
    id: 'ref-1', sourceType: 'task', sourceId: 'task-1',
    targetType: 'session', targetId: 'session-1',
    relationship: 'creates', createdAt: new Date().toISOString(),
  }),
  deleteEntityReferenceByLink: vi.fn().mockReturnValue(true),
  getRelatedEntities: vi.fn().mockReturnValue({ forward: [], reverse: [] }),
  queryEntityReferences: vi.fn().mockReturnValue([]),
  countEntityReferences: vi.fn().mockReturnValue(0),
};

// Mock @sidstack/shared - getDB returns our mock
vi.mock('@sidstack/shared', async () => {
  const actual = await vi.importActual('@sidstack/shared') as Record<string, unknown>;
  return {
    ...actual,
    getDB: vi.fn().mockResolvedValue(mockDB),
  };
});
