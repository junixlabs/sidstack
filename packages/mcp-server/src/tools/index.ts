/**
 * MCP Tools Index
 *
 * Exports tool definitions and handler routing.
 * MVP: ~18 focused tools (down from 80+).
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { sqliteTools, handleSqliteTool } from './sqlite-tools.js';

// Import handlers
import {
  impactTools,
  handleImpactTool,
} from './handlers/impact.js';

import {
  ticketTools,
  handleTicketCreate,
  handleTicketList,
  handleTicketUpdate,
  handleTicketConvertToTask,
} from './handlers/tickets.js';

import {
  knowledgeTools,
  handleKnowledgeList,
  handleKnowledgeGet,
  handleKnowledgeSearch,
  handleKnowledgeContext,
  handleKnowledgeModules,
  handleKnowledgeCreate,
  handleKnowledgeUpdate,
  handleKnowledgeDelete,
  handleKnowledgeHealth,
} from './handlers/knowledge.js';

import {
  trainingRoomTools,
  handleTrainingRoomTool,
} from './handlers/training-room.js';

import {
  okrTools,
  handleOkrList,
  handleOkrUpdate,
} from './handlers/okr.js';

// ============================================================
// MVP Tool Whitelist
// ============================================================

const MVP_TOOLS = new Set([
  // Knowledge (core value)
  'knowledge_context',
  'knowledge_search',
  'knowledge_list',
  'knowledge_get',
  'knowledge_modules',
  'knowledge_create',
  'knowledge_update',
  'knowledge_delete',
  'knowledge_health',

  // Tasks (workflow)
  'task_create',
  'task_update',
  'task_list',
  'task_get',
  'task_complete',

  // Impact (differentiator)
  'impact_analyze',
  'impact_check_gate',
  'impact_list',

  // Tickets (intake)
  'ticket_create',
  'ticket_list',
  'ticket_update',
  'ticket_convert_to_task',

  // Training (learning)
  'lesson_create',
  'lesson_list',
  'rule_check',
  'incident_create',
  'incident_list',
  'skill_create',
  'skill_list',
  'training_context_get',

  // Sessions (role-based launch)
  'session_launch',

  // OKRs (project goals)
  'okr_list',
  'okr_update',
]);

// ============================================================
// Tool Definitions (filtered to MVP)
// ============================================================

const allTools: Tool[] = [
  // SQLite-based tools (task_*, session_*, work_*, project_*)
  ...(sqliteTools as Tool[]),

  // Impact Analysis tools
  ...(impactTools as Tool[]),

  // Ticket tools
  ...(ticketTools as unknown as Tool[]),

  // Knowledge Tools
  ...(knowledgeTools as unknown as Tool[]),

  // Training Room Tools
  ...(trainingRoomTools as unknown as Tool[]),

  // OKR Tools
  ...(okrTools as unknown as Tool[]),
];

// Export only MVP tools
export const tools: Tool[] = allTools.filter(t => MVP_TOOLS.has(t.name));

// ============================================================
// Tool Call Handler
// ============================================================

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  // Reject non-MVP tools
  if (!MVP_TOOLS.has(name)) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    };
  }

  let result: { content: Array<{ type: string; text: string }> };

  try {
    switch (name) {
      // Impact Analysis tools
      case 'impact_analyze':
      case 'impact_check_gate':
      case 'impact_list':
        return handleImpactTool(name, args);

      // Ticket tools
      case 'ticket_create':
        return wrapResult(handleTicketCreate(args as any));
      case 'ticket_list':
        return wrapResult(handleTicketList(args as any));
      case 'ticket_update':
        return wrapResult(handleTicketUpdate(args as any));
      case 'ticket_convert_to_task':
        return wrapResult(handleTicketConvertToTask(args as any));

      // Knowledge tools
      case 'knowledge_list':
        return wrapResult(handleKnowledgeList(args as any));
      case 'knowledge_get':
        return wrapResult(handleKnowledgeGet(args as any));
      case 'knowledge_search':
        return wrapResult(handleKnowledgeSearch(args as any));
      case 'knowledge_context':
        return wrapResult(handleKnowledgeContext(args as any));
      case 'knowledge_modules':
        return wrapResult(handleKnowledgeModules(args as any));
      case 'knowledge_create':
        return wrapResult(handleKnowledgeCreate(args as any));
      case 'knowledge_update':
        return wrapResult(handleKnowledgeUpdate(args as any));
      case 'knowledge_delete':
        return wrapResult(handleKnowledgeDelete(args as any));
      case 'knowledge_health':
        return wrapResult(handleKnowledgeHealth(args as any));

      // Training Room tools
      case 'lesson_create':
      case 'lesson_list':
      case 'rule_check':
      case 'incident_create':
      case 'incident_list':
      case 'skill_create':
      case 'skill_list':
      case 'training_context_get':
        return wrapResult(handleTrainingRoomTool(name, args as any));

      // OKR tools
      case 'okr_list':
        return wrapResult(handleOkrList(args as any));
      case 'okr_update':
        return wrapResult(handleOkrUpdate(args as any));

      default:
        // Try SQLite-based tools (task_*, session_launch)
        const sqliteToolNames = sqliteTools.map((t: { name: string }) => t.name);
        if (sqliteToolNames.includes(name)) {
          result = await handleSqliteTool(name, args);
        } else {
          throw new Error(`Unknown tool: ${name}`);
        }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result = {
      content: [{ type: 'text', text: `Error: ${message}` }],
    };
  }

  return result!;
}

// ============================================================
// Result Wrapper
// ============================================================

async function wrapResult(
  resultPromise: Promise<Record<string, unknown>>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const result = await resultPromise;
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2),
    }],
  };
}
