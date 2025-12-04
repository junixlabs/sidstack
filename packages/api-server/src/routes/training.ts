/**
 * Training Room API Routes
 *
 * Endpoints for the Training Room (lessons-learned system).
 * Manages incidents, lessons, skills, rules, and training context.
 */

import { Router } from 'express';
import { getDB } from '@sidstack/shared';
import type {
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
  LessonStatus,
  SkillType,
  SkillStatus,
  RuleLevel,
  RuleEnforcement,
  RuleStatus,
  FeedbackOutcome,
  IncidentContext,
  Applicability,
  TriggerConfig,
  TrainingContext,
} from '@sidstack/shared';

export const trainingRouter: Router = Router();

// =============================================================================
// Training Sessions
// =============================================================================

// Get training session for a module
trainingRouter.get('/sessions/:moduleId', async (req, res) => {
  try {
    const db = await getDB();
    const projectPath = req.query.projectPath as string || '';
    const session = db.getTrainingSessionByModule(req.params.moduleId, projectPath);

    if (!session) {
      return res.status(404).json({ error: 'Training session not found' });
    }

    res.json({ success: true, session });
  } catch (error) {
    console.error('Failed to get training session:', error);
    res.status(500).json({ error: 'Failed to get training session' });
  }
});

// Get or create training session for a module
trainingRouter.post('/sessions/:moduleId', async (req, res) => {
  try {
    const db = await getDB();
    const projectPath = (req.body.projectPath || req.query.projectPath || '') as string;
    console.log(`[Training] POST /sessions/${req.params.moduleId} - projectPath: "${projectPath}"`);
    const session = db.getOrCreateTrainingSession(req.params.moduleId, projectPath);

    res.json({ success: true, session });
  } catch (error) {
    console.error('Failed to get/create training session:', error);
    res.status(500).json({ error: 'Failed to get/create training session' });
  }
});

// List all training sessions
trainingRouter.get('/sessions', async (req, res) => {
  try {
    const db = await getDB();
    const projectPath = req.query.projectPath as string | undefined;
    const status = req.query.status as 'active' | 'archived' | undefined;
    const sessions = db.listTrainingSessions(projectPath, status);

    res.json({ success: true, sessions, total: sessions.length });
  } catch (error) {
    console.error('Failed to list training sessions:', error);
    res.status(500).json({ error: 'Failed to list training sessions' });
  }
});

// =============================================================================
// Incidents
// =============================================================================

// Create incident
trainingRouter.post('/incidents', async (req, res) => {
  try {
    const db = await getDB();
    const {
      sessionId,
      type = 'mistake',
      severity = 'medium',
      title,
      description,
      context,
    } = req.body;

    if (!sessionId || !title) {
      return res.status(400).json({ error: 'sessionId and title are required' });
    }

    // Verify session exists
    const session = db.getTrainingSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Training session not found' });
    }

    const incident = db.createIncident({
      sessionId,
      type: type as IncidentType,
      severity: severity as IncidentSeverity,
      title,
      description,
      context: context as IncidentContext | undefined,
    });

    res.status(201).json({ success: true, incident });
  } catch (error) {
    console.error('Failed to create incident:', error);
    res.status(500).json({ error: 'Failed to create incident' });
  }
});

// List incidents
trainingRouter.get('/incidents', async (req, res) => {
  try {
    const db = await getDB();

    const sessionId = req.query.sessionId as string | undefined;
    const type = req.query.type as IncidentType | undefined;
    const severity = req.query.severity as IncidentSeverity | undefined;
    const status = req.query.status as IncidentStatus | undefined;

    const incidents = db.listIncidents({ sessionId, type, severity, status });

    res.json({ success: true, incidents, total: incidents.length });
  } catch (error) {
    console.error('Failed to list incidents:', error);
    res.status(500).json({ error: 'Failed to list incidents' });
  }
});

// Get incident by ID
trainingRouter.get('/incidents/:id', async (req, res) => {
  try {
    const db = await getDB();
    const incident = db.getIncident(req.params.id);

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    res.json({ success: true, incident });
  } catch (error) {
    console.error('Failed to get incident:', error);
    res.status(500).json({ error: 'Failed to get incident' });
  }
});

