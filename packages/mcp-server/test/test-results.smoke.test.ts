/**
 * Smoke Tests - Test Result Handlers
 *
 * Validates test result MCP handler functions (create, list, get).
 * Mocks the file-based service from @sidstack/shared AND the API client
 * for entity reference creation in handleTestResultCreate.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mockApiClient, resetMockApiClient } from './setup';
import {
  handleTestResultCreate,
  handleTestResultList,
  handleTestResultGet,
  handleTestResultTool,
} from '../src/tools/handlers/test-results';

// The setup.ts already mocks:
// - createApiClient -> mockApiClient
// - validateProjectPath -> no-op
// - detectWorkspace -> null
//
// We need to additionally mock the file-based service functions.
// Since setup.ts uses vi.mock('@sidstack/shared', ...) we override those
// specific exports here by accessing the mocked module.
import { createTestResult, getTestResult, listTestResults } from '@sidstack/shared';
import { vi } from 'vitest';

const mockResult = {
  id: '2026-02-08-knowledge-browser',
  projectId: 'sidstack',
  featureName: 'Knowledge Browser',
  verdict: 'pass',
  totalScenarios: 5,
  passed: 5,
  failed: 0,
  passRate: 100,
  testPlan: [{ scenario: 'Load list', priority: 'P0' }],
  results: [{ scenario: 'Load list', result: 'PASS' }],
  createdAt: '2026-02-08T00:00:00.000Z',
};

// Override the file-based functions from the already-mocked @sidstack/shared
vi.mocked(createTestResult).mockReturnValue(mockResult as any);
vi.mocked(getTestResult).mockImplementation((_path: string, id: string) => {
  if (id === '2026-02-08-knowledge-browser') return mockResult as any;
  return null;
});
vi.mocked(listTestResults).mockReturnValue([mockResult] as any);

describe('Test Result Handlers (Smoke)', () => {
  beforeEach(() => {
    resetMockApiClient();
    vi.mocked(createTestResult).mockClear();
    vi.mocked(getTestResult).mockClear();
    vi.mocked(listTestResults).mockClear();
  });

  describe('handleTestResultCreate', () => {
    it('creates a test result', async () => {
      const result = await handleTestResultCreate({
        projectPath: '/tmp/test',
        projectId: 'sidstack',
        featureName: 'Knowledge Browser',
        verdict: 'pass',
        totalScenarios: 5,
        passed: 5,
        failed: 0,
        testPlan: [{ scenario: 'Load list', priority: 'P0' }],
        results: [{ scenario: 'Load list', result: 'PASS' }],
      });
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.message).toContain('knowledge-browser');
    });

    it('creates entity references for taskId', async () => {
      const result = await handleTestResultCreate({
        projectPath: '/tmp/test',
        projectId: 'sidstack',
        taskId: 'task-123',
        featureName: 'Task Manager',
        verdict: 'pass',
        totalScenarios: 1,
        passed: 1,
        failed: 0,
        testPlan: [],
        results: [],
      });
      expect(result.success).toBe(true);
      expect(mockApiClient.references.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'test_result',
          targetType: 'task',
          targetId: 'task-123',
          relationship: 'validates',
        }),
      );
    });

    it('creates entity references for specId', async () => {
      const result = await handleTestResultCreate({
        projectPath: '/tmp/test',
        projectId: 'sidstack',
        specId: 'spec-abc',
        featureName: 'Knowledge Browser',
        verdict: 'pass',
        totalScenarios: 1,
        passed: 1,
        failed: 0,
        testPlan: [],
        results: [],
      });
      expect(result.success).toBe(true);
      expect(mockApiClient.references.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'test_result',
          targetType: 'knowledge',
          targetId: 'spec-abc',
          relationship: 'validates',
        }),
      );
    });

    it('passes optional fields through', async () => {
      const result = await handleTestResultCreate({
        projectPath: '/tmp/test',
        projectId: 'sidstack',
        taskId: 'task-123',
        featureName: 'Task Manager',
        verdict: 'fail',
        totalScenarios: 3,
        passed: 1,
        failed: 2,
        testPlan: [],
        results: [],
        testerAgent: 'Claude (e2e)',
        impactTesting: [{ module: 'shared', status: 'PASS' }],
        failingScenarios: [{ scenario: 'Create task', reason: 'timeout' }],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('handleTestResultList', () => {
    it('lists test results', async () => {
      const result = await handleTestResultList({
        projectPath: '/tmp/test',
      });
      expect(result.success).toBe(true);
      expect(result.results).toBeInstanceOf(Array);
      expect(result.total).toBe(1);
    });

    it('passes filters through', async () => {
      const result = await handleTestResultList({
        projectPath: '/tmp/test',
        projectId: 'sidstack',
        verdict: 'pass',
        taskId: 'task-1',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('handleTestResultGet', () => {
    it('gets a result by ID', async () => {
      const result = await handleTestResultGet({
        projectPath: '/tmp/test',
        id: '2026-02-08-knowledge-browser',
      });
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
    });

    it('returns error for non-existent ID', async () => {
      const result = await handleTestResultGet({
        projectPath: '/tmp/test',
        id: 'non-existent',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('handleTestResultTool (unified router)', () => {
    it('routes test_result_create', async () => {
      const result = await handleTestResultTool('test_result_create', {
        projectPath: '/tmp/test',
        projectId: 'test',
        featureName: 'Test',
        verdict: 'pass',
        totalScenarios: 1,
        passed: 1,
        failed: 0,
        testPlan: [],
        results: [],
      });
      expect(result.success).toBe(true);
    });

    it('routes test_result_list', async () => {
      const result = await handleTestResultTool('test_result_list', {
        projectPath: '/tmp/test',
      });
      expect(result.success).toBe(true);
    });

    it('routes test_result_get', async () => {
      const result = await handleTestResultTool('test_result_get', {
        projectPath: '/tmp/test',
        id: '2026-02-08-knowledge-browser',
      });
      expect(result.success).toBe(true);
    });

    it('returns error for unknown tool', async () => {
      const result = await handleTestResultTool('test_result_unknown', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown');
    });
  });
});
