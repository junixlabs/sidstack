/**
 * Gate Controller
 *
 * Controls the implementation gate based on:
 * - Risk assessment (critical/high risks block)
 * - Validation status (blocking validations must pass)
 * - Approval workflow for overrides
 *
 * Provides:
 * - Blocker evaluation
 * - Approval workflow
 * - Override mechanism with audit logging
 * - Status update hooks
 */

import type {
  ImpactAnalysis,
  IdentifiedRisk,
  ValidationItem,
  ImplementationGate,
  GateBlocker,
  GateWarning,
  GateStatus,
  GateApproval,
  ApproveGateRequest,
} from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Hook function signature for gate status changes
 */
export type GateStatusHook = (
  analysisId: string,
  previousStatus: GateStatus,
  newStatus: GateStatus,
  gate: ImplementationGate
) => void | Promise<void>;

/**
 * Configuration for gate controller
 */
export interface GateControllerConfig {
  /** Risk severities that block implementation */
  blockingSeverities: Array<'critical' | 'high' | 'medium' | 'low'>;
  /** Whether unresolved high risks block by default */
  blockOnHighRisk: boolean;
  /** Whether failed validations block */
  blockOnFailedValidation: boolean;
  /** Whether pending blocking validations block */
  blockOnPendingBlockingValidation: boolean;
  /** Minimum validations that must pass before clear */
  minPassedValidations: number;
}

const DEFAULT_CONFIG: GateControllerConfig = {
  blockingSeverities: ['critical', 'high'],
  blockOnHighRisk: true,
  blockOnFailedValidation: true,
  blockOnPendingBlockingValidation: true,
  minPassedValidations: 0,
};

// =============================================================================
// Gate Controller Class
// =============================================================================

export class GateController {
  private config: GateControllerConfig;
  private statusHooks: GateStatusHook[] = [];

