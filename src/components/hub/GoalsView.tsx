/**
 * Goals View - Capability-level goal-oriented presentation
 *
 * Shows: Goal -> Sub-goals (with progress) -> Score
 * Alternative view to the Detail panel's 7-section layout.
 */

import { useMemo } from 'react';
import { Target, Star, ShieldCheck, Link2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  CapabilityDefinition,
  CapabilityPurpose,
  CapabilityRequirement,
  EnrichedPurpose,
  EnrichedRequirement,
} from '@sidstack/shared';

// ============================================================================
// Score Calculation
// ============================================================================

export function calculateGoalScore(requirements?: CapabilityRequirement[]): number {
  if (!requirements || requirements.length === 0) return 0;

  let totalScore = 0;
  for (const req of requirements) {
    const enriched = normalizeRequirement(req);
    if (enriched.status === 'done') {
      totalScore += 100;
    } else if (enriched.completeness !== undefined) {
      totalScore += enriched.completeness;
    } else if (enriched.status === 'in-progress') {
      totalScore += 50;
    }
    // 'planned' or no status = 0
  }
  return Math.round(totalScore / requirements.length);
}

// ============================================================================
// GoalsView Component
// ============================================================================

export function GoalsView({ capability }: { capability: CapabilityDefinition }) {
  const purpose = normalizePurpose(capability.purpose);
  const score = useMemo(
    () => calculateGoalScore(capability.requirements),
    [capability.requirements],
  );

  return (
    <div className="space-y-5">
      {/* Goal */}
      <GoalSection purpose={purpose} />

      {/* Value Proposition */}
      <ValuePropositionSection purpose={purpose} />

      {/* Sub-goals Card */}
      <SubGoalsCard requirements={capability.requirements} score={score} />

      {/* Governance Guardrails (compact) */}
      {capability.businessRules && capability.businessRules.length > 0 && (
        <CompactRulesSection rules={capability.businessRules} />
      )}

      {/* Dependencies (compact) */}
      {capability.relationships?.dependsOn && capability.relationships.dependsOn.length > 0 && (
        <CompactDependenciesSection dependsOn={capability.relationships.dependsOn} />
      )}
    </div>
  );
}

// ============================================================================
// Goal Section
// ============================================================================

function GoalSection({ purpose }: { purpose: EnrichedPurpose }) {
  const goal = purpose.objective || purpose.description;

  return (
    <div className="border-t border-[var(--border-muted)] pt-3">
      <div className="flex items-center gap-2 mb-2">
        <Target size={12} className="text-[var(--text-muted)]" />
        <h3 className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
          Goal
        </h3>
      </div>
      {goal ? (
        <p className="text-sm text-[var(--text-primary)]">{goal}</p>
      ) : (
        <>
          <p className="text-xs text-[var(--text-muted)] italic">(not set)</p>
          <EnrichmentHint text="Add 'objective' to this capability's purpose in YAML to define the goal." />
        </>
      )}
    </div>
  );
}

// ============================================================================
// Value Proposition Section
// ============================================================================

function ValuePropositionSection({ purpose }: { purpose: EnrichedPurpose }) {
  return (
    <div className="border-t border-[var(--border-muted)] pt-3">
      <div className="flex items-center gap-2 mb-2">
        <Star size={12} className="text-[var(--text-muted)]" />
        <h3 className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
          Value Proposition
        </h3>
      </div>
      {purpose.valueProposition ? (
        <p className="text-xs text-[var(--text-primary)]">{purpose.valueProposition}</p>
      ) : (
        <>
          <p className="text-xs text-[var(--text-muted)] italic">(not set)</p>
          <EnrichmentHint text="Add 'valueProposition' to this capability's purpose in YAML to define the value delivered." />
        </>
      )}
    </div>
  );
}

// ============================================================================
// Sub-goals Card
// ============================================================================

