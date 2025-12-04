/**
 * Capability Registry MCP Tools (Project Intelligence Hub)
 *
 * Tools for managing business-level capability definitions.
 */

import {
  loadAllCapabilities,
  loadCapability,
  writeCapability,
  resolveHierarchy,
  queryCapabilities,
  getCapabilityStats,
  capabilitiesExist,
} from '@sidstack/shared';
import type { CapabilityDefinition, CapabilityQuery } from '@sidstack/shared';

function getProjectPath(): string {
  return process.env.SIDSTACK_PROJECT_PATH || process.cwd();
}

// =============================================================================
// Tool Definitions
// =============================================================================

export const capabilityTools = [
  {
    name: 'capability_list',
    description: 'List all capabilities in the registry with optional filters. Returns capability definitions and stats.',
    inputSchema: {
      type: 'object',
      properties: {
        level: {
          type: 'string',
          enum: ['L0', 'L1', 'L2'],
          description: 'Filter by hierarchy level',
        },
        status: {
          type: 'string',
          enum: ['planned', 'active', 'deprecated'],
          description: 'Filter by status',
        },
        maturity: {
          type: 'string',
          enum: ['planned', 'developing', 'established', 'optimized'],
          description: 'Filter by maturity',
        },
        parent: { type: 'string', description: 'Filter by parent capability ID' },
        tag: { type: 'string', description: 'Filter by tag' },
        moduleId: { type: 'string', description: 'Filter by linked module ID' },
        hierarchy: {
          type: 'boolean',
          description: 'If true, returns resolved hierarchy tree instead of flat list',
          default: false,
        },
      },
    },
  },
  {
    name: 'capability_get',
    description: 'Get a single capability by ID with full definition including purpose, business rules, requirements, and glossary.',
    inputSchema: {
      type: 'object',
      properties: {
        capabilityId: { type: 'string', description: 'The capability ID' },
      },
      required: ['capabilityId'],
    },
  },
  {
    name: 'capability_create',
    description: 'Create a new capability definition. Writes a YAML file to .sidstack/capabilities/.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique capability ID (kebab-case)' },
        name: { type: 'string', description: 'Display name' },
        level: { type: 'string', enum: ['L0', 'L1', 'L2'], description: 'Hierarchy level' },
        parent: { type: 'string', description: 'Parent capability ID (for L1/L2)' },
        purpose: { type: 'string', description: 'What business value does this provide?' },
        businessRules: {
          type: 'array',
          items: { type: 'string' },
          description: 'Business rules governing this capability',
        },
        requirements: {
          type: 'array',
          items: { type: 'string' },
          description: 'Requirements for this capability to function',
        },
        glossary: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              term: { type: 'string' },
              definition: { type: 'string' },
            },
            required: ['term', 'definition'],
          },
          description: 'Domain-specific terms',
        },
        status: { type: 'string', enum: ['planned', 'active', 'deprecated'], default: 'planned' },
        maturity: { type: 'string', enum: ['planned', 'developing', 'established', 'optimized'], default: 'planned' },
        relationships: {
          type: 'object',
          properties: {
            enables: { type: 'array', items: { type: 'string' } },
            dependsOn: { type: 'array', items: { type: 'string' } },
            feedsInto: { type: 'array', items: { type: 'string' } },
          },
          description: 'Relationships to other capabilities',
        },
        modules: {
          type: 'array',
          items: { type: 'string' },
          description: 'Linked module IDs',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for filtering',
        },
        owner: { type: 'string', description: 'Owner of this capability' },
      },
      required: ['id', 'name', 'level', 'purpose'],
    },
  },
  {
    name: 'capability_update',
    description: 'Update an existing capability definition. Merges provided fields with the existing definition.',
    inputSchema: {
      type: 'object',
      properties: {
        capabilityId: { type: 'string', description: 'The capability ID to update' },
        name: { type: 'string', description: 'New display name' },
        purpose: { type: 'string', description: 'New purpose description' },
        businessRules: { type: 'array', items: { type: 'string' } },
        requirements: { type: 'array', items: { type: 'string' } },
        glossary: {
          type: 'array',
          items: {
            type: 'object',
            properties: { term: { type: 'string' }, definition: { type: 'string' } },
          },
        },
        status: { type: 'string', enum: ['planned', 'active', 'deprecated'] },
        maturity: { type: 'string', enum: ['planned', 'developing', 'established', 'optimized'] },
        relationships: {
          type: 'object',
          properties: {
            enables: { type: 'array', items: { type: 'string' } },
            dependsOn: { type: 'array', items: { type: 'string' } },
            feedsInto: { type: 'array', items: { type: 'string' } },
          },
        },
        modules: { type: 'array', items: { type: 'string' } },
        tags: { type: 'array', items: { type: 'string' } },
        owner: { type: 'string' },
      },
      required: ['capabilityId'],
    },
  },
];

