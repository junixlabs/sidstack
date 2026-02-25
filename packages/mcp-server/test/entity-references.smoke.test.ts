/**
 * Smoke Tests - Entity Reference Handlers
 *
 * Validates entity reference CRUD operations via API client.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mockApiClient, resetMockApiClient } from './setup';
import {
  handleEntityLink,
  handleEntityUnlink,
  handleEntityReferences,
} from '../src/tools/handlers/entity-references';

describe('Entity Reference Handlers (Smoke)', () => {
  beforeEach(() => {
    resetMockApiClient();
  });

  describe('handleEntityLink', () => {
    it('creates a reference between entities', async () => {
      const result = await handleEntityLink({
        sourceType: 'task',
        sourceId: 'task-1',
        targetType: 'session',
        targetId: 'session-1',
        relationship: 'creates',
      });
      expect(result.success).toBe(true);
      expect(result.reference).toBeDefined();
      expect(mockApiClient.references.create).toHaveBeenCalledOnce();
      expect(mockApiClient.references.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'task',
          sourceId: 'task-1',
          targetType: 'session',
          targetId: 'session-1',
          relationship: 'creates',
        }),
      );
    });

    it('returns error for duplicate reference (409)', async () => {
      mockApiClient.references.create.mockRejectedValueOnce(
        Object.assign(new Error('UNIQUE constraint'), { status: 409 }),
      );
      const result = await handleEntityLink({
        sourceType: 'task',
        sourceId: 'task-1',
        targetType: 'session',
        targetId: 'session-1',
        relationship: 'creates',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });
  });

  describe('handleEntityUnlink', () => {
    it('removes a reference', async () => {
      const result = await handleEntityUnlink({
        sourceType: 'task',
        sourceId: 'task-1',
        targetType: 'session',
        targetId: 'session-1',
        relationship: 'creates',
      });
      expect(result.success).toBe(true);
      expect(mockApiClient.references.deleteByLink).toHaveBeenCalledOnce();
      expect(mockApiClient.references.deleteByLink).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'task',
          sourceId: 'task-1',
          targetType: 'session',
          targetId: 'session-1',
          relationship: 'creates',
        }),
      );
    });
  });

  describe('handleEntityReferences', () => {
    it('queries references for an entity (depth=1)', async () => {
      mockApiClient.references.query.mockResolvedValueOnce({ references: [], total: 0 });
      const result = await handleEntityReferences({
        entityType: 'task',
        entityId: 'task-1',
      });
      expect(result.success).toBe(true);
      expect(result.references).toBeDefined();
      expect(mockApiClient.references.query).toHaveBeenCalledOnce();
    });

    it('uses getRelated for depth > 1', async () => {
      mockApiClient.references.getRelated.mockResolvedValueOnce({
        references: [
          { id: 'ref-1', sourceType: 'task', sourceId: 'task-1', targetType: 'session', targetId: 'session-1', relationship: 'creates' },
        ],
        total: 1,
      });
      const result = await handleEntityReferences({
        entityType: 'task',
        entityId: 'task-1',
        maxDepth: 2,
      });
      expect(result.success).toBe(true);
      expect(result.depth).toBe(2);
      expect(mockApiClient.references.getRelated).toHaveBeenCalledWith(
        'task', 'task-1', { maxDepth: 2 },
      );
      expect(mockApiClient.references.query).not.toHaveBeenCalled();
    });
  });
});
