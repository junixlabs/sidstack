/**
 * Claude Exporter
 *
 * Exports impact analysis results to Claude-compatible formats:
 * - Markdown rules for .claude/rules/
 * - Context summaries for injection
 * - Structured reports
 */

import type {
  ImpactAnalysis,
  ChangeScope,
  ImpactDataFlow,
  IdentifiedRisk,
  ValidationItem,
  ImplementationGate,
  ClaudeImpactExport,
  RiskSeverity,
} from './types';

// =============================================================================
// Types
// =============================================================================

export interface ClaudeExporterConfig {
  /** Project path for file generation */
  projectPath?: string;
  /** Include detailed flow diagrams */
  includeFlowDiagrams?: boolean;
  /** Include validation commands */
  includeValidationCommands?: boolean;
  /** Maximum risks to include */
  maxRisks?: number;
  /** Maximum validations to include */
  maxValidations?: number;
}

export interface ClaudeRulesFile {
  /** File path relative to project */
  filePath: string;
  /** File content */
  content: string;
  /** Globs for paths this rule applies to */
  globs: string[];
}

export interface ClaudeContextSummary {
  /** Short summary for injection */
  summary: string;
  /** Key points */
  keyPoints: string[];
  /** Files to focus on */
  focusFiles: string[];
  /** Warnings to show */
  warnings: string[];
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_CONFIG: Required<ClaudeExporterConfig> = {
  projectPath: '.',
  includeFlowDiagrams: true,
  includeValidationCommands: true,
  maxRisks: 10,
  maxValidations: 15,
};

// =============================================================================
// Claude Exporter Class
// =============================================================================

export class ClaudeExporter {
  private config: Required<ClaudeExporterConfig>;

