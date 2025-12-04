/**
 * Risk Assessor
 *
 * Evaluates risks based on:
 * - Predefined risk rules (R001-R005+)
 * - Change scope and type
 * - Data flow impacts
 * - Module dependencies
 */

import type {
  ChangeInput,
  ParsedChange,
  ChangeScope,
  ImpactDataFlow,
  IdentifiedRisk,
  RiskRule,
  RiskEvaluationContext,
  RiskSeverity,
  RiskCategory,
} from './types';

// =============================================================================
// Default Risk Rules
// =============================================================================

const DEFAULT_RISK_RULES: RiskRule[] = [
  // R001: Database Schema Change
  {
    id: 'R001',
    name: 'Database Schema Change',
    category: 'data-corruption',
    severity: 'critical',
    condition: (ctx) => {
      // Check if modifying entities with critical data flows
      const hasCriticalFlow = ctx.dataFlows.some(
        f => f.strength === 'critical' && f.validationRequired
      );

      // Check if operation suggests schema change
      const hasSchemaOperation = ctx.parsed.operations.some(
        op => op.type === 'migrate' ||
              op.target.toLowerCase().includes('schema') ||
              op.target.toLowerCase().includes('database') ||
              op.target.toLowerCase().includes('migration')
      );

      // Check keywords
      const hasSchemaKeyword = ctx.parsed.keywords.some(
        k => ['schema', 'migration', 'database', 'table', 'column', 'index'].includes(k)
      );

      return (hasCriticalFlow && ctx.parsed.operations.some(op => op.type === 'modify')) ||
             hasSchemaOperation ||
             (ctx.changeInput.changeType === 'migration' && hasSchemaKeyword);
    },
    mitigation: 'Create migration scripts with rollback capability. Test on staging data first.',
    isBlocking: true,
  },

  // R002: Breaking API Change
  {
    id: 'R002',
    name: 'Breaking API Change',
    category: 'breaking-change',
    severity: 'high',
    condition: (ctx) => {
      // Check if affecting API-related files
      const affectsApi = ctx.scope.primaryFiles.some(
        f => f.includes('/api/') ||
             f.includes('/routes/') ||
             f.includes('/endpoints/') ||
             f.includes('.controller.')
      );

      // Check if refactoring or modifying (not just adding)
      const isModifying = ctx.changeInput.changeType === 'refactor' ||
                          ctx.parsed.operations.some(op =>
                            op.type === 'modify' || op.type === 'delete' || op.type === 'refactor'
                          );

      // Check keywords
      const hasApiKeyword = ctx.parsed.keywords.some(
        k => ['api', 'endpoint', 'route', 'controller', 'request', 'response'].includes(k)
      );

      return (affectsApi && isModifying) || (hasApiKeyword && isModifying);
    },
    mitigation: 'Add API versioning or maintain backward compatibility. Document breaking changes.',
    isBlocking: false,
  },

  // R003: Authentication/Authorization Change
  {
    id: 'R003',
    name: 'Security-Sensitive Change',
    category: 'security',
    severity: 'critical',
    condition: (ctx) => {
      const securityKeywords = [
        'auth', 'authentication', 'authorization', 'login', 'logout',
        'password', 'token', 'session', 'permission', 'role', 'access',
        'security', 'credential', 'oauth', 'jwt', 'secret', 'encrypt'
      ];

      // Check entities
      const hasSecurityEntity = ctx.parsed.entities.some(
        e => securityKeywords.some(k => e.toLowerCase().includes(k))
      );

      // Check keywords
      const hasSecurityKeyword = ctx.parsed.keywords.some(
        k => securityKeywords.includes(k)
      );

      // Check files
      const affectsSecurityFiles = ctx.scope.primaryFiles.some(
        f => securityKeywords.some(k => f.toLowerCase().includes(k))
      );

      // Check modules
      const affectsSecurityModule = ctx.scope.primaryModules.some(
        m => securityKeywords.some(k => m.toLowerCase().includes(k))
      );

      return hasSecurityEntity || hasSecurityKeyword || affectsSecurityFiles || affectsSecurityModule;
    },
    mitigation: 'Security review required. Test authentication flows. Verify no credential exposure.',
    isBlocking: true,
  },

  // R004: Cross-Module Impact
  {
    id: 'R004',
    name: 'Cross-Module Impact',
    category: 'compatibility',
    severity: 'medium',
    condition: (ctx) => {
      // More than 2 modules affected
      const totalModules = ctx.scope.primaryModules.length + ctx.scope.dependentModules.length;
      return totalModules > 2;
    },
    mitigation: 'Coordinate with other module owners. Run integration tests across affected modules.',
    isBlocking: false,
  },

  // R005: Data Flow Disruption
  {
    id: 'R005',
    name: 'Data Flow Disruption',
    category: 'data-corruption',
    severity: 'high',
    condition: (ctx) => {
      // Check if modifying critical data flows
      const criticalFlowCount = ctx.dataFlows.filter(
        f => f.strength === 'critical' && f.impactLevel === 'direct'
      ).length;

      return criticalFlowCount > 0;
    },
    mitigation: 'Verify data integrity after change. Add data validation checks.',
    isBlocking: false,
  },

  // R006: Performance Impact
  {
    id: 'R006',
    name: 'Potential Performance Impact',
    category: 'performance',
    severity: 'medium',
    condition: (ctx) => {
      const perfKeywords = [
        'query', 'database', 'cache', 'index', 'bulk', 'batch',
        'loop', 'iteration', 'recursive', 'sync', 'async'
      ];

      // Check if modifying performance-sensitive areas
      const hasPerKeyword = ctx.parsed.keywords.some(k => perfKeywords.includes(k));

      // Check for database-heavy operations
      const hasDatabaseOp = ctx.parsed.operations.some(
        op => op.target.toLowerCase().includes('database') ||
              op.target.toLowerCase().includes('query')
      );

      // Many files affected
      const manyFilesAffected = ctx.scope.affectedFiles.length > 10;

      return (hasPerKeyword && hasDatabaseOp) || manyFilesAffected;
    },
    mitigation: 'Run performance benchmarks. Consider caching strategies.',
    isBlocking: false,
  },

  // R007: Test Coverage Gap
  {
    id: 'R007',
    name: 'Test Coverage Gap',
    category: 'testing',
    severity: 'medium',
    condition: (ctx) => {
      // Check if adding new functionality without test mentions
      const isNewFeature = ctx.changeInput.changeType === 'feature' ||
                          ctx.parsed.operations.some(op => op.type === 'add');

      const hasTestMention = ctx.parsed.keywords.some(
        k => ['test', 'spec', 'coverage', 'unit', 'integration', 'e2e'].includes(k)
      );

      return isNewFeature && !hasTestMention;
    },
    mitigation: 'Add unit tests for new functionality. Update existing tests if behavior changes.',
    isBlocking: false,
  },

  // R008: Deletion with Dependencies
  {
    id: 'R008',
    name: 'Deletion with Dependencies',
    category: 'breaking-change',
    severity: 'high',
    condition: (ctx) => {
      const isDeletion = ctx.changeInput.changeType === 'deletion' ||
                         ctx.parsed.operations.some(op => op.type === 'delete');

      const hasDependents = ctx.scope.dependentModules.length > 0 ||
                            ctx.scope.affectedFiles.length > 0;

      return isDeletion && hasDependents;
    },
    mitigation: 'Update or remove all dependent code before deletion. Check for runtime references.',
    isBlocking: true,
  },
];

