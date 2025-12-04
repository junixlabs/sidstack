/**
 * Session Context Builder Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  buildSessionContext,
  hasContextEntities,
  getContextSummary,
  type ContextBuilderOptions,
  type ModuleKnowledge,
  type SpecContent,
} from './session-context-builder';
import type { Task, Ticket } from './database';

describe('Session Context Builder', () => {
  // ============================================================================
  // Mock Data Factories
  // ============================================================================

  const createMockTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'task-123',
    projectId: 'project-1',
    title: 'Fix authentication bug',
    description: 'Users are unable to login after password reset',
    status: 'in_progress',
    priority: 'high',
    taskType: 'bugfix',
    progress: 50,
    assignedAgent: 'dev-1',
    createdBy: 'user',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
    notes: 'Check the password hash comparison logic',
    parentTaskId: undefined,
    moduleId: 'auth-module',
    governance: JSON.stringify({
      principles: ['security', 'code-quality'],
      skills: ['dev/implement-feature'],
    }),
    acceptanceCriteria: JSON.stringify([
      { description: 'Users can login after reset', completed: false },
      { description: 'Password validation works correctly', completed: true },
    ]),
    validation: undefined,
    context: undefined,
    ...overrides,
  });

  const createMockTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
    id: 'ticket-456',
    projectId: 'project-1',
    externalId: 'JIRA-123',
    source: 'jira',
    title: 'Login page not working on Safari',
    description: 'Safari users report blank login page',
    type: 'bug',
    priority: 'high',
    status: 'reviewing',
    reporter: 'john@example.com',
    assignee: undefined,
    labels: JSON.stringify(['safari', 'login', 'urgent']),
    attachments: '[]',
    linkedIssues: JSON.stringify([
      { type: 'blocks', id: 'JIRA-124', title: 'Payment flow broken' },
    ]),
    externalUrls: JSON.stringify(['https://jira.example.com/JIRA-123']),
    taskId: undefined,
    sessionId: undefined,
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now(),
    ...overrides,
  });

  const createMockModuleKnowledge = (overrides: Partial<ModuleKnowledge> = {}): ModuleKnowledge => ({
    moduleId: 'auth-module',
    name: 'Authentication Module',
    description: 'Handles user authentication and authorization',
    dependencies: ['database', 'crypto', 'session'],
    files: [
      'src/auth/login.ts',
      'src/auth/logout.ts',
      'src/auth/password-reset.ts',
      'src/auth/session.ts',
    ],
    docs: [
      {
        title: 'OAuth Flow',
        path: 'docs/auth/oauth.md',
        content: '# OAuth Integration\n\nThis module supports OAuth 2.0...',
        type: 'api',
      },
    ],
    ...overrides,
  });

  const createMockSpecContent = (overrides: Partial<SpecContent> = {}): SpecContent => ({
    specId: 'spec-789',
    title: 'User Authentication Redesign',
    content: '# Spec: Auth Redesign\n\n## Goals\n- Improve security\n- Add 2FA support',
    status: 'approved',
    impactAnalysis: {
      scope: ['auth-module', 'user-module'],
      risks: [
        { severity: 'high', description: 'Breaking change for existing sessions' },
        { severity: 'medium', description: 'Requires database migration' },
      ],
    },
    ...overrides,
  });

  // ============================================================================
  // buildSessionContext Tests
  // ============================================================================

  describe('buildSessionContext', () => {
    it('should build context with only workspace path', async () => {
      const options: ContextBuilderOptions = {
        workspacePath: '/path/to/project',
      };

      const result = await buildSessionContext(options);

      expect(result.prompt).toContain('# Session Context');
      expect(result.prompt).toContain('/path/to/project');
      expect(result.metadata.entities).toEqual([]);
      expect(result.metadata.generatedAt).toBeDefined();
    });

    it('should include task context when taskId provided', async () => {
      const mockTask = createMockTask();
      const options: ContextBuilderOptions = {
        workspacePath: '/path/to/project',
        taskId: 'task-123',
        getTask: async () => mockTask,
      };

      const result = await buildSessionContext(options);

      expect(result.prompt).toContain('## Task: Fix authentication bug');
      expect(result.prompt).toContain('**ID:** task-123');
      expect(result.prompt).toContain('**Status:** in_progress');
      expect(result.prompt).toContain('**Priority:** high');
      expect(result.prompt).toContain('Users are unable to login');
      expect(result.metadata.entities).toContain('task');
      expect(result.metadata.taskId).toBe('task-123');
    });

    it('should include acceptance criteria when present', async () => {
      const mockTask = createMockTask();
      const options: ContextBuilderOptions = {
        workspacePath: '/path/to/project',
        taskId: 'task-123',
        getTask: async () => mockTask,
      };

      const result = await buildSessionContext(options);

      expect(result.prompt).toContain('### Acceptance Criteria');
      expect(result.prompt).toContain('Users can login after reset');
      expect(result.prompt).toContain('[x]'); // completed criterion
      expect(result.prompt).toContain('[ ]'); // incomplete criterion
    });

    it('should include governance info when present', async () => {
      const mockTask = createMockTask();
      const options: ContextBuilderOptions = {
        workspacePath: '/path/to/project',
        taskId: 'task-123',
        getTask: async () => mockTask,
      };

      const result = await buildSessionContext(options);

      expect(result.prompt).toContain('### Governance');
      expect(result.prompt).toContain('security, code-quality');
      expect(result.prompt).toContain('dev/implement-feature');
    });

    it('should include notes when present', async () => {
      const mockTask = createMockTask();
      const options: ContextBuilderOptions = {
        workspacePath: '/path/to/project',
        taskId: 'task-123',
        getTask: async () => mockTask,
      };

      const result = await buildSessionContext(options);

      expect(result.prompt).toContain('### Notes');
      expect(result.prompt).toContain('Check the password hash comparison logic');
    });

    it('should include ticket context when ticketId provided', async () => {
      const mockTicket = createMockTicket();
      const options: ContextBuilderOptions = {
        workspacePath: '/path/to/project',
        ticketId: 'ticket-456',
        getTicket: async () => mockTicket,
      };

      const result = await buildSessionContext(options);

      expect(result.prompt).toContain('## Ticket: Login page not working on Safari');
      expect(result.prompt).toContain('**External ID:** JIRA-123 (jira)');
      expect(result.prompt).toContain('**Type:** bug');
      expect(result.prompt).toContain('**Priority:** high');
      expect(result.prompt).toContain('**Labels:** safari, login, urgent');
      expect(result.metadata.entities).toContain('ticket');
      expect(result.metadata.ticketId).toBe('ticket-456');
    });

    it('should include ticket linked issues and external URLs', async () => {
      const mockTicket = createMockTicket();
      const options: ContextBuilderOptions = {
        workspacePath: '/path/to/project',
        ticketId: 'ticket-456',
        getTicket: async () => mockTicket,
      };

      const result = await buildSessionContext(options);

      expect(result.prompt).toContain('### External References');
      expect(result.prompt).toContain('https://jira.example.com/JIRA-123');
      expect(result.prompt).toContain('### Linked Issues');
      expect(result.prompt).toContain('[blocks] JIRA-124');
    });

    it('should include module context when moduleId provided', async () => {
      const mockModule = createMockModuleKnowledge();
      const options: ContextBuilderOptions = {
        workspacePath: '/path/to/project',
        moduleId: 'auth-module',
        getModuleKnowledge: async () => mockModule,
      };

      const result = await buildSessionContext(options);

      expect(result.prompt).toContain('## Module: Authentication Module');
      expect(result.prompt).toContain('**ID:** auth-module');
      expect(result.prompt).toContain('Handles user authentication');
      expect(result.prompt).toContain('### Dependencies');
      expect(result.prompt).toContain('database');
      expect(result.prompt).toContain('### Key Files');
      expect(result.prompt).toContain('src/auth/login.ts');
      expect(result.metadata.entities).toContain('module');
      expect(result.metadata.moduleId).toBe('auth-module');
    });

    it('should include module documentation', async () => {
      const mockModule = createMockModuleKnowledge();
      const options: ContextBuilderOptions = {
        workspacePath: '/path/to/project',
        moduleId: 'auth-module',
        getModuleKnowledge: async () => mockModule,
      };

      const result = await buildSessionContext(options);

      expect(result.prompt).toContain('### Documentation');
      expect(result.prompt).toContain('#### OAuth Flow (api)');
      expect(result.prompt).toContain('OAuth Integration');
    });

    it('should truncate long module docs', async () => {
      const longContent = 'A'.repeat(3000);
      const mockModule = createMockModuleKnowledge({
        docs: [{ title: 'Long Doc', path: 'doc.md', content: longContent, type: 'general' }],
      });
      const options: ContextBuilderOptions = {
        workspacePath: '/path/to/project',
        moduleId: 'auth-module',
        getModuleKnowledge: async () => mockModule,
      };

      const result = await buildSessionContext(options);

      expect(result.prompt).toContain('...[truncated]');
      expect(result.prompt.length).toBeLessThan(longContent.length);
    });

    it('should show file count when more than 10 files', async () => {
      const mockModule = createMockModuleKnowledge({
        files: Array.from({ length: 15 }, (_, i) => `src/file${i}.ts`),
      });
      const options: ContextBuilderOptions = {
        workspacePath: '/path/to/project',
        moduleId: 'auth-module',
        getModuleKnowledge: async () => mockModule,
      };

      const result = await buildSessionContext(options);

      expect(result.prompt).toContain('... and 5 more files');
    });

    it('should include spec context when specId provided', async () => {
      const mockSpec = createMockSpecContent();
      const options: ContextBuilderOptions = {
        workspacePath: '/path/to/project',
        specId: 'spec-789',
        getSpecContent: async () => mockSpec,
      };

      const result = await buildSessionContext(options);

      expect(result.prompt).toContain('## Spec: User Authentication Redesign');
      expect(result.prompt).toContain('**ID:** spec-789');
      expect(result.prompt).toContain('**Status:** approved');
      expect(result.prompt).toContain('### Content');
      expect(result.prompt).toContain('Improve security');
      expect(result.metadata.entities).toContain('spec');
      expect(result.metadata.specId).toBe('spec-789');
    });

    it('should include spec impact analysis', async () => {
      const mockSpec = createMockSpecContent();
      const options: ContextBuilderOptions = {
        workspacePath: '/path/to/project',
        specId: 'spec-789',
        getSpecContent: async () => mockSpec,
      };

      const result = await buildSessionContext(options);

      expect(result.prompt).toContain('### Impact Analysis');
      expect(result.prompt).toContain('**Scope:** auth-module, user-module');
      expect(result.prompt).toContain('**Risks:**');
      expect(result.prompt).toContain('[HIGH] Breaking change for existing sessions');
      expect(result.prompt).toContain('[MEDIUM] Requires database migration');
    });

    it('should combine multiple contexts with separators', async () => {
      const mockTask = createMockTask();
      const mockTicket = createMockTicket();
      const options: ContextBuilderOptions = {
        workspacePath: '/path/to/project',
        taskId: 'task-123',
        ticketId: 'ticket-456',
        getTask: async () => mockTask,
        getTicket: async () => mockTicket,
      };

      const result = await buildSessionContext(options);

      expect(result.prompt).toContain('## Task: Fix authentication bug');
      expect(result.prompt).toContain('---');
      expect(result.prompt).toContain('## Ticket: Login page not working on Safari');
      expect(result.metadata.entities).toContain('task');
      expect(result.metadata.entities).toContain('ticket');
    });

    it('should handle null entity gracefully', async () => {
      const options: ContextBuilderOptions = {
        workspacePath: '/path/to/project',
        taskId: 'task-123',
        getTask: async () => null,
      };

      const result = await buildSessionContext(options);

      expect(result.prompt).not.toContain('## Task:');
      expect(result.metadata.entities).toEqual([]);
    });

    it('should truncate context when exceeding maxContextLength', async () => {
      const longDescription = 'B'.repeat(10000);
      const mockTask = createMockTask({ description: longDescription });
      const options: ContextBuilderOptions = {
        workspacePath: '/path/to/project',
        taskId: 'task-123',
        getTask: async () => mockTask,
        maxContextLength: 5000,
      };

      const result = await buildSessionContext(options);

      expect(result.prompt.length).toBeLessThanOrEqual(5100); // Allow some buffer
      expect(result.prompt).toContain('...[Context truncated due to size limits]');
    });

    it('should handle malformed JSON in task fields gracefully', async () => {
      const mockTask = createMockTask({
        governance: 'not valid json',
        acceptanceCriteria: 'also not json',
      });
      const options: ContextBuilderOptions = {
        workspacePath: '/path/to/project',
        taskId: 'task-123',
        getTask: async () => mockTask,
      };

      // Should not throw
      const result = await buildSessionContext(options);

      expect(result.prompt).toContain('## Task: Fix authentication bug');
      expect(result.prompt).not.toContain('### Governance');
      expect(result.prompt).not.toContain('### Acceptance Criteria');
    });

    it('should handle malformed JSON in ticket fields gracefully', async () => {
      const mockTicket = createMockTicket({
        labels: 'not valid json',
        linkedIssues: 'also not json',
        externalUrls: '{bad}',
      });
      const options: ContextBuilderOptions = {
        workspacePath: '/path/to/project',
        ticketId: 'ticket-456',
        getTicket: async () => mockTicket,
      };

      // Should not throw
      const result = await buildSessionContext(options);

      expect(result.prompt).toContain('## Ticket: Login page not working on Safari');
      expect(result.prompt).not.toContain('**Labels:**');
    });

    it('should handle empty task fields', async () => {
      const mockTask = createMockTask({
        description: null as unknown as string,
        notes: null as unknown as string,
        governance: null as unknown as string,
        acceptanceCriteria: null as unknown as string,
      });
      const options: ContextBuilderOptions = {
        workspacePath: '/path/to/project',
        taskId: 'task-123',
        getTask: async () => mockTask,
      };

      const result = await buildSessionContext(options);

      expect(result.prompt).toContain('## Task: Fix authentication bug');
      expect(result.prompt).not.toContain('### Description');
      expect(result.prompt).not.toContain('### Notes');
    });

    it('should handle ticket without externalId', async () => {
      const mockTicket = createMockTicket({
        externalId: null as unknown as string,
      });
      const options: ContextBuilderOptions = {
        workspacePath: '/path/to/project',
        ticketId: 'ticket-456',
        getTicket: async () => mockTicket,
      };

      const result = await buildSessionContext(options);

      expect(result.prompt).not.toContain('**External ID:**');
    });
  });

  // ============================================================================
  // hasContextEntities Tests
  // ============================================================================

  describe('hasContextEntities', () => {
    it('should return false when no entities specified', () => {
      expect(hasContextEntities({})).toBe(false);
      expect(hasContextEntities({ workspacePath: '/path' } as ContextBuilderOptions)).toBe(false);
    });

    it('should return true when taskId specified', () => {
      expect(hasContextEntities({ taskId: 'task-123' })).toBe(true);
    });

    it('should return true when moduleId specified', () => {
      expect(hasContextEntities({ moduleId: 'module-1' })).toBe(true);
    });

    it('should return true when specId specified', () => {
      expect(hasContextEntities({ specId: 'spec-1' })).toBe(true);
    });

    it('should return true when ticketId specified', () => {
      expect(hasContextEntities({ ticketId: 'ticket-1' })).toBe(true);
    });

    it('should return true when multiple entities specified', () => {
      expect(hasContextEntities({ taskId: 'task-1', moduleId: 'module-1' })).toBe(true);
    });
  });

  // ============================================================================
  // getContextSummary Tests
  // ============================================================================

  describe('getContextSummary', () => {
    it('should return "No context" when no entities', () => {
      expect(getContextSummary({})).toBe('No context');
    });

    it('should format task summary with truncated ID', () => {
      const result = getContextSummary({ taskId: 'task-1234567890-abcdef' });
      expect(result).toBe('Task: task-1234567...');
    });

    it('should format module summary with full ID', () => {
      const result = getContextSummary({ moduleId: 'auth-module' });
      expect(result).toBe('Module: auth-module');
    });

    it('should format spec summary with truncated ID', () => {
      const result = getContextSummary({ specId: 'spec-1234567890-xyz' });
      expect(result).toBe('Spec: spec-1234567...');
    });

    it('should format ticket summary with truncated ID', () => {
      const result = getContextSummary({ ticketId: 'ticket-1234567890-abc' });
      expect(result).toBe('Ticket: ticket-12345...');
    });

    it('should join multiple entities with separator', () => {
      const result = getContextSummary({
        taskId: 'task-123',
        moduleId: 'auth',
      });
      expect(result).toBe('Task: task-123... | Module: auth');
    });

    it('should handle all four entities', () => {
      const result = getContextSummary({
        taskId: 'task-1234567890',
        moduleId: 'auth',
        specId: 'spec-1234567890',
        ticketId: 'ticket-1234567890',
      });
      expect(result).toContain('Task:');
      expect(result).toContain('Module:');
      expect(result).toContain('Spec:');
      expect(result).toContain('Ticket:');
      expect(result.split(' | ').length).toBe(4);
    });
  });
});
