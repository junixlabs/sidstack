/**
 * Macro Tools MCP Handler
 *
 * Composite macros that combine multiple tool calls into one.
 * Built-in macros: start_work, finish_work
 *
 * Each macro internally calls existing handlers — no new API endpoints needed.
 */

import { createApiClient } from '@sidstack/shared';
import { getSidMemoClientIfAvailable } from './memory.js';

const apiClient = createApiClient();

// =============================================================================
// Tool Definitions
// =============================================================================

export const macroTools = [
  {
    name: 'macro_run',
    description:
      'Run a composite macro that executes multiple SidStack operations in one call. Available macros:\n' +
      '- **start_work**: Create task + search knowledge + search memory + return combined context. Params: projectId, projectPath, title, taskType, description\n' +
      '- **finish_work**: Run quality summary + complete task + store learnings. Params: projectId, taskId, implementSummary, learnings (optional)',
    inputSchema: {
      type: 'object',
      properties: {
        macro: {
          type: 'string',
          description: 'Macro name to run',
          enum: ['start_work', 'finish_work'],
        },
        params: {
          type: 'object',
          description: 'Parameters for the macro (varies by macro type)',
          additionalProperties: true,
        },
      },
      required: ['macro', 'params'],
    },
  },
];

// =============================================================================
// Macro Implementations
// =============================================================================

async function macroStartWork(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const projectId = params.projectId as string;
  const projectPath = params.projectPath as string;
  const title = params.title as string;
  const taskType = (params.taskType as string) || 'feature';
  const description = (params.description as string) || title;

  if (!projectId || !title) {
    return { success: false, error: 'Missing required params: projectId, title' };
  }

  const results: Record<string, unknown> = { macro: 'start_work' };

  // Step 1: Create task
  try {
    const taskResult = await apiClient.tasks.create({
      projectId,
      title,
      description,
      taskType: taskType as any,
      status: 'in_progress',
      priority: 'medium',
      createdBy: 'macro',
    });
    results.task = taskResult;
    results.taskId = (taskResult as any).task?.id || (taskResult as any).id;
  } catch (error) {
    results.taskError = error instanceof Error ? error.message : 'Task creation failed';
  }

  // Step 2 & 3: Search knowledge + memory in parallel
  const searchQuery = title.replace(/^\[.*?\]\s*/, ''); // Strip [type] prefix
  const parallelResults = await Promise.allSettled([
    // Knowledge search
    projectPath
      ? apiClient.knowledge.search({ projectPath, query: searchQuery, limit: 5 } as any)
      : Promise.resolve({ results: [] }),
    // Memory search
    (async () => {
      const client = await getSidMemoClientIfAvailable();
      if (!client) return { memories: [] };
      const memories = await client.search(searchQuery, projectId, 5);
      return {
        memories: memories.map(m => ({
          id: m.id,
          content: m.content,
          score: m.score,
        })),
      };
    })(),
  ]);

  // Process knowledge results
  if (parallelResults[0].status === 'fulfilled') {
    const kResult = parallelResults[0].value as any;
    results.knowledge = kResult.results || kResult.documents || [];
    results.knowledgeCount = (results.knowledge as any[]).length;
  }

  // Process memory results
  if (parallelResults[1].status === 'fulfilled') {
    const mResult = parallelResults[1].value as any;
    results.memories = mResult.memories || [];
    results.memoryCount = (results.memories as any[]).length;
  }

  results.success = true;
  results.hint = results.taskId
    ? `Task ${results.taskId} created and in_progress. ${results.knowledgeCount || 0} knowledge docs + ${results.memoryCount || 0} memories found. Begin implementation.`
    : 'Task creation failed but context was gathered. Create task manually.';

  return results;
}

async function macroFinishWork(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const projectId = params.projectId as string;
  const taskId = params.taskId as string;
  const implementSummary = (params.implementSummary as string) || '';
  const learnings = params.learnings as string | undefined;

  if (!taskId) {
    return { success: false, error: 'Missing required param: taskId' };
  }

  const results: Record<string, unknown> = { macro: 'finish_work', taskId };

  // Step 1: Update task to completed
  try {
    await apiClient.tasks.update(taskId, {
      status: 'completed',
      progress: 100,
      implementSummary,
    } as any);
    results.taskCompleted = true;
  } catch (error) {
    results.taskCompleted = false;
    results.taskError = error instanceof Error ? error.message : 'Task completion failed';
  }

  // Step 2: Store learnings in memory (if provided)
  if (learnings && projectId) {
    try {
      const client = await getSidMemoClientIfAvailable();
      if (client) {
        const { result } = await client.addSmart(
          learnings,
          projectId,
          { sourceType: 'task_completion', taskId },
        );
        results.memoryStored = true;
        results.memoryId = result.id;
      }
    } catch {
      results.memoryStored = false;
    }
  }

  results.success = true;
  results.hint = `Task ${taskId} completed.${results.memoryStored ? ' Learnings stored in memory.' : ''} Consider: lesson_create if this was a tricky fix.`;

  return results;
}

// =============================================================================
// Main Handler
// =============================================================================

export async function handleMacroRun(args: {
  macro: string;
  params: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  switch (args.macro) {
    case 'start_work':
      return macroStartWork(args.params);
    case 'finish_work':
      return macroFinishWork(args.params);
    default:
      return {
        success: false,
        error: `Unknown macro: ${args.macro}. Available: start_work, finish_work`,
      };
  }
}
