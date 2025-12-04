/**
 * Validation Generator Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ValidationGenerator,
  validationGenerator,
  VALIDATION_TEMPLATES,
} from './validation-generator';
import type {
  ChangeScope,
  ImpactDataFlow,
  IdentifiedRisk,
  ValidationItem,
} from './types';

describe('ValidationGenerator', () => {
  let generator: ValidationGenerator;

  // Helper to create mock scope
  const createMockScope = (overrides: Partial<ChangeScope> = {}): ChangeScope => ({
    primaryModules: [],
    primaryFiles: [],
    dependentModules: [],
    affectedFiles: [],
    affectedEntities: [],
    expansionDepth: 1,
    ...overrides,
  });

  // Helper to create mock data flow
  const createMockDataFlow = (overrides: Partial<ImpactDataFlow> = {}): ImpactDataFlow => ({
    id: `flow-${Date.now()}`,
    from: 'ServiceA',
    to: 'ServiceB',
    entities: ['Entity1'],
    flowType: 'write',
    strength: 'important',
    relationships: ['writes'],
    impactLevel: 'direct',
    affectedOperations: ['create'],
    validationRequired: true,
    suggestedTests: ['test entity creation'],
    ...overrides,
  });

  // Helper to create mock risk
  const createMockRisk = (overrides: Partial<IdentifiedRisk> = {}): IdentifiedRisk => ({
    id: `risk-${Date.now()}`,
    ruleId: 'R001',
    name: 'Test Risk',
    category: 'data-corruption',
    severity: 'high',
    description: 'Test risk description',
    affectedAreas: [],
    mitigation: 'Test mitigation',
    isBlocking: true,
    mitigationApplied: false,
    ...overrides,
  });

  beforeEach(() => {
    generator = new ValidationGenerator();
  });

  describe('generate', () => {
    it('should return empty array when no inputs', () => {
      const validations = generator.generate(
        createMockScope(),
        [],
        []
      );

      expect(validations).toHaveLength(0);
    });

    it('should generate validations from risks', () => {
      const risks = [createMockRisk({ category: 'security' })];
      const validations = generator.generate(
        createMockScope(),
        [],
        risks
      );

      expect(validations.length).toBeGreaterThan(0);
      expect(validations[0].riskId).toBe(risks[0].id);
    });

    it('should deduplicate similar validations', () => {
      const risks = [
        createMockRisk({ id: 'risk-1', name: 'Test Risk', category: 'testing' }),
        createMockRisk({ id: 'risk-2', name: 'Test Risk', category: 'testing' }),
      ];
      const validations = generator.generate(
        createMockScope(),
        [],
        risks
      );

      // Should deduplicate validations with same title pattern
      const testValidations = validations.filter(v =>
        v.title.includes('Add tests for new functionality')
      );
      expect(testValidations.length).toBe(1);
    });
  });

  describe('generateRiskValidations', () => {
    it('should generate manual validation for data-corruption risks', () => {
      const risks = [createMockRisk({ category: 'data-corruption' })];
      const validations = generator.generate(createMockScope(), [], risks);

      const dataValidation = validations.find(v => v.category === 'manual');
      expect(dataValidation).toBeDefined();
      expect(dataValidation?.title).toContain('Verify data integrity');
    });

    it('should generate test validation for breaking-change risks', () => {
      const risks = [createMockRisk({ category: 'breaking-change' })];
      const validations = generator.generate(createMockScope(), [], risks);

      const breakingValidation = validations.find(v =>
        v.title.includes('backward compatibility')
      );
      expect(breakingValidation).toBeDefined();
      expect(breakingValidation?.category).toBe('test');
    });

    it('should generate review validation for security risks', () => {
      const risks = [createMockRisk({ category: 'security' })];
      const validations = generator.generate(createMockScope(), [], risks);

      const securityValidation = validations.find(v =>
        v.title.includes('Security review')
      );
      expect(securityValidation).toBeDefined();
      expect(securityValidation?.category).toBe('review');
      expect(securityValidation?.isBlocking).toBe(true); // Security always blocking
    });

    it('should generate test validation for performance risks', () => {
      const risks = [createMockRisk({ category: 'performance' })];
      const validations = generator.generate(createMockScope(), [], risks);

      const perfValidation = validations.find(v =>
        v.title.includes('Performance check')
      );
      expect(perfValidation).toBeDefined();
      expect(perfValidation?.isBlocking).toBe(false);
    });

    it('should generate test validation for testing risks', () => {
      const risks = [createMockRisk({ category: 'testing' })];
      const validations = generator.generate(createMockScope(), [], risks);

      const testValidation = validations.find(v =>
        v.title.includes('Add tests')
      );
      expect(testValidation).toBeDefined();
    });

    it('should generate integration test for compatibility risks', () => {
      const risks = [createMockRisk({ category: 'compatibility' })];
      const validations = generator.generate(createMockScope(), [], risks);

      const compatValidation = validations.find(v =>
        v.title.includes('Integration test')
      );
      expect(compatValidation).toBeDefined();
      expect(compatValidation?.autoVerifiable).toBe(true);
    });
  });

  describe('generateModuleTestValidations', () => {
    it('should generate test for primary modules', () => {
      const scope = createMockScope({
        primaryModules: ['users', 'orders'],
      });
      const validations = generator.generate(scope, [], []);

      expect(validations.filter(v => v.title.includes('module tests'))).toHaveLength(2);
    });

    it('should generate test for direct dependent modules', () => {
      const scope = createMockScope({
        primaryModules: ['users'],
        dependentModules: [
          {
            moduleId: 'orders',
            moduleName: 'orders',
            impactLevel: 'direct',
            dependencyPath: ['users'],
            reason: 'imports from users',
          },
        ],
      });
      const validations = generator.generate(scope, [], []);

      const depTest = validations.find(v => v.title.includes('orders dependent'));
      expect(depTest).toBeDefined();
      expect(depTest?.isBlocking).toBe(false); // Dependent tests not blocking
    });

    it('should not duplicate module tests', () => {
      const scope = createMockScope({
        primaryModules: ['users', 'users'], // Duplicate
      });
      const validations = generator.generate(scope, [], []);

      const userTests = validations.filter(v => v.title.includes('users module'));
      expect(userTests).toHaveLength(1);
    });

    it('should include verify command for module tests', () => {
      const scope = createMockScope({
        primaryModules: ['users'],
      });
      const validations = generator.generate(scope, [], []);

      const userTest = validations.find(v => v.title.includes('users module'));
      expect(userTest?.autoVerifiable).toBe(true);
      expect(userTest?.verifyCommand).toContain('pnpm test');
    });
  });

  describe('generateDataFlowValidations', () => {
    it('should generate validation for critical flows', () => {
      const flows = [createMockDataFlow({ strength: 'critical', impactLevel: 'direct' })];
      const validations = generator.generate(createMockScope(), flows, []);

      const flowValidation = validations.find(v => v.category === 'data-flow');
      expect(flowValidation).toBeDefined();
      expect(flowValidation?.isBlocking).toBe(true);
    });

    it('should generate validation for important direct flows', () => {
      const flows = [createMockDataFlow({ strength: 'important', impactLevel: 'direct' })];
      const validations = generator.generate(createMockScope(), flows, []);

      const flowValidation = validations.find(v => v.category === 'data-flow');
      expect(flowValidation).toBeDefined();
      expect(flowValidation?.isBlocking).toBe(false);
    });

    it('should skip optional flows', () => {
      const flows = [createMockDataFlow({ strength: 'optional', impactLevel: 'direct' })];
      const validations = generator.generate(createMockScope(), flows, []);

      const flowValidation = validations.find(v => v.category === 'data-flow');
      expect(flowValidation).toBeUndefined();
    });

    it('should skip cascade flows', () => {
      const flows = [createMockDataFlow({ strength: 'critical', impactLevel: 'cascade' })];
      const validations = generator.generate(createMockScope(), flows, []);

      const flowValidation = validations.find(v => v.category === 'data-flow');
      expect(flowValidation).toBeUndefined();
    });

    it('should include flow entities in validation title', () => {
      const flows = [createMockDataFlow({
        entities: ['User', 'Order'],
        strength: 'critical',
        impactLevel: 'direct',
      })];
      const validations = generator.generate(createMockScope(), flows, []);

      const flowValidation = validations.find(v => v.category === 'data-flow');
      expect(flowValidation?.title).toContain('User');
      expect(flowValidation?.title).toContain('Order');
    });
  });

  describe('generateApiValidations', () => {
    it('should generate API validations for API files', () => {
      const scope = createMockScope({
        primaryFiles: ['src/api/users.ts', 'src/routes/orders.ts'],
      });
      const validations = generator.generate(scope, [], []);

      const apiValidations = validations.filter(v => v.category === 'api');
      expect(apiValidations.length).toBeGreaterThan(0);
    });

    it('should not generate API validations for non-API files', () => {
      const scope = createMockScope({
        primaryFiles: ['src/services/user.ts', 'src/models/order.ts'],
      });
      const validations = generator.generate(scope, [], []);

      const apiValidations = validations.filter(v => v.category === 'api');
      expect(apiValidations).toHaveLength(0);
    });

    it('should include affected files in description', () => {
      const scope = createMockScope({
        primaryFiles: ['src/api/users.ts'],
      });
      const validations = generator.generate(scope, [], []);

      const apiValidation = validations.find(v => v.title.includes('affected API'));
      expect(apiValidation?.description).toContain('src/api/users.ts');
    });

    it('should detect controller files as API files', () => {
      const scope = createMockScope({
        primaryFiles: ['src/controllers/user.controller.ts'],
      });
      const validations = generator.generate(scope, [], []);

      const apiValidations = validations.filter(v => v.category === 'api');
      expect(apiValidations.length).toBeGreaterThan(0);
    });
  });

  describe('setConfig', () => {
    it('should update test command prefix', () => {
      generator.setConfig({ testCommandPrefix: 'npm test' });

      const scope = createMockScope({ primaryModules: ['users'] });
      const validations = generator.generate(scope, [], []);

      const moduleTest = validations.find(v => v.title.includes('users module'));
      expect(moduleTest?.verifyCommand).toContain('npm test');
    });

    it('should disable module tests generation', () => {
      generator.setConfig({ includeModuleTests: false });

      const scope = createMockScope({ primaryModules: ['users'] });
      const validations = generator.generate(scope, [], []);

      const moduleTests = validations.filter(v => v.title.includes('module tests'));
      expect(moduleTests).toHaveLength(0);
    });

    it('should disable data flow validations', () => {
      generator.setConfig({ includeDataFlowValidations: false });

      const flows = [createMockDataFlow({ strength: 'critical', impactLevel: 'direct' })];
      const validations = generator.generate(createMockScope(), flows, []);

      const flowValidations = validations.filter(v => v.category === 'data-flow');
      expect(flowValidations).toHaveLength(0);
    });

    it('should disable API validations', () => {
      generator.setConfig({ includeApiValidations: false });

      const scope = createMockScope({
        primaryFiles: ['src/api/users.ts'],
      });
      const validations = generator.generate(scope, [], []);

      const apiValidations = validations.filter(v => v.category === 'api');
      expect(apiValidations).toHaveLength(0);
    });
  });

  describe('getStatistics', () => {
    it('should calculate validation statistics', () => {
      const validations: ValidationItem[] = [
        {
          id: '1', title: 'Test 1', description: '', category: 'test',
          status: 'passed', isBlocking: true, autoVerifiable: true,
        },
        {
          id: '2', title: 'Test 2', description: '', category: 'test',
          status: 'pending', isBlocking: false, autoVerifiable: true,
        },
        {
          id: '3', title: 'Review 1', description: '', category: 'review',
          status: 'failed', isBlocking: true, autoVerifiable: false,
        },
        {
          id: '4', title: 'API 1', description: '', category: 'api',
          status: 'pending', isBlocking: true, autoVerifiable: true,
        },
      ];

      const stats = generator.getStatistics(validations);

      expect(stats.total).toBe(4);
      expect(stats.byCategory.test).toBe(2);
      expect(stats.byCategory.review).toBe(1);
      expect(stats.byCategory.api).toBe(1);
      expect(stats.blocking).toBe(3);
      expect(stats.autoVerifiable).toBe(3);
      expect(stats.pending).toBe(2);
      expect(stats.passed).toBe(1);
      expect(stats.failed).toBe(1);
    });
  });

  describe('VALIDATION_TEMPLATES', () => {
    it('should export validation templates', () => {
      expect(VALIDATION_TEMPLATES).toBeDefined();
      expect(VALIDATION_TEMPLATES.moduleTest).toBeDefined();
      expect(VALIDATION_TEMPLATES.dataFlow).toBeDefined();
      expect(VALIDATION_TEMPLATES.api).toBeDefined();
      expect(VALIDATION_TEMPLATES.migration).toBeDefined();
      expect(VALIDATION_TEMPLATES.securityReview).toBeDefined();
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton generator', () => {
      expect(validationGenerator).toBeInstanceOf(ValidationGenerator);
    });
  });
});
