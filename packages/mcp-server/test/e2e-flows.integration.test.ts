/**
 * E2E Integration Tests — Real DB + Real File I/O
 *
 * Tests 5 flows end-to-end without mocks:
 * - U3: Ticket Queue (create → list → update → convert_to_task)
 * - U4: Knowledge Browser (list → search → modules)
 * - U5: Training Room (incident → lesson → rule_check)
 * - A5: Training Context (training_context_get)
 * - Test Results (create → list → get — file-based)
 *
 * Uses the REAL project path (this repo) so .sidstack/config.json exists.
 */

import { describe, it, expect, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

// Real handlers (no mocks)
import { handleToolCall } from '../src/tools/index';

// Project root where .sidstack/config.json exists
const PROJECT_PATH = path.resolve(__dirname, '../../..');

// Test-results dir for verification
const TEST_RESULTS_DIR = path.join(PROJECT_PATH, '.sidstack', 'test-results');

// Track created resources for cleanup
const createdTicketIds: string[] = [];
const createdTaskIds: string[] = [];
const createdIncidentIds: string[] = [];
const createdLessonIds: string[] = [];
const createdTestResultIds: string[] = [];

/**
 * Helper: call MCP tool and parse JSON response
 */
async function callTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await handleToolCall(name, args);
  const text = response.content[0]?.text;
  if (!text) return { success: false, error: 'Empty response' };
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, error: text };
  }
}

// =============================================================================
// U3: Ticket Queue Flow
// =============================================================================

describe('U3: Ticket Queue (create → list → update → convert)', () => {
  let ticketId: string;

  it('ticket_create — creates a new ticket', async () => {
    const result = await callTool('ticket_create', {
      projectId: 'sidstack',
      title: '[E2E] Test Ticket for Integration',
      description: 'Created by E2E integration test',
      type: 'task',
      priority: 'low',
      source: 'manual',
    });

    expect(result.success).toBe(true);
    const ticket = result.ticket as Record<string, unknown>;
    expect(ticket).toBeDefined();
    expect(ticket.id).toBeTruthy();
    expect(ticket.title).toContain('E2E');
    ticketId = ticket.id as string;
    createdTicketIds.push(ticketId);
  });

  it('ticket_list — lists tickets including new one', async () => {
    const result = await callTool('ticket_list', {
      projectId: 'sidstack',
    });

    expect(result.success).toBe(true);
    const tickets = result.tickets as Record<string, unknown>[];
    expect(Array.isArray(tickets)).toBe(true);
    const found = tickets.find((t) => t.id === ticketId);
    expect(found).toBeDefined();
  });

  it('ticket_update — changes status to reviewing', async () => {
    const result = await callTool('ticket_update', {
      ticketId,
      status: 'reviewing',
    });

    expect(result.success).toBe(true);
  });

  it('ticket_convert_to_task — converts ticket to task', async () => {
    // First approve the ticket
    await callTool('ticket_update', {
      ticketId,
      status: 'approved',
    });

    const result = await callTool('ticket_convert_to_task', {
      ticketId,
      projectId: 'sidstack',
    });

    expect(result.success).toBe(true);
    const task = result.task as Record<string, unknown>;
    if (task?.id) {
      createdTaskIds.push(task.id as string);
    }
  });
});

// =============================================================================
// U4: Knowledge Browser Flow
// =============================================================================