// =============================================================================
// Handler Functions
// =============================================================================

export async function handleCapabilityList(args: {
  level?: string;
  status?: string;
  maturity?: string;
  parent?: string;
  tag?: string;
  moduleId?: string;
  hierarchy?: boolean;
}): Promise<Record<string, unknown>> {
  const projectPath = getProjectPath();

  if (!capabilitiesExist(projectPath)) {
    return { success: true, capabilities: [], stats: null, exists: false };
  }

  const all = loadAllCapabilities(projectPath);
  const definitions = all.map((c) => c.definition);

  if (args.hierarchy) {
    const tree = resolveHierarchy(definitions);
    const stats = getCapabilityStats(definitions);
    return { success: true, tree, stats };
  }

  const query: CapabilityQuery = {};
  if (args.level) query.level = args.level as any;
  if (args.status) query.status = args.status as any;
  if (args.maturity) query.maturity = args.maturity as any;
  if (args.parent) query.parent = args.parent;
  if (args.tag) query.tag = args.tag;
  if (args.moduleId) query.moduleId = args.moduleId;

  const hasFilters = Object.keys(query).length > 0;
  const filtered = hasFilters ? queryCapabilities(definitions, query) : definitions;
  const stats = getCapabilityStats(definitions);

  return { success: true, capabilities: filtered, stats, exists: true };
}

export async function handleCapabilityGet(args: {
  capabilityId: string;
}): Promise<Record<string, unknown>> {
  const projectPath = getProjectPath();
  const loaded = loadCapability(projectPath, args.capabilityId);

  if (!loaded) {
    return { success: false, error: `Capability '${args.capabilityId}' not found` };
  }

  return { success: true, capability: loaded.definition, filePath: loaded.filePath };
}

export async function handleCapabilityCreate(args: {
  id: string;
  name: string;
  level: string;
  parent?: string;
  purpose: string;
  businessRules?: string[];
  requirements?: string[];
  glossary?: Array<{ term: string; definition: string }>;
  status?: string;
  maturity?: string;
  relationships?: { enables?: string[]; dependsOn?: string[]; feedsInto?: string[] };
  modules?: string[];
  tags?: string[];
  owner?: string;
}): Promise<Record<string, unknown>> {
  const projectPath = getProjectPath();

  // Check if already exists
  const existing = loadCapability(projectPath, args.id);
  if (existing) {
    return { success: false, error: `Capability '${args.id}' already exists` };
  }

  const definition: CapabilityDefinition = {
    id: args.id,
    name: args.name,
    level: args.level as any,
    parent: args.parent,
    purpose: args.purpose,
    businessRules: args.businessRules,
    requirements: args.requirements,
    glossary: args.glossary,
    status: (args.status as any) || 'planned',
    maturity: (args.maturity as any) || 'planned',
    relationships: args.relationships,
    modules: args.modules,
    tags: args.tags,
    owner: args.owner,
  };

  const filePath = writeCapability(projectPath, definition);
  return { success: true, capability: definition, filePath };
}

export async function handleCapabilityUpdate(args: {
  capabilityId: string;
  [key: string]: unknown;
}): Promise<Record<string, unknown>> {
  const projectPath = getProjectPath();
  const loaded = loadCapability(projectPath, args.capabilityId);

  if (!loaded) {
    return { success: false, error: `Capability '${args.capabilityId}' not found` };
  }

  const { capabilityId, ...updates } = args;
  const updated: CapabilityDefinition = {
    ...loaded.definition,
    ...(updates as Partial<CapabilityDefinition>),
    id: loaded.definition.id, // Prevent ID change
  };

  const filePath = writeCapability(projectPath, updated);
  return { success: true, capability: updated, filePath };
}
