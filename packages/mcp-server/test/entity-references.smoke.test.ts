/**
 * Smoke Tests - Entity Reference Handlers
 *
 * Validates entity reference CRUD operations.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mockDB } from './setup';
import {
  handleEntityLink,
  handleEntityUnlink,
  handleEntityReferences,
} from '../src/tools/handlers/entity-references';

describe('Entity Reference Handlers (Smoke)', () => {
  beforeEach(() => {
    Object.values(mockDB).forEach((fn) => {
      if (typeof fn === 'function' && 'mockClear' in fn) fn.mockClear();
    });
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
      expect(mockDB.createEntityReference).toHaveBeenCalledOnce();
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
      expect(mockDB.deleteEntityReferenceByLink).toHaveBeenCalledOnce();
    });
  });

  describe('handleEntityReferences', () => {
    it('queries references for an entity', async () => {
      const result = await handleEntityReferences({
        entityType: 'task',
        entityId: 'task-1',
      });
      expect(result.success).toBe(true);
      expect(result.references).toBeDefined();
    });
  });
});
