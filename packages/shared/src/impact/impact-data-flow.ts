/**
 * Impact Data Flow
 *
 * Enhanced data flow analysis for impact assessment.
 * Extends the basic DataFlow with:
 * - Impact level classification (direct/indirect/cascade)
 * - Suggested tests for affected flows
 * - Affected operations detection
 * - Visualization data structures
 * - Mermaid diagram generation
 */

import type {
  ImpactDataFlow,
  ImpactLevel,
  ChangeScope,
  ParsedChange,
} from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Basic data flow from ERD analysis
 */
export interface DataFlow {
  from: string;
  to: string;
  entities: string[];
  flowType: 'read' | 'write' | 'bidirectional';
  strength: 'critical' | 'important' | 'optional';
  relationships: string[];
}

/**
 * Entity relationship from ERD
 */
export interface EntityRelationship {
  source: string;
  target: string;
  cardinality: string;
  label: string;
}

/**
 * Node for flow visualization
 */
export interface FlowNode {
  id: string;
  label: string;
  type: 'entity' | 'module';
  impactLevel?: ImpactLevel;
  isAffected: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Edge for flow visualization
 */
export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  flowType: 'read' | 'write' | 'bidirectional';
  strength: 'critical' | 'important' | 'optional';
  impactLevel?: ImpactLevel;
  isAffected: boolean;
}

/**
 * Complete flow graph for visualization
 */
export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
  metadata: {
    totalNodes: number;
    totalEdges: number;
    affectedNodes: number;
    affectedEdges: number;
    criticalityScore: number;
  };
}

/**
 * Mermaid diagram output
 */
export interface MermaidDiagram {
  type: 'flowchart' | 'erDiagram';
  code: string;
  title: string;
}

// =============================================================================
// Test Generation Templates
// =============================================================================

interface TestTemplate {
  pattern: RegExp;
  template: string;
}

const TEST_TEMPLATES: TestTemplate[] = [
  {
    pattern: /creates?|generates?/i,
    template: 'Test that {{source}} correctly creates {{target}} with valid data',
  },
  {
    pattern: /owns?|contains?/i,
    template: 'Verify {{source}} ownership of {{target}} persists after change',
  },
  {
    pattern: /has|have/i,
    template: 'Verify {{source}} can access associated {{target}} records',
  },
  {
    pattern: /belongsTo|references?/i,
    template: 'Test {{target}} reference integrity from {{source}}',
  },
  {
    pattern: /updates?|modifies?/i,
    template: 'Verify {{source}} updates to {{target}} propagate correctly',
  },
  {
    pattern: /deletes?|removes?/i,
    template: 'Test cascade delete behavior from {{source}} to {{target}}',
  },
];

// =============================================================================
// Operation Detection Patterns
// =============================================================================

interface OperationPattern {
  relationship: RegExp;
  operations: string[];
}

const OPERATION_PATTERNS: OperationPattern[] = [
  {
    relationship: /creates?|generates?/i,
    operations: ['INSERT', 'CREATE'],
  },
  {
    relationship: /owns?|contains?|has/i,
    operations: ['SELECT', 'JOIN', 'DELETE'],
  },
  {
    relationship: /updates?|modifies?/i,
    operations: ['UPDATE', 'PATCH'],
  },
  {
    relationship: /deletes?|removes?/i,
    operations: ['DELETE', 'CASCADE'],
  },
  {
    relationship: /reads?|fetches?|gets?/i,
    operations: ['SELECT', 'READ'],
  },
  {
    relationship: /writes?|saves?|stores?/i,
    operations: ['INSERT', 'UPDATE', 'UPSERT'],
  },
];

// =============================================================================
// Impact Data Flow Analyzer
// =============================================================================

