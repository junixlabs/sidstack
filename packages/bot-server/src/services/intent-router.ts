/**
 * Gemini function calling intent router.
 * Classifies user intent, executes tools, streams results via SSE.
 */

import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';
import { Response } from 'express';
import { sendSSE } from '../utils/sse';
import { addTurn, getHistory, Turn } from './conversation';
import { listTasks, listTickets, createTask } from './sidstack-api';

const DEFAULT_MODEL = 'gemini-2.5-flash';

interface ChatContext {
  projectName?: string;
  activeView?: string;
  projectPath?: string;
  projectVersion?: string;
}

function declareTools(): FunctionDeclaration[] {
  return [
    {
      name: 'respond',
      description: 'Answer greetings, SidStack questions (features, upgrade, commands, usage), and clarifications. Use your built-in SidStack knowledge.',
      parameters: {
        type: Type.OBJECT,
        properties: { text: { type: Type.STRING, description: 'Response text' } },
        required: ['text'],
      },
    },
    {
      name: 'query_tasks',
      description: 'List or search project tasks',
      parameters: {
        type: Type.OBJECT,
        properties: { filter: { type: Type.STRING, description: 'Optional filter text' } },
      },
    },
    {
      name: 'query_tickets',
      description: 'List or search project tickets',
      parameters: {
        type: Type.OBJECT,
        properties: { filter: { type: Type.STRING, description: 'Optional filter text' } },
      },
    },
    {
      name: 'navigate',
      description: 'Switch the app to a specific view',
      parameters: {
        type: Type.OBJECT,
        properties: {
          view: {
            type: Type.STRING,
            description: 'View name: project-hub, task-manager, knowledge, ticket-queue, training-room, settings',
          },
        },
        required: ['view'],
      },
    },
    {
      name: 'create_task',
      description: 'Create a new task in the project',
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'Task title' },
          description: { type: Type.STRING, description: 'Task description' },
        },
        required: ['title'],
      },
    },
    {
      name: 'open_doc',
      description: 'Open a specific knowledge document',
      parameters: {
        type: Type.OBJECT,
        properties: { docId: { type: Type.STRING, description: 'Document ID' } },
        required: ['docId'],
      },
    },
  ];
}

