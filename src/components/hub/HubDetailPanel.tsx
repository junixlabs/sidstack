/**
 * Hub Detail Panel - Capability Detail
 *
 * Shows all 4 professional concepts for the selected capability:
 * 1. Goal Tree (Purpose): objective, value proposition, description
 * 2. Bounded Context (Business Rules): rules with rationale + enforcement
 * 3. Bounded Context (Glossary): term-definition pairs
 * 4. Feature Registry (Requirements): status-tagged with criteria + completeness
 * 5. Capability Map (Relationships): enables/dependsOn/feedsInto
 * 6. Status: maturity, tags, owner, modules
 */

import {
  Target,
  ShieldCheck,
  BookOpen,
  CheckSquare,
  Link2,
  Tag,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectHubStore } from '@/stores/projectHubStore';
import type { HubViewMode } from '@/stores/projectHubStore';
import { CapabilityActions } from './CapabilityActions';
import { LinkedWorkSection } from './LinkedWorkSection';
import { GoalsView } from './GoalsView';
import { ProjectGoalsOverview } from './ProjectGoalsOverview';
import { ProjectOverview } from './ProjectOverview';
import { LevelBadge, StatusBadge, MaturityBadge } from './ui/badges';
import type {
  CapabilityDefinition,
  CapabilityPurpose,
  CapabilityBusinessRule,
  CapabilityRequirement,
  EnrichedPurpose,
  EnrichedBusinessRule,
  EnrichedRequirement,
} from '@sidstack/shared';

export function HubDetailPanel() {
  const selectedCapability = useProjectHubStore((s) => s.selectedCapability);
  const viewMode = useProjectHubStore((s) => s.viewMode);

  if (!selectedCapability) {
    if (viewMode === 'goals') {
      return <ProjectGoalsOverview />;
    }
    return <ProjectOverview />;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-5">
        <CapabilityHeader cap={selectedCapability} />
        {viewMode === 'goals' ? (
          <GoalsView capability={selectedCapability} />
        ) : (
          <>
            <PurposeSection purpose={selectedCapability.purpose} />
            <BusinessRulesSection rules={selectedCapability.businessRules} />
            <GlossarySection glossary={selectedCapability.glossary} />
            <RequirementsSection requirements={selectedCapability.requirements} />
            <RelationshipsSection relationships={selectedCapability.relationships} />
            <StatusSection cap={selectedCapability} />
            <LinkedWorkSection />
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Header
// ============================================================================

function CapabilityHeader({ cap }: { cap: CapabilityDefinition }) {
  const viewMode = useProjectHubStore((s) => s.viewMode);
  const setViewMode = useProjectHubStore((s) => s.setViewMode);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <LevelBadge level={cap.level} />
        <StatusBadge status={cap.status} />
        <MaturityBadge maturity={cap.maturity} />
        <div className="ml-auto">
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </div>
      <h2 className="text-base font-medium text-[var(--text-primary)]">{cap.name}</h2>
      <div className="flex items-center gap-2 mt-1">
        <p className="text-[10px] text-[var(--text-muted)] font-mono">{cap.id}</p>
        <div className="ml-auto">
          <CapabilityActions capability={cap} />
        </div>
      </div>
    </div>
  );
}

function ViewModeToggle({ mode, onChange }: { mode: HubViewMode; onChange: (m: HubViewMode) => void }) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 bg-[var(--surface-2)] rounded-md">
      <button
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all',
          mode === 'detail'
            ? 'bg-[var(--surface-0)] text-[var(--text-primary)] shadow-sm'
            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
        )}
        onClick={() => onChange('detail')}
      >
        <List className="w-3 h-3" />
        Detail
      </button>
      <button
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all',
          mode === 'goals'
            ? 'bg-[var(--surface-0)] text-[var(--text-primary)] shadow-sm'
            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
        )}
        onClick={() => onChange('goals')}
      >
        <Target className="w-3 h-3" />
        Goals
      </button>
    </div>
  );
}

// ============================================================================
// Section 1: Purpose (Goal Tree)
// ============================================================================

