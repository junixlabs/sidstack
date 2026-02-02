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
      if (rule.enforcement === 'gate') {
        sections.push(`   _Enforcement: Gate - violations will block completion_`);
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

/**
 * Format auto-learning instructions for Claude session injection.
 * Tells the agent when and how to capture incidents, lessons, and skills.
 */
function formatAutoLearnInstructions(moduleId: string): string {
  return `## Auto-Learning Protocol

During this session, proactively capture knowledge when you encounter these situations:

### When to create an Incident
- You encounter an error that takes multiple attempts to fix
- You find a bug caused by a misunderstanding of the codebase
- A build/test failure is caused by a non-obvious reason
- You discover an undocumented constraint or behavior

→ Call \`incident_create\` with: projectPath, moduleId, type (mistake|failure|confusion|slow), severity, title, description, context

### When to create a Lesson
- After resolving an incident, you identify the root cause and prevention
- You notice a pattern across multiple similar issues
- You discover a project-specific convention not documented anywhere

→ Call \`lesson_create\` with: projectPath, moduleId, title, problem, rootCause, solution

### When to create a Skill
- You develop a reusable procedure for a recurring task
- You create a checklist that would help future sessions
- You find an effective debugging approach for this codebase

→ Call \`skill_create\` with: projectPath, name, type (procedure|checklist|template), content

### Important
- Only create entries for genuinely useful insights, not trivial fixes
- Be concise - focus on what would help a future agent in the same situation
- Link to the current module: ${moduleId}`;
}

// ============================================================================
// Relevance Scoring
// ============================================================================

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'must', 'ought',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
  'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than',
  'too', 'very', 'just', 'because', 'if', 'when', 'while', 'this',
  'that', 'these', 'those', 'it', 'its', 'we', 'they', 'them',
]);

/**
 * Extract keywords from text, removing stop words
 */
export function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Score a document's relevance to a set of keywords
 */
export function scoreDocRelevance(
  doc: { title: string; summary?: string; content: string; tags?: string[]; module?: string },
  keywords: string[]
): number {
  if (keywords.length === 0) return 0;

  let score = 0;
  const titleLower = doc.title.toLowerCase();
  const summaryLower = (doc.summary || '').toLowerCase();
  const moduleLower = (doc.module || '').toLowerCase();
  const tagsLower = (doc.tags || []).map(t => t.toLowerCase());
  const contentLower = doc.content.toLowerCase();

  for (const keyword of keywords) {
    // Title match (highest weight)
    if (titleLower.includes(keyword)) score += 10;
    // Module match
    if (moduleLower.includes(keyword)) score += 6;
    // Tags match
    if (tagsLower.some(t => t.includes(keyword))) score += 4;
    // Summary match
    if (summaryLower.includes(keyword)) score += 3;
    // Content match (lowest weight)
    if (contentLower.includes(keyword)) score += 1;
  }

  return score;
}

/**
 * Rough token estimate: ~4 chars per token
 */
function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4);
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

  // Auto-learning instructions (when training tools are available)
  if (options.includeTraining && options.moduleId) {
    contextParts.push('\n---\n');
    contextParts.push(formatAutoLearnInstructions(options.moduleId));
    entities.push('auto-learn');
  }

  // Build final prompt
  let prompt = contextParts.join('\n');

  // Truncate at section boundaries if too long
  if (prompt.length > maxLength) {
    const sections = prompt.split('\n---\n');
    let truncated = '';
    for (const section of sections) {
      if (truncated.length + section.length + 5 > maxLength) {
        break;
      }
      if (truncated) truncated += '\n---\n';
      truncated += section;
    }
    prompt = truncated || prompt.slice(0, maxLength);
    prompt += `\n\n...[Context truncated. ~${estimateTokens(prompt.length)} tokens used]`;
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
 * Create ContextBuilderOptions with data loaders wired to db + KnowledgeService.
 *
 * Factory that removes boilerplate so callers (MCP handler, API server, etc.)
 * don't duplicate data-loader wiring for buildSessionContext().
 */
export function createSessionContextOptions(params: {
  db: any;
  knowledgeService: any;
  workspacePath: string;
  taskId?: string;
  moduleId?: string;
  specId?: string;
  ticketId?: string;
  includeTraining?: boolean;
  agentRole?: string;
  taskType?: string;
  maxContextLength?: number;
}): ContextBuilderOptions {
  const { db, knowledgeService, workspacePath } = params;

  return {
    workspacePath,
    taskId: params.taskId,
    moduleId: params.moduleId,
    specId: params.specId,
    ticketId: params.ticketId,
    includeTraining: params.includeTraining,
    agentRole: params.agentRole,
    taskType: params.taskType,
    maxContextLength: params.maxContextLength ?? 8000,

    // Data loaders
    getTask: db ? async (id: string) => db.getTask(id) : undefined,
    getTicket: db ? async (id: string) => db.getTicket(id) : undefined,

    // Module knowledge loader - direct filesystem via KnowledgeService
    getModuleKnowledge: knowledgeService
      ? async (modId: string) => {
          try {
            const response = await knowledgeService.listDocuments({
              module: modId,
              limit: 10,
            });
            if (response.documents.length === 0) return null;
            return {
              moduleId: modId,
              name: modId,
              docs: response.documents.map((d: any) => {
                const t = d.type as string;
                const mappedType = t === 'reference' ? 'api' : t === 'pattern' ? 'pattern' : 'general';
                return {
                  title: d.title,
                  path: d.sourcePath,
                  content: d.content || d.summary || '',
                  type: mappedType as 'business-logic' | 'api' | 'pattern' | 'database' | 'general',
                };
              }),
            };
          } catch {
            return null;
          }
        }
      : undefined,

    // Spec content loader - direct filesystem via KnowledgeService
    getSpecContent: knowledgeService
      ? async (specId: string) => {
          try {
            const doc = await knowledgeService.getDocument(specId);
            if (!doc) return null;
            return {
              specId: doc.id,
              title: doc.title,
              content: doc.content || doc.summary || '',
              status: doc.status,
            };
          } catch {
            return null;
          }
        }
      : undefined,

    // Training context loader - from db
    getTrainingContext: db
      ? async (modId: string, role?: string, taskType?: string) => {
          try {
            return db.getTrainingContext(modId, workspacePath, role, taskType);
          } catch {
            return null;
          }
        }
      : undefined,
  };
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