  constructor(config: ClaudeExporterConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Export analysis to Claude rules format
   */
  exportToRules(analysis: ImpactAnalysis): ClaudeImpactExport {
    const content = this.generateRulesMarkdown(analysis);
    const paths = this.collectPaths(analysis.scope);
    const globs = this.generateGlobs(analysis.scope);

    return {
      content,
      paths,
      globs,
    };
  }

  /**
   * Generate a rules file for .claude/rules/
   */
  generateRulesFile(analysis: ImpactAnalysis): ClaudeRulesFile {
    const changeId = analysis.id.slice(0, 8);
    const timestamp = new Date().toISOString().split('T')[0];
    const filePath = `.claude/rules/impact-${changeId}-${timestamp}.md`;

    const content = this.generateRulesMarkdown(analysis);
    const globs = this.generateGlobs(analysis.scope);

    return {
      filePath,
      content,
      globs,
    };
  }

  /**
   * Generate compact context summary for injection
   */
  generateContextSummary(analysis: ImpactAnalysis): ClaudeContextSummary {
    const keyPoints: string[] = [];
    const warnings: string[] = [];

    // Gate status
    if (analysis.gate.status === 'blocked') {
      warnings.push(`BLOCKED: ${analysis.gate.blockers.length} blocking issues must be resolved`);
    } else if (analysis.gate.status === 'warning') {
      warnings.push(`WARNING: ${analysis.gate.warnings.length} warnings present`);
    }

    // Critical risks
    const criticalRisks = analysis.risks.filter(r => r.severity === 'critical');
    if (criticalRisks.length > 0) {
      warnings.push(`CRITICAL RISKS: ${criticalRisks.map(r => r.name).join(', ')}`);
    }

    // Scope summary
    keyPoints.push(
      `Affects ${analysis.scope.primaryModules.length} modules, ${analysis.scope.primaryFiles.length} files`
    );

    // Data flow summary
    const criticalFlows = analysis.dataFlows.filter(f => f.strength === 'critical');
    if (criticalFlows.length > 0) {
      keyPoints.push(`${criticalFlows.length} critical data flows impacted`);
    }

    // Validation summary
    const pendingValidations = analysis.validations.filter(v => v.status === 'pending');
    const blockingValidations = pendingValidations.filter(v => v.isBlocking);
    if (blockingValidations.length > 0) {
      keyPoints.push(`${blockingValidations.length} blocking validations required`);
    }

    // Focus files
    const focusFiles = [
      ...analysis.scope.primaryFiles.slice(0, 5),
      ...analysis.scope.affectedFiles.filter(f => f.impactLevel === 'direct').map(f => f.filePath).slice(0, 3),
    ];

    const summary = this.generateShortSummary(analysis);

    return {
      summary,
      keyPoints,
      focusFiles,
      warnings,
    };
  }

  /**
   * Generate full markdown report
   */
  generateReport(analysis: ImpactAnalysis): string {
    const lines: string[] = [];

    lines.push('# Impact Analysis Report');
    lines.push('');
    lines.push(`**Analysis ID:** ${analysis.id}`);
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push(`**Status:** ${analysis.gate.status.toUpperCase()}`);
    lines.push('');

    // Description
    lines.push('## Change Description');
    lines.push('');
    lines.push(analysis.input.description);
    lines.push('');

    // Gate Status
    lines.push('## Gate Status');
    lines.push('');
    lines.push(this.formatGateStatus(analysis.gate));
    lines.push('');

    // Scope
    lines.push('## Scope');
    lines.push('');
    lines.push(this.formatScope(analysis.scope));
    lines.push('');

    // Data Flows
    if (analysis.dataFlows.length > 0) {
      lines.push('## Data Flows');
      lines.push('');
      lines.push(this.formatDataFlows(analysis.dataFlows));
      lines.push('');
    }

    // Risks
    if (analysis.risks.length > 0) {
      lines.push('## Identified Risks');
      lines.push('');
      lines.push(this.formatRisks(analysis.risks));
      lines.push('');
    }

    // Validations
    if (analysis.validations.length > 0) {
      lines.push('## Validation Checklist');
      lines.push('');
      lines.push(this.formatValidations(analysis.validations));
      lines.push('');
    }

    return lines.join('\n');
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private generateRulesMarkdown(analysis: ImpactAnalysis): string {
    const lines: string[] = [];

    // Header
    lines.push('# Impact Analysis Context');
    lines.push('');
    lines.push('> This file was auto-generated by the Impact Analyzer.');
    lines.push('> It contains important context about a planned change.');
    lines.push('');

    // Gate Status Banner
    if (analysis.gate.status === 'blocked') {
      lines.push('## ⛔ IMPLEMENTATION BLOCKED');
      lines.push('');
      lines.push('The following issues must be resolved before implementation:');
      lines.push('');
      for (const blocker of analysis.gate.blockers) {
        lines.push(`- **${blocker.description}**`);
        lines.push(`  - Resolution: ${blocker.resolution}`);
      }
      lines.push('');
    } else if (analysis.gate.status === 'warning') {
      lines.push('## ⚠️ PROCEED WITH CAUTION');
      lines.push('');
      lines.push('The following warnings should be reviewed:');
      lines.push('');
      for (const warning of analysis.gate.warnings) {
        lines.push(`- ${warning.description}`);
      }
      lines.push('');
    }

    // Change Summary
    lines.push('## Change Summary');
    lines.push('');
    lines.push(`**Description:** ${analysis.input.description}`);
    lines.push(`**Type:** ${analysis.parsed.changeType}`);
    lines.push(`**Confidence:** ${Math.round(analysis.parsed.confidence * 100)}%`);
    lines.push('');

    // Scope Rules
    lines.push('## Scope Guidelines');
    lines.push('');
    lines.push('### Primary Modules');
    lines.push('Focus changes on these modules:');
    lines.push('');
    for (const module of analysis.scope.primaryModules) {
      lines.push(`- \`${module}\``);
    }
    lines.push('');

    lines.push('### Primary Files');
    lines.push('These files are the main targets:');
    lines.push('');
    for (const file of analysis.scope.primaryFiles.slice(0, 10)) {
      lines.push(`- \`${file}\``);
    }
    if (analysis.scope.primaryFiles.length > 10) {
      lines.push(`- ... and ${analysis.scope.primaryFiles.length - 10} more`);
    }
    lines.push('');

    // Dependencies to be careful with
    if (analysis.scope.dependentModules.length > 0) {
      lines.push('### Dependencies (Be Careful)');
      lines.push('Changes may affect these dependent modules:');
      lines.push('');
      for (const dep of analysis.scope.dependentModules.slice(0, 5)) {
        lines.push(`- \`${dep.moduleName}\` (${dep.impactLevel}): ${dep.reason}`);
      }
      lines.push('');
    }

    // Risk Rules
    if (analysis.risks.length > 0) {
      lines.push('## Risk Awareness');
      lines.push('');
      lines.push('The following risks have been identified:');
      lines.push('');

      const sortedRisks = [...analysis.risks]
        .sort((a, b) => this.severityOrder(a.severity) - this.severityOrder(b.severity))
        .slice(0, this.config.maxRisks);

      for (const risk of sortedRisks) {
        const icon = this.severityIcon(risk.severity);
        lines.push(`### ${icon} ${risk.name} (${risk.severity})`);
        lines.push('');
        lines.push(risk.description);
        lines.push('');
        lines.push(`**Mitigation:** ${risk.mitigation}`);
        lines.push('');
        if (risk.isBlocking) {
          lines.push('> ⛔ This is a BLOCKING risk');
          lines.push('');
        }
      }
    }

    // Data Flow Rules
    if (analysis.dataFlows.length > 0 && this.config.includeFlowDiagrams) {
      lines.push('## Data Flow Considerations');
      lines.push('');

      const criticalFlows = analysis.dataFlows.filter(f => f.strength === 'critical');
      if (criticalFlows.length > 0) {
        lines.push('### Critical Data Flows');
        lines.push('These data flows must be preserved:');
        lines.push('');
        for (const flow of criticalFlows) {
          lines.push(`- **${flow.from} → ${flow.to}**: ${flow.entities.join(', ')}`);
          if (flow.suggestedTests.length > 0) {
            lines.push(`  - Test: ${flow.suggestedTests[0]}`);
          }
        }
        lines.push('');
      }
    }

    // Validation Requirements
    if (analysis.validations.length > 0) {
      lines.push('## Required Validations');
      lines.push('');
      lines.push('Before completing this change, verify:');
      lines.push('');

      const blockingValidations = analysis.validations.filter(v => v.isBlocking);
      const otherValidations = analysis.validations.filter(v => !v.isBlocking);

      if (blockingValidations.length > 0) {
        lines.push('### Blocking (Must Pass)');
        lines.push('');
        for (const val of blockingValidations.slice(0, this.config.maxValidations)) {
          lines.push(`- [ ] ${val.title}`);
          if (this.config.includeValidationCommands && val.verifyCommand) {
            lines.push(`  - Command: \`${val.verifyCommand}\``);
          }
        }
        lines.push('');
      }

      if (otherValidations.length > 0) {
        lines.push('### Recommended');
        lines.push('');
        for (const val of otherValidations.slice(0, 5)) {
          lines.push(`- [ ] ${val.title}`);
        }
        lines.push('');
      }
    }

    // Footer
    lines.push('---');
    lines.push(`*Analysis ID: ${analysis.id}*`);
    lines.push(`*Generated: ${new Date().toISOString()}*`);

    return lines.join('\n');
  }

  private generateShortSummary(analysis: ImpactAnalysis): string {
    const parts: string[] = [];

    // Gate status
    if (analysis.gate.status === 'blocked') {
      parts.push('BLOCKED');
    } else if (analysis.gate.status === 'warning') {
      parts.push('WARNING');
    } else {
      parts.push('READY');
    }

    // Scope
    parts.push(`${analysis.scope.primaryModules.length}mod/${analysis.scope.primaryFiles.length}files`);

    // Risks
    const criticalCount = analysis.risks.filter(r => r.severity === 'critical').length;
    const highCount = analysis.risks.filter(r => r.severity === 'high').length;
    if (criticalCount > 0) {
      parts.push(`${criticalCount}critical`);
    }
    if (highCount > 0) {
      parts.push(`${highCount}high`);
    }

    // Validations
    const pendingBlocking = analysis.validations.filter(
      v => v.status === 'pending' && v.isBlocking
    ).length;
    if (pendingBlocking > 0) {
      parts.push(`${pendingBlocking}blocking-validations`);
    }

    return parts.join(' | ');
  }

  private collectPaths(scope: ChangeScope): string[] {
    const paths: string[] = [
      ...scope.primaryFiles,
      ...scope.affectedFiles.map(f => f.filePath),
    ];
    return [...new Set(paths)];
  }

  private generateGlobs(scope: ChangeScope): string[] {
    const globs: string[] = [];

    // Add module-based globs
    for (const module of scope.primaryModules) {
      globs.push(`**/${module}/**`);
    }

    // Add file-based patterns
    const directories = new Set<string>();
    for (const file of scope.primaryFiles) {
      const parts = file.split('/');
      if (parts.length > 1) {
        parts.pop(); // Remove filename
        directories.add(parts.join('/'));
      }
    }

    for (const dir of directories) {
      globs.push(`${dir}/**`);
    }

    return [...new Set(globs)];
  }

  private formatGateStatus(gate: ImplementationGate): string {
    const lines: string[] = [];

    const statusEmoji = {
      blocked: '⛔',
      warning: '⚠️',
      clear: '✅',
    }[gate.status];

    lines.push(`**Status:** ${statusEmoji} ${gate.status.toUpperCase()}`);

    if (gate.blockers.length > 0) {
      lines.push('');
      lines.push('**Blockers:**');
      for (const blocker of gate.blockers) {
        lines.push(`- ${blocker.description}`);
      }
    }

    if (gate.warnings.length > 0) {
      lines.push('');
      lines.push('**Warnings:**');
      for (const warning of gate.warnings) {
        lines.push(`- ${warning.description}`);
      }
    }

    if (gate.approval) {
      lines.push('');
      lines.push(`**Approved by:** ${gate.approval.approver}`);
      lines.push(`**Reason:** ${gate.approval.reason}`);
    }

    return lines.join('\n');
  }

  private formatScope(scope: ChangeScope): string {
    const lines: string[] = [];

    lines.push(`**Primary Modules:** ${scope.primaryModules.join(', ') || 'None'}`);
    lines.push(`**Primary Files:** ${scope.primaryFiles.length}`);
    lines.push(`**Dependent Modules:** ${scope.dependentModules.length}`);
    lines.push(`**Affected Files:** ${scope.affectedFiles.length}`);
    lines.push(`**Affected Entities:** ${scope.affectedEntities.join(', ') || 'None'}`);

    return lines.join('\n');
  }

  private formatDataFlows(flows: ImpactDataFlow[]): string {
    const lines: string[] = [];

    lines.push('| From | To | Type | Strength | Impact |');
    lines.push('|------|-----|------|----------|--------|');

    for (const flow of flows.slice(0, 10)) {
      lines.push(
        `| ${flow.from} | ${flow.to} | ${flow.flowType} | ${flow.strength} | ${flow.impactLevel} |`
      );
    }

    if (flows.length > 10) {
      lines.push(`| ... | ... | ... | ... | *${flows.length - 10} more* |`);
    }

    return lines.join('\n');
  }

  private formatRisks(risks: IdentifiedRisk[]): string {
    const lines: string[] = [];

    for (const risk of risks) {
      const icon = this.severityIcon(risk.severity);
      const blocking = risk.isBlocking ? ' ⛔' : '';
      lines.push(`### ${icon} ${risk.name}${blocking}`);
      lines.push('');
      lines.push(`**Severity:** ${risk.severity} | **Category:** ${risk.category}`);
      lines.push('');
      lines.push(risk.description);
      lines.push('');
      lines.push(`**Mitigation:** ${risk.mitigation}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  private formatValidations(validations: ValidationItem[]): string {
    const lines: string[] = [];

    for (const val of validations) {
      const status = {
        pending: '⬜',
        running: '🔄',
        passed: '✅',
        failed: '❌',
        skipped: '⏭️',
      }[val.status];

      const blocking = val.isBlocking ? ' **[BLOCKING]**' : '';
      lines.push(`- ${status} ${val.title}${blocking}`);

      if (val.verifyCommand) {
        lines.push(`  - Command: \`${val.verifyCommand}\``);
      }
    }

    return lines.join('\n');
  }

  private severityOrder(severity: RiskSeverity): number {
    return { critical: 0, high: 1, medium: 2, low: 3 }[severity];
  }

  private severityIcon(severity: RiskSeverity): string {
    return { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[severity];
  }
}

// =============================================================================
// Export singleton instance
// =============================================================================

export const claudeExporter = new ClaudeExporter();