function PurposeSection({ purpose }: { purpose: CapabilityPurpose }) {
  if (!purpose) return null;

  const enriched = normalizePurpose(purpose);

  return (
    <Section title="Purpose" icon={Target} concept="Goal Tree">
      {enriched.objective && (
        <div className="mb-2">
          <label className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
            Objective
          </label>
          <p className="text-xs text-[var(--text-primary)] mt-0.5">{enriched.objective}</p>
        </div>
      )}
      {enriched.valueProposition && (
        <div className="mb-2">
          <label className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
            Value Proposition
          </label>
          <p className="text-xs text-[var(--text-primary)] mt-0.5">{enriched.valueProposition}</p>
        </div>
      )}
      <div>
        <label className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
          Description
        </label>
        <p className="text-xs text-[var(--text-primary)] mt-0.5">{enriched.description}</p>
      </div>
    </Section>
  );
}

// ============================================================================
// Section 2: Business Rules (Bounded Context)
// ============================================================================

function BusinessRulesSection({ rules }: { rules?: CapabilityBusinessRule[] }) {
  if (!rules || rules.length === 0) return null;

  return (
    <Section title="Business Rules" icon={ShieldCheck} count={rules.length} concept="Bounded Context">
      <ol className="space-y-2">
        {rules.map((rule, i) => {
          const enriched = normalizeBusinessRule(rule);
          return (
            <li key={i} className="text-xs">
              <p className="text-[var(--text-primary)]">
                <span className="text-[var(--text-muted)] mr-1">{i + 1}.</span>
                {enriched.rule}
              </p>
              {enriched.rationale && (
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5 ml-4">
                  Rationale: {enriched.rationale}
                </p>
              )}
              {enriched.enforcement && (
                <span className={cn(
                  'inline-block text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 ml-4',
                  enforcementColor(enriched.enforcement),
                )}>
                  {enriched.enforcement}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

// ============================================================================
// Section 3: Glossary (Bounded Context)
// ============================================================================

function GlossarySection({ glossary }: { glossary?: { term: string; definition: string }[] }) {
  if (!glossary || glossary.length === 0) return null;

  return (
    <Section title="Glossary" icon={BookOpen} count={glossary.length} concept="Bounded Context">
      <dl className="space-y-1.5">
        {glossary.map((g, i) => (
          <div key={i}>
            <dt className="text-xs font-medium text-[var(--text-primary)]">{g.term}</dt>
            <dd className="text-[11px] text-[var(--text-secondary)] ml-3">{g.definition}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

// ============================================================================
// Section 4: Requirements (Feature Registry)
// ============================================================================

function RequirementsSection({ requirements }: { requirements?: CapabilityRequirement[] }) {
  if (!requirements || requirements.length === 0) return null;

  return (
    <Section title="Requirements" icon={CheckSquare} count={requirements.length} concept="Feature Registry">
      <div className="space-y-2">
        {requirements.map((req, i) => {
          const enriched = normalizeRequirement(req);
          return (
            <div key={i} className="text-xs">
              <div className="flex items-start gap-2">
                {enriched.status && <RequirementStatusBadge status={enriched.status} />}
                <span className="text-[var(--text-primary)] flex-1">{enriched.description}</span>
                {enriched.completeness !== undefined && enriched.completeness > 0 && (
                  <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">
                    {enriched.completeness}%
                  </span>
                )}
              </div>
              {enriched.acceptanceCriteria && enriched.acceptanceCriteria.length > 0 && (
                <div className="ml-7 mt-0.5 text-[10px] text-[var(--text-muted)]">
                  {enriched.acceptanceCriteria.join(', ')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ============================================================================
// Section 5: Relationships (Capability Map)
// ============================================================================

function RelationshipsSection({ relationships }: { relationships?: CapabilityDefinition['relationships'] }) {
  if (!relationships) return null;
  const { enables, dependsOn, feedsInto } = relationships;
  if (!enables?.length && !dependsOn?.length && !feedsInto?.length) return null;

  const { selectCapability } = useProjectHubStore();

  return (
    <Section title="Relationships" icon={Link2} concept="Capability Map">
      <div className="space-y-1.5 text-xs">
        <RelationshipGroup label="enables" ids={enables} onSelect={selectCapability} />
        <RelationshipGroup label="depends_on" ids={dependsOn} onSelect={selectCapability} />
        <RelationshipGroup label="feeds_into" ids={feedsInto} onSelect={selectCapability} />
      </div>
    </Section>
  );
}

function RelationshipGroup({
  label,
  ids,
  onSelect,
}: {
  label: string;
  ids?: string[];
  onSelect: (id: string) => void;
}) {
  if (!ids || ids.length === 0) return null;

  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] text-[var(--text-muted)] w-20 flex-shrink-0 text-right font-mono">
        {label}
      </span>
      <span className="text-[var(--text-muted)]">{'->'}</span>
      <div className="flex flex-wrap gap-1">
        {ids.map((id) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className="text-[var(--accent-primary)] hover:underline cursor-pointer"
          >
            {id}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Section 6: Status
// ============================================================================

function StatusSection({ cap }: { cap: CapabilityDefinition }) {
  const hasTags = cap.tags && cap.tags.length > 0;
  const hasModules = cap.modules && cap.modules.length > 0;
  if (!hasTags && !hasModules && !cap.owner) return null;

  return (
    <Section title="Status" icon={Tag}>
      <div className="space-y-1.5 text-xs">
        {cap.owner && (
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] w-16">Owner</span>
            <span className="text-[var(--text-primary)]">{cap.owner}</span>
          </div>
        )}
        {hasTags && (
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] w-16">Tags</span>
            <div className="flex flex-wrap gap-1">
              {cap.tags!.map((tag) => (
                <span key={tag} className="text-[10px] bg-[var(--surface-2)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
        {hasModules && (
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] w-16">Modules</span>
            <div className="flex flex-wrap gap-1">
              {cap.modules!.map((mod) => (
                <span key={mod} className="text-[10px] bg-[var(--surface-2)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded font-mono">
                  {mod}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

// ============================================================================
// Section Wrapper
// ============================================================================

function Section({
  title,
  icon: Icon,
  count,
  concept,
  children,
}: {
  title: string;
  icon: React.ElementType;
  count?: number;
  concept?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-[var(--border-muted)] pt-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={12} className="text-[var(--text-muted)]" />
        <h3 className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
          {title}
        </h3>
        {count !== undefined && (
          <span className="text-[11px] text-[var(--text-muted)]">({count})</span>
        )}
        {concept && (
          <span className="text-[10px] text-[var(--text-muted)] ml-auto">
            {concept}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// Badges (local only)
// ============================================================================

function RequirementStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    done: { label: 'done', color: 'bg-[var(--color-success)]/20 text-[var(--color-success)]' },
    'in-progress': { label: 'prog', color: 'bg-[var(--color-info)]/20 text-[var(--color-info)]' },
    planned: { label: 'plan', color: 'bg-[var(--surface-3)] text-[var(--text-muted)]' },
  };
  const cfg = map[status] || { label: status, color: 'bg-[var(--surface-3)] text-[var(--text-muted)]' };
  return (
    <span className={cn('text-[10px] font-mono font-bold px-1 py-0.5 rounded flex-shrink-0', cfg.color)}>
      {cfg.label}
    </span>
  );
}

function enforcementColor(enforcement: string): string {
  const map: Record<string, string> = {
    automated: 'bg-[var(--color-info)]/20 text-[var(--color-info)]',
    manual: 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]',
    governance: 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]',
  };
  return map[enforcement] || 'bg-[var(--surface-3)] text-[var(--text-muted)]';
}

// ============================================================================
// Type Normalizers (handle union types: string | enriched object)
// ============================================================================

function normalizePurpose(purpose: CapabilityPurpose): EnrichedPurpose {
  if (typeof purpose === 'string') {
    return { description: purpose };
  }
  return purpose;
}

function normalizeBusinessRule(rule: CapabilityBusinessRule): EnrichedBusinessRule {
  if (typeof rule === 'string') {
    return { rule };
  }
  return rule;
}

function normalizeRequirement(req: CapabilityRequirement): EnrichedRequirement {
  if (typeof req === 'string') {
    return { description: req };
  }
  return req;
}
