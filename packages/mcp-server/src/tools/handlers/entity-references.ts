/**
 * Entity Reference MCP Tools (Project Intelligence Hub)
 *
 * Tools for creating, querying, and removing typed references
 * between all SidStack entities.
 */

import { getDB } from '@sidstack/shared';
import type {
  SidStackDB,
  EntityType,
  EntityReferenceRelationship,
} from '@sidstack/shared';

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

export const entityReferenceTools = [
  {
    name: 'entity_link',
    description: 'Create a typed reference between two SidStack entities. Supports all entity types: task, session, knowledge, capability, impact, ticket, incident, lesson, rule, skill.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceType: {
          type: 'string',
          description: 'Source entity type',
          enum: ['task', 'session', 'knowledge', 'capability', 'impact', 'ticket', 'incident', 'lesson', 'rule', 'skill'],
        },
        sourceId: { type: 'string', description: 'Source entity ID' },
        targetType: {
          type: 'string',
          description: 'Target entity type',
          enum: ['task', 'session', 'knowledge', 'capability', 'impact', 'ticket', 'incident', 'lesson', 'rule', 'skill'],
        },
        targetId: { type: 'string', description: 'Target entity ID' },
        relationship: {
          type: 'string',
          description: 'Relationship type between entities',
          enum: [
            'converts_to', 'implemented_by', 'analyzed_by', 'requires_context',
            'governed_by', 'creates', 'discovers', 'describes', 'codified_from',
            'originates_from', 'generates', 'enables', 'depends_on', 'feeds_into',
            'blocks', 'related_to', 'mentions',
          ],
        },
        metadata: {
          type: 'object',
          description: 'Optional metadata (JSON object)',
        },
        createdBy: {
          type: 'string',
          description: 'Who created this reference (user, agent:session-id, system)',
          default: 'agent',
        },
      },
      required: ['sourceType', 'sourceId', 'targetType', 'targetId', 'relationship'],
    },
  },
  {
    name: 'entity_unlink',
    description: 'Remove a typed reference between two SidStack entities.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceType: {
          type: 'string',
          description: 'Source entity type',
          enum: ['task', 'session', 'knowledge', 'capability', 'impact', 'ticket', 'incident', 'lesson', 'rule', 'skill'],
        },
        sourceId: { type: 'string', description: 'Source entity ID' },
        targetType: {
          type: 'string',
          description: 'Target entity type',
          enum: ['task', 'session', 'knowledge', 'capability', 'impact', 'ticket', 'incident', 'lesson', 'rule', 'skill'],
        },
        targetId: { type: 'string', description: 'Target entity ID' },
        relationship: {
          type: 'string',
          description: 'Relationship type to remove',
          enum: [
            'converts_to', 'implemented_by', 'analyzed_by', 'requires_context',
            'governed_by', 'creates', 'discovers', 'describes', 'codified_from',
            'originates_from', 'generates', 'enables', 'depends_on', 'feeds_into',
            'blocks', 'related_to', 'mentions',
          ],
        },
      },
      required: ['sourceType', 'sourceId', 'targetType', 'targetId', 'relationship'],
    },
  },
  {
    name: 'entity_references',
    description: 'Query entity references. Supports forward, reverse, and bidirectional traversal. Can query by source, target, or entity (both directions). Supports depth traversal for discovering transitive connections.',
    inputSchema: {
      type: 'object',
      properties: {
        entityType: {
          type: 'string',
          description: 'Entity type to query (searches both source and target)',
          enum: ['task', 'session', 'knowledge', 'capability', 'impact', 'ticket', 'incident', 'lesson', 'rule', 'skill'],
        },
        entityId: { type: 'string', description: 'Entity ID to query' },
        direction: {
          type: 'string',
          description: 'Query direction: forward (source), reverse (target), both (default)',
          enum: ['forward', 'reverse', 'both'],
          default: 'both',
        },
        relationshipTypes: {
          type: 'array',
          description: 'Filter by relationship types',
          items: {
            type: 'string',
            enum: [
              'converts_to', 'implemented_by', 'analyzed_by', 'requires_context',
              'governed_by', 'creates', 'discovers', 'describes', 'codified_from',
              'originates_from', 'generates', 'enables', 'depends_on', 'feeds_into',
              'blocks', 'related_to', 'mentions',
            ],
          },
        },
        maxDepth: {
          type: 'number',
          description: 'Max traversal depth (1 = direct connections only, 2+ = transitive). Default 1.',
          default: 1,
        },
        limit: { type: 'number', description: 'Max results to return (default 100)', default: 100 },
      },
      required: ['entityType', 'entityId'],
    },
  },
];

// =============================================================================
// Handler Functions
// =============================================================================

export async function handleEntityLink(args: {
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  relationship: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}) {
  const database = await getDatabase();

  try {
    const ref = database.createEntityReference({
      sourceType: args.sourceType as EntityType,
      sourceId: args.sourceId,
      targetType: args.targetType as EntityType,
      targetId: args.targetId,
      relationship: args.relationship as EntityReferenceRelationship,
      metadata: args.metadata,
      createdBy: args.createdBy || 'agent',
    });

    return {
      success: true,
      reference: ref,
    };
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return {
        success: false,
        error: 'Reference already exists between these entities with this relationship',
      };
    }
    return {
      success: false,
      error: `Failed to create reference: ${error.message}`,
    };
  }
}

export async function handleEntityUnlink(args: {
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  relationship: string;
}) {
  const database = await getDatabase();

  const deleted = database.deleteEntityReferenceByLink(
    args.sourceType as EntityType,
    args.sourceId,
    args.targetType as EntityType,
    args.targetId,
    args.relationship as EntityReferenceRelationship,
  );

  if (!deleted) {
    return {
      success: false,
      error: 'Reference not found',
    };
  }

  return { success: true };
}

export async function handleEntityReferences(args: {
  entityType: string;
  entityId: string;
  direction?: string;
  relationshipTypes?: string[];
  maxDepth?: number;
  limit?: number;
}) {
  const database = await getDatabase();
  const maxDepth = args.maxDepth || 1;

  if (maxDepth > 1) {
    // Depth traversal
    const refs = database.getRelatedEntities(
      args.entityType as EntityType,
      args.entityId,
      maxDepth,
    );

    // Filter by relationship types if specified
    const filtered = args.relationshipTypes
      ? refs.filter(r => args.relationshipTypes!.includes(r.relationship))
      : refs;

    return {
      success: true,
      references: filtered,
      total: filtered.length,
      depth: maxDepth,
    };
  }

  // Direct query
  const relationship = args.relationshipTypes as EntityReferenceRelationship[] | undefined;
  const refs = database.queryEntityReferences({
    entityType: args.entityType as EntityType,
    entityId: args.entityId,
    direction: (args.direction as 'forward' | 'reverse' | 'both') || 'both',
    relationship,
    limit: args.limit || 100,
  });

  const total = database.countEntityReferences({
    entityType: args.entityType as EntityType,
    entityId: args.entityId,
    direction: (args.direction as 'forward' | 'reverse' | 'both') || 'both',
    relationship,
  });

  return {
    success: true,
    references: refs,
    total,
  };
}
