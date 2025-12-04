/**
 * Validation Generator
 *
 * Generates validation checklist based on:
 * - Identified risks
 * - Affected modules
 * - Data flow impacts
 * - API changes
 */

import type {
  ChangeScope,
  ImpactDataFlow,
  IdentifiedRisk,
  ValidationItem,
  ValidationCategory,
} from './types';

// =============================================================================
// Validation Templates
// =============================================================================

interface ValidationTemplate {
  titleTemplate: string;
  descriptionTemplate: string;
  category: ValidationCategory;
  isBlocking: boolean;
  autoVerifiable: boolean;
  verifyCommandTemplate?: string;
  expectedPatternTemplate?: string;
}

// Templates for future template-based generation
// Currently using inline generation in methods
const _MODULE_TEST_TEMPLATE: ValidationTemplate = {
  titleTemplate: 'Run {{moduleName}} module tests',
  descriptionTemplate: 'Execute all tests for the {{moduleName}} module to ensure no regressions.',
  category: 'test',
  isBlocking: true,
  autoVerifiable: true,
  verifyCommandTemplate: 'pnpm test {{modulePath}}',
  expectedPatternTemplate: '(PASS|passed|✓)',
};

const _DATA_FLOW_TEMPLATE: ValidationTemplate = {
  titleTemplate: 'Verify {{flowName}} data flow',
  descriptionTemplate: 'Manually verify that data flows correctly from {{from}} to {{to}}.',
  category: 'data-flow',
  isBlocking: true,
  autoVerifiable: false,
};

const _API_TEMPLATE: ValidationTemplate = {
  titleTemplate: 'Test {{endpoint}} API endpoint',
  descriptionTemplate: 'Verify that the {{endpoint}} endpoint returns expected responses.',
  category: 'api',
  isBlocking: true,
  autoVerifiable: true,
  verifyCommandTemplate: 'curl -s {{endpoint}} | jq .',
};

const _MIGRATION_TEMPLATE: ValidationTemplate = {
  titleTemplate: 'Run database migration',
  descriptionTemplate: 'Execute and verify database migration scripts.',
  category: 'migration',
  isBlocking: true,
  autoVerifiable: true,
  verifyCommandTemplate: 'pnpm db:migrate',
  expectedPatternTemplate: '(success|completed|done)',
};

const _SECURITY_REVIEW_TEMPLATE: ValidationTemplate = {
  titleTemplate: 'Security review for {{area}}',
  descriptionTemplate: 'Conduct security review for changes in {{area}}. Check for vulnerabilities.',
  category: 'review',
  isBlocking: true,
  autoVerifiable: false,
};

// Export templates for future use
export const VALIDATION_TEMPLATES = {
  moduleTest: _MODULE_TEST_TEMPLATE,
  dataFlow: _DATA_FLOW_TEMPLATE,
  api: _API_TEMPLATE,
  migration: _MIGRATION_TEMPLATE,
  securityReview: _SECURITY_REVIEW_TEMPLATE,
};

// =============================================================================
// Validation Generator Class
// =============================================================================

export interface ValidationGeneratorConfig {
  /** Include module tests for all affected modules */
  includeModuleTests: boolean;
  /** Include data flow validations */
  includeDataFlowValidations: boolean;
  /** Include API validations */
  includeApiValidations: boolean;
  /** Test command prefix (e.g., 'pnpm test', 'npm test') */
  testCommandPrefix: string;
  /** Module path prefix for test commands */
  modulePathPrefix: string;
}

const DEFAULT_CONFIG: ValidationGeneratorConfig = {
  includeModuleTests: true,
  includeDataFlowValidations: true,
  includeApiValidations: true,
  testCommandPrefix: 'pnpm test',
  modulePathPrefix: 'packages/',
};

export class ValidationGenerator {
  private config: ValidationGeneratorConfig;

