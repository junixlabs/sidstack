/**
 * Entity Context Builder (Project Intelligence Hub)
 *
 * Builds complete context for any SidStack entity by traversing
 * the Entity Reference Graph. Supports multiple output formats
 * and priority-based token budgeting.
 */

import type {
  EntityType,
  EntityReference,
  EntityReferenceRelationship,
} from './database';

import type { SidStackDB } from './database';

// ============================================================================
// Types
// ============================================================================

export type ContextFormat = 'claude' | 'json' | 'compact';

export type ContextSection =
  | 'capability'
  | 'knowledge'
  | 'impact'
  | 'governance'
  | 'history'
  | 'references';

export interface EntityContextOptions {
  entityType: EntityType;
  entityId: string;
  format?: ContextFormat;
  sections?: ContextSection[];
  maxTokens?: number;
  depth?: number;
}

export interface EntityContextResult {
  entity: EntitySummary;
  references: EntityReference[];
  related: {
    tasks: EntitySummary[];
    sessions: EntitySummary[];
    knowledge: EntitySummary[];
    impact: EntitySummary[];
    governance: { rules: EntitySummary[]; skills: EntitySummary[] };
    tickets: EntitySummary[];
    incidents: EntitySummary[];
    lessons: EntitySummary[];
  };
  formatted?: string; // Only for 'claude' format
  generatedAt: number;
}

export interface EntitySummary {
  type: EntityType;
  id: string;
  title: string;
  status?: string;
  relationship?: EntityReferenceRelationship;
  metadata?: Record<string, unknown>;
}

// Section priority for token budgeting (higher = more important)
const SECTION_PRIORITY: Record<ContextSection, number> = {
  capability: 6,
  knowledge: 5,
  governance: 4,
  impact: 3,
  history: 2,
  references: 1,
};

// ============================================================================
// Entity Loaders
// ============================================================================

function loadEntitySummary(
  db: SidStackDB,
  type: EntityType,
  id: string,
  relationship?: EntityReferenceRelationship,
): EntitySummary | null {
  switch (type) {
    case 'task': {
      const task = db.getTask(id);
      if (!task) return null;
      return { type, id, title: task.title, status: task.status, relationship };
    }
    case 'session': {
      const session = db.getClaudeSession(id);
      if (!session) return null;
      return {
        type, id,
        title: session.initialPrompt?.slice(0, 80) || `Session ${id.slice(0, 12)}`,
        status: session.status,
        relationship,
      };
    }
    case 'ticket': {
      const ticket = db.getTicket(id);
      if (!ticket) return null;
      return { type, id, title: ticket.title, status: ticket.status, relationship };
    }
    case 'incident': {
      const incident = db.getIncident(id);
      if (!incident) return null;
      return { type, id, title: incident.title, status: incident.status, relationship };
    }
    case 'lesson': {
      const lesson = db.getLesson(id);
      if (!lesson) return null;
      return { type, id, title: lesson.title, status: lesson.status, relationship };
    }
    case 'skill': {
      const skill = db.getSkill(id);
      if (!skill) return null;
      return { type, id, title: skill.name, status: skill.status, relationship };
    }
    case 'rule': {
      const rule = db.getRule(id);
      if (!rule) return null;
      return { type, id, title: rule.name, status: rule.status, relationship };
    }
    case 'impact': {
      const impact = db.getImpactAnalysis(id);
      if (!impact) return null;
      return { type, id, title: `Impact Analysis (${impact.changeType})`, status: impact.status, relationship };
    }
    case 'knowledge':
    case 'capability':
      // Knowledge and capabilities are file-based, return placeholder summary
      return { type, id, title: id, relationship };
    default:
      return null;
  }
}

// ============================================================================
// Context Builder Core
// ============================================================================

export function buildEntityContext(
  db: SidStackDB,
  options: EntityContextOptions,
): EntityContextResult {
  const { entityType, entityId, format = 'json', depth = 1 } = options;
  const sections = options.sections || ['knowledge', 'impact', 'governance', 'history', 'references'];

  // Load primary entity
  const entity = loadEntitySummary(db, entityType, entityId);
  if (!entity) {
    return {
      entity: { type: entityType, id: entityId, title: `Unknown ${entityType}` },
      references: [],
      related: emptyRelated(),
      generatedAt: Date.now(),
    };
  }

  // Get all references (with depth traversal)
  const references = depth > 1
    ? db.getRelatedEntities(entityType, entityId, depth)
    : db.queryEntityReferences({
        entityType,
        entityId,
        direction: 'both',
        limit: 200,
      });

  // Categorize references into related groups
  const related = categorizeReferences(db, references, entityType, entityId);

  // Load additional context based on entity type
  if (entityType === 'task') {
    enrichTaskContext(db, entityId, related);
  }

  const result: EntityContextResult = {
    entity,
    references,
    related,
    generatedAt: Date.now(),
  };

  // Format output
  if (format === 'claude') {
    result.formatted = formatClaudeContext(db, entity, related, references, sections, options.maxTokens);
  } else if (format === 'compact') {
    result.formatted = formatCompactContext(entity, related);
  }

  return result;
}

