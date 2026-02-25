/**
 * Test Result Service (File-based)
 *
 * Stores E2E test results as JSON files in .sidstack/test-results/
 * Each result = one JSON file: YYYY-MM-DD-{feature-slug}.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

// =============================================================================
// Types
// =============================================================================

export interface TestResult {
  id: string;
  projectId: string;
  taskId?: string;
  specId?: string;
  featureName: string;
  verdict: 'pass' | 'fail' | 'partial';
  totalScenarios: number;
  passed: number;
  failed: number;
  passRate: number;
  testPlan: Record<string, unknown>[];
  results: Record<string, unknown>[];
  impactTesting?: Record<string, unknown>[];
  failingScenarios?: Record<string, unknown>[];
  testerAgent?: string;
  createdAt: string;
}

export interface CreateTestResultInput {
  projectId: string;
  taskId?: string;
  specId?: string;
  featureName: string;
  verdict: 'pass' | 'fail' | 'partial';
  totalScenarios: number;
  passed: number;
  failed: number;
  testPlan: Record<string, unknown>[];
  results: Record<string, unknown>[];
  impactTesting?: Record<string, unknown>[];
  failingScenarios?: Record<string, unknown>[];
  testerAgent?: string;
}

export interface ListTestResultsFilters {
  projectId?: string;
  taskId?: string;
  verdict?: 'pass' | 'fail' | 'partial';
}

// =============================================================================
// Helpers
// =============================================================================

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

function getTestResultsDir(projectPath: string): string {
  return path.join(projectPath, '.sidstack', 'test-results');
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// =============================================================================
// CRUD Functions
// =============================================================================

export function createTestResult(
  projectPath: string,
  input: CreateTestResultInput
): TestResult {
  const dir = getTestResultsDir(projectPath);
  ensureDir(dir);

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const slug = slugify(input.featureName);
  const id = `${dateStr}-${slug}`;

  const passRate =
    input.totalScenarios > 0
      ? Math.round((input.passed / input.totalScenarios) * 100)
      : 0;

  const result: TestResult = {
    id,
    projectId: input.projectId,
    taskId: input.taskId,
    specId: input.specId,
    featureName: input.featureName,
    verdict: input.verdict,
    totalScenarios: input.totalScenarios,
    passed: input.passed,
    failed: input.failed,
    passRate,
    testPlan: input.testPlan,
    results: input.results,
    impactTesting: input.impactTesting,
    failingScenarios: input.failingScenarios,
    testerAgent: input.testerAgent,
    createdAt: now.toISOString(),
  };

  const filePath = path.join(dir, `${id}.json`);

  // If file already exists, append a short unique suffix
  if (fs.existsSync(filePath)) {
    const suffix = randomUUID().substring(0, 6);
    result.id = `${id}-${suffix}`;
    const altPath = path.join(dir, `${result.id}.json`);
    fs.writeFileSync(altPath, JSON.stringify(result, null, 2), 'utf-8');
  } else {
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8');
  }

  return result;
}

export function getTestResult(
  projectPath: string,
  id: string
): TestResult | null {
  const dir = getTestResultsDir(projectPath);
  const filePath = path.join(dir, `${id}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as TestResult;
}

export function listTestResults(
  projectPath: string,
  filters?: ListTestResultsFilters
): TestResult[] {
  const dir = getTestResultsDir(projectPath);

  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse(); // newest first

  const results: TestResult[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      const result = JSON.parse(content) as TestResult;

      if (filters?.projectId && result.projectId !== filters.projectId) continue;
      if (filters?.taskId && result.taskId !== filters.taskId) continue;
      if (filters?.verdict && result.verdict !== filters.verdict) continue;

      results.push(result);
    } catch {
      // Skip malformed files
    }
  }

  return results;
}
