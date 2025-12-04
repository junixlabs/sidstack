/**
 * Lifecycle Hooks
 *
 * Integrates impact analysis with task and spec lifecycle:
 * - Auto-analyze on task creation (non-trivial tasks)
 * - Analyze on spec approval
 * - Pre-implementation gate checks
 * - Gate status metadata updates
 */

import type {
  ChangeInput,
  ImpactAnalysis,
  ChangeType,
  GateStatus,
} from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Task metadata with impact analysis link
 */
export interface TaskImpactMetadata {
  /** Impact analysis ID if analyzed */
  analysisId?: string;
  /** Current gate status */
  gateStatus?: GateStatus;
  /** Whether analysis is required */
  analysisRequired: boolean;
  /** Skip reason if analysis not required */
  skipReason?: string;
  /** Last checked timestamp */
  checkedAt: number;
}

/**
 * Spec metadata with impact analysis link
 */
export interface SpecImpactMetadata {
  /** Impact analysis ID if analyzed */
  analysisId?: string;
  /** Current gate status */
  gateStatus?: GateStatus;
  /** When analysis was triggered */
  analyzedAt?: number;
}

/**
 * Criteria for determining if analysis is needed
 */
export interface AnalysisCriteria {
  /** Keywords that trigger analysis */
  triggerKeywords: string[];
  /** Change types that always need analysis */
  alwaysAnalyzeTypes: ChangeType[];
  /** Minimum description length to consider non-trivial */
  minDescriptionLength: number;
  /** File patterns that trigger analysis */
  sensitiveFilePatterns: RegExp[];
  /** Module IDs that always need analysis */
  sensitiveModules: string[];
}

/**
 * Analysis trigger result
 */
export interface AnalysisTrigger {
  shouldAnalyze: boolean;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  suggestedInput?: Partial<ChangeInput>;
}

/**
 * Pre-implementation check result
 */
export interface PreImplementationCheck {
  allowed: boolean;
  gateStatus: GateStatus;
  analysisId?: string;
  blockerCount: number;
  warningCount: number;
  message: string;
  blockerSummary?: string[];
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CRITERIA: AnalysisCriteria = {
  triggerKeywords: [
    'refactor',
    'migration',
    'database',
    'schema',
    'api',
    'authentication',
    'authorization',
    'security',
    'breaking',
    'deprecate',
    'remove',
    'delete',
    'rename',
    'restructure',
    'performance',
    'critical',
  ],
  alwaysAnalyzeTypes: ['migration', 'refactor', 'deletion'],
  minDescriptionLength: 50,
  sensitiveFilePatterns: [
    /database\.(ts|js)/i,
    /schema\.(ts|js|sql)/i,
    /migration/i,
    /auth/i,
    /security/i,
    /\.env/i,
    /config\.(ts|js|json)/i,
  ],
  sensitiveModules: [
    'database',
    'auth',
    'security',
    'api',
    'shared',
  ],
};

// =============================================================================
// Lifecycle Hooks Class
// =============================================================================

export class LifecycleHooks {
  private criteria: AnalysisCriteria;
  private analysisProvider?: AnalysisProvider;

  constructor(
    criteria: Partial<AnalysisCriteria> = {},
    analysisProvider?: AnalysisProvider
  ) {
    this.criteria = { ...DEFAULT_CRITERIA, ...criteria };
    this.analysisProvider = analysisProvider;
  }

  // ===========================================================================
  // Task Creation Hook
  // ===========================================================================