function buildSystemPrompt(ctx: ChatContext): string {
  return `You are SidBot, the AI assistant for SidStack — an AI-powered project intelligence platform.

## ABOUT SIDSTACK (you know this)
SidStack helps developers manage projects with: Knowledge System (docs, patterns, business logic), Task Management (with governance & quality gates), Impact Analysis (change risk assessment), Ticket Queue (external issue intake), Training Room (lessons learned).

**CLI Commands:**
- \`sidstack init\` — Initialize SidStack in a project (creates .sidstack/ folder, governance, skills)
- \`sidstack update\` — Update SidStack templates/skills to latest version
- \`sidstack migrate\` — Run database migrations after version upgrade
- \`npx @sidstack/cli@latest init\` or \`npx @sidstack/cli@latest update\` — Quick usage without global install

**Upgrade SidStack:**
1. \`npm install -g @sidstack/cli@latest\` (or pnpm/yarn)
2. \`sidstack update\` in your project to refresh templates
3. \`sidstack migrate\` if needed for DB changes

**Desktop App Views:** Project Hub (⌘1), Task Manager (⌘2), Knowledge Browser (⌘3), Ticket Queue (⌘4), Training Room (⌘5), Settings (⌘,)

**MCP Tools:** entity_context, knowledge_search, task_create, task_update, impact_analyze, ticket_create, lesson_create, rule_check

## YOUR ROLE
You are a SidStack usage guide and project assistant. You help users use SidStack features, manage tasks/tickets, and navigate the app. For deep project questions (code, architecture, business logic), you suggest relevant SidStack features and provide ready-made prompts the user can use with their code agent (Claude Code, Cursor, etc.).

## ROUTING RULES
1. Questions about SidStack (features, upgrade, commands, usage) → respond()
2. Greetings, thanks, clarifications → respond()
3. "Go to X" / "Open X" → navigate()
4. Questions about tasks/progress → query_tasks()
5. Questions about tickets/issues → query_tickets()
6. "Create task X" → create_task()
7. Open a knowledge doc → open_doc()
8. Deep project questions (code, architecture, how something works) → respond() with:
   - Suggest which SidStack feature/tool can help (e.g., "Use Knowledge Browser ⌘3 to search docs" or "Use \`knowledge_search\` MCP tool")
   - Provide a ready-made prompt the user can copy-paste to their code agent

## PROMPT GENERATION
When the user asks deep questions you can't answer directly, generate a helpful prompt like:
- "You can ask your code agent: \`Explain how [topic] works in this project. Check .sidstack/knowledge/ for existing docs.\`"
- "Try this prompt with Claude Code: \`Search for [keyword] in the codebase and explain the implementation.\`"

VIEWS: project-hub, task-manager, knowledge, ticket-queue, training-room, settings
CURRENT PROJECT: ${ctx.projectName || 'unknown'}
CURRENT VERSION: ${ctx.projectVersion || 'unknown'}
CURRENT VIEW: ${ctx.activeView || 'unknown'}`;
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Route a user message through Gemini function calling.
 * Gemini picks a tool → execute → feed result back → Gemini summarizes.
 * Max 3 steps to prevent infinite loops.
 */
export async function routeIntent(
  apiKey: string,
  conversationId: string,
  message: string,
  context: ChatContext,
  model: string | undefined,
  res: Response,
): Promise<{ route: string; tokenCount: number; usage?: TokenUsage }> {
  const ai = new GoogleGenAI({ apiKey });
  const modelName = model || DEFAULT_MODEL;
  const routes: string[] = [];
  let tokenCount = 0;
  let usage: TokenUsage | undefined;

  const mergeUsage = (meta: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }) => {
    const u = {
      promptTokens: meta.promptTokenCount || 0,
      completionTokens: meta.candidatesTokenCount || 0,
      totalTokens: meta.totalTokenCount || 0,
    };
    usage = usage
      ? { promptTokens: usage.promptTokens + u.promptTokens, completionTokens: usage.completionTokens + u.completionTokens, totalTokens: usage.totalTokens + u.totalTokens }
      : u;
  };

  // Add user turn to history
  addTurn(conversationId, { role: 'user', parts: [{ text: message }] });

  const MAX_STEPS = 3;
  let finalText = '';

  for (let step = 0; step < MAX_STEPS; step++) {
    const history = getHistory(conversationId);

    const response = await ai.models.generateContentStream({
      model: modelName,
      contents: history,
      config: {
        systemInstruction: buildSystemPrompt(context),
        tools: [{ functionDeclarations: declareTools() }],
      },
    });

    let functionCall: { name: string; args: Record<string, unknown> } | undefined;
    let rawModelParts: unknown[] | undefined;
    let textChunks = '';

    for await (const chunk of response) {
      const meta = (chunk as unknown as Record<string, unknown>).usageMetadata as
        | { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
        | undefined;
      if (meta) mergeUsage(meta);

      const calls = chunk.functionCalls;
      if (calls && calls.length > 0) {
        functionCall = { name: calls[0].name!, args: (calls[0].args as Record<string, unknown>) || {} };
        const candidates = (chunk as unknown as Record<string, unknown>).candidates as Array<{
          content: { parts: unknown[] };
        }> | undefined;
        if (candidates?.[0]) rawModelParts = candidates[0].content.parts;
        break;
      }
      const text = chunk.text;
      if (text) {
        textChunks += text;
        tokenCount++;
        sendSSE(res, 'token', { text });
      }
    }

    // No function call → Gemini responded with text, we're done
    if (!functionCall) {
      finalText = textChunks;
      addTurn(conversationId, { role: 'model', parts: [{ text: finalText }] });
      break;
    }

    const { name, args } = functionCall;
    routes.push(name);

    // respond() shortcut
    if (name === 'respond') {
      finalText = (args.text as string) || '';
      if (finalText) {
        sendSSE(res, 'token', { text: finalText });
        tokenCount++;
      }
      addTurn(conversationId, { role: 'model', parts: [{ text: finalText }] });
      break;
    }

    // Execute tool
    const result = await executeTool(name, args, context, conversationId, res);
    const compactResult = summarizeForHistory(name, result);

    // Store function call + response in history for next Gemini iteration
    addTurn(conversationId, {
      role: 'model',
      parts: (rawModelParts as Turn['parts']) || [{ functionCall: { name, args } }],
    });
    addTurn(conversationId, {
      role: 'user',
      parts: [{ functionResponse: { name, response: { result: compactResult } } }],
    });

    // If this is the last step, format locally as fallback
    if (step === MAX_STEPS - 1) {
      finalText = formatToolResult(name, result);
      sendSSE(res, 'token', { text: finalText });
      tokenCount++;
      addTurn(conversationId, { role: 'model', parts: [{ text: finalText }] });
    }
    // Otherwise: loop continues — Gemini sees the function response and decides next action
    // (text answer using the data, or another tool call like claude_analyze)
  }

  const route = routes.length > 0 ? routes.join(' → ') : 'direct';
  return { route, tokenCount, usage };
}

/**
 * Format tool results into user-facing markdown — for simple tools
 * that don't need Gemini interpretation.
 */
function formatToolResult(toolName: string, result: unknown): string {
  const r = result as Record<string, unknown>;
  if (r.error) return `Sorry, there was an issue: ${r.error}`;

  switch (toolName) {
    case 'query_tasks': {
      const tasks = (r.tasks as Array<Record<string, unknown>>) || [];
      const total = (r.total as number) || tasks.length;
      if (total === 0) return 'No tasks found matching your criteria.';
      const lines = tasks.slice(0, 10).map(
        (t) => `- **${t.title}** — ${t.status} / ${t.priority}`,
      );
      const more = total > 10 ? `\n\n_...and ${total - 10} more_` : '';
      return `Found **${total}** tasks:\n\n${lines.join('\n')}${more}`;
    }
    case 'query_tickets': {
      const tickets = (r.tickets as Array<Record<string, unknown>>) || [];
      const total = (r.total as number) || tickets.length;
      if (total === 0) return 'No open tickets found.';
      const lines = tickets.slice(0, 10).map(
        (t) => `- **${t.title}** — ${t.status} / ${t.priority}`,
      );
      const more = total > 10 ? `\n\n_...and ${total - 10} more_` : '';
      return `Found **${total}** tickets:\n\n${lines.join('\n')}${more}`;
    }
    case 'create_task':
      return r.id ? `Task **${r.title || r.id}** created.` : 'Task creation was processed.';
    case 'navigate':
      return `Navigated to **${(r.navigated as string) || 'the requested view'}**.`;
    case 'open_doc':
      return `Opened document **${(r.opened as string) || ''}**.`;
    default:
      return 'Done.';
  }
}

/**
 * Create a compact summary of tool results for conversation history.
 * Full results are streamed to the client via SSE; Gemini only needs
 * enough context to produce a good follow-up response.
 */
function summarizeForHistory(toolName: string, result: unknown): unknown {
  const r = result as Record<string, unknown>;
  if (r.error) return { error: r.error };

  switch (toolName) {
    case 'query_tasks': {
      const tasks = (r.tasks as Array<Record<string, unknown>>) || [];
      return {
        total: r.total || tasks.length,
        tasks: tasks.slice(0, 10).map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
        })),
        truncated: tasks.length > 10,
      };
    }
    case 'query_tickets': {
      const tickets = (r.tickets as Array<Record<string, unknown>>) || [];
      return {
        total: r.total || tickets.length,
        tickets: tickets.slice(0, 10).map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
        })),
        truncated: tickets.length > 10,
      };
    }
    default:
      return result;
  }
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  context: ChatContext,
  _conversationId: string,
  res: Response,
): Promise<unknown> {
  const projectId = context.projectName || 'default';

  switch (name) {
    case 'respond':
      return { text: args.text as string };

    case 'query_tasks': {
      try {
        const result = await listTasks(projectId, args.filter as string | undefined);
        sendSSE(res, 'action', {
          type: 'navigate',
          payload: { view: 'task-manager' },
          label: 'Open Task Manager',
        });
        return result;
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Failed to query tasks' };
      }
    }

    case 'query_tickets': {
      try {
        const result = await listTickets(projectId, args.filter as string | undefined);
        sendSSE(res, 'action', {
          type: 'navigate',
          payload: { view: 'ticket-queue' },
          label: 'Open Ticket Queue',
        });
        return result;
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Failed to query tickets' };
      }
    }

    case 'navigate': {
      const view = args.view as string;
      sendSSE(res, 'action', {
        type: 'navigate',
        payload: { view },
        label: `Open ${view}`,
      });
      return { navigated: view };
    }

    case 'create_task': {
      try {
        const task = await createTask(
          projectId,
          args.title as string,
          args.description as string | undefined,
        );
        sendSSE(res, 'action', {
          type: 'create_task',
          payload: { title: args.title },
          label: 'Task created',
        });
        return task;
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Failed to create task' };
      }
    }

    case 'open_doc': {
      const docId = args.docId as string;
      sendSSE(res, 'action', {
        type: 'open_doc',
        payload: { docId },
        label: `Open ${docId}`,
      });
      return { opened: docId };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

/**
 * Cancel active streams for a conversation.
 */
export function cancelIntent(_conversationId: string): string[] {
  return [];
}
