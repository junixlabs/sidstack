/**
 * Smoke Tests - Ticket Handlers
 *
 * Validates that ticket handler functions:
 * 1. Accept valid arguments without throwing
 * 2. Return correctly shaped responses
 * 3. Call expected API client methods
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mockApiClient, resetMockApiClient } from './setup';
import { ApiClientError } from '@sidstack/shared';
import {
  handleTicketCreate,
  handleTicketList,
  handleTicketGet,
  handleTicketUpdate,
  handleTicketConvertToTask,
} from '../src/tools/handlers/tickets';

describe('Ticket Handlers (Smoke)', () => {
  beforeEach(() => {
    resetMockApiClient();
  });

  describe('handleTicketCreate', () => {
    it('creates a ticket with required args', async () => {
      const result = await handleTicketCreate({
        projectId: 'test-project',
        title: 'Test Bug',
      });
      expect(result.success).toBe(true);
      expect(result.ticket).toBeDefined();
      expect(mockApiClient.tickets.create).toHaveBeenCalledOnce();
      expect(mockApiClient.tickets.create).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'test-project', title: 'Test Bug' }),
      );
    });

    it('returns error for duplicate externalId (409)', async () => {
      mockApiClient.tickets.create.mockRejectedValueOnce(
        new ApiClientError('Conflict', 409, { existingTicket: { id: 'existing' } }),
      );
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
      mockApiClient.tickets.list.mockResolvedValueOnce({ tickets: [], total: 0 });
      const result = await handleTicketList({ projectId: 'test-project' });
      expect(result.success).toBe(true);
      expect(result.tickets).toBeInstanceOf(Array);
      expect(typeof result.total).toBe('number');
      expect(mockApiClient.tickets.list).toHaveBeenCalledOnce();
    });
  });

  describe('handleTicketGet', () => {
    it('returns error for non-existent ticket (404)', async () => {
      mockApiClient.tickets.get.mockRejectedValueOnce(
        new ApiClientError('Not found', 404),
      );
      const result = await handleTicketGet({ ticketId: 'nonexistent' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('returns ticket when found', async () => {
      mockApiClient.tickets.get.mockResolvedValueOnce({
        success: true,
        ticket: { id: 'ticket-1', title: 'Found', labels: [], attachments: [] },
      });
      const result = await handleTicketGet({ ticketId: 'ticket-1' });
      expect(result.success).toBe(true);
      expect(result.ticket).toBeDefined();
      expect(mockApiClient.tickets.get).toHaveBeenCalledWith('ticket-1');
    });
  });

  describe('handleTicketUpdate', () => {
    it('returns error for non-existent ticket (404)', async () => {
      mockApiClient.tickets.update.mockRejectedValueOnce(
        new ApiClientError('Not found', 404),
      );
      const result = await handleTicketUpdate({ ticketId: 'nonexistent', status: 'approved' });
      expect(result.success).toBe(false);
    });

    it('updates ticket when found', async () => {
      mockApiClient.tickets.update.mockResolvedValueOnce({
        success: true,
        ticket: { id: 'ticket-1', title: 'Existing', status: 'approved' },
      });
      const result = await handleTicketUpdate({ ticketId: 'ticket-1', status: 'approved' });
      expect(result.success).toBe(true);
      expect(mockApiClient.tickets.update).toHaveBeenCalledWith('ticket-1', { status: 'approved' });
    });
  });

  describe('handleTicketConvertToTask', () => {
    it('converts ticket to task successfully', async () => {
      mockApiClient.tickets.convertToTask.mockResolvedValueOnce({
        success: true,
        task: { id: 'task-new', title: '[BUGFIX] Fix login bug', status: 'pending' },
        ticket: { id: 'ticket-1', taskId: 'task-new', status: 'in_progress' },
      });

      const result = await handleTicketConvertToTask({ ticketId: 'ticket-1' });
      expect(result.success).toBe(true);
      expect(result.task).toBeDefined();
      expect(mockApiClient.tickets.convertToTask).toHaveBeenCalledWith('ticket-1');
    });

    it('returns error for non-existent ticket (404)', async () => {
      mockApiClient.tickets.convertToTask.mockRejectedValueOnce(
        new ApiClientError('Not found', 404),
      );
      const result = await handleTicketConvertToTask({ ticketId: 'nonexistent' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('rejects already-converted ticket (409)', async () => {
      mockApiClient.tickets.convertToTask.mockRejectedValueOnce(
        new ApiClientError('Conflict', 409, { task: { id: 'task-existing' } }),
      );
      const result = await handleTicketConvertToTask({ ticketId: 'ticket-1' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('already converted');
    });
  });
});
