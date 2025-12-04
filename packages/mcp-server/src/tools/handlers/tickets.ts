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

import { SidStackDB, getDB } from '@sidstack/shared';
import type { TicketStatus, TicketType, TicketPriority, TicketSource, TerminalApp } from '@sidstack/shared';

// Database instance
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
    description: 'List tickets with optional filters.',
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
          description: 'Max tickets to return (default: 50)',
          default: 50,
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
  const database = await getDatabase();

  // Check for existing ticket with same externalId
  if (args.externalId) {
    const existing = database.getTicketByExternalId(args.externalId, args.projectId);
    if (existing) {
      return {
        success: false,
        error: 'Ticket with this externalId already exists',
        existingTicket: existing,
      };
    }
  }

  // Ensure project exists
  let project = database.getProject(args.projectId);
  if (!project) {
    project = database.createProject({
      id: args.projectId,
      name: args.projectId,
      path: process.cwd(),
      status: 'active',
    });
  }

  const ticket = database.createTicket({
    projectId: args.projectId,
    externalId: args.externalId,
    source: args.source || 'api',
    title: args.title,
    description: args.description || '',
    type: args.type || 'task',
    priority: args.priority || 'medium',
    status: 'new',
    labels: JSON.stringify(args.labels || []),
    attachments: '[]',
    linkedIssues: '[]',
    externalUrls: JSON.stringify(args.externalUrls || []),
    reporter: args.reporter,
  });

  return {
    success: true,
    ticket: {
      ...ticket,
      labels: JSON.parse(ticket.labels),
      attachments: [],
      linkedIssues: [],
      externalUrls: JSON.parse(ticket.externalUrls),
    },
  };
}

export async function handleTicketList(args: {
  projectId: string;
  status?: TicketStatus[];
  type?: TicketType[];
  priority?: TicketPriority[];
  limit?: number;
}) {
  const database = await getDatabase();

  const tickets = database.listTickets(args.projectId, {
    status: args.status,
    type: args.type,
    priority: args.priority,
    limit: args.limit || 50,
  });

  const parsed = tickets.map((t) => ({
    ...t,
    labels: JSON.parse(t.labels),
    attachments: JSON.parse(t.attachments),
    linkedIssues: JSON.parse(t.linkedIssues),
    externalUrls: JSON.parse(t.externalUrls),
  }));

  const total = database.countTickets(args.projectId);

  return {
    success: true,
    tickets: parsed,
    total,
  };
}

export async function handleTicketGet(args: { ticketId: string }) {
  const database = await getDatabase();
  const ticket = database.getTicket(args.ticketId);

  if (!ticket) {
    return { success: false, error: 'Ticket not found' };
  }

  return {
    success: true,
    ticket: {
      ...ticket,
      labels: JSON.parse(ticket.labels),
      attachments: JSON.parse(ticket.attachments),
      linkedIssues: JSON.parse(ticket.linkedIssues),
      externalUrls: JSON.parse(ticket.externalUrls),
    },
  };
}

export async function handleTicketUpdate(args: {
  ticketId: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assignee?: string;
  labels?: string[];
}) {
  const database = await getDatabase();

  const updates: Record<string, unknown> = {};
  if (args.status !== undefined) updates.status = args.status;
  if (args.priority !== undefined) updates.priority = args.priority;
  if (args.assignee !== undefined) updates.assignee = args.assignee;
  if (args.labels !== undefined) updates.labels = JSON.stringify(args.labels);

  const ticket = database.updateTicket(args.ticketId, updates);

  if (!ticket) {
    return { success: false, error: 'Ticket not found' };
  }

  return {
    success: true,
    ticket: {
      ...ticket,
      labels: JSON.parse(ticket.labels),
      attachments: JSON.parse(ticket.attachments),
      linkedIssues: JSON.parse(ticket.linkedIssues),
      externalUrls: JSON.parse(ticket.externalUrls),
    },
  };
}

export async function handleTicketStartSession(args: {
  ticketId: string;
  workspacePath: string;
  terminal?: string;
}) {
  const database = await getDatabase();
  const ticket = database.getTicket(args.ticketId);

  if (!ticket) {
    return { success: false, error: 'Ticket not found' };
  }

  const labels = JSON.parse(ticket.labels);
  const linkedIssues = JSON.parse(ticket.linkedIssues);
  const externalUrls = JSON.parse(ticket.externalUrls);

  // Build context prompt
  const contextPrompt = buildTicketContextPrompt(ticket, labels, linkedIssues, externalUrls);

  // Create Claude session
  const session = database.createClaudeSession({
    workspacePath: args.workspacePath,
    terminal: (args.terminal || 'iTerm') as TerminalApp,
    launchMode: 'normal',
    initialPrompt: contextPrompt,
  });

  // Update ticket with session link
  database.updateTicket(ticket.id, {
    sessionId: session.id,
    status: 'in_progress',
  });

  // Log event
  database.logSessionEvent({
    claudeSessionId: session.id,
    eventType: 'launched',
    details: {
      source: 'ticket',
      ticketId: ticket.id,
      ticketTitle: ticket.title,
    },
  });

  return {
    success: true,
    session,
    contextPrompt,
    message: `Session started. Use this prompt to initialize Claude Code:\n\n${contextPrompt}`,
  };
}

export async function handleTicketConvertToTask(args: { ticketId: string }) {
  const database = await getDatabase();
  const ticket = database.getTicket(args.ticketId);

  if (!ticket) {
    return { success: false, error: 'Ticket not found' };
  }

  // Check if already converted
  if (ticket.taskId) {
    const existingTask = database.getTask(ticket.taskId);
    if (existingTask) {
      return {
        success: false,
        error: 'Ticket already converted to task',
        task: existingTask,
      };
    }
  }

  // Map ticket type to task type
  const taskTypeMap: Record<string, string> = {
    bug: 'bugfix',
    feature: 'feature',
    improvement: 'refactor',
    task: 'feature',
    epic: 'feature',
  };

  const taskType = taskTypeMap[ticket.type] || 'feature';

  // Create task from ticket
  const task = database.createTask({
    projectId: ticket.projectId,
    title: `[${taskType.toUpperCase()}] ${ticket.title}`,
    description: `From ticket: ${ticket.externalId || ticket.id}\n\n${ticket.description}`,
    status: 'pending',
    priority: ticket.priority === 'critical' ? 'high' : (ticket.priority as 'low' | 'medium' | 'high'),
    taskType: taskType as 'feature' | 'bugfix' | 'refactor',
    createdBy: 'ticket-system',
  });

  // Link ticket to task
  database.updateTicket(ticket.id, {
    taskId: task.id,
    status: 'approved',
  });

  return {
    success: true,
    task,
    ticketId: ticket.id,
    message: `Ticket converted to task: ${task.id}`,
  };
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
