/**
 * Tests for test-results service (file-based CRUD)
 */

import * as path from 'path';
import * as fs from 'fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestResult,
  getTestResult,
  listTestResults,
  type CreateTestResultInput,
} from './test-results';

const TEST_DIR = path.join(__dirname, '../../../..', '.test-results-tmp');
const SIDSTACK_DIR = path.join(TEST_DIR, '.sidstack');
const RESULTS_DIR = path.join(SIDSTACK_DIR, 'test-results');

const baseInput: CreateTestResultInput = {
  projectId: 'test-project',
  featureName: 'Knowledge Browser',
  verdict: 'pass',
  totalScenarios: 5,
  passed: 5,
  failed: 0,
  testPlan: [
    { scenario: 'Load knowledge list', priority: 'P0', expectedOutput: 'List renders' },
  ],
  results: [
    { scenario: 'Load knowledge list', priority: 'P0', result: 'PASS', actualOutput: 'List renders' },
  ],
};

describe('test-results service', () => {
  beforeAll(() => {
    // Create minimal .sidstack structure so validate isn't needed at service level
    fs.mkdirSync(SIDSTACK_DIR, { recursive: true });
  });

  afterAll(() => {
    // Cleanup
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('createTestResult', () => {
    it('creates a JSON file in .sidstack/test-results/', () => {
      const result = createTestResult(TEST_DIR, baseInput);

      expect(result.id).toMatch(/^\d{4}-\d{2}-\d{2}-knowledge-browser$/);
      expect(result.projectId).toBe('test-project');
      expect(result.featureName).toBe('Knowledge Browser');
      expect(result.verdict).toBe('pass');
      expect(result.passRate).toBe(100);
      expect(result.createdAt).toBeTruthy();

      // Verify file exists
      const filePath = path.join(RESULTS_DIR, `${result.id}.json`);
      expect(fs.existsSync(filePath)).toBe(true);

      // Verify file content
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(content.id).toBe(result.id);
      expect(content.totalScenarios).toBe(5);
    });

    it('handles duplicate IDs with suffix', () => {
      const result2 = createTestResult(TEST_DIR, baseInput);
      // Should have a UUID suffix since the first one already exists
      expect(result2.id).toMatch(/^\d{4}-\d{2}-\d{2}-knowledge-browser-[a-f0-9]{6}$/);

      const filePath = path.join(RESULTS_DIR, `${result2.id}.json`);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('calculates passRate correctly', () => {
      const result = createTestResult(TEST_DIR, {
        ...baseInput,
        featureName: 'Partial Feature',
        verdict: 'partial',
        totalScenarios: 10,
        passed: 7,
        failed: 3,
      });
      expect(result.passRate).toBe(70);
    });

    it('handles zero scenarios', () => {
      const result = createTestResult(TEST_DIR, {
        ...baseInput,
        featureName: 'Empty Feature',
        totalScenarios: 0,
        passed: 0,
        failed: 0,
      });
      expect(result.passRate).toBe(0);
    });

    it('stores optional fields', () => {
      const result = createTestResult(TEST_DIR, {
        ...baseInput,
        featureName: 'Full Feature',
        taskId: 'task-123',
        testerAgent: 'Claude (e2e)',
        impactTesting: [{ module: 'shared', changed: 'direct', regressionStatus: 'PASS' }],
        failingScenarios: [],
      });
      expect(result.taskId).toBe('task-123');
      expect(result.testerAgent).toBe('Claude (e2e)');
      expect(result.impactTesting).toHaveLength(1);
    });
  });

  describe('getTestResult', () => {
    it('returns result by ID', () => {
      const created = createTestResult(TEST_DIR, {
        ...baseInput,
        featureName: 'Get Test',
      });
      const fetched = getTestResult(TEST_DIR, created.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.featureName).toBe('Get Test');
    });

    it('returns null for non-existent ID', () => {
      const result = getTestResult(TEST_DIR, 'non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('listTestResults', () => {
    it('returns all results', () => {
      const results = listTestResults(TEST_DIR);
      expect(results.length).toBeGreaterThan(0);
    });

    it('filters by projectId', () => {
      createTestResult(TEST_DIR, {
        ...baseInput,
        projectId: 'other-project',
        featureName: 'Other Project Feature',
      });

      const filtered = listTestResults(TEST_DIR, { projectId: 'other-project' });
      expect(filtered.every((r) => r.projectId === 'other-project')).toBe(true);
      expect(filtered.length).toBeGreaterThan(0);
    });

    it('filters by verdict', () => {
      createTestResult(TEST_DIR, {
        ...baseInput,
        featureName: 'Failing Feature',
        verdict: 'fail',
        passed: 2,
        failed: 3,
      });

      const failOnly = listTestResults(TEST_DIR, { verdict: 'fail' });
      expect(failOnly.every((r) => r.verdict === 'fail')).toBe(true);
    });

    it('filters by taskId', () => {
      createTestResult(TEST_DIR, {
        ...baseInput,
        featureName: 'Task Linked',
        taskId: 'task-filter-test',
      });

      const filtered = listTestResults(TEST_DIR, { taskId: 'task-filter-test' });
      expect(filtered.every((r) => r.taskId === 'task-filter-test')).toBe(true);
      expect(filtered.length).toBe(1);
    });

    it('returns empty array for non-existent directory', () => {
      const results = listTestResults('/tmp/non-existent-path-xyz');
      expect(results).toEqual([]);
    });
  });
});
