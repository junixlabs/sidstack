/**
 * Smoke Tests - Training Room Handlers
 *
 * Validates training room handler functions (incidents, lessons, skills, rules).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mockDB } from './setup';
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
    Object.values(mockDB).forEach((fn) => {
      if (typeof fn === 'function' && 'mockClear' in fn) fn.mockClear();
    });
  });

  describe('handleTrainingSessionGet', () => {
    it('gets or creates a training session', async () => {
      const result = await handleTrainingSessionGet({
        projectPath: '/tmp/test',
        moduleId: 'test-module',
      });
      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
    });
  });

  describe('handleTrainingSessionList', () => {
    it('lists training sessions', async () => {
      const result = await handleTrainingSessionList({ projectPath: '/tmp/test' });
      expect(result.success).toBe(true);
      expect(result.sessions).toBeInstanceOf(Array);
    });
  });

  describe('handleIncidentCreate', () => {
    it('creates an incident with required args', async () => {
      const result = await handleIncidentCreate({
        projectPath: '/tmp/test',
        moduleId: 'test-module',
        title: 'Test Incident',
        type: 'bug_fix',
        severity: 'medium',
        description: 'Something happened',
      });
      expect(result.success).toBe(true);
      expect(result.incident).toBeDefined();
      expect(mockDB.createIncident).toHaveBeenCalledOnce();
    });
  });

  describe('handleIncidentList', () => {
    it('lists incidents', async () => {
      const result = await handleIncidentList({ projectPath: '/tmp/test' });
      expect(result.success).toBe(true);
      expect(result.incidents).toBeInstanceOf(Array);
    });
  });

  describe('handleLessonCreate', () => {
    it('creates a lesson', async () => {
      const result = await handleLessonCreate({
        projectPath: '/tmp/test',
        moduleId: 'test-module',
        incidentId: 'inc-1',
        title: 'Test Lesson',
        summary: 'We learned something',
        rootCause: 'Bad config',
        fix: 'Fix the config',
        prevention: 'Add validation',
      });
      expect(result.success).toBe(true);
      expect(result.lesson).toBeDefined();
    });
  });

  describe('handleLessonList', () => {
    it('lists lessons', async () => {
      const result = await handleLessonList({ projectPath: '/tmp/test' });
      expect(result.success).toBe(true);
      expect(result.lessons).toBeInstanceOf(Array);
    });
  });

  describe('handleSkillCreate', () => {
    it('creates a skill', async () => {
      const result = await handleSkillCreate({
        projectPath: '/tmp/test',
        lessonId: 'lesson-1',
        name: 'test-skill',
        type: 'checklist',
        content: 'Step 1: Do this\nStep 2: Do that',
      });
      expect(result.success).toBe(true);
      expect(result.skill).toBeDefined();
    });

    it('rejects duplicate skill names', async () => {
      mockDB.getSkillByName.mockReturnValueOnce({ id: 'existing-skill' });
      const result = await handleSkillCreate({
        projectPath: '/tmp/test',
        lessonId: 'lesson-1',
        name: 'existing-skill',
        type: 'checklist',
        content: 'Duplicate',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });
  });

  describe('handleSkillList', () => {
    it('lists skills', async () => {
      const result = await handleSkillList({ projectPath: '/tmp/test' });
      expect(result.success).toBe(true);
      expect(result.skills).toBeInstanceOf(Array);
    });
  });

  describe('handleRuleCreate', () => {
    it('creates a rule', async () => {
      const result = await handleRuleCreate({
        projectPath: '/tmp/test',
        lessonId: 'lesson-1',
        name: 'test-rule',
        description: 'Always do this',
        level: 'should',
        enforcement: 'manual',
      });
      expect(result.success).toBe(true);
      expect(result.rule).toBeDefined();
    });

    it('rejects duplicate rule names', async () => {
      mockDB.getRuleByName.mockReturnValueOnce({ id: 'existing-rule' });
      const result = await handleRuleCreate({
        projectPath: '/tmp/test',
        lessonId: 'lesson-1',
        name: 'existing-rule',
        description: 'Dupe',
        level: 'must',
        enforcement: 'automated',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });
  });

  describe('handleRuleList', () => {
    it('lists rules', async () => {
      const result = await handleRuleList({ projectPath: '/tmp/test' });
      expect(result.success).toBe(true);
      expect(result.rules).toBeInstanceOf(Array);
    });
  });

  describe('handleRuleCheck', () => {
    it('checks rules for a module', async () => {
      const result = await handleRuleCheck({
        projectPath: '/tmp/test',
        moduleId: 'test-module',
      });
      expect(result.success).toBe(true);
      expect(result.rules).toBeDefined();
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
    });
  });
});
