/**
 * Capability Registry Types (Project Intelligence Hub)
 *
 * Business-value layer that captures what a project CAN DO,
 * not just how it's structured. Replaces module-centric view
 * with a capability-centric view.
 *
 * Hierarchy: L0 (Domain) → L1 (Capability) → L2 (Sub-capability)
 */

// ============================================================================
// Core Types
// ============================================================================

export type CapabilityLevel = 'L0' | 'L1' | 'L2';
export type CapabilityStatus = 'planned' | 'active' | 'deprecated';
export type CapabilityMaturity = 'planned' | 'developing' | 'established' | 'optimized';

export interface GlossaryEntry {
  term: string;
  definition: string;
}

// ============================================================================
// Enriched Types (4 Professional Concepts)
// Union types ensure backward compatibility: simple strings still work,
// rich objects add Goal Tree / Bounded Context / Feature Registry metadata.
// ============================================================================

/** Goal Tree (OKR/Strategy): enriched purpose with business objective */
export interface EnrichedPurpose {
  description: string;
  objective?: string;          // Business goal this capability serves
  valueProposition?: string;   // What value it delivers
}

/** Bounded Context (DDD): enriched business rule with rationale */
export interface EnrichedBusinessRule {
  rule: string;
  rationale?: string;          // Why this rule exists
  enforcement?: 'automated' | 'manual' | 'governance';
}

/** Feature Registry (Product Management): enriched requirement with status/criteria */
export interface EnrichedRequirement {
  description: string;
  acceptanceCriteria?: string[];
  status?: 'planned' | 'in-progress' | 'done';
  completeness?: number;       // 0-100
}

export type CapabilityPurpose = string | EnrichedPurpose;
export type CapabilityBusinessRule = string | EnrichedBusinessRule;
export type CapabilityRequirement = string | EnrichedRequirement;

export interface CapabilityRelationships {
  enables?: string[];     // Capabilities this one enables
  dependsOn?: string[];   // Capabilities this depends on
  feedsInto?: string[];   // Data/value flows to these capabilities
}

// ============================================================================
// Capability Definition (YAML-driven)
// ============================================================================

export interface CapabilityDefinition {
  id: string;
  name: string;
  level: CapabilityLevel;
  parent?: string;            // ID of parent capability (L1 → L0, L2 → L1)
  purpose: CapabilityPurpose;           // Goal Tree: string or { description, objective?, valueProposition? }
  businessRules?: CapabilityBusinessRule[];  // Bounded Context: string[] or enriched rules with rationale
  requirements?: CapabilityRequirement[];   // Feature Registry: string[] or enriched with status/criteria
  glossary?: GlossaryEntry[]; // Domain-specific terms
  status: CapabilityStatus;
  maturity: CapabilityMaturity;
  relationships?: CapabilityRelationships;
  modules?: string[];         // Linked module IDs (for migration)
  tags?: string[];
  owner?: string;
}

// ============================================================================
// Loaded Capability (with file metadata)
// ============================================================================

export interface LoadedCapability {
  definition: CapabilityDefinition;
  filePath: string;
  fileName: string;
}

// ============================================================================
// Hierarchy Node (resolved tree)
// ============================================================================

export interface CapabilityNode {
  capability: CapabilityDefinition;
  children: CapabilityNode[];
  depth: number;
}

// ============================================================================
// Registry Query/Response
// ============================================================================

export interface CapabilityQuery {
  level?: CapabilityLevel;
  status?: CapabilityStatus;
  maturity?: CapabilityMaturity;
  parent?: string;
  tag?: string;
  moduleId?: string;
}

export interface CapabilityRegistryStats {
  total: number;
  byLevel: Record<CapabilityLevel, number>;
  byStatus: Record<CapabilityStatus, number>;
  byMaturity: Record<CapabilityMaturity, number>;
}
