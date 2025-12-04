/**
 * Lifecycle Hooks Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LifecycleHooks,
  lifecycleHooks,
  type AnalysisProvider,
  type TaskImpactMetadata,
  type SpecImpactMetadata,
} from './lifecycle-hooks';
import type { ImpactAnalysis, ChangeType } from './types';

describe('LifecycleHooks', () => {
  let hooks: LifecycleHooks;

  // Mock analysis provider
  const createMockAnalysisProvider = (): AnalysisProvider => ({
    getAnalysisByTask: vi.fn().mockResolvedValue(null),
    getAnalysisBySpec: vi.fn().mockResolvedValue(null),
    getAnalysis: vi.fn().mockResolvedValue(null),
  });

  // Mock impact analysis
  const createMockAnalysis = (overrides: Partial<ImpactAnalysis> = {}): ImpactAnalysis => ({
    id: 'analysis-123',
    projectId: 'project-1',
    input: { description: 'test' },
    status: 'completed',
    parsed: { entities: [], operations: [], keywords: [], changeType: 'feature', confidence: 0.8 },
    scope: { primaryModules: [], primaryFiles: [], dependentModules: [], affectedFiles: [], affectedEntities: [], expansionDepth: 1 },
    dataFlows: [],
    risks: [],
    validations: [],
    gate: {
      status: 'clear',
      blockers: [],
      warnings: [],
      evaluatedAt: Date.now(),
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    hooks = new LifecycleHooks();
  });

  describe('evaluateTaskForAnalysis', () => {
    it('should trigger analysis for tasks with trigger keywords', () => {
      const task = {
        id: 'task-1',
        title: 'Refactor database connection',
        description: 'Update the connection pooling',
      };

      const result = hooks.evaluateTaskForAnalysis(task);

      expect(result.shouldAnalyze).toBe(true);
      expect(result.reason).toContain('refactor');
      expect(result.priority).toBe('medium');
    });

    it('should trigger high priority for security keywords', () => {
      const task = {
        id: 'task-1',
        title: 'Fix security vulnerability',
        description: 'Patch authentication bypass',
      };

      const result = hooks.evaluateTaskForAnalysis(task);

      expect(result.shouldAnalyze).toBe(true);
      expect(result.priority).toBe('high');
    });

    it('should trigger high priority for migration keywords', () => {
      const task = {
        id: 'task-1',
        title: 'Database migration',
        description: 'Migrate user data',
      };

      const result = hooks.evaluateTaskForAnalysis(task);

      expect(result.shouldAnalyze).toBe(true);
      expect(result.priority).toBe('high');
    });

    it('should trigger analysis for sensitive file patterns', () => {
      const task = {
        id: 'task-1',
        title: 'Update config',
        targetFiles: ['src/config.ts'],
      };

      const result = hooks.evaluateTaskForAnalysis(task);

      expect(result.shouldAnalyze).toBe(true);
      expect(result.priority).toBe('high');
      expect(result.reason).toContain('sensitive file');
    });

    it('should trigger analysis for database files', () => {
      const task = {
        id: 'task-1',
        title: 'Update schema',
        targetFiles: ['src/database.ts'],
      };

      const result = hooks.evaluateTaskForAnalysis(task);

      expect(result.shouldAnalyze).toBe(true);
      expect(result.priority).toBe('high');
    });

    it('should trigger analysis for sensitive modules', () => {
      const task = {
        id: 'task-1',
        title: 'Update module',
        targetModules: ['auth'],
      };

      const result = hooks.evaluateTaskForAnalysis(task);

      expect(result.shouldAnalyze).toBe(true);
      expect(result.priority).toBe('high');
      expect(result.reason).toContain('sensitive module');
    });

    it('should trigger analysis for detailed descriptions', () => {
      const task = {
        id: 'task-1',
        title: 'Simple update',
        description: 'This is a very detailed description that explains the changes being made to the system. It includes multiple sentences and covers various aspects of the implementation.',
      };

      const result = hooks.evaluateTaskForAnalysis(task);

      expect(result.shouldAnalyze).toBe(true);
      expect(result.reason).toContain('detailed description');
    });

    it('should not trigger analysis for trivial tasks', () => {
      const task = {
        id: 'task-1',
        title: 'Fix typo',
        description: 'Fix typo in readme',
      };

      const result = hooks.evaluateTaskForAnalysis(task);

      expect(result.shouldAnalyze).toBe(false);
      expect(result.reason).toContain('trivial');
    });

    it('should provide suggested input when analysis is needed', () => {
      const task = {
        id: 'task-1',
        title: 'Refactor authentication',
        description: 'Update auth flow',
        targetFiles: ['src/auth.ts'],
        targetModules: ['auth'],
      };

      const result = hooks.evaluateTaskForAnalysis(task);

      expect(result.suggestedInput).toBeDefined();
      expect(result.suggestedInput?.taskId).toBe('task-1');
      expect(result.suggestedInput?.targetFiles).toContain('src/auth.ts');
      expect(result.suggestedInput?.targetModules).toContain('auth');
    });
  });

  describe('createTaskMetadata', () => {
    it('should create metadata with analysis required', () => {
      const trigger = {
        shouldAnalyze: true,
        reason: 'Contains keyword',
        priority: 'high' as const,
      };

      const metadata = hooks.createTaskMetadata(trigger, 'analysis-123');

      expect(metadata.analysisId).toBe('analysis-123');
      expect(metadata.analysisRequired).toBe(true);
      expect(metadata.skipReason).toBeUndefined();
      expect(metadata.checkedAt).toBeDefined();
    });

    it('should create metadata with skip reason', () => {
      const trigger = {
        shouldAnalyze: false,
        reason: 'Task appears trivial',
        priority: 'low' as const,
      };

      const metadata = hooks.createTaskMetadata(trigger);

      expect(metadata.analysisId).toBeUndefined();
      expect(metadata.analysisRequired).toBe(false);
      expect(metadata.skipReason).toBe('Task appears trivial');
    });
  });

  describe('evaluateSpecForAnalysis', () => {
    it('should always analyze migration change types', () => {
      const spec = {
        id: 'spec-1',
        title: 'Data Update',
        content: 'Simple update',
        changeType: 'migration' as ChangeType,
      };

      const result = hooks.evaluateSpecForAnalysis(spec);

      expect(result.shouldAnalyze).toBe(true);
      expect(result.priority).toBe('high');
      expect(result.reason).toContain('migration');
    });

    it('should always analyze refactor change types', () => {
      const spec = {
        id: 'spec-1',
        title: 'Code cleanup',
        content: 'Refactoring',
        changeType: 'refactor' as ChangeType,
      };

      const result = hooks.evaluateSpecForAnalysis(spec);

      expect(result.shouldAnalyze).toBe(true);
      expect(result.priority).toBe('high');
    });

    it('should always analyze deletion change types', () => {
      const spec = {
        id: 'spec-1',
        title: 'Remove feature',
        content: 'Removing old feature',
        changeType: 'deletion' as ChangeType,
      };

      const result = hooks.evaluateSpecForAnalysis(spec);

      expect(result.shouldAnalyze).toBe(true);
      expect(result.priority).toBe('high');
    });

    it('should trigger analysis for security keywords in content', () => {
      const spec = {
        id: 'spec-1',
        title: 'Update feature',
        content: 'This spec describes authentication changes and security updates',
      };

      const result = hooks.evaluateSpecForAnalysis(spec);

      expect(result.shouldAnalyze).toBe(true);
      expect(result.priority).toBe('high');
    });

    it('should trigger analysis for sensitive modules', () => {
      const spec = {
        id: 'spec-1',
        title: 'Update database',
        content: 'Update database queries',
        moduleId: 'database',
      };

      const result = hooks.evaluateSpecForAnalysis(spec);

      expect(result.shouldAnalyze).toBe(true);
      expect(result.priority).toBe('high');
      expect(result.reason).toContain('sensitive module');
    });

    it('should analyze specs with substantial content', () => {
      const spec = {
        id: 'spec-1',
        title: 'Feature spec',
        content: 'A'.repeat(250), // More than 200 chars
      };

      const result = hooks.evaluateSpecForAnalysis(spec);

      expect(result.shouldAnalyze).toBe(true);
      expect(result.reason).toContain('substantial content');
    });

    it('should not analyze low-impact specs', () => {
      const spec = {
        id: 'spec-1',
        title: 'Simple update',
        content: 'Minor change',
      };

      const result = hooks.evaluateSpecForAnalysis(spec);

      expect(result.shouldAnalyze).toBe(false);
      expect(result.reason).toContain('low-impact');
    });

    it('should provide suggested input when analysis is needed', () => {
      const spec = {
        id: 'spec-1',
        title: 'Authentication spec',
        content: 'Update authentication flow',
        moduleId: 'auth',
        changeType: 'feature' as ChangeType,
      };

      const result = hooks.evaluateSpecForAnalysis(spec);

      expect(result.suggestedInput).toBeDefined();
      expect(result.suggestedInput?.specId).toBe('spec-1');
      expect(result.suggestedInput?.targetModules).toContain('auth');
      expect(result.suggestedInput?.changeType).toBe('feature');
    });
  });

  describe('createSpecMetadata', () => {
    it('should create metadata with analysis ID', () => {
      const metadata = hooks.createSpecMetadata('analysis-123');

      expect(metadata.analysisId).toBe('analysis-123');
      expect(metadata.analyzedAt).toBeDefined();
    });

    it('should create metadata without analysis ID', () => {
      const metadata = hooks.createSpecMetadata();

      expect(metadata.analysisId).toBeUndefined();
      expect(metadata.analyzedAt).toBeUndefined();
    });
  });

  describe('checkPreImplementation', () => {
    it('should allow when no provider configured', async () => {
      const result = await hooks.checkPreImplementation('task-1');

      expect(result.allowed).toBe(true);
      expect(result.gateStatus).toBe('clear');
      expect(result.message).toContain('No analysis provider');
    });

    it('should allow when no analysis found', async () => {
      const provider = createMockAnalysisProvider();
      hooks.setAnalysisProvider(provider);

      const result = await hooks.checkPreImplementation('task-1');

      expect(result.allowed).toBe(true);
      expect(result.gateStatus).toBe('clear');
      expect(result.message).toContain('No impact analysis found');
    });

    it('should block when gate is blocked', async () => {
      const provider = createMockAnalysisProvider();
      (provider.getAnalysisByTask as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockAnalysis({
          gate: {
            status: 'blocked',
            blockers: [
              { type: 'risk', itemId: 'r1', description: 'Critical risk', resolution: 'Fix it' },
            ],
            warnings: [],
            evaluatedAt: Date.now(),
          },
        })
      );
      hooks.setAnalysisProvider(provider);

      const result = await hooks.checkPreImplementation('task-1');

      expect(result.allowed).toBe(false);
      expect(result.gateStatus).toBe('blocked');
      expect(result.blockerCount).toBe(1);
      expect(result.message).toContain('BLOCKED');
      expect(result.blockerSummary).toContain('Critical risk');
    });

    it('should allow with warning when gate has warnings', async () => {
      const provider = createMockAnalysisProvider();
      (provider.getAnalysisByTask as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockAnalysis({
          gate: {
            status: 'warning',
            blockers: [],
            warnings: [
              { type: 'risk', itemId: 'r1', description: 'Medium risk' },
            ],
            evaluatedAt: Date.now(),
          },
        })
      );
      hooks.setAnalysisProvider(provider);

      const result = await hooks.checkPreImplementation('task-1');

      expect(result.allowed).toBe(true);
      expect(result.gateStatus).toBe('warning');
      expect(result.warningCount).toBe(1);
      expect(result.message).toContain('warning');
    });

    it('should allow when gate is clear', async () => {
      const provider = createMockAnalysisProvider();
      (provider.getAnalysisByTask as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockAnalysis()
      );
      hooks.setAnalysisProvider(provider);

      const result = await hooks.checkPreImplementation('task-1');

      expect(result.allowed).toBe(true);
      expect(result.gateStatus).toBe('clear');
      expect(result.message).toContain('Safe to proceed');
    });

    it('should check by spec if task analysis not found', async () => {
      const provider = createMockAnalysisProvider();
      (provider.getAnalysisByTask as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (provider.getAnalysisBySpec as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockAnalysis()
      );
      hooks.setAnalysisProvider(provider);

      const result = await hooks.checkPreImplementation('task-1', 'spec-1');

      expect(result.allowed).toBe(true);
      expect(provider.getAnalysisBySpec).toHaveBeenCalledWith('spec-1');
    });
  });

  describe('syncTaskGateStatus', () => {
    it('should update task metadata with analysis gate status', () => {
      const currentMetadata: TaskImpactMetadata = {
        analysisRequired: true,
        checkedAt: Date.now() - 1000,
      };
      const analysis = createMockAnalysis({
        gate: { status: 'warning', blockers: [], warnings: [], evaluatedAt: Date.now() },
      });

      const updated = hooks.syncTaskGateStatus(currentMetadata, analysis);

      expect(updated.analysisId).toBe('analysis-123');
      expect(updated.gateStatus).toBe('warning');
      expect(updated.checkedAt).toBeGreaterThan(currentMetadata.checkedAt);
    });
  });

  describe('syncSpecGateStatus', () => {
    it('should update spec metadata with analysis gate status', () => {
      const currentMetadata: SpecImpactMetadata = {
        analyzedAt: Date.now() - 1000,
      };
      const analysis = createMockAnalysis({
        gate: { status: 'blocked', blockers: [], warnings: [], evaluatedAt: Date.now() },
      });

      const updated = hooks.syncSpecGateStatus(currentMetadata, analysis);

      expect(updated.analysisId).toBe('analysis-123');
      expect(updated.gateStatus).toBe('blocked');
    });
  });

  describe('configuration', () => {
    it('should allow setting custom criteria', () => {
      hooks.setCriteria({
        triggerKeywords: ['custom', 'keyword'],
        minDescriptionLength: 100,
      });

      const task = {
        id: 'task-1',
        title: 'Custom task',
        description: 'Contains custom keyword',
      };

      const result = hooks.evaluateTaskForAnalysis(task);

      expect(result.shouldAnalyze).toBe(true);
      expect(result.reason).toContain('custom');
    });

    it('should allow adding sensitive modules', () => {
      hooks.addSensitiveModule('payments');

      const task = {
        id: 'task-1',
        title: 'Update payments',
        targetModules: ['payments'],
      };

      const result = hooks.evaluateTaskForAnalysis(task);

      expect(result.shouldAnalyze).toBe(true);
      expect(result.priority).toBe('high');
    });

    it('should allow adding trigger keywords', () => {
      hooks.addTriggerKeyword('customtrigger');

      const task = {
        id: 'task-1',
        title: 'Task with customtrigger',
      };

      const result = hooks.evaluateTaskForAnalysis(task);

      expect(result.shouldAnalyze).toBe(true);
    });

    it('should not add duplicate sensitive modules', () => {
      hooks.addSensitiveModule('auth');
      hooks.addSensitiveModule('auth');

      // Just verifying no error is thrown
      const task = {
        id: 'task-1',
        title: 'Update auth',
        targetModules: ['auth'],
      };

      const result = hooks.evaluateTaskForAnalysis(task);
      expect(result.shouldAnalyze).toBe(true);
    });

    it('should not add duplicate trigger keywords', () => {
      hooks.addTriggerKeyword('refactor');
      hooks.addTriggerKeyword('refactor');

      // Just verifying no error is thrown
      const task = {
        id: 'task-1',
        title: 'Refactor code',
      };

      const result = hooks.evaluateTaskForAnalysis(task);
      expect(result.shouldAnalyze).toBe(true);
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton hooks instance', () => {
      expect(lifecycleHooks).toBeInstanceOf(LifecycleHooks);
    });
  });
});
