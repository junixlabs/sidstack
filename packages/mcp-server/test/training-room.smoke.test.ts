/**
 * Smoke Tests - Training Room Handlers
 *
 * Validates training room handler functions (incidents, lessons, skills, rules)
 * via API client calls.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mockApiClient, resetMockApiClient } from './setup';
import {
  handleTrainingSessionGet,
  handleTrainingSessionList,
  handleIncidentCreate,
  handleIncidentList,
  handleLessonCreate,
  handleLessonList,
  handleSkillCreate,
  handleSkillList,
  handleRuleCreate,
  handleRuleList,
  handleRuleCheck,
  handleTrainingContextGet,
} from '../src/tools/handlers/training-room';

describe('Training Room Handlers (Smoke)', () => {
  beforeEach(() => {
    resetMockApiClient();
  });

  describe('handleTrainingSessionGet', () => {
    it('gets or creates a training session', async () => {
      const result = await handleTrainingSessionGet({
        projectPath: '/tmp/test',
        moduleId: 'test-module',
      });
      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(mockApiClient.training.createSession).toHaveBeenCalledWith(
        'test-module',
        expect.objectContaining({ projectPath: '/tmp/test' }),
      );
    });
  });

  describe('handleTrainingSessionList', () => {
    it('lists training sessions', async () => {
      const result = await handleTrainingSessionList({ projectPath: '/tmp/test' });
      expect(result.success).toBe(true);
      expect(result.sessions).toBeInstanceOf(Array);
      expect(mockApiClient.training.listSessions).toHaveBeenCalledOnce();
    });
  });

  describe('handleIncidentCreate', () => {
    it('creates an incident with required args', async () => {
      const result = await handleIncidentCreate({
        projectPath: '/tmp/test',
        moduleId: 'test-module',
        title: 'Test Incident',
        type: 'mistake',
        severity: 'medium',
        description: 'Something happened',
      });
      expect(result.success).toBe(true);
      expect(result.incident).toBeDefined();
      expect(mockApiClient.training.createSession).toHaveBeenCalledOnce();
      expect(mockApiClient.training.createIncident).toHaveBeenCalledOnce();
    });
  });

  describe('handleIncidentList', () => {
    it('lists incidents', async () => {
      const result = await handleIncidentList({ projectPath: '/tmp/test' });
      expect(result.success).toBe(true);
      expect(result.incidents).toBeInstanceOf(Array);
      expect(mockApiClient.training.listIncidents).toHaveBeenCalledOnce();
    });
  });

  describe('handleLessonCreate', () => {
    it('creates a lesson', async () => {
      const result = await handleLessonCreate({
        projectPath: '/tmp/test',
        moduleId: 'test-module',
        title: 'Test Lesson',
        problem: 'We had a problem',
        rootCause: 'Bad config',
        solution: 'Fix the config',
      });
      expect(result.success).toBe(true);
      expect(result.lesson).toBeDefined();
      expect(mockApiClient.training.createSession).toHaveBeenCalledOnce();
      expect(mockApiClient.training.createLesson).toHaveBeenCalledOnce();
    });
  });

  describe('handleLessonList', () => {
    it('lists lessons', async () => {
      const result = await handleLessonList({ projectPath: '/tmp/test' });
      expect(result.success).toBe(true);
      expect(result.lessons).toBeInstanceOf(Array);
      expect(mockApiClient.training.listLessons).toHaveBeenCalledOnce();
    });
  });

  describe('handleSkillCreate', () => {
    it('creates a skill', async () => {
      const result = await handleSkillCreate({
        projectPath: '/tmp/test',
        name: 'test-skill',
        type: 'checklist',
        content: 'Step 1: Do this\nStep 2: Do that',
      });
      expect(result.success).toBe(true);
      expect(result.skill).toBeDefined();
      expect(mockApiClient.training.createSkill).toHaveBeenCalledOnce();
    });
  });

  describe('handleSkillList', () => {
    it('lists skills', async () => {
      const result = await handleSkillList({ projectPath: '/tmp/test' });
      expect(result.success).toBe(true);
      expect(result.skills).toBeInstanceOf(Array);
      expect(mockApiClient.training.listSkills).toHaveBeenCalledOnce();
    });
  });

  describe('handleRuleCreate', () => {
    it('creates a rule', async () => {
      const result = await handleRuleCreate({
        projectPath: '/tmp/test',
        name: 'test-rule',
        level: 'should',
        enforcement: 'manual',
        content: 'Always do this',
      });
      expect(result.success).toBe(true);
      expect(result.rule).toBeDefined();
      expect(mockApiClient.training.createRule).toHaveBeenCalledOnce();
    });
  });

  describe('handleRuleList', () => {
    it('lists rules', async () => {
      const result = await handleRuleList({ projectPath: '/tmp/test' });
      expect(result.success).toBe(true);
      expect(result.rules).toBeInstanceOf(Array);
      expect(mockApiClient.training.listRules).toHaveBeenCalledOnce();
    });
  });

  describe('handleRuleCheck', () => {
    it('checks rules for a module', async () => {
      const result = await handleRuleCheck({
        projectPath: '/tmp/test',
        moduleId: 'test-module',
        role: 'worker',
        taskType: 'feature',
      });
      expect(result.success).toBe(true);
      expect(result.rules).toBeDefined();
      expect(mockApiClient.training.checkRules).toHaveBeenCalledOnce();
    });
  });

  describe('handleTrainingContextGet', () => {
    it('builds training context', async () => {
      const result = await handleTrainingContextGet({
        projectPath: '/tmp/test',
        moduleId: 'test-module',
        role: 'worker',
        taskType: 'feature',
      });
      expect(result.success).toBe(true);
      expect(result.context).toBeDefined();
      expect(mockApiClient.training.getContext).toHaveBeenCalledWith(
        'test-module',
        expect.objectContaining({
          projectPath: '/tmp/test',
          role: 'worker',
          taskType: 'feature',
        }),
      );
    });
  });
});