  constructor(config: Partial<GateControllerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // Blocker Evaluation
  // ===========================================================================

  /**
   * Evaluate gate status based on risks and validations
   */
  evaluate(
    risks: IdentifiedRisk[],
    validations: ValidationItem[],
    existingApproval?: GateApproval
  ): ImplementationGate {
    const blockers: GateBlocker[] = [];
    const warnings: GateWarning[] = [];

    // Evaluate risks
    this.evaluateRisks(risks, blockers, warnings);

    // Evaluate validations
    this.evaluateValidations(validations, blockers, warnings);

    // Check if any blockers are approved
    const unresolvedBlockers = this.filterApprovedBlockers(
      blockers,
      existingApproval
    );

    // Determine status
    const status = this.determineStatus(unresolvedBlockers, warnings);

    return {
      status,
      blockers: unresolvedBlockers,
      warnings,
      approval: existingApproval,
      evaluatedAt: Date.now(),
    };
  }

  /**
   * Evaluate risks and add blockers/warnings
   */
  private evaluateRisks(
    risks: IdentifiedRisk[],
    blockers: GateBlocker[],
    warnings: GateWarning[]
  ): void {
    for (const risk of risks) {
      // Skip mitigated risks
      if (risk.mitigationApplied) {
        continue;
      }

      // Check if this severity blocks
      const isBlocking = this.config.blockingSeverities.includes(risk.severity);

      if (isBlocking && risk.isBlocking) {
        blockers.push({
          type: 'risk',
          itemId: risk.id,
          description: `${risk.severity.toUpperCase()}: ${risk.name} - ${risk.description}`,
          resolution: risk.mitigation,
        });
      } else {
        warnings.push({
          type: 'risk',
          itemId: risk.id,
          description: `${risk.severity.toUpperCase()}: ${risk.name}`,
        });
      }
    }
  }

  /**
   * Evaluate validations and add blockers/warnings
   */
  private evaluateValidations(
    validations: ValidationItem[],
    blockers: GateBlocker[],
    warnings: GateWarning[]
  ): void {
    let passedCount = 0;

    for (const validation of validations) {
      if (validation.status === 'passed') {
        passedCount++;
        continue;
      }

      if (validation.status === 'failed') {
        if (this.config.blockOnFailedValidation && validation.isBlocking) {
          blockers.push({
            type: 'validation',
            itemId: validation.id,
            description: `FAILED: ${validation.title}`,
            resolution: validation.description,
          });
        } else {
          warnings.push({
            type: 'validation',
            itemId: validation.id,
            description: `FAILED: ${validation.title}`,
          });
        }
      } else if (validation.status === 'pending') {
        if (this.config.blockOnPendingBlockingValidation && validation.isBlocking) {
          blockers.push({
            type: 'validation',
            itemId: validation.id,
            description: `PENDING: ${validation.title}`,
            resolution: validation.autoVerifiable
              ? `Run: ${validation.verifyCommand}`
              : validation.description,
          });
        } else {
          warnings.push({
            type: 'validation',
            itemId: validation.id,
            description: `PENDING: ${validation.title}`,
          });
        }
      } else if (validation.status === 'skipped') {
        if (validation.isBlocking) {
          warnings.push({
            type: 'validation',
            itemId: validation.id,
            description: `SKIPPED: ${validation.title}`,
          });
        }
      }
    }

    // Check minimum passed validations
    if (this.config.minPassedValidations > 0 && passedCount < this.config.minPassedValidations) {
      blockers.push({
        type: 'validation',
        itemId: 'min-validations',
        description: `Only ${passedCount}/${this.config.minPassedValidations} required validations passed`,
        resolution: 'Complete more validations before proceeding',
      });
    }
  }

  /**
   * Filter out blockers that have been approved
   */
  private filterApprovedBlockers(
    blockers: GateBlocker[],
    approval?: GateApproval
  ): GateBlocker[] {
    if (!approval || approval.approvedBlockers.length === 0) {
      return blockers;
    }

    return blockers.filter(
      blocker => !approval.approvedBlockers.includes(blocker.itemId)
    );
  }

  /**
   * Determine gate status based on blockers and warnings
   */
  private determineStatus(
    blockers: GateBlocker[],
    warnings: GateWarning[]
  ): GateStatus {
    if (blockers.length > 0) {
      return 'blocked';
    }
    if (warnings.length > 0) {
      return 'warning';
    }
    return 'clear';
  }

  // ===========================================================================
  // Approval Workflow
  // ===========================================================================

  /**
   * Approve specific blockers to allow implementation to proceed
   */
  approve(
    request: ApproveGateRequest,
    currentGate: ImplementationGate
  ): {
    gate: ImplementationGate;
    approval: GateApproval;
  } {
    // Validate that requested blockers exist
    const existingBlockerIds = currentGate.blockers.map(b => b.itemId);
    const invalidBlockers = request.blockerIds.filter(
      id => !existingBlockerIds.includes(id)
    );

    if (invalidBlockers.length > 0) {
      throw new Error(
        `Invalid blocker IDs: ${invalidBlockers.join(', ')}`
      );
    }

    // Create approval
    const approval: GateApproval = {
      approver: request.approver,
      approvedAt: Date.now(),
      reason: request.reason,
      approvedBlockers: request.blockerIds,
    };

    // Re-evaluate with approval
    const unresolvedBlockers = currentGate.blockers.filter(
      b => !request.blockerIds.includes(b.itemId)
    );

    const newStatus = this.determineStatus(
      unresolvedBlockers,
      currentGate.warnings
    );

    const newGate: ImplementationGate = {
      status: newStatus,
      blockers: unresolvedBlockers,
      warnings: currentGate.warnings,
      approval,
      evaluatedAt: Date.now(),
    };

    return { gate: newGate, approval };
  }

  /**
   * Revoke an existing approval
   */
  revokeApproval(
    risks: IdentifiedRisk[],
    validations: ValidationItem[]
  ): ImplementationGate {
    // Re-evaluate without approval
    return this.evaluate(risks, validations, undefined);
  }

  // ===========================================================================
  // Override Mechanism
  // ===========================================================================

  /**
   * Force override the gate (with audit logging)
   * Use with caution - bypasses all blockers
   */
  forceOverride(
    request: ApproveGateRequest,
    currentGate: ImplementationGate
  ): {
    gate: ImplementationGate;
    approval: GateApproval;
    auditLog: GateAuditLog;
  } {
    // Create approval for ALL blockers
    const allBlockerIds = currentGate.blockers.map(b => b.itemId);

    const approval: GateApproval = {
      approver: request.approver,
      approvedAt: Date.now(),
      reason: `FORCE OVERRIDE: ${request.reason}`,
      approvedBlockers: allBlockerIds,
    };

    // Create audit log
    const auditLog: GateAuditLog = {
      timestamp: Date.now(),
      action: 'force_override',
      approver: request.approver,
      reason: request.reason,
      blockersBypassed: currentGate.blockers.map(b => ({
        id: b.itemId,
        type: b.type,
        description: b.description,
      })),
      previousStatus: currentGate.status,
      newStatus: 'clear',
    };

    const newGate: ImplementationGate = {
      status: 'clear',
      blockers: [],
      warnings: [
        ...currentGate.warnings,
        // Add bypassed blockers as warnings for visibility
        ...currentGate.blockers.map(b => ({
          type: b.type,
          itemId: b.itemId,
          description: `BYPASSED: ${b.description}`,
        })),
      ],
      approval,
      evaluatedAt: Date.now(),
    };

    return { gate: newGate, approval, auditLog };
  }

  // ===========================================================================
  // Status Update Hooks
  // ===========================================================================

  /**
   * Register a hook to be called when gate status changes
   */
  onStatusChange(hook: GateStatusHook): void {
    this.statusHooks.push(hook);
  }

  /**
   * Remove a registered hook
   */
  removeHook(hook: GateStatusHook): void {
    const index = this.statusHooks.indexOf(hook);
    if (index > -1) {
      this.statusHooks.splice(index, 1);
    }
  }

  /**
   * Notify all hooks of a status change
   */
  async notifyStatusChange(
    analysisId: string,
    previousStatus: GateStatus,
    newStatus: GateStatus,
    gate: ImplementationGate
  ): Promise<void> {
    if (previousStatus === newStatus) {
      return; // No change
    }

    for (const hook of this.statusHooks) {
      try {
        await hook(analysisId, previousStatus, newStatus, gate);
      } catch (error) {
        console.error('Gate status hook error:', error);
      }
    }
  }

  // ===========================================================================
  // Re-evaluation
  // ===========================================================================

  /**
   * Re-evaluate gate after validation status changes
   */
  reEvaluateAfterValidation(
    analysis: ImpactAnalysis,
    updatedValidation: ValidationItem
  ): ImplementationGate {
    // Update validations array
    const validations = analysis.validations.map(v =>
      v.id === updatedValidation.id ? updatedValidation : v
    );

    // Re-evaluate with existing approval
    return this.evaluate(analysis.risks, validations, analysis.gate.approval);
  }

  /**
   * Re-evaluate gate after risk mitigation
   */
  reEvaluateAfterRiskMitigation(
    analysis: ImpactAnalysis,
    mitigatedRiskId: string,
    _mitigationNotes: string
  ): ImplementationGate {
    // Update risks array
    const risks = analysis.risks.map(r =>
      r.id === mitigatedRiskId
        ? { ...r, mitigationApplied: true }
        : r
    );

    // Re-evaluate with existing approval
    return this.evaluate(risks, analysis.validations, analysis.gate.approval);
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Check if gate allows implementation to proceed
   */
  canProceed(gate: ImplementationGate): boolean {
    return gate.status !== 'blocked';
  }

  /**
   * Get summary of gate status
   */
  getSummary(gate: ImplementationGate): GateSummary {
    return {
      status: gate.status,
      blockerCount: gate.blockers.length,
      warningCount: gate.warnings.length,
      isApproved: !!gate.approval,
      approvedBlockerCount: gate.approval?.approvedBlockers.length ?? 0,
      canProceed: this.canProceed(gate),
      evaluatedAt: new Date(gate.evaluatedAt).toISOString(),
    };
  }

  /**
   * Get blockers grouped by type
   */
  getBlockersByType(gate: ImplementationGate): {
    risks: GateBlocker[];
    validations: GateBlocker[];
  } {
    return {
      risks: gate.blockers.filter(b => b.type === 'risk'),
      validations: gate.blockers.filter(b => b.type === 'validation'),
    };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<GateControllerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// =============================================================================
// Additional Types
// =============================================================================

/**
 * Audit log for gate overrides
 */
export interface GateAuditLog {
  timestamp: number;
  action: 'approve' | 'force_override' | 'revoke';
  approver: string;
  reason: string;
  blockersBypassed: Array<{
    id: string;
    type: 'risk' | 'validation';
    description: string;
  }>;
  previousStatus: GateStatus;
  newStatus: GateStatus;
}

/**
 * Summary of gate status
 */
export interface GateSummary {
  status: GateStatus;
  blockerCount: number;
  warningCount: number;
  isApproved: boolean;
  approvedBlockerCount: number;
  canProceed: boolean;
  evaluatedAt: string;
}

// =============================================================================
// Export singleton instance
// =============================================================================

export const gateController = new GateController();