export class ImpactDataFlowAnalyzer {
  /**
   * Analyze data flows and add impact-specific information
   */
  analyzeForImpact(
    dataFlows: DataFlow[],
    scope: ChangeScope,
    _parsed: ParsedChange
  ): ImpactDataFlow[] {
    return dataFlows.map((flow, index) => {
      const impactLevel = this.classifyImpactLevel(flow, scope);
      const suggestedTests = this.generateSuggestedTests(flow);
      const affectedOperations = this.detectAffectedOperations(flow);
      const validationRequired = this.determineValidationRequired(flow, impactLevel);

      return {
        id: `flow-${index}-${Date.now()}`,
        from: flow.from,
        to: flow.to,
        entities: flow.entities,
        flowType: flow.flowType,
        strength: flow.strength,
        relationships: flow.relationships,
        impactLevel,
        affectedOperations,
        validationRequired,
        suggestedTests,
      };
    });
  }

  /**
   * Classify the impact level of a flow based on scope
   */
  private classifyImpactLevel(flow: DataFlow, scope: ChangeScope): ImpactLevel {
    // Check if entities are in affected entities
    const hasDirectEntity = flow.entities.some(
      entity => scope.affectedEntities.includes(entity)
    );

    // Check if modules are primary
    const isPrimaryModule =
      scope.primaryModules.includes(flow.from) ||
      scope.primaryModules.includes(flow.to);

    // Check if modules are dependent
    const isDependentModule = scope.dependentModules.some(
      dep => dep.moduleId === flow.from || dep.moduleId === flow.to
    );

    if (isPrimaryModule && hasDirectEntity) {
      return 'direct';
    } else if (isDependentModule || hasDirectEntity) {
      return 'indirect';
    } else {
      return 'cascade';
    }
  }

  /**
   * Generate suggested tests for a flow
   */
  private generateSuggestedTests(flow: DataFlow): string[] {
    const tests: string[] = [];

    for (const relationship of flow.relationships) {
      for (const template of TEST_TEMPLATES) {
        if (template.pattern.test(relationship)) {
          const test = template.template
            .replace('{{source}}', flow.entities[0] || flow.from)
            .replace('{{target}}', flow.entities[1] || flow.to);
          tests.push(test);
        }
      }
    }

    // Add generic tests based on flow type
    if (flow.flowType === 'bidirectional') {
      tests.push(`Test bidirectional sync between ${flow.from} and ${flow.to}`);
    }

    if (flow.strength === 'critical') {
      tests.push(`Verify critical data integrity for ${flow.entities.join(' -> ')} flow`);
    }

    // Deduplicate
    return [...new Set(tests)];
  }

  /**
   * Detect affected operations based on relationship labels
   */
  private detectAffectedOperations(flow: DataFlow): string[] {
    const operations = new Set<string>();

    for (const relationship of flow.relationships) {
      for (const pattern of OPERATION_PATTERNS) {
        if (pattern.relationship.test(relationship)) {
          pattern.operations.forEach(op => operations.add(op));
        }
      }
    }

    // Add default operations based on flow type
    switch (flow.flowType) {
      case 'read':
        operations.add('SELECT');
        operations.add('READ');
        break;
      case 'write':
        operations.add('INSERT');
        operations.add('UPDATE');
        break;
      case 'bidirectional':
        operations.add('SELECT');
        operations.add('INSERT');
        operations.add('UPDATE');
        break;
    }

    return Array.from(operations);
  }

  /**
   * Determine if validation is required for a flow
   */
  private determineValidationRequired(flow: DataFlow, impactLevel: ImpactLevel): boolean {
    // Always require validation for critical flows
    if (flow.strength === 'critical') {
      return true;
    }

    // Require validation for direct impacts
    if (impactLevel === 'direct') {
      return true;
    }

    // Require validation for important indirect impacts
    if (impactLevel === 'indirect' && flow.strength === 'important') {
      return true;
    }

    return false;
  }

