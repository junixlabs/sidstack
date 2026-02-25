/**
 * Ticket MCP Tool Handlers
 *
 * Tools for managing tickets (Ticket to Release feature):
 * - ticket_create: Create a new ticket
 * - ticket_list: List tickets with filters
 * - ticket_get: Get ticket by ID
 * - ticket_update: Update ticket
 * - ticket_start_session: Start Claude session with ticket context
 * - ticket_convert_to_task: Convert ticket to task
 */

import type { TicketStatus, TicketType, TicketPriority, TicketSource } from '@sidstack/shared';
import { createApiClient, ApiClientError } from '@sidstack/shared';

// =============================================================================
// Tool Definitions
// =============================================================================

export const ticketTools = [
  {
    name: 'ticket_create',
    description: 'Create a new ticket from external source (Jira, GitHub, etc.) or manual input.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID to create ticket in',
        },
        title: {
          type: 'string',
          description: 'Ticket title',
        },
        description: {
          type: 'string',
          description: 'Ticket description',
        },
        type: {
          type: 'string',
          enum: ['bug', 'feature', 'improvement', 'task', 'epic'],
          description: 'Ticket type',
          default: 'task',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Ticket priority',
          default: 'medium',
        },
        externalId: {
          type: 'string',
          description: 'External ID from source system (e.g., JIRA-123, #456)',
        },
        source: {
          type: 'string',
          enum: ['api', 'jira', 'github', 'linear', 'manual'],
          description: 'Ticket source',
          default: 'api',
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Labels/tags for the ticket',
        },
        externalUrls: {
          type: 'array',
          items: { type: 'string' },
          description: 'External reference URLs',
        },
        reporter: {
          type: 'string',
          description: 'Reporter name or email',
        },
      },
      required: ['projectId', 'title'],
    },
  },
  {
    name: 'ticket_list',
    description: 'List tickets with optional filters. Default returns compact mode (truncated descriptions, array counts).',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID to list tickets for',
        },
        status: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['new', 'reviewing', 'approved', 'in_progress', 'completed', 'rejected'],
          },
          description: 'Filter by status(es)',
        },
        type: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['bug', 'feature', 'improvement', 'task', 'epic'],
          },
          description: 'Filter by type(s)',
        },
        priority: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
          },
          description: 'Filter by priority(s)',
        },
        limit: {
          type: 'number',
          description: 'Max tickets to return (default: 20)',
          default: 20,
        },
        compact: {
          type: 'boolean',
          description: 'Compact mode: truncate description, return array counts instead of full arrays (default: true)',
          default: true,
        },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'ticket_get',
    description: 'Get a ticket by ID with full details.',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: {
          type: 'string',
          description: 'Ticket ID',
        },
      },
      required: ['ticketId'],
    },
  },
  {
    name: 'ticket_update',
    description: 'Update a ticket status or other fields.',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: {
          type: 'string',
          description: 'Ticket ID to update',
        },
        status: {
          type: 'string',
          enum: ['new', 'reviewing', 'approved', 'in_progress', 'completed', 'rejected'],
          description: 'New status',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'New priority',
        },
        assignee: {
          type: 'string',
          description: 'Assignee name',
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Updated labels',
        },
      },
      required: ['ticketId'],
    },
  },
  {
    name: 'ticket_start_session',
    description: 'Start a Claude Code session with ticket context injected. Returns session details and context prompt.',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: {
          type: 'string',
          description: 'Ticket ID to start session for',
        },
        workspacePath: {
          type: 'string',
          description: 'Workspace path for the session',
        },
        terminal: {
          type: 'string',
          description: 'Terminal type (default: external)',
          default: 'external',
        },
      },
      required: ['ticketId', 'workspacePath'],
    },
  },
  {
    name: 'ticket_convert_to_task',
    description: 'Convert a ticket to a task for agent execution.',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: {
          type: 'string',
          description: 'Ticket ID to convert',
        },
      },
      required: ['ticketId'],
    },
  },
];

// =============================================================================
// Tool Handlers
// =============================================================================

export async function handleTicketCreate(args: {
  projectId: string;
  title: string;
  description?: string;
  type?: TicketType;
  priority?: TicketPriority;
  externalId?: string;
  source?: TicketSource;
  labels?: string[];
  externalUrls?: string[];
  reporter?: string;
}) {
  const apiClient = createApiClient();

  try {
    const result = await apiClient.tickets.create({
      projectId: args.projectId,
      title: args.title,
      description: args.description,
      type: args.type,
      priority: args.priority,
      externalId: args.externalId,
      source: args.source,
      labels: args.labels,
      externalUrls: args.externalUrls,
      reporter: args.reporter,
    });

    return result;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 409) {
      return {
        success: false,
        error: 'Ticket with this externalId already exists',
        existingTicket: (error.body as any)?.existingTicket,
      };
    }
    throw error;
  }
}

