/**
 * Session Context Builder
 *
 * Builds context prompts from linked entities for Claude Code sessions.
 * Supports Task, Module, Spec, and Ticket context injection.
 */

import type { Task, Ticket, TrainingContext } from './database';

// ============================================================================
// Types
// ============================================================================

export interface ContextBuilderOptions {
  workspacePath: string;

  // Entity linking (pick one or more)
  taskId?: string;
  moduleId?: string;
  specId?: string;
  ticketId?: string;

  // Data loaders (injected for flexibility)
  getTask?: (id: string) => Promise<Task | null>;
  getTicket?: (id: string) => Promise<Ticket | null>;
  getModuleKnowledge?: (moduleId: string, workspacePath: string) => Promise<ModuleKnowledge | null>;
  getSpecContent?: (specId: string, workspacePath: string) => Promise<SpecContent | null>;
  getTrainingContext?: (moduleId: string, role?: string, taskType?: string) => Promise<TrainingContext | null>;

  // Options
  includeGovernance?: boolean;  // Include governance rules in context
  includeTraining?: boolean;    // Include training context (skills/rules)
  agentRole?: string;           // Agent role for training context filtering
  taskType?: string;            // Task type for training context filtering
  maxContextLength?: number;    // Limit context size (default: 8000 chars)
}

export interface ModuleKnowledge {
  moduleId: string;
  name: string;
  description?: string;
  dependencies?: string[];
  files?: string[];
  docs?: ModuleDoc[];
}

export interface ModuleDoc {
  title: string;
  path: string;
  content: string;
  type: 'business-logic' | 'api' | 'pattern' | 'database' | 'general';
}

export interface SpecContent {
  specId: string;
  title: string;
  content: string;
  status: string;
  impactAnalysis?: {
    scope: string[];
    risks: Array<{ severity: string; description: string }>;
  };
}

export interface BuiltSessionContext {
  prompt: string;
  metadata: {
    entities: string[];
    taskId?: string;
    moduleId?: string;
    specId?: string;
    ticketId?: string;
    generatedAt: number;
  };
}

// ============================================================================
// Context Formatters
// ============================================================================

/**
 * Format task context for Claude
 */