// Update incident
trainingRouter.patch('/incidents/:id', async (req, res) => {
  try {
    const db = await getDB();
    const { type, severity, title, description, context, resolution, status } = req.body;

    const incident = db.updateIncident({
      id: req.params.id,
      type: type as IncidentType | undefined,
      severity: severity as IncidentSeverity | undefined,
      title,
      description,
      context: context as IncidentContext | undefined,
      resolution,
      status: status as IncidentStatus | undefined,
    });

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    res.json({ success: true, incident });
  } catch (error) {
    console.error('Failed to update incident:', error);
    res.status(500).json({ error: 'Failed to update incident' });
  }
});

// Delete incident
trainingRouter.delete('/incidents/:id', async (req, res) => {
  try {
    const db = await getDB();
    const incident = db.getIncident(req.params.id);

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    db.deleteIncident(req.params.id);
    res.json({ success: true, message: 'Incident deleted' });
  } catch (error) {
    console.error('Failed to delete incident:', error);
    res.status(500).json({ error: 'Failed to delete incident' });
  }
});

// =============================================================================
// Lessons
// =============================================================================

// Create lesson
trainingRouter.post('/lessons', async (req, res) => {
  try {
    const db = await getDB();
    const {
      sessionId,
      incidentIds,
      title,
      problem,
      rootCause,
      solution,
      applicability,
    } = req.body;

    if (!sessionId || !title || !problem || !solution) {
      return res.status(400).json({
        error: 'sessionId, title, problem, and solution are required',
      });
    }

    // Verify session exists
    const session = db.getTrainingSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Training session not found' });
    }

    const lesson = db.createLesson({
      sessionId,
      incidentIds: incidentIds as string[] | undefined,
      title,
      problem,
      rootCause: rootCause || '',
      solution,
      applicability: applicability as Applicability | undefined,
    });

    res.status(201).json({ success: true, lesson });
  } catch (error) {
    console.error('Failed to create lesson:', error);
    res.status(500).json({ error: 'Failed to create lesson' });
  }
});

// List lessons
trainingRouter.get('/lessons', async (req, res) => {
  try {
    const db = await getDB();

    const sessionId = req.query.sessionId as string | undefined;
    const status = req.query.status as LessonStatus | undefined;

    const lessons = db.listLessons({ sessionId, status });

    res.json({ success: true, lessons, total: lessons.length });
  } catch (error) {
    console.error('Failed to list lessons:', error);
    res.status(500).json({ error: 'Failed to list lessons' });
  }
});

// Get lesson by ID
trainingRouter.get('/lessons/:id', async (req, res) => {
  try {
    const db = await getDB();
    const lesson = db.getLesson(req.params.id);

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    res.json({ success: true, lesson });
  } catch (error) {
    console.error('Failed to get lesson:', error);
    res.status(500).json({ error: 'Failed to get lesson' });
  }
});

