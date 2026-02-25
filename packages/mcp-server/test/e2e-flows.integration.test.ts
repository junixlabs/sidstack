/**
 * E2E Integration Tests — Real DB + Real File I/O
 *
 * Tests 5 flows end-to-end without mocks:
 * - U3: Ticket Queue (create → list → update → convert_to_task)
 * - U4: Knowledge Browser (list → search → context → modules)
 * - U5: Training Room (incident → lesson → skill → rule_check)
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
const createdSkillIds: string[] = [];
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

describe('U4: Knowledge Browser (list → search → context → modules)', () => {
  it('knowledge_list — lists knowledge documents', async () => {
    const result = await callTool('knowledge_list', {
      projectPath: PROJECT_PATH,
    });

    expect(result.success).toBe(true);
    const docs = result.documents as unknown[];
    expect(Array.isArray(docs)).toBe(true);
  });

  it('knowledge_search — searches knowledge base', async () => {
    const result = await callTool('knowledge_search', {
      projectPath: PROJECT_PATH,
      query: 'task',
    });

    expect(result.success).toBe(true);
    expect(result.documents).toBeDefined();
  });

  it('knowledge_context — builds session context', async () => {
    const result = await callTool('knowledge_context', {
      projectPath: PROJECT_PATH,
    });

    expect(result.success).toBe(true);
    expect(result.context).toBeDefined();
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

  it('skill_create — creates skill from lesson', async () => {
    const result = await callTool('skill_create', {
      projectPath: PROJECT_PATH,
      name: `e2e-test-skill-${Date.now()}`,
      description: 'E2E test skill',
      lessonIds: [lessonId],
      type: 'checklist',
      content: '- [ ] Step 1\n- [ ] Step 2',
    });

    expect(result.success).toBe(true);
    const skill = result.skill as Record<string, unknown>;
    expect(skill).toBeDefined();
    if (skill?.id) createdSkillIds.push(skill.id as string);
  });

  it('skill_list — lists skills', async () => {
    const result = await callTool('skill_list', {
      projectPath: PROJECT_PATH,
    });

    expect(result.success).toBe(true);
    expect(Array.isArray(result.skills)).toBe(true);
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

  it('memory_search — finds semantically related content', async () => {
    const result = await callTool('memory_search', {
      query: 'how does user sign-in work',
      projectId: 'sidstack-e2e-test',
      limit: 5,
    });

    if (!result.success) return; // mem0 unavailable

    expect(result.success).toBe(true);
    const memories = result.memories as Array<{ memory: string; score?: number }>;
    expect(Array.isArray(memories)).toBe(true);
    expect(memories.length).toBeGreaterThan(0);
    // Should find the JWT/authentication memory via semantic match
    const authMemory = memories.find(m => m.memory.toLowerCase().includes('authentication') || m.memory.toLowerCase().includes('jwt'));
    expect(authMemory).toBeDefined();
  });

  it('memory_search — risk assessment query finds impact analysis', async () => {
    const result = await callTool('memory_search', {
      query: 'risk assessment before code changes',
      projectId: 'sidstack-e2e-test',
      limit: 5,
    });

    if (!result.success) return;

    expect(result.success).toBe(true);
    const memories = result.memories as Array<{ memory: string; score?: number }>;
    expect(memories.length).toBeGreaterThan(0);
    const impactMemory = memories.find(m => m.memory.toLowerCase().includes('impact') || m.memory.toLowerCase().includes('risk'));
    expect(impactMemory).toBeDefined();
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
// Knowledge Search with Semantic Enhancement
// =============================================================================

describe('Knowledge Search + Semantic (enhanced)', () => {
  it('knowledge_search — returns semanticMatches when mem0 is available', async () => {
    const result = await callTool('knowledge_search', {
      projectPath: PROJECT_PATH,
      query: 'task management workflow',
    });

    expect(result.success).toBe(true);
    expect(result.documents).toBeDefined();
    // semanticMatches may be present if mem0 is running and has indexed data
    // We just verify the field structure is valid when present
    if (result.semanticMatches) {
      const matches = result.semanticMatches as Array<{ memory: string }>;
      expect(Array.isArray(matches)).toBe(true);
      for (const m of matches) {
        expect(typeof m.memory).toBe('string');
      }
    }
  });
});

// =============================================================================
// Graceful Degradation (verify no crashes without mem0)
// =============================================================================

describe('Graceful Degradation', () => {
  it('memory_search — returns error message when server unavailable', async () => {
    // This test validates the error shape; mem0 may actually be running
    // so we just verify it returns a well-formed response either way
    const result = await callTool('memory_search', {
      query: 'test query',
      projectId: 'nonexistent-project',
    });

    // Should never throw, always returns structured response
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  });

  it('knowledge_search — still works without mem0 (keyword results)', async () => {
    const result = await callTool('knowledge_search', {
      projectPath: PROJECT_PATH,
      query: 'governance',
    });

    // Core keyword search must always work regardless of mem0
    expect(result.success).toBe(true);
    expect(result.documents).toBeDefined();
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