  /**
   * Build a flow graph for visualization
   */
  buildFlowGraph(
    impactFlows: ImpactDataFlow[],
    scope: ChangeScope
  ): FlowGraph {
    const nodeMap = new Map<string, FlowNode>();
    const edges: FlowEdge[] = [];

    // Build nodes from flows
    for (const flow of impactFlows) {
      // Add entity nodes
      for (const entity of flow.entities) {
        if (!nodeMap.has(entity)) {
          const isAffected = scope.affectedEntities.includes(entity);
          nodeMap.set(entity, {
            id: entity,
            label: entity,
            type: 'entity',
            impactLevel: isAffected ? flow.impactLevel : undefined,
            isAffected,
          });
        }
      }

      // Add module nodes
      for (const module of [flow.from, flow.to]) {
        if (!nodeMap.has(module)) {
          const isPrimary = scope.primaryModules.includes(module);
          const depModule = scope.dependentModules.find(d => d.moduleId === module);

          nodeMap.set(module, {
            id: module,
            label: module,
            type: 'module',
            impactLevel: isPrimary ? 'direct' : depModule?.impactLevel,
            isAffected: isPrimary || !!depModule,
          });
        }
      }

      // Add edge
      edges.push({
        id: flow.id,
        source: flow.from,
        target: flow.to,
        label: flow.relationships.join(', '),
        flowType: flow.flowType,
        strength: flow.strength,
        impactLevel: flow.impactLevel,
        isAffected: flow.validationRequired,
      });
    }

    const nodes = Array.from(nodeMap.values());
    const affectedNodes = nodes.filter(n => n.isAffected).length;
    const affectedEdges = edges.filter(e => e.isAffected).length;

    // Calculate criticality score (0-1)
    const criticalityScore = this.calculateCriticalityScore(impactFlows, nodes, edges);

    return {
      nodes,
      edges,
      metadata: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        affectedNodes,
        affectedEdges,
        criticalityScore,
      },
    };
  }

  /**
   * Calculate criticality score for the flow graph
   */
  private calculateCriticalityScore(
    flows: ImpactDataFlow[],
    nodes: FlowNode[],
    _edges: FlowEdge[]
  ): number {
    if (flows.length === 0) return 0;

    let score = 0;

    // Weight by flow strength
    for (const flow of flows) {
      if (flow.strength === 'critical') score += 3;
      else if (flow.strength === 'important') score += 2;
      else score += 1;
    }

    // Weight by impact level
    for (const flow of flows) {
      if (flow.impactLevel === 'direct') score += 2;
      else if (flow.impactLevel === 'indirect') score += 1;
    }

    // Weight by affected nodes ratio
    const affectedRatio = nodes.filter(n => n.isAffected).length / nodes.length;
    score *= (1 + affectedRatio);

    // Normalize to 0-1 range
    const maxScore = flows.length * 5 * 2; // max strength (3) + max impact (2) per flow, * 2 for ratio
    return Math.min(score / maxScore, 1);
  }

  /**
   * Generate Mermaid flowchart diagram
   */
  generateFlowchartDiagram(
    graph: FlowGraph,
    title: string = 'Data Flow Impact'
  ): MermaidDiagram {
    const lines: string[] = ['flowchart TD'];

    // Add title as comment
    lines.push(`    %% ${title}`);
    lines.push('');

    // Add nodes with styling
    for (const node of graph.nodes) {
      const shape = node.type === 'module' ? '([' : '((';
      const shapeEnd = node.type === 'module' ? '])' : '))';
      const nodeId = this.sanitizeId(node.id);

      lines.push(`    ${nodeId}${shape}"${node.label}"${shapeEnd}`);
    }

    lines.push('');

    // Add edges with labels and styling
    for (const edge of graph.edges) {
      const sourceId = this.sanitizeId(edge.source);
      const targetId = this.sanitizeId(edge.target);

      let arrow = '-->';
      if (edge.flowType === 'bidirectional') arrow = '<-->';
      else if (edge.flowType === 'write') arrow = '-..->';

      const label = edge.label ? `|"${edge.label}"|` : '';
      lines.push(`    ${sourceId} ${arrow}${label} ${targetId}`);
    }

    lines.push('');

    // Add styling for affected nodes
    const affectedNodes = graph.nodes.filter(n => n.isAffected);
    if (affectedNodes.length > 0) {
      lines.push('    %% Styling');

      // Style direct impact
      const directNodes = affectedNodes
        .filter(n => n.impactLevel === 'direct')
        .map(n => this.sanitizeId(n.id));
      if (directNodes.length > 0) {
        lines.push(`    style ${directNodes.join(',')} fill:#ff6b6b,stroke:#c92a2a`);
      }

      // Style indirect impact
      const indirectNodes = affectedNodes
        .filter(n => n.impactLevel === 'indirect')
        .map(n => this.sanitizeId(n.id));
      if (indirectNodes.length > 0) {
        lines.push(`    style ${indirectNodes.join(',')} fill:#ffd43b,stroke:#f59f00`);
      }

      // Style cascade impact
      const cascadeNodes = affectedNodes
        .filter(n => n.impactLevel === 'cascade')
        .map(n => this.sanitizeId(n.id));
      if (cascadeNodes.length > 0) {
        lines.push(`    style ${cascadeNodes.join(',')} fill:#69db7c,stroke:#37b24d`);
      }
    }

    return {
      type: 'flowchart',
      code: lines.join('\n'),
      title,
    };
  }

  /**
   * Generate Mermaid ER diagram
   */
  generateERDiagram(
    graph: FlowGraph,
    title: string = 'Entity Relationships'
  ): MermaidDiagram {
    const lines: string[] = ['erDiagram'];
    lines.push(`    %% ${title}`);
    lines.push('');

    // Add relationships
    const entityEdges = graph.edges.filter(e => {
      const sourceNode = graph.nodes.find(n => n.id === e.source);
      const targetNode = graph.nodes.find(n => n.id === e.target);
      return sourceNode?.type === 'entity' || targetNode?.type === 'entity';
    });

    for (const edge of entityEdges) {
      const cardinality = this.flowTypeToCardinality(edge.flowType);
      const label = edge.label.split(',')[0]?.trim() || 'relates';
      const sourceId = this.sanitizeId(edge.source);
      const targetId = this.sanitizeId(edge.target);

      lines.push(`    ${sourceId} ${cardinality} ${targetId} : "${label}"`);
    }

    return {
      type: 'erDiagram',
      code: lines.join('\n'),
      title,
    };
  }

  /**
   * Convert flow type to Mermaid ER cardinality
   */
  private flowTypeToCardinality(flowType: string): string {
    switch (flowType) {
      case 'read':
        return '||--o{';
      case 'write':
        return '}o--||';
      case 'bidirectional':
        return '}o--o{';
      default:
        return '||--||';
    }
  }

  /**
   * Sanitize ID for Mermaid
   */
  private sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9]/g, '_');
  }

  /**
   * Get flow statistics
   */
  getFlowStatistics(flows: ImpactDataFlow[]): {
    total: number;
    byStrength: Record<string, number>;
    byImpactLevel: Record<ImpactLevel, number>;
    byFlowType: Record<string, number>;
    requiresValidation: number;
    totalSuggestedTests: number;
  } {
    const stats = {
      total: flows.length,
      byStrength: {
        critical: 0,
        important: 0,
        optional: 0,
      },
      byImpactLevel: {
        direct: 0,
        indirect: 0,
        cascade: 0,
      } as Record<ImpactLevel, number>,
      byFlowType: {
        read: 0,
        write: 0,
        bidirectional: 0,
      },
      requiresValidation: 0,
      totalSuggestedTests: 0,
    };

    for (const flow of flows) {
      stats.byStrength[flow.strength]++;
      stats.byImpactLevel[flow.impactLevel]++;
      stats.byFlowType[flow.flowType]++;
      if (flow.validationRequired) stats.requiresValidation++;
      stats.totalSuggestedTests += flow.suggestedTests.length;
    }

    return stats;
  }
}

// =============================================================================
// Export singleton instance
// =============================================================================

export const impactDataFlowAnalyzer = new ImpactDataFlowAnalyzer();