function formatTaskContext(task: Task): string {
  const sections: string[] = [];

  sections.push(`## Task: ${task.title}`);
  sections.push(`**ID:** ${task.id}`);
  sections.push(`**Status:** ${task.status} | **Priority:** ${task.priority}`);

  if (task.description) {
    sections.push(`\n### Description\n${task.description}`);
  }

  // Parse acceptance criteria if available
  if (task.acceptanceCriteria) {
    try {
      const criteria = JSON.parse(task.acceptanceCriteria);
      if (Array.isArray(criteria) && criteria.length > 0) {
        sections.push('\n### Acceptance Criteria');
        criteria.forEach((c: { description: string; completed?: boolean }, i: number) => {
          const status = c.completed ? '[x]' : '[ ]';
          sections.push(`${status} ${i + 1}. ${c.description}`);
        });
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Parse governance if available
  if (task.governance) {
    try {
      const gov = JSON.parse(task.governance);
      if (gov.principles && gov.principles.length > 0) {
        sections.push('\n### Governance');
        sections.push(`**Principles:** ${gov.principles.join(', ')}`);
      }
      if (gov.skills && gov.skills.length > 0) {
        sections.push(`**Skills:** ${gov.skills.join(', ')}`);
      }
    } catch {
      // Ignore parse errors
    }
  }

  if (task.notes) {
    sections.push(`\n### Notes\n${task.notes}`);
  }

  return sections.join('\n');
}

/**
 * Format ticket context for Claude
 */
function formatTicketContext(ticket: Ticket): string {
  const sections: string[] = [];

  sections.push(`## Ticket: ${ticket.title}`);
  sections.push(`**ID:** ${ticket.id}`);
  if (ticket.externalId) {
    sections.push(`**External ID:** ${ticket.externalId} (${ticket.source})`);
  }
  sections.push(`**Type:** ${ticket.type} | **Priority:** ${ticket.priority} | **Status:** ${ticket.status}`);

  if (ticket.description) {
    sections.push(`\n### Description\n${ticket.description}`);
  }

  // Parse labels
  if (ticket.labels) {
    try {
      const labels = JSON.parse(ticket.labels);
      if (Array.isArray(labels) && labels.length > 0) {
        sections.push(`\n**Labels:** ${labels.join(', ')}`);
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Parse external URLs
  if (ticket.externalUrls) {
    try {
      const urls = JSON.parse(ticket.externalUrls);
      if (Array.isArray(urls) && urls.length > 0) {
        sections.push('\n### External References');
        urls.forEach((url: string) => {
          sections.push(`- ${url}`);
        });
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Parse linked issues
  if (ticket.linkedIssues) {
    try {
      const linked = JSON.parse(ticket.linkedIssues);
      if (Array.isArray(linked) && linked.length > 0) {
        sections.push('\n### Linked Issues');
        linked.forEach((issue: { type: string; id: string; title?: string }) => {
          sections.push(`- [${issue.type}] ${issue.id}${issue.title ? `: ${issue.title}` : ''}`);
        });
      }
    } catch {
      // Ignore parse errors
    }
  }

  return sections.join('\n');
}

/**
 * Format module knowledge context for Claude
 */
function formatModuleContext(knowledge: ModuleKnowledge): string {
  const sections: string[] = [];

  sections.push(`## Module: ${knowledge.name}`);
  sections.push(`**ID:** ${knowledge.moduleId}`);

  if (knowledge.description) {
    sections.push(`\n### Description\n${knowledge.description}`);
  }

  if (knowledge.dependencies && knowledge.dependencies.length > 0) {
    sections.push(`\n### Dependencies\n${knowledge.dependencies.map(d => `- ${d}`).join('\n')}`);
  }

  if (knowledge.files && knowledge.files.length > 0) {
    sections.push(`\n### Key Files\n${knowledge.files.slice(0, 10).map(f => `- ${f}`).join('\n')}`);
    if (knowledge.files.length > 10) {
      sections.push(`... and ${knowledge.files.length - 10} more files`);
    }
  }

  if (knowledge.docs && knowledge.docs.length > 0) {
    sections.push('\n### Documentation');
    knowledge.docs.forEach(doc => {
      sections.push(`\n#### ${doc.title} (${doc.type})`);
      // Truncate long docs
      const content = doc.content.length > 2000
        ? doc.content.slice(0, 2000) + '\n...[truncated]'
        : doc.content;
      sections.push(content);
    });
  }

  return sections.join('\n');
}

/**
 * Format training context for Claude
 * Includes learned skills and active rules from the lessons-learned system
 */
function formatTrainingContext(context: TrainingContext): string {
  const sections: string[] = [];

  sections.push(`## Training Context: ${context.moduleId}`);
  sections.push('_Lessons learned from past experience. Apply these patterns and rules._\n');

  // Add skills (sorted by success rate)
  if (context.skills && context.skills.length > 0) {
    sections.push('### Learned Skills');
    sections.push('Apply these patterns based on past experience:\n');

    const sortedSkills = [...context.skills].sort((a, b) => b.successRate - a.successRate);
    sortedSkills.slice(0, 5).forEach((skill, i) => {
      sections.push(`#### ${i + 1}. ${skill.name}`);
      sections.push(`_Success rate: ${skill.successRate}% (${skill.usageCount} uses)_\n`);
      // Truncate long content
      const content = skill.content.length > 500
        ? skill.content.slice(0, 500) + '...[truncated]'
        : skill.content;
      sections.push(content);
      sections.push('');
    });

    if (context.skills.length > 5) {
      sections.push(`_...and ${context.skills.length - 5} more skills_\n`);
    }
  }

  // Add rules (sorted by priority: must > should > may)
  if (context.rules && context.rules.length > 0) {
    sections.push('### Active Rules');
    sections.push('Follow these rules strictly:\n');

    const levelOrder: Record<string, number> = { must: 0, should: 1, may: 2 };
    const sortedRules = [...context.rules].sort(
      (a, b) => (levelOrder[a.level] ?? 2) - (levelOrder[b.level] ?? 2)
    );

    sortedRules.slice(0, 10).forEach((rule, i) => {
      const emoji = rule.level === 'must' ? '🔴' : rule.level === 'should' ? '🟡' : '🟢';
      sections.push(`${i + 1}. ${emoji} **[${rule.level.toUpperCase()}]** ${rule.name}`);
      sections.push(`   ${rule.content}`);
      if (rule.enforcement === 'block') {
        sections.push(`   _Enforcement: Blocking - violations will be flagged_`);
      }
      sections.push('');
    });
  }

  // Add recent incidents warning
  if (context.recentIncidents && context.recentIncidents.length > 0) {
    const criticalIncidents = context.recentIncidents.filter(
      (i) => i.severity === 'critical' || i.severity === 'high'
    );

    if (criticalIncidents.length > 0) {
      sections.push('### Recent Issues (Avoid)');
      sections.push('Be aware of these recent problems:\n');
      criticalIncidents.forEach((incident) => {
        sections.push(`- ⚠️ [${incident.severity.toUpperCase()}] ${incident.title}`);
      });
      sections.push('');
    }
  }

  return sections.join('\n');
}

/**
 * Format spec context for Claude
 */
function formatSpecContext(spec: SpecContent): string {
  const sections: string[] = [];

  sections.push(`## Spec: ${spec.title}`);
  sections.push(`**ID:** ${spec.specId}`);
  sections.push(`**Status:** ${spec.status}`);

  if (spec.content) {
    // Truncate long spec content
    const content = spec.content.length > 4000
      ? spec.content.slice(0, 4000) + '\n...[truncated]'
      : spec.content;
    sections.push(`\n### Content\n${content}`);
  }

  if (spec.impactAnalysis) {
    sections.push('\n### Impact Analysis');
    if (spec.impactAnalysis.scope.length > 0) {
      sections.push(`**Scope:** ${spec.impactAnalysis.scope.join(', ')}`);
    }
    if (spec.impactAnalysis.risks.length > 0) {
      sections.push('\n**Risks:**');
      spec.impactAnalysis.risks.forEach(risk => {
        sections.push(`- [${risk.severity.toUpperCase()}] ${risk.description}`);
      });
    }
  }

  return sections.join('\n');
}

// ============================================================================
// Main Builder
// ============================================================================

/**
 * Build session context from linked entities
 *
 * @param options - Context builder options with entity IDs and data loaders
 * @returns SessionContext with formatted prompt and metadata
 */
export async function buildSessionContext(
  options: ContextBuilderOptions
): Promise<BuiltSessionContext> {
  const maxLength = options.maxContextLength ?? 8000;
  const contextParts: string[] = [];
  const entities: string[] = [];

  // Header
  contextParts.push('# Session Context\n');
  contextParts.push(`**Workspace:** ${options.workspacePath}\n`);

  // Load and format Task context
  if (options.taskId && options.getTask) {
    const task = await options.getTask(options.taskId);
    if (task) {
      contextParts.push(formatTaskContext(task));
      entities.push('task');
    }
  }

  // Load and format Ticket context
  if (options.ticketId && options.getTicket) {
    const ticket = await options.getTicket(options.ticketId);
    if (ticket) {
      contextParts.push('\n---\n');
      contextParts.push(formatTicketContext(ticket));
      entities.push('ticket');
    }
  }

  // Load and format Module context
  if (options.moduleId && options.getModuleKnowledge) {
    const knowledge = await options.getModuleKnowledge(options.moduleId, options.workspacePath);
    if (knowledge) {
      contextParts.push('\n---\n');
      contextParts.push(formatModuleContext(knowledge));
      entities.push('module');
    }
  }

  // Load and format Spec context
  if (options.specId && options.getSpecContent) {
    const spec = await options.getSpecContent(options.specId, options.workspacePath);
    if (spec) {
      contextParts.push('\n---\n');
      contextParts.push(formatSpecContext(spec));
      entities.push('spec');
    }
  }

  // Load and format Training context (skills, rules, incidents)
  if (options.includeTraining && options.moduleId && options.getTrainingContext) {
    const trainingContext = await options.getTrainingContext(
      options.moduleId,
      options.agentRole,
      options.taskType
    );
    if (trainingContext) {
      contextParts.push('\n---\n');
      contextParts.push(formatTrainingContext(trainingContext));
      entities.push('training');
    }
  }

  // Build final prompt
  let prompt = contextParts.join('\n');

  // Truncate if too long
  if (prompt.length > maxLength) {
    prompt = prompt.slice(0, maxLength) + '\n\n...[Context truncated due to size limits]';
  }

  return {
    prompt,
    metadata: {
      entities,
      taskId: options.taskId,
      moduleId: options.moduleId,
      specId: options.specId,
      ticketId: options.ticketId,
      generatedAt: Date.now(),
    },
  };
}

/**
 * Check if any context entities are specified
 */
export function hasContextEntities(options: Partial<ContextBuilderOptions>): boolean {
  return !!(options.taskId || options.moduleId || options.specId || options.ticketId);
}

/**
 * Get summary of linked entities
 */
export function getContextSummary(
  options: Pick<ContextBuilderOptions, 'taskId' | 'moduleId' | 'specId' | 'ticketId'>
): string {
  const parts: string[] = [];
  if (options.taskId) parts.push(`Task: ${options.taskId.slice(0, 12)}...`);
  if (options.moduleId) parts.push(`Module: ${options.moduleId}`);
  if (options.specId) parts.push(`Spec: ${options.specId.slice(0, 12)}...`);
  if (options.ticketId) parts.push(`Ticket: ${options.ticketId.slice(0, 12)}...`);
  return parts.length > 0 ? parts.join(' | ') : 'No context';
}
