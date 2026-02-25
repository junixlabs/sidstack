/**
 * Traceability Matrix MCP Tool Handler
 *
 * Queries the spec -> task -> test result chain and returns
 * a coverage summary showing which specs have been tested.
 *
 * Uses API client instead of direct database access.
 */

import { createApiClient } from '@sidstack/shared';
import { validateProjectPath } from './validate-path.js';

const apiClient = createApiClient();

// =============================================================================
// Tool Definitions
// =============================================================================

export const traceabilityTools = [
  {
    name: 'traceability_matrix',
    description:
      'Build a traceability matrix showing spec → task → test result coverage. Shows which specs have been implemented and tested, with pass rates.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project identifier (REQUIRED)',
        },
        projectPath: {
          type: 'string',
          description: 'Project path for loading knowledge docs and test results (REQUIRED)',
        },
        specId: {
          type: 'string',
          description: 'Filter to a specific spec/knowledge doc ID (optional)',
        },
        taskId: {
          type: 'string',
          description: 'Filter to a specific task ID (optional)',
        },
      },
      required: ['projectId', 'projectPath'],
    },
  },
];

// =============================================================================
// Handlers
// =============================================================================

export async function handleTraceabilityMatrix(args: {
  projectId: string;
  projectPath: string;
  specId?: string;
  taskId?: string;
}): Promise<Record<string, unknown>> {
  validateProjectPath(args.projectPath);

  const result = await apiClient.traceability.getMatrix({
    projectId: args.projectId,
    projectPath: args.projectPath,
    specId: args.specId,
    taskId: args.taskId,
  });

  return {
    success: true,
    ...result,
  };
}