  /**
   * Evaluate if a task needs impact analysis
   */
  evaluateTaskForAnalysis(task: {
    id: string;
    title: string;
    description?: string;
    targetFiles?: string[];
    targetModules?: string[];
  }): AnalysisTrigger {
    const reasons: string[] = [];
    let priority: 'high' | 'medium' | 'low' = 'low';

    const fullText = `${task.title} ${task.description || ''}`.toLowerCase();

    // Check trigger keywords
    for (const keyword of this.criteria.triggerKeywords) {
      if (fullText.includes(keyword.toLowerCase())) {
        reasons.push(`Contains keyword: "${keyword}"`);
        if (['security', 'authentication', 'breaking', 'migration'].includes(keyword)) {
          priority = 'high';
        } else if (priority !== 'high') {
          priority = 'medium';
        }
      }
    }

    // Check sensitive files
    if (task.targetFiles) {
      for (const file of task.targetFiles) {
        for (const pattern of this.criteria.sensitiveFilePatterns) {
          if (pattern.test(file)) {
            reasons.push(`Targets sensitive file: ${file}`);
            priority = 'high';
          }
        }
      }
    }

    // Check sensitive modules
    if (task.targetModules) {
      for (const module of task.targetModules) {
        if (this.criteria.sensitiveModules.includes(module.toLowerCase())) {
          reasons.push(`Targets sensitive module: ${module}`);
          priority = 'high';
        }
      }
    }

    // Check description length (complexity indicator)
    if (task.description && task.description.length >= this.criteria.minDescriptionLength) {
      reasons.push('Task has detailed description (likely complex)');
      if (priority === 'low') priority = 'medium';
    }

    const shouldAnalyze = reasons.length > 0;

    return {
      shouldAnalyze,
      reason: shouldAnalyze
        ? reasons.join('; ')
        : 'Task appears trivial - no sensitive patterns detected',
      priority,
      suggestedInput: shouldAnalyze
        ? {
            taskId: task.id,
            description: `${task.title}\n\n${task.description || ''}`,
            targetFiles: task.targetFiles,
            targetModules: task.targetModules,
          }
        : undefined,
    };
  }

  /**
   * Create task impact metadata
   */
  createTaskMetadata(
    trigger: AnalysisTrigger,
    analysisId?: string
  ): TaskImpactMetadata {
    return {
      analysisId,
      gateStatus: analysisId ? undefined : undefined,
      analysisRequired: trigger.shouldAnalyze,
      skipReason: trigger.shouldAnalyze ? undefined : trigger.reason,
      checkedAt: Date.now(),
    };
  }

  // ===========================================================================
  // Spec Approval Hook
  // ===========================================================================

  /**
   * Evaluate if an approved spec needs impact analysis
   */
  evaluateSpecForAnalysis(spec: {
    id: string;
    title: string;
    content: string;
    moduleId?: string;
    changeType?: ChangeType;
  }): AnalysisTrigger {
    const reasons: string[] = [];
    let priority: 'high' | 'medium' | 'low' = 'medium';

    // Always analyze if change type requires it
    if (spec.changeType && this.criteria.alwaysAnalyzeTypes.includes(spec.changeType)) {
      reasons.push(`Change type "${spec.changeType}" requires analysis`);
      priority = 'high';
    }

    const fullText = `${spec.title} ${spec.content}`.toLowerCase();

    // Check trigger keywords in spec content
    for (const keyword of this.criteria.triggerKeywords) {
      if (fullText.includes(keyword.toLowerCase())) {
        reasons.push(`Spec mentions: "${keyword}"`);
        if (['security', 'authentication', 'breaking', 'migration', 'database'].includes(keyword)) {
          priority = 'high';
        }
      }
    }

    // Check if spec targets sensitive module
    if (spec.moduleId && this.criteria.sensitiveModules.includes(spec.moduleId.toLowerCase())) {
      reasons.push(`Targets sensitive module: ${spec.moduleId}`);
      priority = 'high';
    }

    // Specs are generally more detailed, so default to analyzing
    if (reasons.length === 0 && spec.content.length > 200) {
      reasons.push('Spec has substantial content - recommend analysis');
    }

    const shouldAnalyze = reasons.length > 0;

    return {
      shouldAnalyze,
      reason: shouldAnalyze
        ? reasons.join('; ')
        : 'Spec appears low-impact',
      priority,
      suggestedInput: shouldAnalyze
        ? {
            specId: spec.id,
            description: spec.content,
            targetModules: spec.moduleId ? [spec.moduleId] : undefined,
            changeType: spec.changeType,
          }
        : undefined,
    };
  }

  /**
   * Create spec impact metadata
   */
  createSpecMetadata(analysisId?: string): SpecImpactMetadata {
    return {
      analysisId,
      gateStatus: undefined,
      analyzedAt: analysisId ? Date.now() : undefined,
    };
  }