// =============================================================================
// Risk Assessor Class
// =============================================================================

export class RiskAssessor {
  private rules: RiskRule[];
  private customRules: RiskRule[] = [];

  constructor(rules: RiskRule[] = DEFAULT_RISK_RULES) {
    this.rules = rules;
  }

  /**
   * Assess risks for a change
   */
  assess(
    input: ChangeInput,
    parsed: ParsedChange,
    scope: ChangeScope,
    dataFlows: ImpactDataFlow[]
  ): IdentifiedRisk[] {
    const context: RiskEvaluationContext = {
      parsed,
      scope,
      dataFlows,
      changeInput: input,
    };

    const risks: IdentifiedRisk[] = [];
    const allRules = [...this.rules, ...this.customRules];

    for (const rule of allRules) {
      try {
        if (rule.condition(context)) {
          risks.push(this.createRisk(rule, context));
        }
      } catch (error) {
        // Log but don't fail if a rule throws
        console.warn(`Risk rule ${rule.id} evaluation failed:`, error);
      }
    }

    // Sort by severity
    return this.sortBySeverity(risks);
  }

  /**
   * Create an identified risk from a rule match
   */
  private createRisk(rule: RiskRule, context: RiskEvaluationContext): IdentifiedRisk {
    const affectedAreas = this.collectAffectedAreas(context);

    return {
      id: `risk-${rule.id}-${Date.now()}`,
      ruleId: rule.id,
      name: rule.name,
      category: rule.category,
      severity: rule.severity,
      description: this.generateDescription(rule, context),
      affectedAreas,
      mitigation: rule.mitigation,
      isBlocking: rule.isBlocking,
      mitigationApplied: false,
    };
  }

