/**
 * Claude Exporter Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ClaudeExporter,
  claudeExporter,
  type ClaudeExporterConfig,
} from './claude-exporter';
import type { ImpactAnalysis } from './types';

describe('ClaudeExporter', () => {
  let exporter: ClaudeExporter;

  // Helper to create mock analysis
  const createMockAnalysis = (overrides: Partial<ImpactAnalysis> = {}): ImpactAnalysis => ({
    id: 'analysis-123456789',
    projectId: 'project-1',
    input: {
      description: 'Add user authentication with OAuth2',
    },
    status: 'completed',
    parsed: {
      entities: ['User', 'OAuth'],
      operations: [{ type: 'add', target: 'authentication', description: 'add auth' }],
      keywords: ['user', 'authentication', 'oauth'],
      changeType: 'feature',
      confidence: 0.85,
    },
    scope: {
      primaryModules: ['auth', 'users'],
      primaryFiles: ['src/services/auth.ts', 'src/controllers/user.ts'],
      dependentModules: [
        {
          moduleId: 'api',
          moduleName: 'api',
          impactLevel: 'direct',
          dependencyPath: ['auth'],
          reason: 'imports from auth',
        },
      ],
      affectedFiles: [
        { filePath: 'src/routes/index.ts', impactLevel: 'direct', reason: 'uses auth' },
      ],
      affectedEntities: ['User', 'Session'],
      expansionDepth: 2,
    },
    dataFlows: [
      {
        id: 'flow-1',
        from: 'UserService',
        to: 'Database',
        entities: ['User'],
        flowType: 'write',
        strength: 'critical',
        relationships: ['writes'],
        impactLevel: 'direct',
        affectedOperations: ['create'],
        validationRequired: true,
        suggestedTests: ['test user creation'],
      },
    ],
    risks: [
      {
        id: 'risk-1',
        ruleId: 'R003',
        name: 'Security-Sensitive Change',
        category: 'security',
        severity: 'critical',
        description: 'Authentication changes require security review',
        affectedAreas: ['auth module'],
        mitigation: 'Conduct security review',
        isBlocking: true,
        mitigationApplied: false,
      },
      {
        id: 'risk-2',
        ruleId: 'R007',
        name: 'Test Coverage Gap',
        category: 'testing',
        severity: 'medium',
        description: 'New feature needs tests',
        affectedAreas: [],
        mitigation: 'Add unit tests',
        isBlocking: false,
        mitigationApplied: false,
      },
    ],
    validations: [
      {
        id: 'val-1',
        title: 'Security review',
        description: 'Review auth implementation',
        category: 'review',
        status: 'pending',
        isBlocking: true,
        autoVerifiable: false,
      },
      {
        id: 'val-2',
        title: 'Run auth tests',
        description: 'Execute auth module tests',
        category: 'test',
        status: 'pending',
        isBlocking: true,
        autoVerifiable: true,
        verifyCommand: 'pnpm test packages/auth',
      },
    ],
    gate: {
      status: 'blocked',
      blockers: [
        {
          type: 'risk',
          itemId: 'risk-1',
          description: 'CRITICAL: Security-Sensitive Change',
          resolution: 'Conduct security review',
        },
      ],
      warnings: [
        {
          type: 'risk',
          itemId: 'risk-2',
          description: 'MEDIUM: Test Coverage Gap',
        },
      ],
      evaluatedAt: Date.now(),
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    exporter = new ClaudeExporter();
  });

  describe('exportToRules', () => {
    it('should export analysis to Claude rules format', () => {
      const analysis = createMockAnalysis();
      const result = exporter.exportToRules(analysis);

      expect(result.content).toBeDefined();
      expect(result.paths).toContain('src/services/auth.ts');
      expect(result.globs.length).toBeGreaterThan(0);
    });

    it('should include all primary files in paths', () => {
      const analysis = createMockAnalysis();
      const result = exporter.exportToRules(analysis);

      for (const file of analysis.scope.primaryFiles) {
        expect(result.paths).toContain(file);
      }
    });

    it('should generate module-based globs', () => {
      const analysis = createMockAnalysis();
      const result = exporter.exportToRules(analysis);

      expect(result.globs.some(g => g.includes('auth'))).toBe(true);
      expect(result.globs.some(g => g.includes('users'))).toBe(true);
    });
  });

  describe('generateRulesFile', () => {
    it('should generate rules file with correct path', () => {
      const analysis = createMockAnalysis();
      const result = exporter.generateRulesFile(analysis);

      expect(result.filePath).toMatch(/^\.claude\/rules\/impact-/);
      expect(result.filePath).toMatch(/\.md$/);
    });

    it('should include analysis ID prefix in filename', () => {
      const analysis = createMockAnalysis();
      const result = exporter.generateRulesFile(analysis);

      // The ID 'analysis-123456789' gets sliced to first 8 chars: 'analysis-'
      expect(result.filePath).toContain('impact-analysis');
    });

    it('should generate content with gate status', () => {
      const analysis = createMockAnalysis();
      const result = exporter.generateRulesFile(analysis);

      expect(result.content).toContain('BLOCKED');
      expect(result.content).toContain('IMPLEMENTATION BLOCKED');
    });

    it('should include blockers in content', () => {
      const analysis = createMockAnalysis();
      const result = exporter.generateRulesFile(analysis);

      expect(result.content).toContain('Security-Sensitive Change');
      expect(result.content).toContain('Conduct security review');
    });

    it('should include scope in content', () => {
      const analysis = createMockAnalysis();
      const result = exporter.generateRulesFile(analysis);

      expect(result.content).toContain('auth');
      expect(result.content).toContain('src/services/auth.ts');
    });

    it('should include risks in content', () => {
      const analysis = createMockAnalysis();
      const result = exporter.generateRulesFile(analysis);

      expect(result.content).toContain('Risk Awareness');
      expect(result.content).toContain('Security-Sensitive Change');
    });

    it('should include validations in content', () => {
      const analysis = createMockAnalysis();
      const result = exporter.generateRulesFile(analysis);

      expect(result.content).toContain('Required Validations');
      expect(result.content).toContain('Security review');
      expect(result.content).toContain('pnpm test packages/auth');
    });

    it('should handle warning status', () => {
      const analysis = createMockAnalysis({
        gate: {
          status: 'warning',
          blockers: [],
          warnings: [{ type: 'risk', itemId: 'r1', description: 'Warning test' }],
          evaluatedAt: Date.now(),
        },
      });
      const result = exporter.generateRulesFile(analysis);

      expect(result.content).toContain('PROCEED WITH CAUTION');
    });

    it('should handle clear status', () => {
      const analysis = createMockAnalysis({
        gate: {
          status: 'clear',
          blockers: [],
          warnings: [],
          evaluatedAt: Date.now(),
        },
      });
      const result = exporter.generateRulesFile(analysis);

      expect(result.content).not.toContain('BLOCKED');
      expect(result.content).not.toContain('CAUTION');
    });
  });

  describe('generateContextSummary', () => {
    it('should generate compact summary', () => {
      const analysis = createMockAnalysis();
      const result = exporter.generateContextSummary(analysis);

      expect(result.summary).toBeDefined();
      expect(result.keyPoints).toBeInstanceOf(Array);
      expect(result.focusFiles).toBeInstanceOf(Array);
      expect(result.warnings).toBeInstanceOf(Array);
    });

    it('should include blocked warning', () => {
      const analysis = createMockAnalysis();
      const result = exporter.generateContextSummary(analysis);

      expect(result.warnings.some(w => w.includes('BLOCKED'))).toBe(true);
    });

    it('should include critical risk warning', () => {
      const analysis = createMockAnalysis();
      const result = exporter.generateContextSummary(analysis);

      expect(result.warnings.some(w => w.includes('CRITICAL RISKS'))).toBe(true);
    });

    it('should include scope in key points', () => {
      const analysis = createMockAnalysis();
      const result = exporter.generateContextSummary(analysis);

      expect(result.keyPoints.some(kp => kp.includes('modules'))).toBe(true);
    });

    it('should include focus files', () => {
      const analysis = createMockAnalysis();
      const result = exporter.generateContextSummary(analysis);

      expect(result.focusFiles.length).toBeGreaterThan(0);
      expect(result.focusFiles).toContain('src/services/auth.ts');
    });

    it('should include summary with status', () => {
      const analysis = createMockAnalysis();
      const result = exporter.generateContextSummary(analysis);

      expect(result.summary).toContain('BLOCKED');
    });

    it('should show warning count in summary for warning status', () => {
      const analysis = createMockAnalysis({
        gate: {
          status: 'warning',
          blockers: [],
          warnings: [{ type: 'risk', itemId: 'r1', description: 'test' }],
          evaluatedAt: Date.now(),
        },
      });
      const result = exporter.generateContextSummary(analysis);

      expect(result.warnings.some(w => w.includes('WARNING'))).toBe(true);
    });
  });

  describe('generateReport', () => {
    it('should generate full markdown report', () => {
      const analysis = createMockAnalysis();
      const report = exporter.generateReport(analysis);

      expect(report).toContain('# Impact Analysis Report');
      expect(report).toContain('**Analysis ID:**');
      expect(report).toContain('## Change Description');
      expect(report).toContain('## Gate Status');
      expect(report).toContain('## Scope');
    });

    it('should include data flows section', () => {
      const analysis = createMockAnalysis();
      const report = exporter.generateReport(analysis);

      expect(report).toContain('## Data Flows');
      expect(report).toContain('UserService');
      expect(report).toContain('Database');
    });

    it('should include risks section', () => {
      const analysis = createMockAnalysis();
      const report = exporter.generateReport(analysis);

      expect(report).toContain('## Identified Risks');
      expect(report).toContain('Security-Sensitive Change');
    });

    it('should include validations section', () => {
      const analysis = createMockAnalysis();
      const report = exporter.generateReport(analysis);

      expect(report).toContain('## Validation Checklist');
      expect(report).toContain('Security review');
    });

    it('should omit data flows when empty', () => {
      const analysis = createMockAnalysis({ dataFlows: [] });
      const report = exporter.generateReport(analysis);

      expect(report).not.toContain('## Data Flows');
    });

    it('should omit risks when empty', () => {
      const analysis = createMockAnalysis({ risks: [] });
      const report = exporter.generateReport(analysis);

      expect(report).not.toContain('## Identified Risks');
    });

    it('should omit validations when empty', () => {
      const analysis = createMockAnalysis({ validations: [] });
      const report = exporter.generateReport(analysis);

      expect(report).not.toContain('## Validation Checklist');
    });
  });

  describe('configuration', () => {
    it('should respect maxRisks config', () => {
      const config: ClaudeExporterConfig = { maxRisks: 1 };
      const customExporter = new ClaudeExporter(config);

      const analysis = createMockAnalysis();
      const result = customExporter.generateRulesFile(analysis);

      // Should only include 1 risk in the Risk Awareness section
      const riskSectionMatches = result.content.match(/### (🔴|🟠|🟡|🟢)/g);
      expect(riskSectionMatches?.length).toBeLessThanOrEqual(1);
    });

    it('should exclude validation commands when disabled', () => {
      const config: ClaudeExporterConfig = { includeValidationCommands: false };
      const customExporter = new ClaudeExporter(config);

      const analysis = createMockAnalysis();
      const result = customExporter.generateRulesFile(analysis);

      // Should not include "Command:" in validations
      const validationsSection = result.content.split('Required Validations')[1];
      if (validationsSection) {
        const blockingSection = validationsSection.split('Recommended')[0];
        expect(blockingSection).not.toContain('Command:');
      }
    });

    it('should exclude flow diagrams when disabled', () => {
      const config: ClaudeExporterConfig = { includeFlowDiagrams: false };
      const customExporter = new ClaudeExporter(config);

      const analysis = createMockAnalysis();
      const result = customExporter.generateRulesFile(analysis);

      expect(result.content).not.toContain('Data Flow Considerations');
    });
  });

  describe('severity formatting', () => {
    it('should use correct icons for severity levels', () => {
      const analysis = createMockAnalysis();
      const result = exporter.generateRulesFile(analysis);

      // Critical should use red icon
      expect(result.content).toContain('🔴');
    });

    it('should sort risks by severity', () => {
      const analysis = createMockAnalysis();
      const report = exporter.generateReport(analysis);

      // Critical risk should appear before medium risk
      const criticalPos = report.indexOf('critical');
      const mediumPos = report.indexOf('medium');

      // In the risks section, critical should come first
      expect(criticalPos).toBeLessThan(mediumPos);
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton exporter', () => {
      expect(claudeExporter).toBeInstanceOf(ClaudeExporter);
    });

    it('should work the same as new instance', () => {
      const analysis = createMockAnalysis();

      const result1 = claudeExporter.exportToRules(analysis);
      const result2 = exporter.exportToRules(analysis);

      expect(result1.paths.length).toBe(result2.paths.length);
      expect(result1.globs.length).toBe(result2.globs.length);
    });
  });
});
