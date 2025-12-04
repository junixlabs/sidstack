/**
 * Context Builder MCP Tools (Project Intelligence Hub)
 *
 * Tools for building unified context from the Entity Reference Graph.
 * Provides single-call context assembly for AI agents.
 */

import { getDB } from '@sidstack/shared';
import type {
  SidStackDB,
  EntityType,
  ContextFormat,
  ContextSection,
} from '@sidstack/shared';
import { buildEntityContext } from '@sidstack/shared';

let db: SidStackDB | null = null;

async function getDatabase(): Promise<SidStackDB> {
  if (!db) {
    db = await getDB();
  }
  return db;
}

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
          enum: ['task', 'session', 'knowledge', 'capability', 'impact', 'ticket', 'incident', 'lesson', 'rule', 'skill'],
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
            enum: ['capability', 'knowledge', 'impact', 'governance', 'history', 'references'],
          },
        },
        maxTokens: {
          type: 'number',
          description: 'Maximum token budget for the response. Priority-based truncation: capability > knowledge > governance > history > references.',
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
    description: 'Get complete context for starting work on a task. Returns the task with all related entities: capability, knowledge, impact analysis, governance rules, and session history. This is the recommended way for an agent to begin implementing a task.',
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
  const database = await getDatabase();

  const result = buildEntityContext(database, {
    entityType: args.entityType as EntityType,
    entityId: args.entityId,
    format: (args.format as ContextFormat) || 'claude',
    sections: args.sections as ContextSection[] | undefined,
    maxTokens: args.maxTokens || 8000,
    depth: args.depth || 1,
  });

  // For claude format, return the formatted text directly
  if (args.format === 'claude' || !args.format) {
    return {
      success: true,
      context: result.formatted || JSON.stringify(result, null, 2),
      entity: result.entity,
      relatedCounts: {
        tasks: result.related.tasks.length,
        sessions: result.related.sessions.length,
        knowledge: result.related.knowledge.length,
        impact: result.related.impact.length,
        rules: result.related.governance.rules.length,
        skills: result.related.governance.skills.length,
        tickets: result.related.tickets.length,
        incidents: result.related.incidents.length,
        lessons: result.related.lessons.length,
      },
    };
  }

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
  const database = await getDatabase();

  // Verify task exists
  const task = database.getTask(args.taskId);
  if (!task) {
    return {
      success: false,
      error: `Task ${args.taskId} not found`,
    };
  }

  // Build full context
  const result = buildEntityContext(database, {
    entityType: 'task',
    entityId: args.taskId,
    format: (args.format as ContextFormat) || 'claude',
    sections: ['capability', 'knowledge', 'impact', 'governance', 'history', 'references'],
    maxTokens: args.maxTokens || 8000,
    depth: 1,
  });

  return {
    success: true,
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      progress: task.progress,
      taskType: task.taskType,
    },
    context: result.formatted || JSON.stringify(result, null, 2),
    relatedCounts: {
      sessions: result.related.sessions.length,
      knowledge: result.related.knowledge.length,
      impact: result.related.impact.length,
      rules: result.related.governance.rules.length,
      skills: result.related.governance.skills.length,
      tickets: result.related.tickets.length,
    },
  };
}

export async function handleTaskCompleteWithContext(args: {
  taskId: string;
  sessionId?: string;
  knowledgeCreated?: string[];
  lessonsLearned?: string[];
  notes?: string;
}) {
  const database = await getDatabase();

  // Verify task exists
  const task = database.getTask(args.taskId);
  if (!task) {
    return {
      success: false,
      error: `Task ${args.taskId} not found`,
    };
  }

  const refsCreated: string[] = [];

  // Update task status to completed
  database.updateTask(args.taskId, {
    status: 'completed',
    progress: 100,
    notes: args.notes || task.notes,
  });

  // Link session to task
  if (args.sessionId) {
    try {
      database.createEntityReference({
        sourceType: 'task',
        sourceId: args.taskId,
        targetType: 'session',
        targetId: args.sessionId,
        relationship: 'implemented_by',
        createdBy: 'system',
      });
      refsCreated.push(`task -> session (implemented_by)`);
    } catch { /* duplicate reference, ok */ }
  }

  // Link knowledge created
  if (args.knowledgeCreated) {
    for (const knowledgeId of args.knowledgeCreated) {
      // Session creates knowledge
      if (args.sessionId) {
        try {
          database.createEntityReference({
            sourceType: 'session',
            sourceId: args.sessionId,
            targetType: 'knowledge',
            targetId: knowledgeId,
            relationship: 'creates',
            createdBy: 'system',
          });
          refsCreated.push(`session -> knowledge:${knowledgeId} (creates)`);
        } catch { /* duplicate */ }
      }
      // Task requires this knowledge context
      try {
        database.createEntityReference({
          sourceType: 'task',
          sourceId: args.taskId,
          targetType: 'knowledge',
          targetId: knowledgeId,
          relationship: 'requires_context',
          createdBy: 'system',
        });
        refsCreated.push(`task -> knowledge:${knowledgeId} (requires_context)`);
      } catch { /* duplicate */ }
    }
  }

  // Link lessons learned
  if (args.lessonsLearned) {
    for (const lessonId of args.lessonsLearned) {
      if (args.sessionId) {
        try {
          database.createEntityReference({
            sourceType: 'session',
            sourceId: args.sessionId,
            targetType: 'lesson',
            targetId: lessonId,
            relationship: 'creates',
            createdBy: 'system',
          });
          refsCreated.push(`session -> lesson:${lessonId} (creates)`);
        } catch { /* duplicate */ }
      }
    }
  }

  return {
    success: true,
    task: {
      id: task.id,
      title: task.title,
      status: 'completed',
      progress: 100,
    },
    referencesCreated: refsCreated,
    summary: `Task completed. ${refsCreated.length} entity references created.`,
  };
}