// ============================================================================
// Reference Categorization
// ============================================================================

function emptyRelated(): EntityContextResult['related'] {
  return {
    tasks: [],
    sessions: [],
    knowledge: [],
    impact: [],
    governance: { rules: [], skills: [] },
    tickets: [],
    incidents: [],
    lessons: [],
  };
}

function categorizeReferences(
  db: SidStackDB,
  references: EntityReference[],
  primaryType: EntityType,
  primaryId: string,
): EntityContextResult['related'] {
  const related = emptyRelated();
  const seen = new Set<string>();

  for (const ref of references) {
    // Determine the "other" entity (not the primary one)
    const isSource = ref.sourceType === primaryType && ref.sourceId === primaryId;
    const otherType = isSource ? ref.targetType : ref.sourceType;
    const otherId = isSource ? ref.targetId : ref.sourceId;
    const key = `${otherType}:${otherId}`;

    if (seen.has(key)) continue;
    seen.add(key);

    const summary = loadEntitySummary(db, otherType, otherId, ref.relationship);
    if (!summary) continue;

    switch (otherType) {
      case 'task':
        related.tasks.push(summary);
        break;
      case 'session':
        related.sessions.push(summary);
        break;
      case 'knowledge':
      case 'capability':
        related.knowledge.push(summary);
        break;
      case 'impact':
        related.impact.push(summary);
        break;
      case 'rule':
        related.governance.rules.push(summary);
        break;
      case 'skill':
        related.governance.skills.push(summary);
        break;
      case 'ticket':
        related.tickets.push(summary);
        break;
      case 'incident':
        related.incidents.push(summary);
        break;
      case 'lesson':
        related.lessons.push(summary);
        break;
    }
  }

  return related;
}

/**
 * Enrich task context with direct FK relationships that may not be
 * in entity_references yet (e.g., impact analysis by task ID).
 */
function enrichTaskContext(
  db: SidStackDB,
  taskId: string,
  related: EntityContextResult['related'],
): void {
  // Check for impact analysis directly by task FK
  if (related.impact.length === 0) {
    const impact = db.getImpactAnalysisByTask(taskId);
    if (impact) {
      related.impact.push({
        type: 'impact',
        id: impact.id,
        title: `Impact Analysis (${impact.changeType})`,
        status: impact.status,
      });
    }
  }
}

// ============================================================================
// Claude Format
// ============================================================================

function formatClaudeContext(
  db: SidStackDB,
  entity: EntitySummary,
  related: EntityContextResult['related'],
  references: EntityReference[],
  sections: ContextSection[],
  maxTokens?: number,
): string {
  const parts: Array<{ section: ContextSection; content: string; priority: number }> = [];

  // Entity header (always included)
  const header = formatEntityHeader(db, entity);

  // Build sections by priority
  if (sections.includes('knowledge') && related.knowledge.length > 0) {
    parts.push({
      section: 'knowledge',
      priority: SECTION_PRIORITY.knowledge,
      content: formatRelatedSection('Related Knowledge', related.knowledge),
    });
  }

  if (sections.includes('impact') && related.impact.length > 0) {
    const impactContent = formatImpactSection(db, related.impact);
    parts.push({
      section: 'impact',
      priority: SECTION_PRIORITY.impact,
      content: impactContent,
    });
  }

  if (sections.includes('governance')) {
    const govContent = formatGovernanceSection(db, related.governance);
    if (govContent) {
      parts.push({
        section: 'governance',
        priority: SECTION_PRIORITY.governance,
        content: govContent,
      });
    }
  }

  if (sections.includes('history') && related.sessions.length > 0) {
    parts.push({
      section: 'history',
      priority: SECTION_PRIORITY.history,
      content: formatRelatedSection('Session History', related.sessions),
    });
  }

  if (sections.includes('references') && references.length > 0) {
    parts.push({
      section: 'references',
      priority: SECTION_PRIORITY.references,
      content: formatReferencesSection(references),
    });
  }

  // Sort by priority (highest first)
  parts.sort((a, b) => b.priority - a.priority);

  // Apply token budget (rough estimate: 4 chars per token)
  const maxChars = maxTokens ? maxTokens * 4 : 32000;
  let totalChars = header.length;
  const includedParts: string[] = [header];

  for (const part of parts) {
    if (totalChars + part.content.length > maxChars) {
      // Truncate this section if it's partially fittable
      const remaining = maxChars - totalChars;
      if (remaining > 200) {
        includedParts.push(part.content.slice(0, remaining) + '\n...[truncated]');
      }
      break;
    }
    includedParts.push(part.content);
    totalChars += part.content.length;
  }

  return includedParts.join('\n\n---\n\n');
}

