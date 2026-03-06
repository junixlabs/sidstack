/**
 * Context Packs MCP Tool Handler
 *
 * Combines knowledge_module_overview + memory_search + recent tasks
 * into a single comprehensive context bundle for a module.
 * One tool call replaces 3-5 separate calls.
 */

import { createApiClient } from '@sidstack/shared';
import { getSidMemoClientIfAvailable } from './memory.js';

const apiClient = createApiClient();

// =============================================================================
// Tool Definitions
// =============================================================================

export const contextPackTools = [
  {
    name: 'context_pack',
    description:
      'Build a comprehensive context pack for a module or topic. Combines knowledge overview, semantic memories, and recent tasks into a single response. Use this instead of calling knowledge_search + memory_search + task_list separately. Returns markdown-formatted context ready for consumption.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Project path (REQUIRED)',
        },
        projectId: {
          type: 'string',
          description: 'Project ID for memory/task lookup',
        },
        module: {
          type: 'string',
          description:
            'Module name or topic to build context for (e.g., "mcp-server", "authentication", "api-server")',
        },
        includeMemory: {
          type: 'boolean',
          description: 'Include semantic memory search results (default: true)',
          default: true,
        },
        includeTasks: {
          type: 'boolean',
          description: 'Include recent tasks for this module (default: true)',
          default: true,
        },
        includeKnowledge: {
          type: 'boolean',
          description: 'Include knowledge docs (default: true)',
          default: true,
        },
        maxTokens: {
          type: 'number',
          description: 'Approximate token budget (default: 4000)',
          default: 4000,
        },
      },
      required: ['projectPath', 'projectId', 'module'],
    },
  },
];

// =============================================================================
// Handler
// =============================================================================

export async function handleContextPack(args: {
  projectPath: string;
  projectId: string;
  module: string;
  includeMemory?: boolean;
  includeTasks?: boolean;
  includeKnowledge?: boolean;
  maxTokens?: number;
}): Promise<Record<string, unknown>> {
  const {
    projectPath,
    projectId,
    module: moduleName,
    includeMemory = true,
    includeTasks = true,
    includeKnowledge = true,
    maxTokens = 4000,
  } = args;

  const sections: string[] = [];
  const metadata: Record<string, unknown> = {
    module: moduleName,
    projectId,
    generatedAt: new Date().toISOString(),
  };

  // Run all queries in parallel
  const promises: Array<Promise<void>> = [];

  // --- Knowledge section ---
  let knowledgeDocs: Array<Record<string, unknown>> = [];
  if (includeKnowledge) {
    promises.push(
      (async () => {
        try {
          const result = await apiClient.knowledge.search({
            projectPath,
            query: moduleName,
            limit: 8,
          } as any);
          knowledgeDocs = (result as any).results || (result as any).documents || [];
        } catch {
          // Knowledge search failed — skip
        }
      })()
    );
  }

  // --- Memory section ---
  let memories: Array<Record<string, unknown>> = [];
  if (includeMemory) {
    promises.push(
      (async () => {
        try {
          const client = await getSidMemoClientIfAvailable();
          if (client) {
            const rawMemories = await client.search(moduleName, projectId, 5);
            memories = rawMemories.map(m => ({
              id: m.id,
              content: m.content,
              score: m.score,
            }));
          }
        } catch {
          // Memory unavailable — skip
        }
      })()
    );
  }

  // --- Tasks section ---
  let tasks: Array<Record<string, unknown>> = [];
  if (includeTasks) {
    promises.push(
      (async () => {
        try {
          const result = await apiClient.tasks.list({ projectId });
          const allTasks = (result as any).tasks || [];
          // Filter tasks related to this module (by title or moduleId)
          tasks = allTasks.filter((t: any) => {
            const titleMatch = t.title?.toLowerCase().includes(moduleName.toLowerCase());
            const moduleMatch = t.moduleId?.toLowerCase() === moduleName.toLowerCase();
            return titleMatch || moduleMatch;
          }).slice(0, 5);

          // If no module-specific tasks found, show recent ones
          if (tasks.length === 0) {
            tasks = allTasks.slice(0, 3);
          }
        } catch {
          // Tasks unavailable — skip
        }
      })()
    );
  }

  // Wait for all parallel queries
  await Promise.all(promises);

  // --- Build markdown context pack ---
  sections.push(`# Context Pack: ${moduleName}\n`);

  // Knowledge section
  if (knowledgeDocs.length > 0) {
    sections.push('## Knowledge');
    let tokenBudget = Math.floor(maxTokens * 0.5);
    for (const doc of knowledgeDocs) {
      const title = (doc as any).title || (doc as any).id || 'Untitled';
      const docType = (doc as any).type || (doc as any).documentType || '';
      const snippet = (doc as any).snippet || (doc as any).content || '';
      const truncated = snippet.substring(0, Math.min(snippet.length, 300));
      const entry = `- **${title}** (${docType}): ${truncated}`;
      if (tokenBudget <= 0) break;
      sections.push(entry);
      tokenBudget -= entry.length / 4; // rough token estimate
    }
    metadata.knowledgeCount = knowledgeDocs.length;
  }

  // Memory section
  if (memories.length > 0) {
    sections.push('\n## Memories');
    for (const mem of memories) {
      const content = (mem.content as string) || '';
      const score = (mem.score as number) || 0;
      sections.push(`- [${score.toFixed(2)}] ${content.substring(0, 200)}`);
    }
    metadata.memoryCount = memories.length;
  }

  // Tasks section
  if (tasks.length > 0) {
    sections.push('\n## Related Tasks');
    for (const task of tasks) {
      const t = task as any;
      const status = t.status || 'unknown';
      const title = t.title || 'Untitled';
      const progress = t.progress || 0;
      sections.push(`- [${status}] ${title} (${progress}%)`);
    }
    metadata.taskCount = tasks.length;
  }

  const pack = sections.join('\n');

  return {
    success: true,
    pack,
    metadata,
  };
}
