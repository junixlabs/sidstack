/**
 * MCP Tools Index
 *
 * Exports tool definitions and handler routing.
 * MVP: 32 focused tools.
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
  handleKnowledgeModuleOverview,
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

import {
  testResultTools,
  handleTestResultTool,
} from './handlers/test-results.js';

import {
  agentDeskTools,
  handleDeskCreate,
  handleDeskList,
  handleDeskStatus,
  handleDeskCheckout,
  handleDeskHealth,
  handleDeskConflicts,
  handleDeskRemove,
} from './handlers/agent-desk.js';

import {
  memoryTools,
  handleMemoryAdd,
  handleMemorySearch,
  handleMemoryList,
  handleMemoryDelete,
  handleMemoryIndexKnowledge,
  handleMemoryCleanup,
} from './handlers/memory.js';

import {
  traceabilityTools,
  handleTraceabilityMatrix,
} from './handlers/traceability.js';

import {
  entityReferenceTools,
  handleEntityLink,
  handleEntityReferences,
} from './handlers/entity-references.js';

import {
  contextBuilderTools,
  handleEntityContext,
} from './handlers/context-builder.js';

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
  'knowledge_module_overview',
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

  // OKRs (project goals)
  'okr_list',
  'okr_update',

  // Test Results (E2E persistence)
  'test_result_create',
  'test_result_list',
  'test_result_get',

  // Agent Desk (persistent dev machine)
  'desk_create',
  'desk_list',
  'desk_status',
  'desk_checkout',
  'desk_health',
  'desk_conflicts',
  'desk_remove',

  // Memory (semantic search via mem0)
  'memory_add',
  'memory_search',
  'memory_list',
  'memory_delete',
  'memory_index_knowledge',
  'memory_cleanup',

  // Traceability (spec → task → test coverage)
  'traceability_matrix',

  // Entity References (cross-entity linking)
  'entity_link',
  'entity_references',
  'entity_context',
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

  // Test Result Tools
  ...(testResultTools as unknown as Tool[]),

  // Agent Desk Tools
  ...(agentDeskTools as unknown as Tool[]),

  // Memory Tools (mem0 semantic search)
  ...(memoryTools as unknown as Tool[]),

  // Traceability Tools
  ...(traceabilityTools as unknown as Tool[]),

  // Entity Reference Tools
  ...(entityReferenceTools as unknown as Tool[]),

  // Context Builder Tools
  ...(contextBuilderTools as unknown as Tool[]),
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
      case 'knowledge_module_overview':
        return wrapResult(handleKnowledgeModuleOverview(args as any));
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

      // Test Result tools
      case 'test_result_create':
      case 'test_result_list':
      case 'test_result_get':
        return wrapResult(handleTestResultTool(name, args as any));

      // Agent Desk tools
      case 'desk_create':
        return wrapResult(handleDeskCreate(args as any));
      case 'desk_list':
        return wrapResult(handleDeskList(args as any));
      case 'desk_status':
        return wrapResult(handleDeskStatus(args as any));
      case 'desk_checkout':
        return wrapResult(handleDeskCheckout(args as any));
      case 'desk_health':
        return wrapResult(handleDeskHealth(args as any));
      case 'desk_conflicts':
        return wrapResult(handleDeskConflicts(args as any));
      case 'desk_remove':
        return wrapResult(handleDeskRemove(args as any));

      // Memory tools (mem0 semantic search)
      case 'memory_add':
        return wrapResult(handleMemoryAdd(args as any));
      case 'memory_search':
        return wrapResult(handleMemorySearch(args as any));
      case 'memory_list':
        return wrapResult(handleMemoryList(args as any));
      case 'memory_delete':
        return wrapResult(handleMemoryDelete(args as any));
      case 'memory_index_knowledge':
        return wrapResult(handleMemoryIndexKnowledge(args as any));
      case 'memory_cleanup':
        return wrapResult(handleMemoryCleanup(args as any));

      // Traceability tools
      case 'traceability_matrix':
        return wrapResult(handleTraceabilityMatrix(args as any));

      // Entity Reference tools
      case 'entity_link':
        return wrapResult(handleEntityLink(args as any));
      case 'entity_references':
        return wrapResult(handleEntityReferences(args as any));

      // Context Builder tools
      case 'entity_context':
        return wrapResult(handleEntityContext(args as any));

      default:
        // Try SQLite-based tools (task_*, work_*, project_*)
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
      text: JSON.stringify(result),
    }],
  };
}