describe('U4: Knowledge Browser (list → search → modules)', () => {
  it('knowledge_list — lists knowledge documents', async () => {
    const result = await callTool('knowledge_list', {
      projectPath: PROJECT_PATH,
    });

    expect(result.success).toBe(true);
    const docs = result.documents as unknown[];
    expect(Array.isArray(docs)).toBe(true);
  });

  it('knowledge_search — searches knowledge via SidMemo', async () => {
    const result = await callTool('knowledge_search', {
      projectPath: PROJECT_PATH,
      query: 'task',
    });

    // SidMemo may not be available in CI — accept either success or SidMemo error
    if (result.success) {
      expect(result.results).toBeDefined();
    } else {
      expect(result.error).toContain('SidMemo');
    }
  });

  it('knowledge_modules — lists modules with stats', async () => {
    const result = await callTool('knowledge_modules', {
      projectPath: PROJECT_PATH,
    });

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// U5: Training Room Flow
// =============================================================================

describe('U5: Training Room (incident → lesson → skill → rule_check)', () => {
  let incidentId: string;
  let lessonId: string;

  it('incident_create — reports an incident', async () => {
    const result = await callTool('incident_create', {
      projectPath: PROJECT_PATH,
      moduleId: 'e2e-test-module',
      type: 'mistake',
      severity: 'low',
      title: '[E2E] Test incident for integration',
      description: 'Created by E2E integration test',
    });

    expect(result.success).toBe(true);
    const incident = result.incident as Record<string, unknown>;
    expect(incident).toBeDefined();
    expect(incident.id).toBeTruthy();
    incidentId = incident.id as string;
    createdIncidentIds.push(incidentId);
  });

  it('incident_list — lists incidents', async () => {
    const result = await callTool('incident_list', {
      projectPath: PROJECT_PATH,
      moduleId: 'e2e-test-module',
    });

    expect(result.success).toBe(true);
    const incidents = result.incidents as unknown[];
    expect(Array.isArray(incidents)).toBe(true);
  });

  it('lesson_create — creates lesson from incident', async () => {
    const result = await callTool('lesson_create', {
      projectPath: PROJECT_PATH,
      moduleId: 'e2e-test-module',
      incidentIds: [incidentId],
      title: '[E2E] Test lesson',
      problem: 'Test problem statement',
      rootCause: 'Test root cause',
      solution: 'Test solution approach',
    });

    expect(result.success).toBe(true);
    const lesson = result.lesson as Record<string, unknown>;
    expect(lesson).toBeDefined();
    expect(lesson.id).toBeTruthy();
    lessonId = lesson.id as string;
    createdLessonIds.push(lessonId);
  });

  it('lesson_list — lists lessons including new one', async () => {
    const result = await callTool('lesson_list', {
      projectPath: PROJECT_PATH,
      moduleId: 'e2e-test-module',
    });

    expect(result.success).toBe(true);
    const lessons = result.lessons as Record<string, unknown>[];
    expect(Array.isArray(lessons)).toBe(true);
    const found = lessons.find((l) => l.id === lessonId);
    expect(found).toBeDefined();
  });

  it('rule_check — checks applicable rules', async () => {
    const result = await callTool('rule_check', {
      projectPath: PROJECT_PATH,
      moduleId: 'e2e-test-module',
      role: 'worker',
      taskType: 'feature',
    });

    expect(result.success).toBe(true);
    expect(result.rules).toBeDefined();
  });
});

// =============================================================================
// A5: Training Context Flow
// =============================================================================

describe('A5: Training Context (training_context_get)', () => {
  it('returns context with skills, rules, and lessons', async () => {
    const result = await callTool('training_context_get', {
      projectPath: PROJECT_PATH,
      moduleId: 'e2e-test-module',
      role: 'worker',
      taskType: 'feature',
    });

    expect(result.success).toBe(true);
    expect(result.context).toBeDefined();
    const context = result.context as Record<string, unknown>;
    expect(context.skills).toBeDefined();
    expect(context.rules).toBeDefined();
    expect(context.recentLessons).toBeDefined();
    expect(result.contextPrompt).toBeDefined();
    expect(result.summary).toBeDefined();
  });
});

// A6: Session Launch — REMOVED (replaced by Claude Code native teammates)

// =============================================================================
// Test Results Flow (file-based)
// =============================================================================

describe('Test Results (create → list → get — file-based)', () => {
  let resultId: string;

  it('test_result_create — persists JSON file', async () => {
    const result = await callTool('test_result_create', {
      projectPath: PROJECT_PATH,
      projectId: 'sidstack',
      featureName: 'E2E Integration Test',
      verdict: 'pass',
      totalScenarios: 3,
      passed: 3,
      failed: 0,
      testPlan: [
        { scenario: 'Create result', priority: 'P0' },
        { scenario: 'List results', priority: 'P0' },
        { scenario: 'Get result', priority: 'P0' },
      ],
      results: [
        { scenario: 'Create result', result: 'PASS' },
        { scenario: 'List results', result: 'PASS' },
        { scenario: 'Get result', result: 'PASS' },
      ],
      testerAgent: 'vitest-e2e',
    });

    expect(result.success).toBe(true);
    const testResult = result.result as Record<string, unknown>;
    expect(testResult).toBeDefined();
    expect(testResult.id).toBeTruthy();
    resultId = testResult.id as string;
    createdTestResultIds.push(resultId);

    // Verify file actually exists on disk
    const filePath = path.join(TEST_RESULTS_DIR, `${resultId}.json`);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('test_result_list — reads directory and returns results', async () => {
    const result = await callTool('test_result_list', {
      projectPath: PROJECT_PATH,
      projectId: 'sidstack',
    });

    expect(result.success).toBe(true);
    const results = result.results as Record<string, unknown>[];
    expect(Array.isArray(results)).toBe(true);
    const found = results.find((r) => r.id === resultId);
    expect(found).toBeDefined();
  });

  it('test_result_get — reads single JSON file', async () => {
    const result = await callTool('test_result_get', {
      projectPath: PROJECT_PATH,
      id: resultId,
    });

    expect(result.success).toBe(true);
    const testResult = result.result as Record<string, unknown>;
    expect(testResult.featureName).toBe('E2E Integration Test');
    expect(testResult.verdict).toBe('pass');
    expect(testResult.passRate).toBe(100);
  });

  it('test_result_get — returns error for non-existent', async () => {
    const result = await callTool('test_result_get', {
      projectPath: PROJECT_PATH,
      id: 'does-not-exist',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// =============================================================================
// Memory Flow (mem0 semantic search)
// =============================================================================

describe('Memory (add → search → list → delete → index_knowledge)', () => {
  let memoryId: string;

  it('memory_add — stores a memory', async () => {
    const result = await callTool('memory_add', {
      content: 'SidStack impact analysis uses risk scoring to evaluate changes before implementation',
      projectId: 'sidstack-e2e-test',
      metadata: { sourceType: 'manual', test: true },
    });

    if (!result.success) {
      // mem0 server not running — skip remaining tests
      console.warn('mem0 server not available, skipping memory tests:', result.error);
      return;
    }

    expect(result.success).toBe(true);
    expect(result.result).toBeDefined();
  });

  it('memory_add — stores second memory for search', async () => {
    const result = await callTool('memory_add', {
      content: 'The login authentication flow validates JWT tokens with 24-hour expiry stored in httpOnly cookies',
      projectId: 'sidstack-e2e-test',
    });

    if (!result.success) return; // mem0 unavailable
    expect(result.success).toBe(true);
  });

  it('memory_list — lists all memories for project', async () => {
    const result = await callTool('memory_list', {
      projectId: 'sidstack-e2e-test',
    });

    if (!result.success) return;

    expect(result.success).toBe(true);
    const memories = result.memories as Array<{ id: string; memory: string }>;
    expect(Array.isArray(memories)).toBe(true);
    expect(memories.length).toBeGreaterThanOrEqual(2);
    // Save ID for delete test
    if (memories.length > 0) {
      memoryId = memories[0].id;
    }
  });

  it('memory_delete — removes a specific memory', async () => {
    if (!memoryId) return; // no memory to delete

    const result = await callTool('memory_delete', {
      memoryId,
      projectId: 'sidstack-e2e-test',
    });

    expect(result.success).toBe(true);
  });

  it('memory_index_knowledge — bulk indexes knowledge docs', async () => {
    const result = await callTool('memory_index_knowledge', {
      projectPath: PROJECT_PATH,
      projectId: 'sidstack-e2e-test',
    });

    if (!result.success && (result.error as string)?.includes('not available')) return;

    expect(result.success).toBe(true);
    expect(typeof result.total).toBe('number');
    expect(typeof result.indexed).toBe('number');
    expect(result.failed).toBe(0);
  }, 120_000); // Bulk indexing calls Gemini API per doc — needs longer timeout
});

// =============================================================================
// Knowledge Search (SidMemo-only)
// =============================================================================

describe('Knowledge Search (SidMemo-only)', () => {
  it('knowledge_search — returns SidMemo results or clear error', async () => {
    const result = await callTool('knowledge_search', {
      projectPath: PROJECT_PATH,
      query: 'task management workflow',
    });

    // SidMemo may not be available in all environments
    if (result.success) {
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    } else {
      // Must return clear SidMemo error (no silent fallback)
      expect(result.error).toContain('SidMemo');
    }
  });

  it('knowledge_search — includeTasks returns tasks array', async () => {
    const result = await callTool('knowledge_search', {
      projectPath: PROJECT_PATH,
      query: 'task',
      includeTasks: true,
    });

    if (result.success) {
      expect(result.tasks).toBeDefined();
      expect(Array.isArray(result.tasks)).toBe(true);
    }
  });
});

// =============================================================================
// Removed Tools (should return unknown tool)
// =============================================================================

describe('Removed Tools', () => {
  it('memory_search — returns unknown tool error', async () => {
    const result = await callTool('memory_search', {
      query: 'test query',
      projectId: 'nonexistent-project',
    });

    expect(result.success).toBeFalsy();
  });

  it('knowledge_context — returns unknown tool error', async () => {
    const result = await callTool('knowledge_context', {
      projectPath: PROJECT_PATH,
    });

    expect(result.success).toBeFalsy();
  });

  it('context_pack — returns unknown tool error', async () => {
    const result = await callTool('context_pack', {
      projectPath: PROJECT_PATH,
      projectId: 'sidstack',
      module: 'test',
    });

    expect(result.success).toBeFalsy();
  });
});

// =============================================================================
// Cleanup
// =============================================================================

afterAll(async () => {
  // Clean up test result files
  for (const id of createdTestResultIds) {
    const filePath = path.join(TEST_RESULTS_DIR, `${id}.json`);
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  }

  // Clean up DB records (best effort)
  try {
    for (const taskId of createdTaskIds) {
      await callTool('task_update', { taskId, status: 'cancelled' });
    }
  } catch { /* ignore */ }

  // Clean up mem0 test memories (best effort)
  try {
    const memResult = await callTool('memory_list', { projectId: 'sidstack-e2e-test' });
    if (memResult.success) {
      const memories = memResult.memories as Array<{ id: string }>;
      for (const mem of memories) {
        await callTool('memory_delete', { memoryId: mem.id });
      }
    }
  } catch { /* ignore */ }
});
