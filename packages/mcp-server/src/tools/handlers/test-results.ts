/**
 * Test Result MCP Tool Handlers
 *
 * File-based storage for E2E test results in .sidstack/test-results/
 * Entity references created via API client.
 *
 * Tools:
 * - test_result_create: Persist E2E test report
 * - test_result_list: List results with filters
 * - test_result_get: Get single result by ID
 */

import {
  detectWorkspace,
  createTestResult,
  getTestResult,
  listTestResults,
  createApiClient,
} from '@sidstack/shared';
import { validateProjectPath } from './validate-path.js';

const apiClient = createApiClient();

/**
 * Resolve workspace path from projectPath (handles worktrees)
 */
function resolveWorkspacePath(projectPath: string): string {
  const workspace = detectWorkspace(projectPath);
  if (workspace) {
    return workspace.workspaceRoot;
  }
  return projectPath;
}

// =============================================================================
// Tool Definitions
// =============================================================================

export const testResultTools = [
  {
    name: 'test_result_create',
    description:
      'Persist an E2E test result as a JSON file in .sidstack/test-results/. Call after completing E2E testing.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Project path (REQUIRED)',
        },
        projectId: {
          type: 'string',
          description: 'Project identifier',
        },
        taskId: {
          type: 'string',
          description: 'Task ID being tested (optional)',
        },
        featureName: {
          type: 'string',
          description: 'Name of the feature tested',
        },
        verdict: {
          type: 'string',
          enum: ['pass', 'fail', 'partial'],
          description: 'Overall verdict',
        },
        totalScenarios: {
          type: 'number',
          description: 'Total number of test scenarios',
        },
        passed: {
          type: 'number',
          description: 'Number of passed scenarios',
        },
        failed: {
          type: 'number',
          description: 'Number of failed scenarios',
        },
        testPlan: {
          type: 'array',
          items: { type: 'object' },
          description: 'Test plan scenarios',
        },
        results: {
          type: 'array',
          items: { type: 'object' },
          description: 'Test execution results',
        },
        impactTesting: {
          type: 'array',
          items: { type: 'object' },
          description: 'Impact/regression test results (optional)',
        },
        failingScenarios: {
          type: 'array',
          items: { type: 'object' },
          description: 'Details of failing scenarios (optional)',
        },
        testerAgent: {
          type: 'string',
          description: 'Name/role of the tester agent (optional)',
        },
        specId: {
          type: 'string',
          description: 'Spec/knowledge doc ID to link for traceability (optional)',
        },
      },
      required: [
        'projectPath',
        'projectId',
        'featureName',
        'verdict',
        'totalScenarios',
        'passed',
        'failed',
        'testPlan',
        'results',
      ],
    },
  },
  {
    name: 'test_result_list',
    description:
      'List E2E test results from .sidstack/test-results/. Supports filtering by project, task, and verdict.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Project path (REQUIRED)',
        },
        projectId: {
          type: 'string',
          description: 'Filter by project ID',
        },
        taskId: {
          type: 'string',
          description: 'Filter by task ID',
        },
        verdict: {
          type: 'string',
          enum: ['pass', 'fail', 'partial'],
          description: 'Filter by verdict',
        },
      },
      required: ['projectPath'],
    },
  },
  {
    name: 'test_result_get',
    description: 'Get a single E2E test result by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Project path (REQUIRED)',
        },
        id: {
          type: 'string',
          description: 'Test result ID (e.g. 2026-02-08-knowledge-browser)',
        },
      },
      required: ['projectPath', 'id'],
    },
  },
];

// =============================================================================
// Handlers
// =============================================================================

export async function handleTestResultCreate(args: {
  projectPath: string;
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
}): Promise<Record<string, unknown>> {
  validateProjectPath(args.projectPath);
  const workspacePath = resolveWorkspacePath(args.projectPath);

  const result = createTestResult(workspacePath, {
    projectId: args.projectId,
    taskId: args.taskId,
    specId: args.specId,
    featureName: args.featureName,
    verdict: args.verdict,
    totalScenarios: args.totalScenarios,
    passed: args.passed,
    failed: args.failed,
    testPlan: args.testPlan,
    results: args.results,
    impactTesting: args.impactTesting,
    failingScenarios: args.failingScenarios,
    testerAgent: args.testerAgent,
  });

  // Auto-create entity references for traceability (best-effort via API)
  const linkedRefs: string[] = [];
  try {
    if (args.taskId) {
      await apiClient.references.create({
        sourceType: 'test_result',
        sourceId: result.id,
        targetType: 'task',
        targetId: args.taskId,
        relationship: 'validates',
        createdBy: 'system',
      });
      linkedRefs.push(`test_result:${result.id} --[validates]--> task:${args.taskId}`);
    }

    if (args.specId) {
      await apiClient.references.create({
        sourceType: 'test_result',
        sourceId: result.id,
        targetType: 'knowledge',
        targetId: args.specId,
        relationship: 'validates',
        createdBy: 'system',
      });
      linkedRefs.push(`test_result:${result.id} --[validates]--> knowledge:${args.specId}`);
    }
  } catch {
    // Entity reference creation is best-effort
  }

  return {
    success: true,
    result,
    linkedRefs,
    message: `Test result saved: ${result.id}${linkedRefs.length > 0 ? ` (${linkedRefs.length} entity refs created)` : ''}`,
  };
}

export async function handleTestResultList(args: {
  projectPath: string;
  projectId?: string;
  taskId?: string;
  verdict?: 'pass' | 'fail' | 'partial';
}): Promise<Record<string, unknown>> {
  validateProjectPath(args.projectPath);
  const workspacePath = resolveWorkspacePath(args.projectPath);

  const results = listTestResults(workspacePath, {
    projectId: args.projectId,
    taskId: args.taskId,
    verdict: args.verdict,
  });

  return {
    success: true,
    results,
    total: results.length,
  };
}

export async function handleTestResultGet(args: {
  projectPath: string;
  id: string;
}): Promise<Record<string, unknown>> {
  validateProjectPath(args.projectPath);
  const workspacePath = resolveWorkspacePath(args.projectPath);

  const result = getTestResult(workspacePath, args.id);

  if (!result) {
    return { success: false, error: `Test result not found: ${args.id}` };
  }

  return {
    success: true,
    result,
  };
}

// =============================================================================
// Unified Handler
// =============================================================================

export async function handleTestResultTool(
  name: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  switch (name) {
    case 'test_result_create':
      return handleTestResultCreate(args as any);
    case 'test_result_list':
      return handleTestResultList(args as any);
    case 'test_result_get':
      return handleTestResultGet(args as any);
    default:
      return { success: false, error: `Unknown test result tool: ${name}` };
  }
}