// Update lesson
trainingRouter.patch('/lessons/:id', async (req, res) => {
  try {
    const db = await getDB();
    const { title, problem, rootCause, solution, applicability, status } = req.body;

    const lesson = db.updateLesson({
      id: req.params.id,
      title,
      problem,
      rootCause,
      solution,
      applicability: applicability as Applicability | undefined,
      status: status as LessonStatus | undefined,
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    res.json({ success: true, lesson });
  } catch (error) {
    console.error('Failed to update lesson:', error);
    res.status(500).json({ error: 'Failed to update lesson' });
  }
});

// Approve lesson
trainingRouter.post('/lessons/:id/approve', async (req, res) => {
  try {
    const db = await getDB();
    const { approver = 'user' } = req.body;

    const lesson = db.approveLesson(req.params.id, approver);

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    res.json({ success: true, lesson });
  } catch (error) {
    console.error('Failed to approve lesson:', error);
    res.status(500).json({ error: 'Failed to approve lesson' });
  }
});

// =============================================================================
// Skills
// =============================================================================

// Create skill
trainingRouter.post('/skills', async (req, res) => {
  try {
    const db = await getDB();
    const {
      projectPath = '',
      name,
      description,
      lessonIds,
      type = 'procedure',
      content,
      trigger,
      applicability,
    } = req.body;

    if (!name || !content) {
      return res.status(400).json({ error: 'name and content are required' });
    }

    // Check for duplicate name within project
    const existing = db.getSkillByName(name, projectPath);
    if (existing) {
      return res.status(409).json({
        error: 'Skill with this name already exists',
        existingSkill: existing,
      });
    }

    const skill = db.createSkill({
      projectPath,
      name,
      description,
      lessonIds: lessonIds as string[] | undefined,
      type: type as SkillType,
      content,
      trigger: trigger as TriggerConfig | undefined,
      applicability: applicability as Applicability | undefined,
    });

    res.status(201).json({ success: true, skill });
  } catch (error) {
    console.error('Failed to create skill:', error);
    res.status(500).json({ error: 'Failed to create skill' });
  }
});

// List skills
trainingRouter.get('/skills', async (req, res) => {
  try {
    const db = await getDB();

    const projectPath = req.query.projectPath as string | undefined;
    const module = req.query.module as string | undefined;
    const role = req.query.role as string | undefined;
    const taskType = req.query.taskType as string | undefined;
    const type = req.query.type as SkillType | undefined;
    const status = req.query.status as SkillStatus | undefined;

    const skills = db.listSkills({ projectPath, module, role, taskType, type, status });

    res.json({ success: true, skills, total: skills.length });
  } catch (error) {
    console.error('Failed to list skills:', error);
    res.status(500).json({ error: 'Failed to list skills' });
  }
});

// Get skill by ID
trainingRouter.get('/skills/:id', async (req, res) => {
  try {
    const db = await getDB();
    const skill = db.getSkill(req.params.id);

    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    res.json({ success: true, skill });
  } catch (error) {
    console.error('Failed to get skill:', error);
    res.status(500).json({ error: 'Failed to get skill' });
  }
});

// Update skill
trainingRouter.patch('/skills/:id', async (req, res) => {
  try {
    const db = await getDB();
    const {
      name,
      description,
      type,
      content,
      trigger,
      applicability,
      status,
    } = req.body;

    const skill = db.updateSkill({
      id: req.params.id,
      name,
      description,
      type: type as SkillType | undefined,
      content,
      trigger: trigger as TriggerConfig | undefined,
      applicability: applicability as Applicability | undefined,
      status: status as SkillStatus | undefined,
    });

    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    res.json({ success: true, skill });
  } catch (error) {
    console.error('Failed to update skill:', error);
    res.status(500).json({ error: 'Failed to update skill' });
  }
});

// Activate skill
trainingRouter.post('/skills/:id/activate', async (req, res) => {
  try {
    const db = await getDB();
    const skill = db.activateSkill(req.params.id);

    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    res.json({ success: true, skill });
  } catch (error) {
    console.error('Failed to activate skill:', error);
    res.status(500).json({ error: 'Failed to activate skill' });
  }
});

// Deprecate skill
trainingRouter.post('/skills/:id/deprecate', async (req, res) => {
  try {
    const db = await getDB();
    const skill = db.deprecateSkill(req.params.id);

    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    res.json({ success: true, skill });
  } catch (error) {
    console.error('Failed to deprecate skill:', error);
    res.status(500).json({ error: 'Failed to deprecate skill' });
  }
});

// Record skill usage
trainingRouter.post('/skills/:id/usage', async (req, res) => {
  try {
    const db = await getDB();
    const skill = db.incrementSkillUsage(req.params.id);

    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    res.json({ success: true, usageCount: skill.usageCount });
  } catch (error) {
    console.error('Failed to record skill usage:', error);
    res.status(500).json({ error: 'Failed to record skill usage' });
  }
});

// =============================================================================
// Rules
// =============================================================================

// Create rule
trainingRouter.post('/rules', async (req, res) => {
  try {
    const db = await getDB();
    const {
      projectPath = '',
      name,
      description,
      skillIds,
      level = 'should',
      enforcement = 'warn',
      content,
      applicability,
    } = req.body;

    if (!name || !content) {
      return res.status(400).json({ error: 'name and content are required' });
    }

    // Check for duplicate name within project
    const existing = db.getRuleByName(name, projectPath);
    if (existing) {
      return res.status(409).json({
        error: 'Rule with this name already exists',
        existingRule: existing,
      });
    }

    const rule = db.createRule({
      projectPath,
      name,
      description,
      skillIds: skillIds as string[] | undefined,
      level: level as RuleLevel,
      enforcement: enforcement as RuleEnforcement,
      content,
      applicability: applicability as Applicability | undefined,
    });

    res.status(201).json({ success: true, rule });
  } catch (error) {
    console.error('Failed to create rule:', error);
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

// List rules
trainingRouter.get('/rules', async (req, res) => {
  try {
    const db = await getDB();

    const projectPath = req.query.projectPath as string | undefined;
    const module = req.query.module as string | undefined;
    const role = req.query.role as string | undefined;
    const taskType = req.query.taskType as string | undefined;
    const level = req.query.level as RuleLevel | undefined;
    const enforcement = req.query.enforcement as RuleEnforcement | undefined;
    const status = req.query.status as RuleStatus | undefined;

    const rules = db.listRules({ projectPath, module, role, taskType, level, enforcement, status });

    res.json({ success: true, rules, total: rules.length });
  } catch (error) {
    console.error('Failed to list rules:', error);
    res.status(500).json({ error: 'Failed to list rules' });
  }
});

// Get rule by ID
trainingRouter.get('/rules/:id', async (req, res) => {
  try {
    const db = await getDB();
    const rule = db.getRule(req.params.id);

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json({ success: true, rule });
  } catch (error) {
    console.error('Failed to get rule:', error);
    res.status(500).json({ error: 'Failed to get rule' });
  }
});

// Update rule
trainingRouter.patch('/rules/:id', async (req, res) => {
  try {
    const db = await getDB();
    const {
      name,
      description,
      level,
      enforcement,
      content,
      applicability,
      status,
    } = req.body;

    const rule = db.updateRule({
      id: req.params.id,
      name,
      description,
      level: level as RuleLevel | undefined,
      enforcement: enforcement as RuleEnforcement | undefined,
      content,
      applicability: applicability as Applicability | undefined,
      status: status as RuleStatus | undefined,
    });

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json({ success: true, rule });
  } catch (error) {
    console.error('Failed to update rule:', error);
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

// Deprecate rule
trainingRouter.post('/rules/:id/deprecate', async (req, res) => {
  try {
    const db = await getDB();
    const rule = db.deprecateRule(req.params.id);

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json({ success: true, rule });
  } catch (error) {
    console.error('Failed to deprecate rule:', error);
    res.status(500).json({ error: 'Failed to deprecate rule' });
  }
});

// Record rule violation
trainingRouter.post('/rules/:id/violation', async (req, res) => {
  try {
    const db = await getDB();
    const rule = db.recordRuleViolation(req.params.id);

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json({ success: true, violationCount: rule.violationCount });
  } catch (error) {
    console.error('Failed to record rule violation:', error);
    res.status(500).json({ error: 'Failed to record rule violation' });
  }
});

// Check applicable rules for context
trainingRouter.post('/rules/check', async (req, res) => {
  try {
    const db = await getDB();
    const { module: moduleId, role, taskType } = req.body;

    // Get active rules filtered by context
    const rules = db.listRules({
      module: moduleId,
      role,
      taskType,
      status: 'active',
    });

    res.json({ success: true, rules, total: rules.length });
  } catch (error) {
    console.error('Failed to check rules:', error);
    res.status(500).json({ error: 'Failed to check rules' });
  }
});

// =============================================================================
// Training Context
// =============================================================================

// Get training context for a module
trainingRouter.get('/context/:moduleId', async (req, res) => {
  try {
    const db = await getDB();
    const projectPath = req.query.projectPath as string || '';
    const role = req.query.role as string | undefined;
    const taskType = req.query.taskType as string | undefined;

    const context = db.getTrainingContext(req.params.moduleId, projectPath, role, taskType);

    res.json({ success: true, context });
  } catch (error) {
    console.error('Failed to get training context:', error);
    res.status(500).json({ error: 'Failed to get training context' });
  }
});

// Build training context prompt
trainingRouter.post('/context/build', async (req, res) => {
  try {
    const db = await getDB();
    const { moduleId, projectPath = '', role, taskType, maxSkills = 10, maxRules = 10 } = req.body;

    if (!moduleId) {
      return res.status(400).json({ error: 'moduleId is required' });
    }

    const context = db.getTrainingContext(moduleId, projectPath, role, taskType);

    // Build prompt
    const prompt = buildTrainingContextPrompt(context, maxSkills, maxRules);

    res.json({
      success: true,
      context,
      prompt,
    });
  } catch (error) {
    console.error('Failed to build training context:', error);
    res.status(500).json({ error: 'Failed to build training context' });
  }
});

// =============================================================================
// Training Feedback
// =============================================================================

// Submit feedback
trainingRouter.post('/feedback', async (req, res) => {
  try {
    const db = await getDB();
    const {
      entityType,
      entityId,
      taskId,
      sessionId,
      outcome,
      rating,
      comment,
    } = req.body;

    if (!entityType || !entityId || !outcome) {
      return res.status(400).json({
        error: 'entityType, entityId, and outcome are required',
      });
    }

    const feedback = db.createTrainingFeedback({
      entityType: entityType as 'skill' | 'rule',
      entityId,
      taskId,
      sessionId,
      outcome: outcome as FeedbackOutcome,
      rating,
      comment,
    });

    // Update skill success rate if applicable
    if (entityType === 'skill' && (outcome === 'success' || outcome === 'failure')) {
      const skill = db.getSkill(entityId);
      if (skill) {
        const feedbackList = db.listTrainingFeedback('skill', entityId);
        const successCount = feedbackList.filter((f) => f.outcome === 'success').length;
        const totalCount = feedbackList.filter((f) =>
          ['success', 'failure'].includes(f.outcome)
        ).length;
        const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;
        db.updateSkill({ id: entityId, successRate });
      }
    }

    res.status(201).json({ success: true, feedback });
  } catch (error) {
    console.error('Failed to submit feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// List feedback for entity
trainingRouter.get('/feedback/:entityType/:entityId', async (req, res) => {
  try {
    const db = await getDB();
    const { entityType, entityId } = req.params;

    const feedback = db.listTrainingFeedback(entityType as 'skill' | 'rule', entityId);

    res.json({ success: true, feedback, total: feedback.length });
  } catch (error) {
    console.error('Failed to list feedback:', error);
    res.status(500).json({ error: 'Failed to list feedback' });
  }
});

// =============================================================================
// Analytics / Stats
// =============================================================================

// Get training stats for a module
trainingRouter.get('/stats/:moduleId', async (req, res) => {
  try {
    const db = await getDB();
    const moduleId = req.params.moduleId;
    const projectPath = req.query.projectPath as string || '';

    // Get session
    const session = db.getTrainingSessionByModule(moduleId, projectPath);
    if (!session) {
      return res.json({
        success: true,
        stats: {
          moduleId,
          projectPath,
          hasSession: false,
          incidents: { total: 0, byStatus: {}, bySeverity: {} },
          lessons: { total: 0, byStatus: {} },
          skills: { total: 0, active: 0, totalUsage: 0, avgSuccessRate: 0 },
          rules: { total: 0, active: 0, totalViolations: 0 },
        },
      });
    }

    // Get counts
    const incidents = db.listIncidents({ sessionId: session.id });
    const lessons = db.listLessons({ sessionId: session.id });
    const skills = db.listSkills({ projectPath, module: moduleId });
    const rules = db.listRules({ projectPath, module: moduleId });

    // Calculate effectiveness
    const activeSkills = skills.filter((s) => s.status === 'active');
    const totalUsage = activeSkills.reduce((sum, s) => sum + s.usageCount, 0);
    const avgSuccessRate =
      activeSkills.length > 0
        ? Math.round(
            activeSkills.reduce((sum, s) => sum + s.successRate, 0) / activeSkills.length
          )
        : 0;

    const activeRules = rules.filter((r) => r.status === 'active');
    const totalViolations = activeRules.reduce((sum, r) => sum + r.violationCount, 0);

    // Count by status
    const incidentsByStatus: Record<string, number> = {};
    const incidentsBySeverity: Record<string, number> = {};
    incidents.forEach((i) => {
      incidentsByStatus[i.status] = (incidentsByStatus[i.status] || 0) + 1;
      incidentsBySeverity[i.severity] = (incidentsBySeverity[i.severity] || 0) + 1;
    });

    const lessonsByStatus: Record<string, number> = {};
    lessons.forEach((l) => {
      lessonsByStatus[l.status] = (lessonsByStatus[l.status] || 0) + 1;
    });

    res.json({
      success: true,
      stats: {
        moduleId,
        projectPath,
        hasSession: true,
        sessionId: session.id,
        sessionStatus: session.status,
        incidents: {
          total: incidents.length,
          byStatus: incidentsByStatus,
          bySeverity: incidentsBySeverity,
        },
        lessons: {
          total: lessons.length,
          byStatus: lessonsByStatus,
        },
        skills: {
          total: skills.length,
          active: activeSkills.length,
          totalUsage,
          avgSuccessRate,
        },
        rules: {
          total: rules.length,
          active: activeRules.length,
          totalViolations,
        },
      },
    });
  } catch (error) {
    console.error('Failed to get training stats:', error);
    res.status(500).json({ error: 'Failed to get training stats' });
  }
});

// =============================================================================
// Helper Functions
// =============================================================================

function buildTrainingContextPrompt(
  context: TrainingContext,
  maxSkills: number,
  maxRules: number
): string {
  const lines: string[] = [
    '# Training Context',
    '',
    `**Module:** ${context.moduleId}`,
    '',
  ];

  // Add skills
  if (context.skills.length > 0) {
    lines.push('## Learned Skills');
    lines.push('');
    lines.push('Apply these patterns based on past experience:');
    lines.push('');

    const topSkills = context.skills
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, maxSkills);

    topSkills.forEach((skill, i) => {
      lines.push(`### ${i + 1}. ${skill.name}`);
      lines.push(`Success rate: ${skill.successRate}% (${skill.usageCount} uses)`);
      lines.push('');
      lines.push(skill.content);
      lines.push('');
    });
  }

  // Add rules
  if (context.rules.length > 0) {
    lines.push('## Active Rules');
    lines.push('');
    lines.push('Follow these rules strictly:');
    lines.push('');

    const priorityRules = context.rules
      .sort((a, b) => {
        const levelOrder: Record<string, number> = { must: 0, should: 1, may: 2 };
        return (levelOrder[a.level] ?? 2) - (levelOrder[b.level] ?? 2);
      })
      .slice(0, maxRules);

    priorityRules.forEach((rule, i) => {
      const levelEmoji = rule.level === 'must' ? '🔴' : rule.level === 'should' ? '🟡' : '🟢';
      lines.push(`${i + 1}. ${levelEmoji} **[${rule.level.toUpperCase()}]** ${rule.name}`);
      lines.push(`   ${rule.content}`);
      lines.push('');
    });
  }

  // Add recent incidents warning
  if (context.recentIncidents && context.recentIncidents.length > 0) {
    const criticalIncidents = context.recentIncidents.filter(
      (i) => i.severity === 'critical' || i.severity === 'high'
    );

    if (criticalIncidents.length > 0) {
      lines.push('## Recent Issues (Avoid)');
      lines.push('');
      criticalIncidents.forEach((incident) => {
        lines.push(`- [${incident.severity.toUpperCase()}] ${incident.title}`);
      });
      lines.push('');
    }
  }

  // Add lesson suggestion instructions
  lines.push('## Lesson Detection (Proactive)');
  lines.push('');
  lines.push('After fixing bugs or solving problems, PROACTIVELY suggest creating a lesson when:');
  lines.push('');
  lines.push('| Trigger | Action |');
  lines.push('|---------|--------|');
  lines.push('| Bug took >30min to debug | Ask: "This was tricky. Create a lesson?" |');
  lines.push('| Type/config mismatch error | Ask: "Create checklist for type sync?" |');
  lines.push('| Found reusable pattern | Ask: "Document this pattern as a skill?" |');
  lines.push('| Error could be prevented | Ask: "Create a rule to prevent this?" |');
  lines.push('| Same error occurred before | Ask: "This is recurring. Create a rule?" |');
  lines.push('');
  lines.push('**How to create:** Use MCP tools `incident_create` → `lesson_create` → `skill_create`');
  lines.push('');
  lines.push('**Keep it lightweight:** Only suggest for valuable lessons, not every minor fix.');
  lines.push('');

  lines.push('---');
  lines.push('');

  return lines.join('\n');
}
