/**
 * Context Builder MCP Tools (Project Intelligence Hub)
 *
 * Tools for building unified context from the Entity Reference Graph
 * and RAG-based knowledge retrieval via SidMemo.
 *
 * entity_context supports two modes:
 * 1. Entity mode: entityType+entityId or taskId → Graph traversal + SidMemo overlay
 * 2. RAG mode: projectPath + query/moduleId → Knowledge docs + SidMemo semantic search
 */

import { createApiClient, detectWorkspace } from '@sidstack/shared';
import { getSidMemoClientIfAvailable } from './memory.js';
import { validateProjectPath } from './validate-path.js';
import * as path from 'path';

const apiClient = createApiClient();

function resolveWorkspacePath(projectPath: string): string {
  try {
    const workspace = detectWorkspace(projectPath);
    return workspace ? workspace.workspaceRoot : projectPath;
  } catch {
    return projectPath;
  }
}

// =============================================================================
// Tool Definitions
// =============================================================================

export const contextBuilderTools = [
  {
    name: 'entity_context',
    description:
      'Build complete context via Entity Reference Graph or RAG search. Two modes:\n' +
      '1. **Entity mode** (entityType+entityId or taskId): Traverse entity graph + SidMemo semantic overlay\n' +
      '2. **RAG mode** (projectPath + query/moduleId): Knowledge docs context + SidMemo semantic search\n\n' +
      'Use format "claude" for markdown, "json" for structured data, "compact" for one-line summary.',
    inputSchema: {
      type: 'object',
      properties: {
        entityType: {
          type: 'string',
          description: 'Entity type for graph traversal (entity mode)',
          enum: ['task', 'session', 'knowledge', 'impact', 'ticket', 'incident', 'lesson', 'rule', 'skill'],
        },
        entityId: { type: 'string', description: 'Entity ID (entity mode)' },
        projectPath: { type: 'string', description: 'Project path (RAG mode, or for SidMemo overlay in entity mode)' },
        query: { type: 'string', description: 'Semantic search query (RAG mode)' },
        taskId: { type: 'string', description: 'Task ID shortcut — equivalent to entityType="task", entityId=taskId' },
        moduleId: { type: 'string', description: 'Module ID for context (RAG mode)' },
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
            enum: ['knowledge', 'impact', 'governance', 'history', 'references', 'memory'],
          },
        },
        maxTokens: {
          type: 'number',
          description: 'Maximum token budget for the response.',
          default: 8000,
        },
        depth: {
          type: 'number',
          description: 'Traversal depth for entity mode (default 1)',
          default: 1,
        },
      },
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
  entityType?: string;
  entityId?: string;
  projectPath?: string;
  query?: string;
  taskId?: string;
  moduleId?: string;
  format?: string;
  sections?: string[];
  maxTokens?: number;
  depth?: number;
}) {
  // Mode detection
  const isEntityMode = Boolean((args.entityType && args.entityId) || args.taskId);
  const isRAGMode = Boolean(args.projectPath && (args.query || args.moduleId));

  if (!isEntityMode && !isRAGMode) {
    return {
      success: false,
      error: 'Provide entityType+entityId or taskId for entity mode, or projectPath+query/moduleId for RAG mode.',
    };
  }

  const sidmemoClient = await getSidMemoClientIfAvailable();

  // RAG mode requires SidMemo; entity mode uses it as optional overlay
  if (isRAGMode && !sidmemoClient) {
    return {
      success: false,
      error: 'SidMemo is not available. RAG context mode requires SidMemo — check SIDMEMO_API_KEY.',
    };
  }

  if (isEntityMode) {
    // Entity mode: Graph traversal + SidMemo overlay
    const entityType = args.entityType || 'task';
    const entityId = args.entityId || args.taskId!;

    const queryParams: Record<string, string | number | boolean | undefined> = {
      format: args.format || 'claude',
      depth: args.depth || 1,
      maxTokens: args.maxTokens || 8000,
    };
    if (args.sections) {
      queryParams.sections = args.sections.join(',');
    }

    const result = await apiClient.context.getEntityContext(entityType, entityId, queryParams);

    // SidMemo overlay using entity title (optional)
    if (args.projectPath && sidmemoClient) {
      const workspacePath = resolveWorkspacePath(args.projectPath);
      const projectId = path.basename(workspacePath);
      const entityTitle = (result as any).entity?.title || (result as any).title || entityId;
      const memories = await sidmemoClient.search(entityTitle, projectId, 5);

      if (memories.length > 0) {
        let semanticSection = '\n\n## Semantic Memory\n';
        for (const m of memories) {
          semanticSection += `- [${(m.score ?? 0).toFixed(2)}] ${m.content}\n`;
        }
        if (typeof result.context === 'string') {
          result.context += semanticSection;
        } else {
          result.semanticMemory = memories.map(m => ({
            content: m.content,
            score: m.score,
          }));
        }
      }
    }

    return {
      success: true,
      ...result,
    };
  } else {
    // RAG mode: Knowledge context + SidMemo search
    validateProjectPath(args.projectPath!);
    const workspacePath = resolveWorkspacePath(args.projectPath!);
    const projectId = path.basename(workspacePath);
    const searchQuery = args.query || args.moduleId || 'project context';

    const [contextResult, memories] = await Promise.all([
      apiClient.knowledge.context({
        projectPath: args.projectPath!,
        taskId: args.taskId,
        moduleId: args.moduleId,
        maxLength: args.maxTokens ? String(args.maxTokens) : undefined,
      }),
      sidmemoClient!.search(searchQuery, projectId, 10),
    ]);

    const contextText = typeof contextResult === 'string'
      ? contextResult
      : ((contextResult as any).context || (contextResult as any).prompt || JSON.stringify(contextResult));

    let semanticSection = '';
    if (memories.length > 0) {
      const knowledgeMemories = memories.filter((m: any) => m.metadata_?.sourceType !== 'validation_failure').slice(0, 5);
      const failures = memories.filter((m: any) => m.metadata_?.sourceType === 'validation_failure').slice(0, 5);

      if (knowledgeMemories.length > 0) {
        semanticSection += '\n\n## Relevant Knowledge\n';
        for (const m of knowledgeMemories) {
          semanticSection += `- ${m.content}\n`;
        }
      }
      if (failures.length > 0) {
        semanticSection += '\n\n## Past Validation Failures\n';
        for (const f of failures) {
          semanticSection += `- ${f.content}\n`;
        }
      }
    }

    const fullContext = contextText + semanticSection;

    return {
      success: true,
      context: fullContext,
      entities: (contextResult as any).entities || (contextResult as any).metadata?.entities || [],
      metadata: {
        totalLength: fullContext.length,
        maxLength: args.maxTokens || 8000,
        truncated: fullContext.length >= (args.maxTokens || 8000),
      },
    };
  }
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
