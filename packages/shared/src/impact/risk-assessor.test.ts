/**
 * Risk Assessor Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RiskAssessor, riskAssessor, DEFAULT_RISK_RULES } from './risk-assessor';
import type {
  ChangeInput,
  ParsedChange,
  ChangeScope,
  ImpactDataFlow,
  RiskRule,
} from './types';

describe('RiskAssessor', () => {
  let assessor: RiskAssessor;

  // Helper to create mock data
  const createMockInput = (overrides: Partial<ChangeInput> = {}): ChangeInput => ({
    description: 'Test change',
    ...overrides,
  });

  const createMockParsed = (overrides: Partial<ParsedChange> = {}): ParsedChange => ({
    entities: [],
    operations: [],
    keywords: [],
    changeType: 'feature',
    confidence: 0.7,
    ...overrides,
  });

  const createMockScope = (overrides: Partial<ChangeScope> = {}): ChangeScope => ({
    primaryModules: [],
    primaryFiles: [],
    dependentModules: [],
    affectedFiles: [],
    affectedEntities: [],
    expansionDepth: 1,
    ...overrides,
  });

  const createMockDataFlows = (): ImpactDataFlow[] => [];

  beforeEach(() => {
    assessor = new RiskAssessor();
  });

  describe('assess', () => {
    it('should return empty array when no risks detected', () => {
      const input = createMockInput();
      const parsed = createMockParsed();
      const scope = createMockScope();
      const flows = createMockDataFlows();

      const risks = assessor.assess(input, parsed, scope, flows);

      expect(risks).toEqual([]);
    });

    it('should detect R001 (Database Schema Change) for migration', () => {
      const input = createMockInput({ changeType: 'migration' });
      const parsed = createMockParsed({
        keywords: ['schema', 'migration', 'database'],
        operations: [{ type: 'migrate', target: 'user schema', description: 'migrate schema' }],
        changeType: 'migration',
      });
      const scope = createMockScope();
      const flows = createMockDataFlows();

      const risks = assessor.assess(input, parsed, scope, flows);

      expect(risks.some(r => r.ruleId === 'R001')).toBe(true);
      const r001 = risks.find(r => r.ruleId === 'R001');
      expect(r001?.severity).toBe('critical');
      expect(r001?.isBlocking).toBe(true);
    });

    it('should detect R002 (Breaking API Change) for API modifications', () => {
      const input = createMockInput({ changeType: 'refactor' });
      const parsed = createMockParsed({
        keywords: ['api', 'endpoint'],
        operations: [{ type: 'modify', target: 'API endpoint', description: 'modify endpoint' }],
        changeType: 'refactor',
      });
      const scope = createMockScope({
        primaryFiles: ['src/api/users.ts', 'src/routes/index.ts'],
      });
      const flows = createMockDataFlows();

      const risks = assessor.assess(input, parsed, scope, flows);

      expect(risks.some(r => r.ruleId === 'R002')).toBe(true);
      const r002 = risks.find(r => r.ruleId === 'R002');
      expect(r002?.severity).toBe('high');
    });

    it('should detect R003 (Security-Sensitive Change) for auth changes', () => {
      const input = createMockInput();
      const parsed = createMockParsed({
        keywords: ['authentication', 'password', 'login'],
        entities: ['UserAuth'],
      });
      const scope = createMockScope({
        primaryFiles: ['src/services/auth.ts'],
      });
      const flows = createMockDataFlows();

      const risks = assessor.assess(input, parsed, scope, flows);

      expect(risks.some(r => r.ruleId === 'R003')).toBe(true);
      const r003 = risks.find(r => r.ruleId === 'R003');
      expect(r003?.severity).toBe('critical');
      expect(r003?.isBlocking).toBe(true);
    });

    it('should detect R004 (Cross-Module Impact) when multiple modules affected', () => {
      const input = createMockInput();
      const parsed = createMockParsed();
      const scope = createMockScope({
        primaryModules: ['users', 'orders'],
        dependentModules: [
          { moduleId: 'payments', moduleName: 'payments', impactLevel: 'direct', dependencyPath: [], reason: 'dep' },
        ],
      });
      const flows = createMockDataFlows();

      const risks = assessor.assess(input, parsed, scope, flows);

      expect(risks.some(r => r.ruleId === 'R004')).toBe(true);
      const r004 = risks.find(r => r.ruleId === 'R004');
      expect(r004?.severity).toBe('medium');
    });

    it('should detect R005 (Data Flow Disruption) for critical flows', () => {
      const input = createMockInput();
      const parsed = createMockParsed();
      const scope = createMockScope();
      const flows: ImpactDataFlow[] = [
        {
          id: 'flow-1',
          from: 'UserService',
          to: 'Database',
          entities: ['User'],
          flowType: 'write',
          strength: 'critical',
          relationships: ['writes'],
          impactLevel: 'direct',
          affectedOperations: ['create', 'update'],
          validationRequired: true,
          suggestedTests: ['test user writes'],
        },
      ];

      const risks = assessor.assess(input, parsed, scope, flows);

      expect(risks.some(r => r.ruleId === 'R005')).toBe(true);
      const r005 = risks.find(r => r.ruleId === 'R005');
      expect(r005?.severity).toBe('high');
    });

    it('should detect R006 (Performance Impact) for database-heavy changes', () => {
      const input = createMockInput();
      const parsed = createMockParsed({
        keywords: ['query', 'database', 'index'],
        operations: [{ type: 'modify', target: 'database query', description: 'modify query' }],
      });
      const scope = createMockScope();
      const flows = createMockDataFlows();

      const risks = assessor.assess(input, parsed, scope, flows);

      expect(risks.some(r => r.ruleId === 'R006')).toBe(true);
      const r006 = risks.find(r => r.ruleId === 'R006');
      expect(r006?.severity).toBe('medium');
    });

    it('should detect R007 (Test Coverage Gap) for new features without tests', () => {
      const input = createMockInput({ changeType: 'feature' });
      const parsed = createMockParsed({
        keywords: ['user', 'feature', 'new'],
        operations: [{ type: 'add', target: 'new feature', description: 'add feature' }],
        changeType: 'feature',
      });
      const scope = createMockScope();
      const flows = createMockDataFlows();

      const risks = assessor.assess(input, parsed, scope, flows);

      expect(risks.some(r => r.ruleId === 'R007')).toBe(true);
    });

    it('should NOT detect R007 when tests are mentioned', () => {
      const input = createMockInput({ changeType: 'feature' });
      const parsed = createMockParsed({
        keywords: ['user', 'feature', 'test', 'unit'],
        operations: [{ type: 'add', target: 'new feature', description: 'add feature' }],
        changeType: 'feature',
      });
      const scope = createMockScope();
      const flows = createMockDataFlows();

      const risks = assessor.assess(input, parsed, scope, flows);

      expect(risks.some(r => r.ruleId === 'R007')).toBe(false);
    });

    it('should detect R008 (Deletion with Dependencies) when deleting with deps', () => {
      const input = createMockInput({ changeType: 'deletion' });
      const parsed = createMockParsed({
        operations: [{ type: 'delete', target: 'UserService', description: 'delete service' }],
        changeType: 'deletion',
      });
      const scope = createMockScope({
        dependentModules: [
          { moduleId: 'orders', moduleName: 'orders', impactLevel: 'direct', dependencyPath: [], reason: 'uses UserService' },
        ],
      });
      const flows = createMockDataFlows();

      const risks = assessor.assess(input, parsed, scope, flows);

      expect(risks.some(r => r.ruleId === 'R008')).toBe(true);
      const r008 = risks.find(r => r.ruleId === 'R008');
      expect(r008?.isBlocking).toBe(true);
    });

    it('should sort risks by severity', () => {
      const input = createMockInput({ changeType: 'migration' });
      const parsed = createMockParsed({
        keywords: ['schema', 'api', 'migration'],
        operations: [
          { type: 'migrate', target: 'schema', description: 'migrate' },
          { type: 'modify', target: 'api', description: 'modify' },
        ],
        changeType: 'migration',
      });
      const scope = createMockScope({
        primaryFiles: ['src/api/users.ts'],
        primaryModules: ['m1', 'm2'],
        dependentModules: [
          { moduleId: 'm3', moduleName: 'm3', impactLevel: 'direct', dependencyPath: [], reason: 'dep' },
        ],
      });
      const flows = createMockDataFlows();

      const risks = assessor.assess(input, parsed, scope, flows);

      // Critical should come before high, high before medium
      for (let i = 1; i < risks.length; i++) {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        expect(severityOrder[risks[i - 1].severity]).toBeLessThanOrEqual(
          severityOrder[risks[i].severity]
        );
      }
    });
  });

  describe('addRule', () => {
    it('should add custom rule and evaluate it', () => {
      const customRule: RiskRule = {
        id: 'CUSTOM001',
        name: 'Custom Test Rule',
        category: 'testing',
        severity: 'low',
        condition: (ctx) => ctx.parsed.keywords.includes('custom-trigger'),
        mitigation: 'Custom mitigation',
        isBlocking: false,
      };

      assessor.addRule(customRule);

      const input = createMockInput();
      const parsed = createMockParsed({ keywords: ['custom-trigger'] });
      const scope = createMockScope();
      const flows = createMockDataFlows();

      const risks = assessor.assess(input, parsed, scope, flows);

      expect(risks.some(r => r.ruleId === 'CUSTOM001')).toBe(true);
    });
  });

  describe('removeRule', () => {
    it('should remove custom rule', () => {
      const customRule: RiskRule = {
        id: 'CUSTOM002',
        name: 'Removable Rule',
        category: 'testing',
        severity: 'low',
        condition: () => true,
        mitigation: 'Test',
        isBlocking: false,
      };

      assessor.addRule(customRule);
      const removed = assessor.removeRule('CUSTOM002');

      expect(removed).toBe(true);
      expect(assessor.getRules().some(r => r.id === 'CUSTOM002')).toBe(false);
    });

    it('should return false when rule not found', () => {
      const removed = assessor.removeRule('NON_EXISTENT');

      expect(removed).toBe(false);
    });
  });

  describe('getRules', () => {
    it('should return all default rules', () => {
      const rules = assessor.getRules();

      expect(rules.length).toBe(DEFAULT_RISK_RULES.length);
      expect(rules.some(r => r.id === 'R001')).toBe(true);
      expect(rules.some(r => r.id === 'R008')).toBe(true);
    });
  });

  describe('getStatistics', () => {
    it('should calculate risk statistics', () => {
      const mockRisks = [
        { id: '1', ruleId: 'R001', name: 'Test', category: 'security' as const, severity: 'critical' as const, description: '', affectedAreas: [], mitigation: '', isBlocking: true, mitigationApplied: false },
        { id: '2', ruleId: 'R002', name: 'Test', category: 'breaking-change' as const, severity: 'high' as const, description: '', affectedAreas: [], mitigation: '', isBlocking: false, mitigationApplied: false },
        { id: '3', ruleId: 'R003', name: 'Test', category: 'performance' as const, severity: 'medium' as const, description: '', affectedAreas: [], mitigation: '', isBlocking: false, mitigationApplied: false },
      ];

      const stats = assessor.getStatistics(mockRisks);

      expect(stats.total).toBe(3);
      expect(stats.bySeverity.critical).toBe(1);
      expect(stats.bySeverity.high).toBe(1);
      expect(stats.bySeverity.medium).toBe(1);
      expect(stats.bySeverity.low).toBe(0);
      expect(stats.byCategory.security).toBe(1);
      expect(stats.blocking).toBe(1);
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton assessor', () => {
      expect(riskAssessor).toBeInstanceOf(RiskAssessor);
    });
  });

  describe('DEFAULT_RISK_RULES', () => {
    it('should export default rules array', () => {
      expect(Array.isArray(DEFAULT_RISK_RULES)).toBe(true);
      expect(DEFAULT_RISK_RULES.length).toBe(8);
    });

    it('should have all required rule properties', () => {
      for (const rule of DEFAULT_RISK_RULES) {
        expect(rule.id).toBeDefined();
        expect(rule.name).toBeDefined();
        expect(rule.category).toBeDefined();
        expect(rule.severity).toBeDefined();
        expect(typeof rule.condition).toBe('function');
        expect(rule.mitigation).toBeDefined();
        expect(typeof rule.isBlocking).toBe('boolean');
      }
    });
  });
});