function SubGoalsCard({
  requirements,
  score,
}: {
  requirements?: CapabilityRequirement[];
  score: number;
}) {
  if (!requirements || requirements.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-1)] p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
            Sub-goals
          </span>
          <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">0%</span>
        </div>
        <p className="text-[11px] text-[var(--text-muted)] italic">No requirements defined</p>
        <EnrichmentHint text="Add 'requirements' with 'status' and 'completeness' for goal tracking." />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-1)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-muted)]">
        <span className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
          Sub-goals
        </span>
        <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">{score}%</span>
      </div>

      {/* Progress Bar */}
      <div className="px-3 pt-2.5 pb-1">
        <GoalProgressBar score={score} />
      </div>

      {/* Sub-goal rows */}
      <div className="px-3 pb-3 space-y-1.5 mt-1">
        {requirements.map((req, i) => {
          const enriched = normalizeRequirement(req);
          return (
            <div key={i} className="flex items-start gap-2 text-xs">
              <RequirementStatusBadge status={enriched.status || 'planned'} />
              <span className="text-[var(--text-primary)] flex-1">{enriched.description}</span>
              {enriched.completeness !== undefined && (
                <span className="text-[11px] text-[var(--text-muted)] flex-shrink-0 tabular-nums">
                  {enriched.completeness}%
                </span>
              )}
              {enriched.completeness === undefined && enriched.status === 'done' && (
                <span className="text-[11px] text-[var(--text-muted)] flex-shrink-0 tabular-nums">100%</span>
              )}
              {enriched.completeness === undefined && enriched.status !== 'done' && (
                <span className="text-[11px] text-[var(--text-muted)] flex-shrink-0 tabular-nums">0%</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Compact Sections
// ============================================================================

function CompactRulesSection({ rules }: { rules: any[] }) {
  return (
    <div className="border-t border-[var(--border-muted)] pt-3">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck size={12} className="text-[var(--text-muted)]" />
        <h3 className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
          Governance Guardrails
        </h3>
        <span className="text-[11px] text-[var(--text-muted)]">({rules.length})</span>
      </div>
      <div className="text-[11px] text-[var(--text-secondary)] space-y-0.5">
        {rules.map((rule, i) => {
          const text = typeof rule === 'string' ? rule : rule.rule;
          return (
            <div key={i} className="flex gap-1.5">
              <span className="text-[var(--text-muted)] flex-shrink-0">&bull;</span>
              <span>{text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompactDependenciesSection({ dependsOn }: { dependsOn: string[] }) {
  return (
    <div className="border-t border-[var(--border-muted)] pt-3">
      <div className="flex items-center gap-2 mb-2">
        <Link2 size={12} className="text-[var(--text-muted)]" />
        <h3 className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
          Dependencies
        </h3>
      </div>
      <div className="flex items-start gap-2 text-xs">
        <span className="text-[11px] text-[var(--text-muted)] font-mono flex-shrink-0">depends_on</span>
        <span className="text-[var(--text-muted)]">&rarr;</span>
        <div className="flex flex-wrap gap-1">
          {dependsOn.map((id) => (
            <span key={id} className="text-[var(--accent-primary)]">{id}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Shared Components
// ============================================================================

function GoalProgressBar({ score, className }: { score: number; className?: string }) {
  return (
    <div className={cn('h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden', className)}>
      <div
        className={cn(
          'h-full rounded-full transition-all duration-300',
          score >= 80 ? 'bg-[var(--color-success)]' :
          score >= 50 ? 'bg-[var(--accent-primary)]' :
          score >= 20 ? 'bg-[var(--color-warning)]' :
          'bg-[var(--text-muted)]',
        )}
        style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
      />
    </div>
  );
}

function RequirementStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    done: { label: 'done', color: 'bg-[var(--color-success)]/20 text-[var(--color-success)]' },
    'in-progress': { label: 'prog', color: 'bg-[var(--color-info)]/20 text-[var(--color-info)]' },
    planned: { label: 'plan', color: 'bg-[var(--surface-3)] text-[var(--text-muted)]' },
  };
  const cfg = map[status] || { label: status, color: 'bg-[var(--surface-3)] text-[var(--text-muted)]' };
  return (
    <span className={cn('text-[11px] font-mono font-bold px-1 py-0.5 rounded flex-shrink-0', cfg.color)}>
      {cfg.label}
    </span>
  );
}

function EnrichmentHint({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-muted)] mt-2">
      <Info className="w-3.5 h-3.5 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
      <p className="text-[11px] text-[var(--text-muted)] italic">{text}</p>
    </div>
  );
}

// ============================================================================
// Type Normalizers
// ============================================================================

function normalizePurpose(purpose: CapabilityPurpose): EnrichedPurpose {
  if (typeof purpose === 'string') {
    return { description: purpose };
  }
  return purpose;
}

function normalizeRequirement(req: CapabilityRequirement): EnrichedRequirement {
  if (typeof req === 'string') {
    return { description: req };
  }
  return req;
}
