/**
 * Context Builder MCP Tools (Project Intelligence Hub)
 *
 * Tools for building unified context from the Entity Reference Graph.
 * Provides single-call context assembly for AI agents.
 *
 * Uses API client instead of direct database access.
 */

import { createApiClient } from '@sidstack/shared';

const apiClient = createApiClient();

// =============================================================================
// Tool Definitions
// =============================================================================

export const contextBuilderTools = [
  {
    name: 'entity_context',
    description: 'Build complete context for any SidStack entity by traversing the Entity Reference Graph. Returns the entity with all related entities (tasks, sessions, knowledge, impact, governance, tickets, lessons) in a single call. Use format "claude" for markdown, "json" for structured data, "compact" for one-line summary.',
    inputSchema: {
      type: 'object',
      properties: {
        entityType: {
          type: 'string',
          description: 'The type of entity to build context for',
          enum: ['task', 'session', 'knowledge', 'impact', 'ticket', 'incident', 'lesson', 'rule', 'skill'],
        },
        entityId: { type: 'string', description: 'The entity ID' },
        format: {
          type: 'string',
          description: 'Output format: claude (markdown), json (structured), compact (one-line)',
          enum: ['claude', 'json', 'compact'],
          default: 'claude',
        },
        sections: {
          type: 'array',
          description: 'Which related sections to include (default: all)',
          items: {
            type: 'string',
            enum: ['knowledge', 'impact', 'governance', 'history', 'references'],
          },
        },
        maxTokens: {
          type: 'number',
          description: 'Maximum token budget for the response. Priority-based truncation: knowledge > governance > history > references.',
          default: 8000,
        },
        depth: {
          type: 'number',
          description: 'Traversal depth for discovering transitive connections (default 1)',
          default: 1,
        },
      },
      required: ['entityType', 'entityId'],
    },
  },
  {
    name: 'task_start_with_context',
    description: 'Get complete context for starting work on a task. Returns the task with all related entities: knowledge, impact analysis, governance rules, and session history. This is the recommended way for an agent to begin implementing a task.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task ID to start working on' },
        format: {
          type: 'string',
          description: 'Output format (default: claude)',
          enum: ['claude', 'json', 'compact'],
          default: 'claude',
        },
        maxTokens: {
          type: 'number',
          description: 'Maximum token budget (default: 8000)',
          default: 8000,
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'task_complete_with_context',
    description: 'Complete a task and atomically create all related entity references. Updates task status, links the session, and creates references for any knowledge or lessons produced during the work.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task ID to complete' },
        sessionId: { type: 'string', description: 'The session that implemented this task' },
        knowledgeCreated: {
          type: 'array',
          description: 'Knowledge document IDs created during this task',
          items: { type: 'string' },
        },
        lessonsLearned: {
          type: 'array',
          description: 'Lesson IDs created during this task',
          items: { type: 'string' },
        },
        notes: {
          type: 'string',
          description: 'Completion notes',
        },
      },
      required: ['taskId'],
    },
  },
];

// =============================================================================
// Handler Functions
// =============================================================================

export async function handleEntityContext(args: {
  entityType: string;
  entityId: string;
  format?: string;
  sections?: string[];
  maxTokens?: number;
  depth?: number;
}) {
  const query: Record<string, string | number | boolean | undefined> = {
    format: args.format || 'claude',
    depth: args.depth || 1,
    maxTokens: args.maxTokens || 8000,
  };
  if (args.sections) {
    query.sections = args.sections.join(',');
  }

  const result = await apiClient.context.getEntityContext(args.entityType, args.entityId, query);

  return {
    success: true,
    ...result,
  };
}

export async function handleTaskStartWithContext(args: {
  taskId: string;
  format?: string;
  maxTokens?: number;
}) {
  const query: Record<string, string | number | boolean | undefined> = {
    format: args.format || 'claude',
    maxTokens: args.maxTokens || 8000,
  };

  const result = await apiClient.context.getStartContext(args.taskId, query);

  return {
    success: true,
    ...result,
  };
}

export async function handleTaskCompleteWithContext(args: {
  taskId: string;
  sessionId?: string;
  knowledgeCreated?: string[];
  lessonsLearned?: string[];
  notes?: string;
}) {
  const result = await apiClient.context.completeContext(args.taskId, {
    sessionId: args.sessionId,
    knowledgeCreated: args.knowledgeCreated,
    lessonsLearned: args.lessonsLearned,
    notes: args.notes,
  });

  return {
    success: true,
    ...result,
  };
}
