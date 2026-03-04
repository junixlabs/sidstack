/**
 * Traceability Matrix - Shared Logic
 *
 * Builds a spec -> task -> test result coverage matrix.
 * Used by both MCP tool and API endpoint.
 *
 * Uses IRepository for async DB access (supports both SQLite and PostgreSQL).
 */

import { listTestResults } from './test-results';
import type { IRepository } from './repository/types';

// =============================================================================
// Types
// =============================================================================

export interface TraceabilityTaskEntry {
  id: string;
  title: string;
  status: string;
  verdict: string | null;
  passRate: number | null;
}

export interface TraceabilityCoverage {
  totalTasks: number;
  tested: number;
  passed: number;
  rate: number;
}

export interface TraceabilityMatrixEntry {
  specId: string;
  specTitle: string;
  specStatus: string;
  tasks: TraceabilityTaskEntry[];
  coverage: TraceabilityCoverage;
}

export interface TraceabilitySummary {
  totalSpecs: number;
  fullyCovered: number;
  partial: number;
  uncovered: number;
  overallRate: number;
}

export interface TraceabilityMatrix {
  matrix: TraceabilityMatrixEntry[];
  summary: TraceabilitySummary;
}

// =============================================================================
// Builder
// =============================================================================

export async function buildTraceabilityMatrix(
  repo: IRepository,
  projectPath: string,
  projectId: string,
  specId?: string,
  taskId?: string,
): Promise<TraceabilityMatrix> {
  // 1. Load specs from DB
  const result = await repo.knowledge.list(projectId, { type: 'spec', limit: 10000 });
  let specs = result.documents;

  if (specId) {
    specs = specs.filter((s) => s.id === specId);
  }

  // 2. Load all test results for this project
  const allTestResults = listTestResults(projectPath, { projectId });

  // 3. Load all tasks for this project
  const allTasksResult = await repo.tasks.list(projectId, { fields: 'standard', preset: 'all' });
  const allTasks = allTasksResult.tasks;

  // If filtering by taskId, find which specs link to that task
  const taskIdFilter = taskId;

  // 4. Build matrix
  const matrix: TraceabilityMatrixEntry[] = [];

  for (const spec of specs) {
    // Find tasks linked to this spec via entity references
    const specRefs = await repo.entityLinks.query({
      entityType: 'knowledge',
      entityId: spec.id,
      direction: 'both',
      limit: 200,
    });

    // Tasks that reference this spec (requires_context relationship)
    const linkedTaskIds = new Set<string>();
    for (const ref of specRefs) {
      if (ref.relationship === 'requires_context') {
        if (ref.sourceType === 'task') {
          linkedTaskIds.add(ref.sourceId);
        }
        if (ref.targetType === 'task') {
          linkedTaskIds.add(ref.targetId);
        }
      }
    }

    // If filtering by taskId, skip specs that don't include this task
    if (taskIdFilter && !linkedTaskIds.has(taskIdFilter)) {
      continue;
    }

    // Find direct test results linked to this spec via entity references
    const directTestResultIds = new Set<string>();
    for (const ref of specRefs) {
      if (ref.relationship === 'validates') {
        if (ref.sourceType === 'test_result') {
          directTestResultIds.add(ref.sourceId);
        }
      }
    }

    // Build task entries
    const taskEntries: TraceabilityTaskEntry[] = [];

    for (const tId of linkedTaskIds) {
      const task = allTasks.find(t => t.id === tId);
      if (!task) continue;

      // Find test results for this task
      const taskTestRefs = await repo.entityLinks.query({
        entityType: 'task',
        entityId: tId,
        direction: 'both',
        relationship: ['validates'],
        limit: 100,
      });

      const testResultIds = new Set<string>();
      for (const ref of taskTestRefs) {
        if (ref.sourceType === 'test_result') {
          testResultIds.add(ref.sourceId);
        }
      }

      // Also check test results by taskId field
      const taskTestResults = allTestResults.filter(
        tr => tr.taskId === tId || testResultIds.has(tr.id)
      );

      // Use latest test result
      const latestResult = taskTestResults[0]; // already sorted newest first

      taskEntries.push({
        id: tId,
        title: task.title!,
        status: task.status!,
        verdict: latestResult?.verdict ?? null,
        passRate: latestResult?.passRate ?? null,
      });
    }

    // Calculate coverage
    const tested = taskEntries.filter(t => t.verdict !== null).length;
    const passed = taskEntries.filter(t => t.verdict === 'pass').length;
    const totalTasks = taskEntries.length;
    const rate = totalTasks > 0 ? Math.round((tested / totalTasks) * 100) : 0;

    matrix.push({
      specId: spec.id,
      specTitle: spec.title,
      specStatus: spec.status,
      tasks: taskEntries,
      coverage: { totalTasks, tested, passed, rate },
    });
  }

  // 5. Build summary
  const totalSpecs = matrix.length;
  const fullyCovered = matrix.filter(m => m.coverage.rate === 100 && m.coverage.totalTasks > 0).length;
  const uncovered = matrix.filter(m => m.coverage.tested === 0).length;
  const partial = totalSpecs - fullyCovered - uncovered;
  const totalTested = matrix.reduce((sum, m) => sum + m.coverage.tested, 0);
  const totalTasksAll = matrix.reduce((sum, m) => sum + m.coverage.totalTasks, 0);
  const overallRate = totalTasksAll > 0 ? Math.round((totalTested / totalTasksAll) * 100) : 0;

  return {
    matrix,
    summary: { totalSpecs, fullyCovered, partial, uncovered, overallRate },
  };
}
