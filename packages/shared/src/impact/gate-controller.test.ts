/**
 * Gate Controller Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GateController,
  gateController,
  type GateStatusHook,
  type GateControllerConfig,
} from './gate-controller';
import type {
  IdentifiedRisk,
  ValidationItem,
  ImplementationGate,
  GateApproval,
} from './types';

describe('GateController', () => {
  let controller: GateController;

  // Helper to create mock risks
  const createMockRisk = (overrides: Partial<IdentifiedRisk> = {}): IdentifiedRisk => ({
    id: `risk-${Date.now()}`,
    ruleId: 'R001',
    name: 'Test Risk',
    category: 'data-corruption',
    severity: 'critical',
    description: 'Test description',
    affectedAreas: [],
    mitigation: 'Test mitigation',
    isBlocking: true,
    mitigationApplied: false,
    ...overrides,
  });

  // Helper to create mock validations
  const createMockValidation = (overrides: Partial<ValidationItem> = {}): ValidationItem => ({
    id: `val-${Date.now()}`,
    title: 'Test Validation',
    description: 'Test description',
    category: 'test',
    status: 'pending',
    isBlocking: false,
    autoVerifiable: false,
    ...overrides,
  });

  beforeEach(() => {
    controller = new GateController();
  });

  describe('evaluate', () => {
    it('should return clear status when no risks or validations', () => {
      const gate = controller.evaluate([], []);

      expect(gate.status).toBe('clear');
      expect(gate.blockers).toHaveLength(0);
      expect(gate.warnings).toHaveLength(0);
    });

    it('should block on critical risk with isBlocking=true', () => {
      const risks = [createMockRisk({ severity: 'critical', isBlocking: true })];
      const gate = controller.evaluate(risks, []);

      expect(gate.status).toBe('blocked');
      expect(gate.blockers).toHaveLength(1);
      expect(gate.blockers[0].type).toBe('risk');
    });

    it('should block on high risk with isBlocking=true', () => {
      const risks = [createMockRisk({ severity: 'high', isBlocking: true })];
      const gate = controller.evaluate(risks, []);

      expect(gate.status).toBe('blocked');
    });

    it('should warn on medium risk', () => {
      const risks = [createMockRisk({ severity: 'medium', isBlocking: false })];
      const gate = controller.evaluate(risks, []);

      expect(gate.status).toBe('warning');
      expect(gate.warnings).toHaveLength(1);
      expect(gate.blockers).toHaveLength(0);
    });

    it('should not block on mitigated risk', () => {
      const risks = [createMockRisk({ severity: 'critical', isBlocking: true, mitigationApplied: true })];
      const gate = controller.evaluate(risks, []);

      expect(gate.status).toBe('clear');
    });

    it('should block on failed blocking validation', () => {
      const validations = [createMockValidation({ status: 'failed', isBlocking: true })];
      const gate = controller.evaluate([], validations);

      expect(gate.status).toBe('blocked');
      expect(gate.blockers[0].type).toBe('validation');
    });

    it('should warn on failed non-blocking validation', () => {
      const validations = [createMockValidation({ status: 'failed', isBlocking: false })];
      const gate = controller.evaluate([], validations);

      expect(gate.status).toBe('warning');
    });

    it('should block on pending blocking validation', () => {
      const validations = [createMockValidation({ status: 'pending', isBlocking: true })];
      const gate = controller.evaluate([], validations);

      expect(gate.status).toBe('blocked');
    });

    it('should warn on pending non-blocking validation', () => {
      const validations = [createMockValidation({ status: 'pending', isBlocking: false })];
      const gate = controller.evaluate([], validations);

      expect(gate.status).toBe('warning');
    });

    it('should clear when all validations pass', () => {
      const validations = [
        createMockValidation({ status: 'passed', isBlocking: true }),
        createMockValidation({ status: 'passed', isBlocking: false }),
      ];
      const gate = controller.evaluate([], validations);

      expect(gate.status).toBe('clear');
    });

    it('should respect existing approval for blockers', () => {
      const risks = [createMockRisk({ id: 'risk-1', severity: 'critical', isBlocking: true })];
      const approval: GateApproval = {
        approver: 'test-user',
        approvedAt: Date.now(),
        reason: 'Testing',
        approvedBlockers: ['risk-1'],
      };

      const gate = controller.evaluate(risks, [], approval);

      expect(gate.status).toBe('clear');
      expect(gate.blockers).toHaveLength(0);
      expect(gate.approval).toBeDefined();
    });
  });

  describe('approve', () => {
    it('should approve specific blockers', () => {
      const risks = [createMockRisk({ id: 'risk-1', severity: 'critical', isBlocking: true })];
      const currentGate = controller.evaluate(risks, []);

      const { gate, approval } = controller.approve(
        {
          approver: 'test-user',
          reason: 'Reviewed and safe',
          blockerIds: ['risk-1'],
        },
        currentGate
      );

      expect(gate.status).toBe('clear');
      expect(approval.approver).toBe('test-user');
      expect(approval.approvedBlockers).toContain('risk-1');
    });

    it('should throw on invalid blocker ID', () => {
      const currentGate = controller.evaluate([], []);

      expect(() => {
        controller.approve(
          {
            approver: 'test-user',
            reason: 'Test',
            blockerIds: ['non-existent'],
          },
          currentGate
        );
      }).toThrow('Invalid blocker IDs');
    });

    it('should only approve specified blockers', () => {
      const risks = [
        createMockRisk({ id: 'risk-1', severity: 'critical', isBlocking: true }),
        createMockRisk({ id: 'risk-2', severity: 'critical', isBlocking: true }),
      ];
      const currentGate = controller.evaluate(risks, []);

      const { gate } = controller.approve(
        {
          approver: 'test-user',
          reason: 'Partial approval',
          blockerIds: ['risk-1'],
        },
        currentGate
      );

      expect(gate.status).toBe('blocked');
      expect(gate.blockers).toHaveLength(1);
      expect(gate.blockers[0].itemId).toBe('risk-2');
    });
  });

  describe('revokeApproval', () => {
    it('should re-evaluate without approval', () => {
      const risks = [createMockRisk({ id: 'risk-1', severity: 'critical', isBlocking: true })];

      const gate = controller.revokeApproval(risks, []);

      expect(gate.status).toBe('blocked');
      expect(gate.approval).toBeUndefined();
    });
  });

  describe('forceOverride', () => {
    it('should clear all blockers with audit log', () => {
      const risks = [
        createMockRisk({ id: 'risk-1', severity: 'critical', isBlocking: true }),
        createMockRisk({ id: 'risk-2', severity: 'high', isBlocking: true }),
      ];
      const currentGate = controller.evaluate(risks, []);

      const { gate, auditLog } = controller.forceOverride(
        {
          approver: 'admin',
          reason: 'Emergency deployment',
          blockerIds: [],
        },
        currentGate
      );

      expect(gate.status).toBe('clear');
      expect(gate.blockers).toHaveLength(0);
      expect(auditLog.action).toBe('force_override');
      expect(auditLog.blockersBypassed).toHaveLength(2);
    });

    it('should add bypassed blockers as warnings', () => {
      const risks = [createMockRisk({ id: 'risk-1', severity: 'critical', isBlocking: true })];
      const currentGate = controller.evaluate(risks, []);

      const { gate } = controller.forceOverride(
        {
          approver: 'admin',
          reason: 'Test',
          blockerIds: [],
        },
        currentGate
      );

      expect(gate.warnings.some(w => w.description.includes('BYPASSED'))).toBe(true);
    });
  });

  describe('onStatusChange', () => {
    it('should register and call hooks on status change', async () => {
      const hook = vi.fn();
      controller.onStatusChange(hook);

      await controller.notifyStatusChange('analysis-1', 'blocked', 'clear', {
        status: 'clear',
        blockers: [],
        warnings: [],
        evaluatedAt: Date.now(),
      });

      expect(hook).toHaveBeenCalledTimes(1);
      expect(hook).toHaveBeenCalledWith(
        'analysis-1',
        'blocked',
        'clear',
        expect.any(Object)
      );
    });

    it('should not call hooks when status unchanged', async () => {
      const hook = vi.fn();
      controller.onStatusChange(hook);

      await controller.notifyStatusChange('analysis-1', 'clear', 'clear', {
        status: 'clear',
        blockers: [],
        warnings: [],
        evaluatedAt: Date.now(),
      });

      expect(hook).not.toHaveBeenCalled();
    });

    it('should handle hook errors gracefully', async () => {
      const errorHook: GateStatusHook = () => {
        throw new Error('Hook error');
      };
      const successHook = vi.fn();

      controller.onStatusChange(errorHook);
      controller.onStatusChange(successHook);

      // Should not throw
      await controller.notifyStatusChange('analysis-1', 'blocked', 'clear', {
        status: 'clear',
        blockers: [],
        warnings: [],
        evaluatedAt: Date.now(),
      });

      // Second hook should still be called
      expect(successHook).toHaveBeenCalled();
    });
  });

  describe('removeHook', () => {
    it('should remove registered hook', async () => {
      const hook = vi.fn();
      controller.onStatusChange(hook);
      controller.removeHook(hook);

      await controller.notifyStatusChange('analysis-1', 'blocked', 'clear', {
        status: 'clear',
        blockers: [],
        warnings: [],
        evaluatedAt: Date.now(),
      });

      expect(hook).not.toHaveBeenCalled();
    });
  });

  describe('reEvaluateAfterValidation', () => {
    it('should update gate after validation status change', () => {
      const validation = createMockValidation({ id: 'val-1', status: 'pending', isBlocking: true });
      const mockAnalysis = {
        id: 'analysis-1',
        projectId: 'project-1',
        input: { description: 'test' },
        status: 'completed' as const,
        parsed: { entities: [], operations: [], keywords: [], changeType: 'feature' as const, confidence: 0.8 },
        scope: { primaryModules: [], primaryFiles: [], dependentModules: [], affectedFiles: [], affectedEntities: [], expansionDepth: 1 },
        dataFlows: [],
        risks: [],
        validations: [validation],
        gate: controller.evaluate([], [validation]),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Initially blocked
      expect(mockAnalysis.gate.status).toBe('blocked');

      // Update validation to passed
      const updatedValidation = { ...validation, status: 'passed' as const };
      const newGate = controller.reEvaluateAfterValidation(mockAnalysis, updatedValidation);

      expect(newGate.status).toBe('clear');
    });
  });

  describe('reEvaluateAfterRiskMitigation', () => {
    it('should update gate after risk mitigation', () => {
      const risk = createMockRisk({ id: 'risk-1', severity: 'critical', isBlocking: true });
      const mockAnalysis = {
        id: 'analysis-1',
        projectId: 'project-1',
        input: { description: 'test' },
        status: 'completed' as const,
        parsed: { entities: [], operations: [], keywords: [], changeType: 'feature' as const, confidence: 0.8 },
        scope: { primaryModules: [], primaryFiles: [], dependentModules: [], affectedFiles: [], affectedEntities: [], expansionDepth: 1 },
        dataFlows: [],
        risks: [risk],
        validations: [],
        gate: controller.evaluate([risk], []),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Initially blocked
      expect(mockAnalysis.gate.status).toBe('blocked');

      const newGate = controller.reEvaluateAfterRiskMitigation(mockAnalysis, 'risk-1', 'Mitigation applied');

      expect(newGate.status).toBe('clear');
    });
  });

  describe('canProceed', () => {
    it('should return true for clear status', () => {
      const gate: ImplementationGate = {
        status: 'clear',
        blockers: [],
        warnings: [],
        evaluatedAt: Date.now(),
      };

      expect(controller.canProceed(gate)).toBe(true);
    });

    it('should return true for warning status', () => {
      const gate: ImplementationGate = {
        status: 'warning',
        blockers: [],
        warnings: [{ type: 'risk', itemId: 'r1', description: 'warning' }],
        evaluatedAt: Date.now(),
      };

      expect(controller.canProceed(gate)).toBe(true);
    });

    it('should return false for blocked status', () => {
      const gate: ImplementationGate = {
        status: 'blocked',
        blockers: [{ type: 'risk', itemId: 'r1', description: 'blocker', resolution: 'fix it' }],
        warnings: [],
        evaluatedAt: Date.now(),
      };

      expect(controller.canProceed(gate)).toBe(false);
    });
  });

  describe('getSummary', () => {
    it('should return gate summary', () => {
      const gate: ImplementationGate = {
        status: 'blocked',
        blockers: [
          { type: 'risk', itemId: 'r1', description: 'blocker', resolution: 'fix' },
        ],
        warnings: [
          { type: 'validation', itemId: 'v1', description: 'warning' },
          { type: 'validation', itemId: 'v2', description: 'warning' },
        ],
        approval: {
          approver: 'user',
          approvedAt: Date.now(),
          reason: 'test',
          approvedBlockers: ['r0'],
        },
        evaluatedAt: Date.now(),
      };

      const summary = controller.getSummary(gate);

      expect(summary.status).toBe('blocked');
      expect(summary.blockerCount).toBe(1);
      expect(summary.warningCount).toBe(2);
      expect(summary.isApproved).toBe(true);
      expect(summary.approvedBlockerCount).toBe(1);
      expect(summary.canProceed).toBe(false);
    });
  });

  describe('getBlockersByType', () => {
    it('should group blockers by type', () => {
      const gate: ImplementationGate = {
        status: 'blocked',
        blockers: [
          { type: 'risk', itemId: 'r1', description: 'risk', resolution: 'fix' },
          { type: 'validation', itemId: 'v1', description: 'validation', resolution: 'run' },
          { type: 'risk', itemId: 'r2', description: 'risk', resolution: 'fix' },
        ],
        warnings: [],
        evaluatedAt: Date.now(),
      };

      const grouped = controller.getBlockersByType(gate);

      expect(grouped.risks).toHaveLength(2);
      expect(grouped.validations).toHaveLength(1);
    });
  });

  describe('setConfig', () => {
    it('should update configuration', () => {
      const customConfig: Partial<GateControllerConfig> = {
        blockingSeverities: ['critical'],  // Only critical blocks, not high
      };

      controller.setConfig(customConfig);

      // Test that high severity no longer blocks
      const risks = [createMockRisk({ severity: 'high', isBlocking: true })];
      const gate = controller.evaluate(risks, []);

      expect(gate.status).toBe('warning'); // Not blocked because high is not in blockingSeverities
    });
  });

  describe('minPassedValidations config', () => {
    it('should block when not enough validations passed', () => {
      const customController = new GateController({ minPassedValidations: 2 });

      const validations = [
        createMockValidation({ status: 'passed', isBlocking: false }),
      ];
      const gate = customController.evaluate([], validations);

      expect(gate.status).toBe('blocked');
      expect(gate.blockers[0].itemId).toBe('min-validations');
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton controller', () => {
      expect(gateController).toBeInstanceOf(GateController);
    });
  });
});
