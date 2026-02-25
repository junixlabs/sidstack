/**
 * Ticket to Release API Routes
 *
 * Endpoints for managing tickets from external sources,
 * reviewing them, and starting Claude sessions for analysis.
 */

import { Router } from 'express';
import { getDB } from '@sidstack/shared';
import type {
  TicketStatus,
  TicketType,
  TicketPriority,
  TicketSource,
} from '@sidstack/shared';
import { emitSseEvent } from '../events';

export const ticketsRouter: Router = Router();

// =============================================================================
// CRUD Operations
// =============================================================================

// Create a new ticket
ticketsRouter.post('/', async (req, res) => {
  try {
    const db = await getDB();
    const {
      projectId,
      externalId,
      source = 'api',
      title,
      description,
      type = 'task',
      priority = 'medium',
      labels = [],
      attachments = [],
      linkedIssues = [],
      externalUrls = [],
      reporter,
      assignee,
    } = req.body;

    if (!projectId || !title) {
      return res.status(400).json({ error: 'projectId and title are required' });
    }

    // Check if ticket with same externalId already exists
    if (externalId) {
      const existing = db.getTicketByExternalId(externalId, projectId);
      if (existing) {
        return res.status(409).json({
          error: 'Ticket with this externalId already exists',
          existingTicket: existing,
        });
      }
    }

    // Ensure project exists
    let project = db.getProject(projectId);
    if (!project) {
      project = db.createProject({
        id: projectId,
        name: projectId,
        path: process.cwd(),
        status: 'active',
      });
    }

    const ticket = db.createTicket({
      projectId,
      externalId,
      source: source as TicketSource,
      title,
      description: description || '',
      type: type as TicketType,
      priority: priority as TicketPriority,
      status: 'new',
      labels: JSON.stringify(labels),
      attachments: JSON.stringify(attachments),
      linkedIssues: JSON.stringify(linkedIssues),
      externalUrls: JSON.stringify(externalUrls),
      reporter,
      assignee,
    });

    emitSseEvent({
      type: 'ticket_created',
      projectId,
      entityId: ticket.id,
      title: ticket.title,
      summary: `New ${type} ticket`,
      timestamp: Date.now(),
    });

    res.status(201).json({
      success: true,
      ticket: {
        ...ticket,
        labels: JSON.parse(ticket.labels),
        attachments: JSON.parse(ticket.attachments),
        linkedIssues: JSON.parse(ticket.linkedIssues),
        externalUrls: JSON.parse(ticket.externalUrls),
      },
    });
  } catch (error) {
    console.error('Failed to create ticket:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// List tickets with filters
ticketsRouter.get('/', async (req, res) => {
  try {
    const db = await getDB();

    const projectId = (req.query.projectId as string) || 'default';
    const status = req.query.status as TicketStatus | TicketStatus[] | undefined;
    const type = req.query.type as TicketType | TicketType[] | undefined;
    const priority = req.query.priority as TicketPriority | TicketPriority[] | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

    const tickets = db.listTickets(projectId, { status, type, priority, limit, offset });

    // Parse JSON fields for response
    const parsed = tickets.map((t) => ({
      ...t,
      labels: JSON.parse(t.labels),
      attachments: JSON.parse(t.attachments),
      linkedIssues: JSON.parse(t.linkedIssues),
      externalUrls: JSON.parse(t.externalUrls),
    }));

    const total = db.countTickets(projectId);

    res.json({ success: true, tickets: parsed, total });
  } catch (error) {
    console.error('Failed to list tickets:', error);
    res.status(500).json({ error: 'Failed to list tickets' });
  }
});

// Get ticket by ID
ticketsRouter.get('/:id', async (req, res) => {
  try {
    const db = await getDB();
    const ticket = db.getTicket(req.params.id);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json({
      success: true,
      ticket: {
        ...ticket,
        labels: JSON.parse(ticket.labels),
        attachments: JSON.parse(ticket.attachments),
        linkedIssues: JSON.parse(ticket.linkedIssues),
        externalUrls: JSON.parse(ticket.externalUrls),
      },
    });
  } catch (error) {
    console.error('Failed to get ticket:', error);
    res.status(500).json({ error: 'Failed to get ticket' });
  }
});

// Update ticket
ticketsRouter.patch('/:id', async (req, res) => {
  try {
    const db = await getDB();
    const {
      title,
      description,
      type,
      priority,
      status,
      labels,
      attachments,
      linkedIssues,
      externalUrls,
      taskId,
      sessionId,
      assignee,
    } = req.body;

    const updates: Record<string, unknown> = {};

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (type !== undefined) updates.type = type;
    if (priority !== undefined) updates.priority = priority;
    if (status !== undefined) updates.status = status;
    if (labels !== undefined) updates.labels = JSON.stringify(labels);
    if (attachments !== undefined) updates.attachments = JSON.stringify(attachments);
    if (linkedIssues !== undefined) updates.linkedIssues = JSON.stringify(linkedIssues);
    if (externalUrls !== undefined) updates.externalUrls = JSON.stringify(externalUrls);
    if (taskId !== undefined) updates.taskId = taskId;
    if (sessionId !== undefined) updates.sessionId = sessionId;
    if (assignee !== undefined) updates.assignee = assignee;

    const ticket = db.updateTicket(req.params.id, updates);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    emitSseEvent({
      type: 'ticket_updated',
      projectId: ticket.projectId,
      entityId: ticket.id,
      title: ticket.title,
      summary: status ? `Ticket status → ${status}` : 'Ticket updated',
      timestamp: Date.now(),
    });

    res.json({
      success: true,
      ticket: {
        ...ticket,
        labels: JSON.parse(ticket.labels),
        attachments: JSON.parse(ticket.attachments),
        linkedIssues: JSON.parse(ticket.linkedIssues),
        externalUrls: JSON.parse(ticket.externalUrls),
      },
    });
  } catch (error) {
    console.error('Failed to update ticket:', error);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

// Delete ticket
ticketsRouter.delete('/:id', async (req, res) => {
  try {
    const db = await getDB();
    const ticket = db.getTicket(req.params.id);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    db.deleteTicket(req.params.id);
    res.json({ success: true, message: 'Ticket deleted' });
  } catch (error) {
    console.error('Failed to delete ticket:', error);
    res.status(500).json({ error: 'Failed to delete ticket' });
  }
});

// =============================================================================
// Ticket Actions
// =============================================================================

// Convert ticket to task
ticketsRouter.post('/:id/convert-to-task', async (req, res) => {
  try {
    const db = await getDB();
    const ticket = db.getTicket(req.params.id);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Check if already converted
    if (ticket.taskId) {
      const existingTask = db.getTask(ticket.taskId);
      if (existingTask) {
        return res.status(409).json({
          error: 'Ticket already converted to task',
          task: existingTask,
        });
      }
    }

    // Map ticket type to task type
    const taskTypeMap: Record<TicketType, string> = {
      bug: 'bugfix',
      feature: 'feature',
      improvement: 'refactor',
      task: 'feature',
      epic: 'feature',
    };

    // Create task from ticket
    const task = db.createTask({
      projectId: ticket.projectId,
      title: `[${taskTypeMap[ticket.type as TicketType].toUpperCase()}] ${ticket.title}`,
      description: `From ticket: ${ticket.externalId || ticket.id}\n\n${ticket.description}`,
      status: 'pending',
      priority: ticket.priority === 'critical' ? 'high' : ticket.priority as 'low' | 'medium' | 'high',
      taskType: taskTypeMap[ticket.type as TicketType] as 'feature' | 'bugfix' | 'refactor',
      createdBy: 'ticket-system',
    });

    // Link ticket to task
    db.updateTicket(ticket.id, {
      taskId: task.id,
      status: 'approved',
    });

    res.json({
      success: true,
      task,
      ticket: {
        ...ticket,
        taskId: task.id,
        status: 'approved',
      },
    });
  } catch (error) {
    console.error('Failed to convert ticket to task:', error);
    res.status(500).json({ error: 'Failed to convert ticket to task' });
  }
});

