/**
 * Entity Reference API Routes
 *
 * Endpoints for managing typed, bidirectional references
 * between all SidStack entities (Project Intelligence Hub).
 *
 * IMPORTANT: Specific routes (/link, /related, /bulk) MUST be defined
 * before parameterized routes (/:id) to avoid incorrect matching.
 */

import { Router } from 'express';
import { getDB } from '@sidstack/shared';
import type {
  EntityType,
  EntityReferenceRelationship,
} from '@sidstack/shared';

export const referencesRouter: Router = Router();

// =============================================================================
// POST /api/references -- Create a reference
// =============================================================================
referencesRouter.post('/', async (req, res) => {
  try {
    const db = await getDB();
    const { sourceType, sourceId, targetType, targetId, relationship, metadata, createdBy } = req.body;

    if (!sourceType || !sourceId || !targetType || !targetId || !relationship) {
      return res.status(400).json({
        error: 'Missing required fields: sourceType, sourceId, targetType, targetId, relationship',
      });
    }

    const ref = db.createEntityReference({
      sourceType: sourceType as EntityType,
      sourceId,
      targetType: targetType as EntityType,
      targetId,
      relationship: relationship as EntityReferenceRelationship,
      metadata: metadata || undefined,
      createdBy: createdBy || 'user',
    });

    res.status(201).json({ reference: ref });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Reference already exists' });
    }
    console.error('[references] Error creating reference:', error);
    res.status(500).json({ error: 'Failed to create reference' });
  }
});

// =============================================================================
// POST /api/references/bulk -- Create multiple references
// =============================================================================
referencesRouter.post('/bulk', async (req, res) => {
  try {
    const db = await getDB();
    const { references } = req.body;

    if (!Array.isArray(references) || references.length === 0) {
      return res.status(400).json({ error: 'references must be a non-empty array' });
    }

    const results = db.createEntityReferences(
      references.map((r: any) => ({
        sourceType: r.sourceType as EntityType,
        sourceId: r.sourceId,
        targetType: r.targetType as EntityType,
        targetId: r.targetId,
        relationship: r.relationship as EntityReferenceRelationship,
        metadata: r.metadata || undefined,
        createdBy: r.createdBy || 'user',
      }))
    );

    res.status(201).json({ references: results, created: results.length });
  } catch (error) {
    console.error('[references] Error creating bulk references:', error);
    res.status(500).json({ error: 'Failed to create references' });
  }
});

// =============================================================================
// DELETE /api/references/link -- Delete by source/target/relationship (BEFORE /:id)
// =============================================================================
referencesRouter.delete('/link', async (req, res) => {
  try {
    const db = await getDB();
    const { sourceType, sourceId, targetType, targetId, relationship } = req.body;

    if (!sourceType || !sourceId || !targetType || !targetId || !relationship) {
      return res.status(400).json({
        error: 'Missing required fields: sourceType, sourceId, targetType, targetId, relationship',
      });
    }

    const deleted = db.deleteEntityReferenceByLink(
      sourceType as EntityType,
      sourceId,
      targetType as EntityType,
      targetId,
      relationship as EntityReferenceRelationship,
    );

    if (!deleted) {
      return res.status(404).json({ error: 'Reference not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[references] Error deleting reference by link:', error);
    res.status(500).json({ error: 'Failed to delete reference' });
  }
});

// =============================================================================
// DELETE /api/references/:id -- Delete a reference by ID
// =============================================================================
referencesRouter.delete('/:id', async (req, res) => {
  try {
    const db = await getDB();
    const deleted = db.deleteEntityReference(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: 'Reference not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[references] Error deleting reference:', error);
    res.status(500).json({ error: 'Failed to delete reference' });
  }
});

// =============================================================================
// GET /api/references -- Query references
// =============================================================================
referencesRouter.get('/', async (req, res) => {
  try {
    const db = await getDB();
    const {
      sourceType, sourceId, targetType, targetId,
      entityType, entityId, relationship, direction,
      limit, offset,
    } = req.query;

    const relationshipFilter = relationship
      ? (relationship as string).includes(',')
        ? (relationship as string).split(',') as EntityReferenceRelationship[]
        : relationship as EntityReferenceRelationship
      : undefined;

    const refs = db.queryEntityReferences({
      sourceType: sourceType as EntityType | undefined,
      sourceId: sourceId as string | undefined,
      targetType: targetType as EntityType | undefined,
      targetId: targetId as string | undefined,
      entityType: entityType as EntityType | undefined,
      entityId: entityId as string | undefined,
      relationship: relationshipFilter,
      direction: direction as 'forward' | 'reverse' | 'both' | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    const total = db.countEntityReferences({
      sourceType: sourceType as EntityType | undefined,
      sourceId: sourceId as string | undefined,
      targetType: targetType as EntityType | undefined,
      targetId: targetId as string | undefined,
      entityType: entityType as EntityType | undefined,
      entityId: entityId as string | undefined,
      relationship: relationshipFilter,
      direction: direction as 'forward' | 'reverse' | 'both' | undefined,
    });

    res.json({ references: refs, total });
  } catch (error) {
    console.error('[references] Error querying references:', error);
    res.status(500).json({ error: 'Failed to query references' });
  }
});

// =============================================================================
// GET /api/references/related/:entityType/:entityId -- Related entities (BEFORE /:id)
// =============================================================================
referencesRouter.get('/related/:entityType/:entityId', async (req, res) => {
  try {
    const db = await getDB();
    const { entityType, entityId } = req.params;
    const maxDepth = req.query.maxDepth ? parseInt(req.query.maxDepth as string, 10) : 1;

    const refs = db.getRelatedEntities(
      entityType as EntityType,
      entityId,
      maxDepth,
    );

    res.json({ references: refs, total: refs.length });
  } catch (error) {
    console.error('[references] Error getting related entities:', error);
    res.status(500).json({ error: 'Failed to get related entities' });
  }
});

// =============================================================================
// GET /api/references/:id -- Get a single reference (AFTER specific routes)
// =============================================================================
referencesRouter.get('/:id', async (req, res) => {
  try {
    const db = await getDB();
    const ref = db.getEntityReference(req.params.id);

    if (!ref) {
      return res.status(404).json({ error: 'Reference not found' });
    }

    res.json({ reference: ref });
  } catch (error) {
    console.error('[references] Error getting reference:', error);
    res.status(500).json({ error: 'Failed to get reference' });
  }
});