  constructor(config: Partial<ValidationGeneratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate validation checklist
   */
  generate(
    scope: ChangeScope,
    dataFlows: ImpactDataFlow[],
    risks: IdentifiedRisk[]
  ): ValidationItem[] {
    const validations: ValidationItem[] = [];

    // Generate risk-based validations
    validations.push(...this.generateRiskValidations(risks));

    // Generate module test validations
    if (this.config.includeModuleTests) {
      validations.push(...this.generateModuleTestValidations(scope));
    }

    // Generate data flow validations
    if (this.config.includeDataFlowValidations) {
      validations.push(...this.generateDataFlowValidations(dataFlows));
    }

    // Generate API validations
    if (this.config.includeApiValidations) {
      validations.push(...this.generateApiValidations(scope));
    }

    // Deduplicate
    return this.deduplicateValidations(validations);
  }

  /**
   * Generate validations from identified risks
   */
  private generateRiskValidations(risks: IdentifiedRisk[]): ValidationItem[] {
    const validations: ValidationItem[] = [];

    for (const risk of risks) {
      switch (risk.category) {
        case 'data-corruption':
          validations.push(this.createValidation({
            title: `Verify data integrity after ${risk.name}`,
            description: `${risk.description}\n\nMitigation: ${risk.mitigation}`,
            category: 'manual',
            isBlocking: risk.isBlocking,
            autoVerifiable: false,
            riskId: risk.id,
          }));
          break;

        case 'breaking-change':
          validations.push(this.createValidation({
            title: `Check backward compatibility for ${risk.name}`,
            description: `Verify that existing functionality is not broken.\n\n${risk.description}`,
            category: 'test',
            isBlocking: risk.isBlocking,
            autoVerifiable: false,
            riskId: risk.id,
          }));
          break;

        case 'security':
          validations.push(this.createValidation({
            title: `Security review: ${risk.name}`,
            description: `${risk.description}\n\nRequired checks:\n- No credential exposure\n- No injection vulnerabilities\n- Proper authentication/authorization`,
            category: 'review',
            isBlocking: true, // Always blocking for security
            autoVerifiable: false,
            riskId: risk.id,
          }));
          break;

        case 'performance':
          validations.push(this.createValidation({
            title: `Performance check: ${risk.name}`,
            description: `${risk.description}\n\nVerify no significant performance degradation.`,
            category: 'test',
            isBlocking: false,
            autoVerifiable: false,
            riskId: risk.id,
          }));
          break;

        case 'testing':
          validations.push(this.createValidation({
            title: `Add tests for new functionality`,
            description: `${risk.description}\n\nEnsure adequate test coverage for changes.`,
            category: 'test',
            isBlocking: risk.isBlocking,
            autoVerifiable: false,
            riskId: risk.id,
          }));
          break;

        case 'compatibility':
          validations.push(this.createValidation({
            title: `Integration test for ${risk.name}`,
            description: `${risk.description}\n\nVerify integration across affected modules.`,
            category: 'test',
            isBlocking: risk.isBlocking,
            autoVerifiable: true,
            verifyCommand: `${this.config.testCommandPrefix} --integration`,
            riskId: risk.id,
          }));
          break;

        default:
          validations.push(this.createValidation({
            title: `Review: ${risk.name}`,
            description: risk.description,
            category: 'manual',
            isBlocking: risk.isBlocking,
            autoVerifiable: false,
            riskId: risk.id,
          }));
      }
    }

    return validations;
  }

  /**
   * Generate module test validations
   */
  private generateModuleTestValidations(scope: ChangeScope): ValidationItem[] {
    const validations: ValidationItem[] = [];
    const testedModules = new Set<string>();

    // Primary modules
    for (const moduleId of scope.primaryModules) {
      if (testedModules.has(moduleId)) continue;
      testedModules.add(moduleId);

      const modulePath = this.moduleIdToPath(moduleId);
      validations.push(this.createValidation({
        title: `Run ${moduleId} module tests`,
        description: `Execute all tests for the ${moduleId} module to ensure no regressions.`,
        category: 'test',
        isBlocking: true,
        autoVerifiable: true,
        verifyCommand: `${this.config.testCommandPrefix} ${modulePath}`,
        expectedPattern: '(PASS|passed|✓|0 failed)',
        moduleId,
      }));
    }

    // Direct dependent modules
    for (const dep of scope.dependentModules) {
      if (dep.impactLevel !== 'direct') continue;
      if (testedModules.has(dep.moduleId)) continue;
      testedModules.add(dep.moduleId);

      const modulePath = this.moduleIdToPath(dep.moduleId);
      validations.push(this.createValidation({
        title: `Run ${dep.moduleName} dependent tests`,
        description: `Test dependent module ${dep.moduleName}. Reason: ${dep.reason}`,
        category: 'test',
        isBlocking: false, // Dependent tests are not blocking
        autoVerifiable: true,
        verifyCommand: `${this.config.testCommandPrefix} ${modulePath}`,
        expectedPattern: '(PASS|passed|✓|0 failed)',
        moduleId: dep.moduleId,
      }));
    }

    return validations;
  }

  /**
   * Generate data flow validations
   */
  private generateDataFlowValidations(dataFlows: ImpactDataFlow[]): ValidationItem[] {
    const validations: ValidationItem[] = [];

    // Only validate critical and important flows with direct impact
    const significantFlows = dataFlows.filter(
      f => (f.strength === 'critical' || f.strength === 'important') &&
           (f.impactLevel === 'direct' || f.impactLevel === 'indirect')
    );

    for (const flow of significantFlows) {
      const flowName = flow.entities.join(' → ');
      const isCritical = flow.strength === 'critical';

      validations.push(this.createValidation({
        title: `Verify ${flowName} data flow`,
        description: `Manually verify that data flows correctly from ${flow.from} to ${flow.to}.\n\nRelationships: ${flow.relationships.join(', ')}\nSuggested tests: ${flow.suggestedTests.join(', ') || 'None specified'}`,
        category: 'data-flow',
        isBlocking: isCritical,
        autoVerifiable: false,
        dataFlowId: flow.id,
      }));
    }

    return validations;
  }

  /**
   * Generate API validations
   */
  private generateApiValidations(scope: ChangeScope): ValidationItem[] {
    const validations: ValidationItem[] = [];

    // Look for API-related files
    const apiFiles = [
      ...scope.primaryFiles,
      ...scope.affectedFiles.filter(f => f.impactLevel === 'direct').map(f => f.filePath),
    ].filter(
      f => f.includes('/api/') ||
           f.includes('/routes/') ||
           f.includes('/endpoints/') ||
           f.includes('.controller.') ||
           f.includes('.route.')
    );

    if (apiFiles.length > 0) {
      // Generic API validation for affected endpoints
      validations.push(this.createValidation({
        title: 'Test affected API endpoints',
        description: `Verify that all affected API endpoints work correctly.\n\nAffected files:\n${apiFiles.map(f => `- ${f}`).join('\n')}`,
        category: 'api',
        isBlocking: true,
        autoVerifiable: false, // Would need to know specific endpoints
      }));

      // Suggest running API tests if available
      validations.push(this.createValidation({
        title: 'Run API integration tests',
        description: 'Execute API integration tests to verify endpoint functionality.',
        category: 'api',
        isBlocking: true,
        autoVerifiable: true,
        verifyCommand: `${this.config.testCommandPrefix}:api`,
        expectedPattern: '(PASS|passed|✓|0 failed)',
      }));
    }

    return validations;
  }

  /**
   * Create a validation item
   */
  private createValidation(params: {
    title: string;
    description: string;
    category: ValidationCategory;
    isBlocking: boolean;
    autoVerifiable: boolean;
    verifyCommand?: string;
    expectedPattern?: string;
    riskId?: string;
    dataFlowId?: string;
    moduleId?: string;
  }): ValidationItem {
    return {
      id: `val-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: params.title,
      description: params.description,
      category: params.category,
      status: 'pending',
      isBlocking: params.isBlocking,
      autoVerifiable: params.autoVerifiable,
      verifyCommand: params.verifyCommand,
      expectedPattern: params.expectedPattern,
      riskId: params.riskId,
      dataFlowId: params.dataFlowId,
      moduleId: params.moduleId,
    };
  }

  /**
   * Convert module ID to file path
   */
  private moduleIdToPath(moduleId: string): string {
    // Convert module-name or moduleName to packages/module-name
    const normalizedName = moduleId
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '')
      .replace('module-', '');

    return `${this.config.modulePathPrefix}${normalizedName}`;
  }

  /**
   * Deduplicate validations by title similarity
   */
  private deduplicateValidations(validations: ValidationItem[]): ValidationItem[] {
    const seen = new Map<string, ValidationItem>();

    for (const validation of validations) {
      // Create a key based on title and category
      const key = `${validation.category}:${validation.title.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

      if (!seen.has(key)) {
        seen.set(key, validation);
      } else {
        // Merge: keep the more specific one (longer description)
        const existing = seen.get(key)!;
        if (validation.description.length > existing.description.length) {
          seen.set(key, validation);
        }
        // Also keep blocking if either is blocking
        if (validation.isBlocking && !existing.isBlocking) {
          existing.isBlocking = true;
        }
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<ValidationGeneratorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get statistics for validations
   */
  getStatistics(validations: ValidationItem[]): {
    total: number;
    byCategory: Record<ValidationCategory, number>;
    blocking: number;
    autoVerifiable: number;
    pending: number;
    passed: number;
    failed: number;
  } {
    const stats = {
      total: validations.length,
      byCategory: {
        'test': 0,
        'data-flow': 0,
        'api': 0,
        'migration': 0,
        'manual': 0,
        'review': 0,
      } as Record<ValidationCategory, number>,
      blocking: 0,
      autoVerifiable: 0,
      pending: 0,
      passed: 0,
      failed: 0,
    };

    for (const validation of validations) {
      stats.byCategory[validation.category]++;
      if (validation.isBlocking) stats.blocking++;
      if (validation.autoVerifiable) stats.autoVerifiable++;
      if (validation.status === 'pending') stats.pending++;
      if (validation.status === 'passed') stats.passed++;
      if (validation.status === 'failed') stats.failed++;
    }

    return stats;
  }
}

// =============================================================================
// Export singleton instance
// =============================================================================

export const validationGenerator = new ValidationGenerator();