  // ===========================================================================
  // Pre-Implementation Check
  // ===========================================================================

  /**
   * Check if implementation can proceed based on gate status
   */
  async checkPreImplementation(
    taskId?: string,
    specId?: string
  ): Promise<PreImplementationCheck> {
    if (!this.analysisProvider) {
      return {
        allowed: true,
        gateStatus: 'clear',
        blockerCount: 0,
        warningCount: 0,
        message: 'No analysis provider configured - proceeding without check',
      };
    }

    // Try to find analysis by task or spec
    let analysis: ImpactAnalysis | null = null;

    if (taskId) {
      analysis = await this.analysisProvider.getAnalysisByTask(taskId);
    }
    if (!analysis && specId) {
      analysis = await this.analysisProvider.getAnalysisBySpec(specId);
    }

    // No analysis found
    if (!analysis) {
      return {
        allowed: true,
        gateStatus: 'clear',
        blockerCount: 0,
        warningCount: 0,
        message: 'No impact analysis found - consider running analysis first',
      };
    }

    const gate = analysis.gate;

    return {
      allowed: gate.status !== 'blocked',
      gateStatus: gate.status,
      analysisId: analysis.id,
      blockerCount: gate.blockers.length,
      warningCount: gate.warnings.length,
      message: this.formatGateMessage(gate.status, gate.blockers.length, gate.warnings.length),
      blockerSummary: gate.blockers.map(b => b.description),
    };
  }

  /**
   * Format gate status message
   */
  private formatGateMessage(
    status: GateStatus,
    blockers: number,
    warnings: number
  ): string {
    switch (status) {
      case 'blocked':
        return `Implementation BLOCKED: ${blockers} unresolved blocker(s). Resolve blockers or request approval.`;
      case 'warning':
        return `Implementation allowed with ${warnings} warning(s). Review before proceeding.`;
      case 'clear':
        return 'Implementation gate is clear. Safe to proceed.';
    }
  }

  // ===========================================================================
  // Gate Status Sync
  // ===========================================================================

  /**
   * Sync gate status to task metadata
   */
  syncTaskGateStatus(
    currentMetadata: TaskImpactMetadata,
    analysis: ImpactAnalysis
  ): TaskImpactMetadata {
    return {
      ...currentMetadata,
      analysisId: analysis.id,
      gateStatus: analysis.gate.status,
      checkedAt: Date.now(),
    };
  }

  /**
   * Sync gate status to spec metadata
   */
  syncSpecGateStatus(
    currentMetadata: SpecImpactMetadata,
    analysis: ImpactAnalysis
  ): SpecImpactMetadata {
    return {
      ...currentMetadata,
      analysisId: analysis.id,
      gateStatus: analysis.gate.status,
    };
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  /**
   * Set analysis provider
   */
  setAnalysisProvider(provider: AnalysisProvider): void {
    this.analysisProvider = provider;
  }

  /**
   * Update criteria
   */
  setCriteria(criteria: Partial<AnalysisCriteria>): void {
    this.criteria = { ...this.criteria, ...criteria };
  }

  /**
   * Add sensitive module
   */
  addSensitiveModule(moduleId: string): void {
    if (!this.criteria.sensitiveModules.includes(moduleId)) {
      this.criteria.sensitiveModules.push(moduleId);
    }
  }

  /**
   * Add trigger keyword
   */
  addTriggerKeyword(keyword: string): void {
    if (!this.criteria.triggerKeywords.includes(keyword)) {
      this.criteria.triggerKeywords.push(keyword);
    }
  }
}

// =============================================================================
// Analysis Provider Interface
// =============================================================================

/**
 * Interface for analysis data access
 */
export interface AnalysisProvider {
  getAnalysisByTask(taskId: string): Promise<ImpactAnalysis | null>;
  getAnalysisBySpec(specId: string): Promise<ImpactAnalysis | null>;
  getAnalysis(id: string): Promise<ImpactAnalysis | null>;
}

// =============================================================================
// Export singleton instance
// =============================================================================

export const lifecycleHooks = new LifecycleHooks();