export async function handleTicketList(args: {
  projectId: string;
  status?: TicketStatus[];
  type?: TicketType[];
  priority?: TicketPriority[];
  limit?: number;
  compact?: boolean;
}) {
  const apiClient = createApiClient();
  const compact = args.compact !== false; // default true

  // API expects comma-separated strings for array filters
  const statusJoined = args.status?.join(',');
  const typeJoined = args.type?.join(',');
  const priorityJoined = args.priority?.join(',');

  const result = await apiClient.tickets.list({
    projectId: args.projectId,
    status: statusJoined,
    type: typeJoined,
    priority: priorityJoined,
    limit: String(args.limit || 20),
  } as any);

  // API already parses JSON fields (labels, attachments, etc.)
  // Apply compact mode transformation if needed
  const tickets = result.tickets || [];

  const mapped = tickets.map((t: any) => {
    if (compact) {
      // Compact mode: truncate description, return array counts
      const labels = Array.isArray(t.labels) ? t.labels : [];
      const attachments = Array.isArray(t.attachments) ? t.attachments : [];
      const linkedIssues = Array.isArray(t.linkedIssues) ? t.linkedIssues : [];
      const externalUrls = Array.isArray(t.externalUrls) ? t.externalUrls : [];
      return {
        id: t.id,
        title: t.title,
        description: t.description ? t.description.slice(0, 150) + (t.description.length > 150 ? '...' : '') : '',
        type: t.type,
        priority: t.priority,
        status: t.status,
        externalId: t.externalId,
        assignee: t.assignee,
        taskId: t.taskId,
        labelsCount: labels.length,
        attachmentsCount: attachments.length,
        linkedIssuesCount: linkedIssues.length,
        externalUrlsCount: externalUrls.length,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
    }
    // Full mode — pass through as-is from API
    return t;
  });

  return {
    success: true,
    tickets: mapped,
    total: result.total,
    compact,
  };
}

export async function handleTicketGet(args: { ticketId: string }) {
  const apiClient = createApiClient();

  try {
    const result = await apiClient.tickets.get(args.ticketId);
    return result;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      return { success: false, error: 'Ticket not found' };
    }
    throw error;
  }
}

export async function handleTicketUpdate(args: {
  ticketId: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assignee?: string;
  labels?: string[];
}) {
  const apiClient = createApiClient();

  const updates: Record<string, unknown> = {};
  if (args.status !== undefined) updates.status = args.status;
  if (args.priority !== undefined) updates.priority = args.priority;
  if (args.assignee !== undefined) updates.assignee = args.assignee;
  if (args.labels !== undefined) updates.labels = args.labels;

  try {
    const result = await apiClient.tickets.update(args.ticketId, updates);
    return result;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      return { success: false, error: 'Ticket not found' };
    }
    throw error;
  }
}

export async function handleTicketStartSession(args: {
  ticketId: string;
  workspacePath: string;
  terminal?: string;
}) {
  const apiClient = createApiClient();

  // Fetch ticket via API
  let ticketResult: any;
  try {
    ticketResult = await apiClient.tickets.get(args.ticketId);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      return { success: false, error: 'Ticket not found' };
    }
    throw error;
  }

  const ticket = ticketResult.ticket;
  if (!ticket) {
    return { success: false, error: 'Ticket not found' };
  }

  // API already returns parsed arrays
  const labels = Array.isArray(ticket.labels) ? ticket.labels : [];
  const linkedIssues = Array.isArray(ticket.linkedIssues) ? ticket.linkedIssues : [];
  const externalUrls = Array.isArray(ticket.externalUrls) ? ticket.externalUrls : [];

  // Build context prompt
  const contextPrompt = buildTicketContextPrompt(ticket, labels, linkedIssues, externalUrls);

  // Update ticket status to in_progress via API
  try {
    await apiClient.tickets.update(ticket.id, { status: 'in_progress' });
  } catch {
    // Non-critical: continue even if status update fails
  }

  return {
    success: true,
    contextPrompt,
    message: `Session started. Use this prompt to initialize Claude Code:\n\n${contextPrompt}`,
  };
}

export async function handleTicketConvertToTask(args: { ticketId: string }) {
  const apiClient = createApiClient();

  try {
    const result = await apiClient.tickets.convertToTask(args.ticketId);
    return result;
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.status === 404) {
        return { success: false, error: 'Ticket not found' };
      }
      if (error.status === 409) {
        return {
          success: false,
          error: 'Ticket already converted to task',
          task: (error.body as any)?.task,
        };
      }
    }
    throw error;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function buildTicketContextPrompt(
  ticket: { id: string; externalId?: string; title: string; description: string; type: string; priority: string },
  labels: string[],
  linkedIssues: { id: string; type: string; title?: string }[],
  externalUrls: string[]
): string {
  const lines: string[] = [
    '# Ticket Context',
    '',
    `**Ticket ID:** ${ticket.externalId || ticket.id}`,
    `**Type:** ${ticket.type}`,
    `**Priority:** ${ticket.priority}`,
    '',
    `## Title`,
    ticket.title,
    '',
    `## Description`,
    ticket.description || '_No description provided_',
    '',
  ];

  if (labels.length > 0) {
    lines.push(`## Labels`);
    lines.push(labels.map((l) => `- ${l}`).join('\n'));
    lines.push('');
  }

  if (linkedIssues.length > 0) {
    lines.push(`## Linked Issues`);
    linkedIssues.forEach((issue) => {
      lines.push(`- [${issue.type}] ${issue.id}${issue.title ? `: ${issue.title}` : ''}`);
    });
    lines.push('');
  }

  if (externalUrls.length > 0) {
    lines.push(`## Reference URLs`);
    externalUrls.forEach((url) => {
      lines.push(`- ${url}`);
    });
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('Please analyze this ticket and:');
  lines.push('1. Research the codebase to understand the current state');
  lines.push('2. Recommend optimal solutions with trade-offs');
  lines.push('3. Break down into actionable tasks if approved');
  lines.push('');

  return lines.join('\n');
}