  /**
   * Generate risk description from template or rule
   */
  private generateDescription(rule: RiskRule, context: RiskEvaluationContext): string {
    if (rule.descriptionTemplate) {
      return this.interpolateTemplate(rule.descriptionTemplate, context);
    }

    // Generate default description
    const areas = this.collectAffectedAreas(context);
    const areaList = areas.slice(0, 3).join(', ');
    const moreCount = areas.length > 3 ? ` and ${areas.length - 3} more` : '';

    return `${rule.name} detected. Affected areas: ${areaList}${moreCount}. ${this.getSeverityMessage(rule.severity)}`;
  }

  /**
   * Interpolate template with context values
   */
  private interpolateTemplate(template: string, context: RiskEvaluationContext): string {
    return template
      .replace('{{changeType}}', context.changeInput.changeType || 'unknown')
      .replace('{{moduleCount}}', String(context.scope.primaryModules.length + context.scope.dependentModules.length))
      .replace('{{fileCount}}', String(context.scope.primaryFiles.length + context.scope.affectedFiles.length))
      .replace('{{entityCount}}', String(context.parsed.entities.length));
  }

  /**
   * Get severity message
   */
  private getSeverityMessage(severity: RiskSeverity): string {
    switch (severity) {
      case 'critical':
        return 'This requires immediate attention and approval before proceeding.';
      case 'high':
        return 'This should be addressed before implementation.';
      case 'medium':
        return 'Consider addressing this during implementation.';
      case 'low':
        return 'This is informational and can be addressed if time permits.';
    }
  }

  /**
   * Collect affected areas for risk description
   */
  private collectAffectedAreas(context: RiskEvaluationContext): string[] {
    const areas: string[] = [];

    // Add primary modules
    areas.push(...context.scope.primaryModules.map(m => `module:${m}`));

    // Add dependent modules (direct only)
    const directDeps = context.scope.dependentModules.filter(m => m.impactLevel === 'direct');
    areas.push(...directDeps.map(m => `depends:${m.moduleName}`));

    // Add primary files (just names)
    areas.push(...context.scope.primaryFiles.map(f => f.split('/').pop() || f));

    // Add affected entities
    areas.push(...context.parsed.entities.map(e => `entity:${e}`));

    return [...new Set(areas)];
  }

  /**
   * Sort risks by severity
   */
  private sortBySeverity(risks: IdentifiedRisk[]): IdentifiedRisk[] {
    const severityOrder: Record<RiskSeverity, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }

  /**
   * Add custom risk rule
   */
  addRule(rule: RiskRule): void {
    this.customRules.push(rule);
  }

  /**
   * Remove custom rule by ID
   */
  removeRule(ruleId: string): boolean {
    const index = this.customRules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.customRules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all rules (default + custom)
   */
  getRules(): RiskRule[] {
    return [...this.rules, ...this.customRules];
  }

  /**
   * Get risk statistics
   */
  getStatistics(risks: IdentifiedRisk[]): {
    total: number;
    bySeverity: Record<RiskSeverity, number>;
    byCategory: Record<RiskCategory, number>;
    blocking: number;
  } {
    const stats = {
      total: risks.length,
      bySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      } as Record<RiskSeverity, number>,
      byCategory: {
        'data-corruption': 0,
        'breaking-change': 0,
        'performance': 0,
        'security': 0,
        'compatibility': 0,
        'testing': 0,
        'deployment': 0,
      } as Record<RiskCategory, number>,
      blocking: 0,
    };

    for (const risk of risks) {
      stats.bySeverity[risk.severity]++;
      stats.byCategory[risk.category]++;
      if (risk.isBlocking) stats.blocking++;
    }

    return stats;
  }
}

// =============================================================================
// Export singleton instance and default rules
// =============================================================================

export const riskAssessor = new RiskAssessor();
export { DEFAULT_RISK_RULES };
