/**
 * Entity Reference MCP Tools (Project Intelligence Hub)
 *
 * Tools for creating, querying, and removing typed references
 * between all SidStack entities.
 *
 * Uses API client instead of direct database access.
 */

import { createApiClient } from '@sidstack/shared';

const apiClient = createApiClient();

// =============================================================================
// Tool Definitions
// =============================================================================

export const entityReferenceTools = [
  {
    name: 'entity_link',
    description: 'Create a typed reference between two SidStack entities. Supports all entity types: task, session, knowledge, impact, ticket, incident, lesson, rule, skill.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceType: {
          type: 'string',
          description: 'Source entity type',
          enum: ['task', 'session', 'knowledge', 'impact', 'ticket', 'incident', 'lesson', 'rule', 'skill', 'test_result'],
        },
        sourceId: { type: 'string', description: 'Source entity ID' },
        targetType: {
          type: 'string',
          description: 'Target entity type',
          enum: ['task', 'session', 'knowledge', 'impact', 'ticket', 'incident', 'lesson', 'rule', 'skill', 'test_result'],
        },
        targetId: { type: 'string', description: 'Target entity ID' },
        relationship: {
          type: 'string',
          description: 'Relationship type between entities',
          enum: [
            'converts_to', 'implemented_by', 'analyzed_by', 'requires_context',
            'governed_by', 'creates', 'discovers', 'describes', 'codified_from',
            'originates_from', 'generates', 'enables', 'depends_on', 'feeds_into',
            'blocks', 'validates', 'related_to', 'mentions',
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
          enum: ['task', 'session', 'knowledge', 'impact', 'ticket', 'incident', 'lesson', 'rule', 'skill', 'test_result'],
        },
        sourceId: { type: 'string', description: 'Source entity ID' },
        targetType: {
          type: 'string',
          description: 'Target entity type',
          enum: ['task', 'session', 'knowledge', 'impact', 'ticket', 'incident', 'lesson', 'rule', 'skill', 'test_result'],
        },
        targetId: { type: 'string', description: 'Target entity ID' },
        relationship: {
          type: 'string',
          description: 'Relationship type to remove',
          enum: [
            'converts_to', 'implemented_by', 'analyzed_by', 'requires_context',
            'governed_by', 'creates', 'discovers', 'describes', 'codified_from',
            'originates_from', 'generates', 'enables', 'depends_on', 'feeds_into',
            'blocks', 'validates', 'related_to', 'mentions',
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
          enum: ['task', 'session', 'knowledge', 'impact', 'ticket', 'incident', 'lesson', 'rule', 'skill', 'test_result'],
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
  try {
    const result = await apiClient.references.create({
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      targetType: args.targetType,
      targetId: args.targetId,
      relationship: args.relationship,
      metadata: args.metadata,
      createdBy: args.createdBy || 'agent',
    });

    return {
      success: true,
      reference: result.reference,
    };
  } catch (error: any) {
    if (error.status === 409 || error.message?.includes('UNIQUE constraint')) {
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
  try {
    await apiClient.references.deleteByLink({
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      targetType: args.targetType,
      targetId: args.targetId,
      relationship: args.relationship,
    });

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Reference not found',
    };
  }
}

export async function handleEntityReferences(args: {
  entityType: string;
  entityId: string;
  direction?: string;
  relationshipTypes?: string[];
  maxDepth?: number;
  limit?: number;
}) {
  const maxDepth = args.maxDepth || 1;

  if (maxDepth > 1) {
    // Depth traversal via related endpoint
    const result = await apiClient.references.getRelated(
      args.entityType,
      args.entityId,
      { maxDepth },
    );

    // Filter by relationship types if specified
    const refs = result.references || [];
    const filtered = args.relationshipTypes
      ? refs.filter((r: any) => args.relationshipTypes!.includes(r.relationship))
      : refs;

    return {
      success: true,
      references: filtered,
      total: filtered.length,
      depth: maxDepth,
    };
  }

  // Direct query
  const query: Record<string, string | undefined> = {
    entityType: args.entityType,
    entityId: args.entityId,
    direction: args.direction || 'both',
    limit: String(args.limit || 100),
  };
  if (args.relationshipTypes) {
    query.relationship = args.relationshipTypes.join(',');
  }

  const result = await apiClient.references.query(query);

  return {
    success: true,
    references: result.references || [],
    total: result.total || 0,
  };
}
