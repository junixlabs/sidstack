/**
 * Smoke Tests - Ticket Handlers
 *
 * Validates that ticket handler functions:
 * 1. Accept valid arguments without throwing
 * 2. Return { success: boolean } shaped responses
 * 3. Call expected database methods
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mockDB } from './setup';
import {
  handleTicketCreate,
  handleTicketList,
  handleTicketGet,
  handleTicketUpdate,
  handleTicketConvertToTask,
} from '../src/tools/handlers/tickets';

describe('Ticket Handlers (Smoke)', () => {
  beforeEach(() => {
    Object.values(mockDB).forEach((fn) => {
      if (typeof fn === 'function' && 'mockClear' in fn) fn.mockClear();
    });
  });

  describe('handleTicketCreate', () => {
    it('creates a ticket with required args', async () => {
      const result = await handleTicketCreate({
        projectId: 'test-project',
        title: 'Test Bug',
      });
      expect(result.success).toBe(true);
      expect(result.ticket).toBeDefined();
      expect(mockDB.createTicket).toHaveBeenCalledOnce();
    });

    it('returns error for duplicate externalId', async () => {
      mockDB.getTicketByExternalId.mockReturnValueOnce({ id: 'existing' });
      const result = await handleTicketCreate({
        projectId: 'test-project',
        title: 'Dupe',
        externalId: 'JIRA-123',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });
  });

  describe('handleTicketList', () => {
    it('lists tickets for a project', async () => {
      const result = await handleTicketList({ projectId: 'test-project' });
      expect(result.success).toBe(true);
      expect(result.tickets).toBeInstanceOf(Array);
      expect(typeof result.total).toBe('number');
    });
  });

  describe('handleTicketGet', () => {
    it('returns error for non-existent ticket', async () => {
      const result = await handleTicketGet({ ticketId: 'nonexistent' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('returns ticket when found', async () => {
      mockDB.getTicket.mockReturnValueOnce({
        id: 'ticket-1', title: 'Found',
        labels: '[]', attachments: '[]', linkedIssues: '[]', externalUrls: '[]',
      });
      const result = await handleTicketGet({ ticketId: 'ticket-1' });
      expect(result.success).toBe(true);
      expect(result.ticket).toBeDefined();
    });
  });

  describe('handleTicketUpdate', () => {
    it('returns error for non-existent ticket', async () => {
      const result = await handleTicketUpdate({ ticketId: 'nonexistent', status: 'approved' });
      expect(result.success).toBe(false);
    });

    it('updates ticket when found', async () => {
      mockDB.updateTicket.mockReturnValueOnce({
        id: 'ticket-1', title: 'Existing', status: 'approved',
        labels: '[]', attachments: '[]', linkedIssues: '[]', externalUrls: '[]',
      });
      const result = await handleTicketUpdate({ ticketId: 'ticket-1', status: 'approved' });
      expect(result.success).toBe(true);
      expect(mockDB.updateTicket).toHaveBeenCalled();
    });
  });

  describe('handleTicketConvertToTask', () => {
    it('converts ticket to task successfully', async () => {
      mockDB.getTicket.mockReturnValueOnce({
        id: 'ticket-1', projectId: 'test-project', title: 'Fix login bug',
        description: 'Login fails on Safari', type: 'bug', priority: 'high',
        status: 'approved', taskId: null,
        labels: '[]', attachments: '[]', linkedIssues: '[]', externalUrls: '[]',
      });
      mockDB.createTask.mockReturnValueOnce({
        id: 'task-new', title: '[BUGFIX] Fix login bug', status: 'pending',
      });
      mockDB.updateTicket.mockReturnValueOnce({
        id: 'ticket-1', taskId: 'task-new', status: 'approved',
        labels: '[]', attachments: '[]', linkedIssues: '[]', externalUrls: '[]',
      });

      const result = await handleTicketConvertToTask({ ticketId: 'ticket-1' });
      expect(result.success).toBe(true);
      expect(result.task).toBeDefined();
      expect(mockDB.createTask).toHaveBeenCalledOnce();
      expect(mockDB.updateTicket).toHaveBeenCalled();
    });

    it('returns error for non-existent ticket', async () => {
      const result = await handleTicketConvertToTask({ ticketId: 'nonexistent' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('rejects already-converted ticket', async () => {
      mockDB.getTicket.mockReturnValueOnce({
        id: 'ticket-1', projectId: 'test-project', title: 'Already converted',
        description: '', type: 'feature', priority: 'medium',
        status: 'approved', taskId: 'task-existing',
        labels: '[]', attachments: '[]', linkedIssues: '[]', externalUrls: '[]',
      });
      mockDB.getTask.mockReturnValueOnce({
        id: 'task-existing', title: 'Existing task', status: 'pending',
      });

      const result = await handleTicketConvertToTask({ ticketId: 'ticket-1' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('already converted');
    });

    it('maps ticket types to task types correctly', async () => {
      // bug -> bugfix
      mockDB.getTicket.mockReturnValueOnce({
        id: 'ticket-bug', projectId: 'test-project', title: 'A bug',
        description: 'Bug description', type: 'bug', priority: 'medium',
        status: 'approved', taskId: null,
        labels: '[]', attachments: '[]', linkedIssues: '[]', externalUrls: '[]',
      });
      mockDB.createTask.mockReturnValueOnce({
        id: 'task-bug', title: '[BUGFIX] A bug', status: 'pending',
      });
      mockDB.updateTicket.mockReturnValueOnce({ id: 'ticket-bug' });

      const result = await handleTicketConvertToTask({ ticketId: 'ticket-bug' });
      expect(result.success).toBe(true);

      const createCall = mockDB.createTask.mock.calls[0][0];
      expect(createCall.taskType).toBe('bugfix');
      expect(createCall.title).toContain('[BUGFIX]');
    });
  });
});
