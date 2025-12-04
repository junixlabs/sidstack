/**
 * Impact Data Flow Analyzer Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ImpactDataFlowAnalyzer,
  impactDataFlowAnalyzer,
  type DataFlow,
  type FlowGraph,
} from './impact-data-flow';
import type { ChangeScope, ParsedChange, ImpactDataFlow } from './types';

describe('ImpactDataFlowAnalyzer', () => {
  let analyzer: ImpactDataFlowAnalyzer;

  // Helper to create mock data flow
  const createMockDataFlow = (overrides: Partial<DataFlow> = {}): DataFlow => ({
    from: 'UserService',
    to: 'Database',
    entities: ['User'],
    flowType: 'write',
    strength: 'important',
    relationships: ['writes'],
    ...overrides,
  });

  // Helper to create mock scope
  const createMockScope = (overrides: Partial<ChangeScope> = {}): ChangeScope => ({
    primaryModules: ['users'],
    primaryFiles: [],
    dependentModules: [],
    affectedFiles: [],
    affectedEntities: ['User'],
    expansionDepth: 2,
    ...overrides,
  });

  // Helper to create mock parsed change
  const createMockParsed = (overrides: Partial<ParsedChange> = {}): ParsedChange => ({
    entities: ['User'],
    operations: [],
    keywords: [],
    changeType: 'feature',
    confidence: 0.8,
    ...overrides,
  });

  beforeEach(() => {
    analyzer = new ImpactDataFlowAnalyzer();
  });

  describe('analyzeForImpact', () => {
    it('should add impact-specific fields to flows', () => {
      const flows = [createMockDataFlow()];
      const scope = createMockScope();
      const parsed = createMockParsed();

      const result = analyzer.analyzeForImpact(flows, scope, parsed);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBeDefined();
      expect(result[0].impactLevel).toBeDefined();
      expect(result[0].suggestedTests).toBeDefined();
      expect(result[0].affectedOperations).toBeDefined();
      expect(result[0].validationRequired).toBeDefined();
    });

    it('should preserve original flow properties', () => {
      const flows = [createMockDataFlow({
        from: 'OrderService',
        to: 'PaymentGateway',
        entities: ['Order', 'Payment'],
        flowType: 'bidirectional',
        strength: 'critical',
        relationships: ['processes', 'confirms'],
      })];
      const scope = createMockScope();
      const parsed = createMockParsed();

      const result = analyzer.analyzeForImpact(flows, scope, parsed);

      expect(result[0].from).toBe('OrderService');
      expect(result[0].to).toBe('PaymentGateway');
      expect(result[0].entities).toContain('Order');
      expect(result[0].entities).toContain('Payment');
      expect(result[0].flowType).toBe('bidirectional');
      expect(result[0].strength).toBe('critical');
    });
  });

  describe('classifyImpactLevel', () => {
    it('should classify as direct when entity in affected and module is primary', () => {
      const flows = [createMockDataFlow({
        from: 'users',
        entities: ['User'],
      })];
      const scope = createMockScope({
        primaryModules: ['users'],
        affectedEntities: ['User'],
      });

      const result = analyzer.analyzeForImpact(flows, scope, createMockParsed());

      expect(result[0].impactLevel).toBe('direct');
    });

    it('should classify as indirect when module is dependent', () => {
      const flows = [createMockDataFlow({
        from: 'orders',
        entities: ['Order'],
      })];
      const scope = createMockScope({
        primaryModules: ['users'],
        dependentModules: [
          { moduleId: 'orders', moduleName: 'orders', impactLevel: 'direct', dependencyPath: [], reason: '' },
        ],
        affectedEntities: ['User'],
      });

      const result = analyzer.analyzeForImpact(flows, scope, createMockParsed());

      expect(result[0].impactLevel).toBe('indirect');
    });

    it('should classify as indirect when has affected entity', () => {
      const flows = [createMockDataFlow({
        from: 'external',
        entities: ['User'],
      })];
      const scope = createMockScope({
        primaryModules: ['orders'],
        affectedEntities: ['User'],
      });

      const result = analyzer.analyzeForImpact(flows, scope, createMockParsed());

      expect(result[0].impactLevel).toBe('indirect');
    });

    it('should classify as cascade when no direct connection', () => {
      const flows = [createMockDataFlow({
        from: 'analytics',
        to: 'reporting',
        entities: ['Metric'],
      })];
      const scope = createMockScope({
        primaryModules: ['users'],
        affectedEntities: ['User'],
      });

      const result = analyzer.analyzeForImpact(flows, scope, createMockParsed());

      expect(result[0].impactLevel).toBe('cascade');
    });
  });

  describe('generateSuggestedTests', () => {
    it('should generate tests for creates relationship', () => {
      const flows = [createMockDataFlow({
        relationships: ['creates'],
        entities: ['User', 'Profile'],
      })];

      const result = analyzer.analyzeForImpact(flows, createMockScope(), createMockParsed());

      expect(result[0].suggestedTests.some(t => t.includes('creates'))).toBe(true);
    });

    it('should generate tests for owns relationship', () => {
      const flows = [createMockDataFlow({
        relationships: ['owns'],
        entities: ['User', 'Post'],
      })];

      const result = analyzer.analyzeForImpact(flows, createMockScope(), createMockParsed());

      expect(result[0].suggestedTests.some(t => t.includes('ownership'))).toBe(true);
    });

    it('should generate tests for updates relationship', () => {
      const flows = [createMockDataFlow({
        relationships: ['updates'],
        entities: ['User', 'Settings'],
      })];

      const result = analyzer.analyzeForImpact(flows, createMockScope(), createMockParsed());

      expect(result[0].suggestedTests.some(t => t.includes('updates'))).toBe(true);
    });

    it('should generate tests for deletes relationship', () => {
      const flows = [createMockDataFlow({
        relationships: ['deletes'],
        entities: ['User', 'Session'],
      })];

      const result = analyzer.analyzeForImpact(flows, createMockScope(), createMockParsed());

      expect(result[0].suggestedTests.some(t => t.includes('cascade delete'))).toBe(true);
    });

    it('should add bidirectional sync test', () => {
      const flows = [createMockDataFlow({
        flowType: 'bidirectional',
      })];

      const result = analyzer.analyzeForImpact(flows, createMockScope(), createMockParsed());

      expect(result[0].suggestedTests.some(t => t.includes('bidirectional sync'))).toBe(true);
    });

    it('should add critical data integrity test', () => {
      const flows = [createMockDataFlow({
        strength: 'critical',
      })];

      const result = analyzer.analyzeForImpact(flows, createMockScope(), createMockParsed());

      expect(result[0].suggestedTests.some(t => t.includes('critical data integrity'))).toBe(true);
    });

    it('should deduplicate suggested tests', () => {
      const flows = [createMockDataFlow({
        relationships: ['creates', 'generates'],
        entities: ['User', 'Profile'],
      })];

      const result = analyzer.analyzeForImpact(flows, createMockScope(), createMockParsed());

      // Should not have duplicate tests
      const uniqueTests = [...new Set(result[0].suggestedTests)];
      expect(result[0].suggestedTests.length).toBe(uniqueTests.length);
    });
  });

  describe('detectAffectedOperations', () => {
    it('should detect INSERT/CREATE operations', () => {
      const flows = [createMockDataFlow({
        relationships: ['creates'],
      })];

      const result = analyzer.analyzeForImpact(flows, createMockScope(), createMockParsed());

      expect(result[0].affectedOperations).toContain('INSERT');
      expect(result[0].affectedOperations).toContain('CREATE');
    });

    it('should detect UPDATE/PATCH operations', () => {
      const flows = [createMockDataFlow({
        relationships: ['updates'],
      })];

      const result = analyzer.analyzeForImpact(flows, createMockScope(), createMockParsed());

      expect(result[0].affectedOperations).toContain('UPDATE');
      expect(result[0].affectedOperations).toContain('PATCH');
    });

    it('should detect DELETE operations', () => {
      const flows = [createMockDataFlow({
        relationships: ['removes'],
      })];

      const result = analyzer.analyzeForImpact(flows, createMockScope(), createMockParsed());

      expect(result[0].affectedOperations).toContain('DELETE');
    });

    it('should detect SELECT/READ operations for read flow', () => {
      const flows = [createMockDataFlow({
        flowType: 'read',
        relationships: [],
      })];

      const result = analyzer.analyzeForImpact(flows, createMockScope(), createMockParsed());

      expect(result[0].affectedOperations).toContain('SELECT');
      expect(result[0].affectedOperations).toContain('READ');
    });

    it('should detect INSERT/UPDATE operations for write flow', () => {
      const flows = [createMockDataFlow({
        flowType: 'write',
        relationships: [],
      })];

      const result = analyzer.analyzeForImpact(flows, createMockScope(), createMockParsed());

      expect(result[0].affectedOperations).toContain('INSERT');
      expect(result[0].affectedOperations).toContain('UPDATE');
    });

    it('should detect all operations for bidirectional flow', () => {
      const flows = [createMockDataFlow({
        flowType: 'bidirectional',
        relationships: [],
      })];

      const result = analyzer.analyzeForImpact(flows, createMockScope(), createMockParsed());

      expect(result[0].affectedOperations).toContain('SELECT');
      expect(result[0].affectedOperations).toContain('INSERT');
      expect(result[0].affectedOperations).toContain('UPDATE');
    });
  });

  describe('determineValidationRequired', () => {
    it('should require validation for critical flows', () => {
      const flows = [createMockDataFlow({
        strength: 'critical',
      })];

      const result = analyzer.analyzeForImpact(flows, createMockScope(), createMockParsed());

      expect(result[0].validationRequired).toBe(true);
    });

    it('should require validation for direct impact', () => {
      const flows = [createMockDataFlow({
        from: 'users',
        strength: 'important',
        entities: ['User'],
      })];
      const scope = createMockScope({
        primaryModules: ['users'],
        affectedEntities: ['User'],
      });

      const result = analyzer.analyzeForImpact(flows, scope, createMockParsed());

      expect(result[0].validationRequired).toBe(true);
    });

    it('should require validation for important indirect flows', () => {
      const flows = [createMockDataFlow({
        from: 'orders',
        strength: 'important',
        entities: ['Order'],
      })];
      const scope = createMockScope({
        primaryModules: ['users'],
        dependentModules: [
          { moduleId: 'orders', moduleName: 'orders', impactLevel: 'direct', dependencyPath: [], reason: '' },
        ],
        affectedEntities: ['User'],
      });

      const result = analyzer.analyzeForImpact(flows, scope, createMockParsed());

      expect(result[0].validationRequired).toBe(true);
    });

    it('should not require validation for optional cascade flows', () => {
      const flows = [createMockDataFlow({
        from: 'analytics',
        strength: 'optional',
        entities: ['Metric'],
      })];
      const scope = createMockScope({
        primaryModules: ['users'],
        affectedEntities: ['User'],
      });

      const result = analyzer.analyzeForImpact(flows, scope, createMockParsed());

      expect(result[0].validationRequired).toBe(false);
    });
  });

  describe('buildFlowGraph', () => {
    it('should build nodes from flows', () => {
      const impactFlows: ImpactDataFlow[] = [{
        id: 'flow-1',
        from: 'UserService',
        to: 'Database',
        entities: ['User'],
        flowType: 'write',
        strength: 'critical',
        relationships: ['writes'],
        impactLevel: 'direct',
        affectedOperations: ['INSERT'],
        validationRequired: true,
        suggestedTests: [],
      }];
      const scope = createMockScope({
        primaryModules: ['UserService'],
        affectedEntities: ['User'],
      });

      const graph = analyzer.buildFlowGraph(impactFlows, scope);

      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.nodes.some(n => n.id === 'User')).toBe(true);
      expect(graph.nodes.some(n => n.id === 'UserService')).toBe(true);
    });

    it('should build edges from flows', () => {
      const impactFlows: ImpactDataFlow[] = [{
        id: 'flow-1',
        from: 'UserService',
        to: 'Database',
        entities: ['User'],
        flowType: 'write',
        strength: 'critical',
        relationships: ['writes'],
        impactLevel: 'direct',
        affectedOperations: ['INSERT'],
        validationRequired: true,
        suggestedTests: [],
      }];
      const scope = createMockScope();

      const graph = analyzer.buildFlowGraph(impactFlows, scope);

      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0].source).toBe('UserService');
      expect(graph.edges[0].target).toBe('Database');
    });

    it('should mark affected nodes', () => {
      const impactFlows: ImpactDataFlow[] = [{
        id: 'flow-1',
        from: 'users',
        to: 'Database',
        entities: ['User'],
        flowType: 'write',
        strength: 'critical',
        relationships: ['writes'],
        impactLevel: 'direct',
        affectedOperations: ['INSERT'],
        validationRequired: true,
        suggestedTests: [],
      }];
      const scope = createMockScope({
        primaryModules: ['users'],
        affectedEntities: ['User'],
      });

      const graph = analyzer.buildFlowGraph(impactFlows, scope);

      const userNode = graph.nodes.find(n => n.id === 'User');
      expect(userNode?.isAffected).toBe(true);

      const usersNode = graph.nodes.find(n => n.id === 'users');
      expect(usersNode?.isAffected).toBe(true);
    });

    it('should calculate metadata correctly', () => {
      const impactFlows: ImpactDataFlow[] = [{
        id: 'flow-1',
        from: 'UserService',
        to: 'Database',
        entities: ['User'],
        flowType: 'write',
        strength: 'critical',
        relationships: ['writes'],
        impactLevel: 'direct',
        affectedOperations: ['INSERT'],
        validationRequired: true,
        suggestedTests: [],
      }];
      const scope = createMockScope({
        primaryModules: ['UserService'],
        affectedEntities: ['User'],
      });

      const graph = analyzer.buildFlowGraph(impactFlows, scope);

      expect(graph.metadata.totalNodes).toBeGreaterThan(0);
      expect(graph.metadata.totalEdges).toBe(1);
      expect(graph.metadata.criticalityScore).toBeGreaterThan(0);
    });
  });

  describe('generateFlowchartDiagram', () => {
    it('should generate valid Mermaid flowchart', () => {
      const graph: FlowGraph = {
        nodes: [
          { id: 'UserService', label: 'UserService', type: 'module', isAffected: true, impactLevel: 'direct' },
          { id: 'Database', label: 'Database', type: 'module', isAffected: false },
          { id: 'User', label: 'User', type: 'entity', isAffected: true, impactLevel: 'direct' },
        ],
        edges: [
          { id: 'e1', source: 'UserService', target: 'Database', label: 'writes', flowType: 'write', strength: 'critical', isAffected: true },
        ],
        metadata: { totalNodes: 3, totalEdges: 1, affectedNodes: 2, affectedEdges: 1, criticalityScore: 0.8 },
      };

      const diagram = analyzer.generateFlowchartDiagram(graph, 'Test Flow');

      expect(diagram.type).toBe('flowchart');
      expect(diagram.code).toContain('flowchart TD');
      expect(diagram.code).toContain('UserService');
      expect(diagram.code).toContain('Database');
      expect(diagram.title).toBe('Test Flow');
    });

    it('should add styling for affected nodes', () => {
      const graph: FlowGraph = {
        nodes: [
          { id: 'UserService', label: 'UserService', type: 'module', isAffected: true, impactLevel: 'direct' },
          { id: 'Analytics', label: 'Analytics', type: 'module', isAffected: true, impactLevel: 'indirect' },
        ],
        edges: [],
        metadata: { totalNodes: 2, totalEdges: 0, affectedNodes: 2, affectedEdges: 0, criticalityScore: 0.5 },
      };

      const diagram = analyzer.generateFlowchartDiagram(graph);

      expect(diagram.code).toContain('style');
      expect(diagram.code).toContain('fill:#ff6b6b'); // direct style
      expect(diagram.code).toContain('fill:#ffd43b'); // indirect style
    });

    it('should use correct arrow for bidirectional flow', () => {
      const graph: FlowGraph = {
        nodes: [
          { id: 'ServiceA', label: 'ServiceA', type: 'module', isAffected: false },
          { id: 'ServiceB', label: 'ServiceB', type: 'module', isAffected: false },
        ],
        edges: [
          { id: 'e1', source: 'ServiceA', target: 'ServiceB', label: 'syncs', flowType: 'bidirectional', strength: 'important', isAffected: false },
        ],
        metadata: { totalNodes: 2, totalEdges: 1, affectedNodes: 0, affectedEdges: 0, criticalityScore: 0.3 },
      };

      const diagram = analyzer.generateFlowchartDiagram(graph);

      expect(diagram.code).toContain('<-->');
    });
  });

  describe('generateERDiagram', () => {
    it('should generate valid Mermaid ER diagram', () => {
      const graph: FlowGraph = {
        nodes: [
          { id: 'User', label: 'User', type: 'entity', isAffected: true },
          { id: 'Order', label: 'Order', type: 'entity', isAffected: true },
        ],
        edges: [
          { id: 'e1', source: 'User', target: 'Order', label: 'has', flowType: 'read', strength: 'important', isAffected: true },
        ],
        metadata: { totalNodes: 2, totalEdges: 1, affectedNodes: 2, affectedEdges: 1, criticalityScore: 0.5 },
      };

      const diagram = analyzer.generateERDiagram(graph, 'Entity Relationships');

      expect(diagram.type).toBe('erDiagram');
      expect(diagram.code).toContain('erDiagram');
      expect(diagram.code).toContain('User');
      expect(diagram.code).toContain('Order');
      expect(diagram.title).toBe('Entity Relationships');
    });

    it('should convert flow types to cardinality', () => {
      const graph: FlowGraph = {
        nodes: [
          { id: 'User', label: 'User', type: 'entity', isAffected: true },
          { id: 'Profile', label: 'Profile', type: 'entity', isAffected: true },
        ],
        edges: [
          { id: 'e1', source: 'User', target: 'Profile', label: 'has', flowType: 'read', strength: 'important', isAffected: true },
        ],
        metadata: { totalNodes: 2, totalEdges: 1, affectedNodes: 2, affectedEdges: 1, criticalityScore: 0.5 },
      };

      const diagram = analyzer.generateERDiagram(graph);

      expect(diagram.code).toContain('||--o{');
    });
  });

  describe('getFlowStatistics', () => {
    it('should calculate statistics correctly', () => {
      const flows: ImpactDataFlow[] = [
        {
          id: 'flow-1',
          from: 'A',
          to: 'B',
          entities: [],
          flowType: 'write',
          strength: 'critical',
          relationships: [],
          impactLevel: 'direct',
          affectedOperations: [],
          validationRequired: true,
          suggestedTests: ['test1', 'test2'],
        },
        {
          id: 'flow-2',
          from: 'C',
          to: 'D',
          entities: [],
          flowType: 'read',
          strength: 'important',
          relationships: [],
          impactLevel: 'indirect',
          affectedOperations: [],
          validationRequired: false,
          suggestedTests: ['test3'],
        },
        {
          id: 'flow-3',
          from: 'E',
          to: 'F',
          entities: [],
          flowType: 'bidirectional',
          strength: 'optional',
          relationships: [],
          impactLevel: 'cascade',
          affectedOperations: [],
          validationRequired: false,
          suggestedTests: [],
        },
      ];

      const stats = analyzer.getFlowStatistics(flows);

      expect(stats.total).toBe(3);
      expect(stats.byStrength.critical).toBe(1);
      expect(stats.byStrength.important).toBe(1);
      expect(stats.byStrength.optional).toBe(1);
      expect(stats.byImpactLevel.direct).toBe(1);
      expect(stats.byImpactLevel.indirect).toBe(1);
      expect(stats.byImpactLevel.cascade).toBe(1);
      expect(stats.byFlowType.write).toBe(1);
      expect(stats.byFlowType.read).toBe(1);
      expect(stats.byFlowType.bidirectional).toBe(1);
      expect(stats.requiresValidation).toBe(1);
      expect(stats.totalSuggestedTests).toBe(3);
    });

    it('should handle empty flows', () => {
      const stats = analyzer.getFlowStatistics([]);

      expect(stats.total).toBe(0);
      expect(stats.requiresValidation).toBe(0);
      expect(stats.totalSuggestedTests).toBe(0);
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton analyzer', () => {
      expect(impactDataFlowAnalyzer).toBeInstanceOf(ImpactDataFlowAnalyzer);
    });
  });
});