function formatEntityHeader(db: SidStackDB, entity: EntitySummary): string {
  const lines: string[] = [];
  lines.push(`# Entity Context: ${entity.title}`);
  lines.push(`**Type:** ${entity.type} | **ID:** ${entity.id}`);
  if (entity.status) lines.push(`**Status:** ${entity.status}`);

  // Add full entity details for known types
  if (entity.type === 'task') {
    const task = db.getTask(entity.id);
    if (task) {
      if (task.description) lines.push(`\n## Description\n${task.description}`);
      if (task.acceptanceCriteria) {
        try {
          const criteria = JSON.parse(task.acceptanceCriteria);
          if (Array.isArray(criteria) && criteria.length > 0) {
            lines.push('\n## Acceptance Criteria');
            criteria.forEach((c: { description: string; completed?: boolean }, i: number) => {
              lines.push(`${c.completed ? '[x]' : '[ ]'} ${i + 1}. ${c.description}`);
            });
          }
        } catch { /* ignore */ }
      }
    }
  }

  return lines.join('\n');
}

function formatRelatedSection(title: string, items: EntitySummary[]): string {
  const lines = [`## ${title}`];
  for (const item of items) {
    const rel = item.relationship ? ` (${item.relationship})` : '';
    const status = item.status ? ` [${item.status}]` : '';
    lines.push(`- **${item.type}:** ${item.title}${status}${rel}`);
  }
  return lines.join('\n');
}

function formatImpactSection(db: SidStackDB, impacts: EntitySummary[]): string {
  const lines = ['## Impact Analysis'];
  for (const imp of impacts) {
    const analysis = db.getImpactAnalysis(imp.id);
    if (!analysis) continue;
    lines.push(`**Status:** ${analysis.status} | **Change Type:** ${analysis.changeType}`);
    if (analysis.gateJson) {
      try {
        const gate = JSON.parse(analysis.gateJson);
        lines.push(`**Gate:** ${gate.status || 'unknown'}`);
        if (gate.blockers && gate.blockers.length > 0) {
          lines.push('**Blockers:**');
          gate.blockers.forEach((b: { description: string }) => {
            lines.push(`  - ${b.description}`);
          });
        }
      } catch { /* ignore */ }
    }
    if (analysis.risksJson) {
      try {
        const risks = JSON.parse(analysis.risksJson);
        if (Array.isArray(risks) && risks.length > 0) {
          lines.push('**Risks:**');
          risks.slice(0, 5).forEach((r: { severity: string; title?: string; description?: string }) => {
            lines.push(`  - [${r.severity}] ${r.title || r.description || 'Unknown risk'}`);
          });
        }
      } catch { /* ignore */ }
    }
  }
  return lines.join('\n');
}

function formatGovernanceSection(
  db: SidStackDB,
  governance: { rules: EntitySummary[]; skills: EntitySummary[] },
): string | null {
  if (governance.rules.length === 0 && governance.skills.length === 0) return null;

  const lines = ['## Governance'];

  if (governance.rules.length > 0) {
    lines.push('### Rules');
    for (const r of governance.rules) {
      const rule = db.getRule(r.id);
      if (!rule) continue;
      lines.push(`- **[${rule.level.toUpperCase()}]** ${rule.name}: ${rule.content.slice(0, 200)}`);
    }
  }

  if (governance.skills.length > 0) {
    lines.push('### Skills');
    for (const s of governance.skills) {
      const skill = db.getSkill(s.id);
      if (!skill) continue;
      lines.push(`- **${skill.name}** (${skill.type}): ${skill.description || skill.content.slice(0, 150)}`);
    }
  }

  return lines.join('\n');
}

function formatReferencesSection(references: EntityReference[]): string {
  const lines = ['## Entity References'];
  for (const ref of references.slice(0, 20)) {
    lines.push(`- ${ref.sourceType}:${ref.sourceId} --[${ref.relationship}]--> ${ref.targetType}:${ref.targetId}`);
  }
  if (references.length > 20) {
    lines.push(`... and ${references.length - 20} more references`);
  }
  return lines.join('\n');
}

// ============================================================================
// Compact Format
// ============================================================================

function formatCompactContext(
  entity: EntitySummary,
  related: EntityContextResult['related'],
): string {
  const counts: string[] = [];
  if (related.tasks.length > 0) counts.push(`${related.tasks.length} tasks`);
  if (related.sessions.length > 0) counts.push(`${related.sessions.length} sessions`);
  if (related.knowledge.length > 0) counts.push(`${related.knowledge.length} knowledge`);
  if (related.impact.length > 0) counts.push(`${related.impact.length} impact`);
  if (related.governance.rules.length > 0) counts.push(`${related.governance.rules.length} rules`);
  if (related.governance.skills.length > 0) counts.push(`${related.governance.skills.length} skills`);
  if (related.tickets.length > 0) counts.push(`${related.tickets.length} tickets`);
  if (related.incidents.length > 0) counts.push(`${related.incidents.length} incidents`);
  if (related.lessons.length > 0) counts.push(`${related.lessons.length} lessons`);

  return `${entity.type}:${entity.id} "${entity.title}" [${entity.status || 'unknown'}] | Connected: ${counts.join(', ') || 'none'}`;
}
