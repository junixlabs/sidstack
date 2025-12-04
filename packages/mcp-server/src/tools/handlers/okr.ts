/**
 * OKR MCP Tool Handlers
 *
 * Tools for managing project OKRs:
 * - okr_list: Read current OKRs with progress summary
 * - okr_update: Update progress for one or more Key Results
 *
 * Data stored in .sidstack/project-okrs.json (filesystem, no DB).
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// =============================================================================
// Types
// =============================================================================

interface OKRKeyResult {
  id: string;
  title: string;
  target: string;
  progress: number;
}

interface OKRObjective {
  id: string;
  title: string;
  keyResults: OKRKeyResult[];
}

interface OKRQuarter {
  id: string;
  label: string;
  theme: string;
  period: string;
  objectives: OKRObjective[];
}

interface OKRData {
  year: number;
  title: string;
  description: string;
  quarters: OKRQuarter[];
}

// =============================================================================
// Tool Definitions
// =============================================================================

export const okrTools = [
  {
    name: 'okr_list',
    description:
      'List project OKRs with progress summary. Shows yearly overview, quarterly breakdown, objectives, and key results with current progress. Use this to review OKR status before updating.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the project directory',
        },
        quarter: {
          type: 'string',
          description: 'Filter by quarter ID (e.g. "Q1-2026"). Omit to show all quarters.',
        },
      },
      required: ['projectPath'],
    },
  },
  {
    name: 'okr_update',
    description:
      'Update progress for one or more Key Results. Provide an array of updates with KR ID and new progress (0-100). Use after completing features, milestones, or significant deliverables - not for every task/bug.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the project directory',
        },
        updates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              krId: {
                type: 'string',
                description: 'Key Result ID (e.g. "KR-1.1")',
              },
              progress: {
                type: 'number',
                description: 'New progress value (0-100)',
                minimum: 0,
                maximum: 100,
              },
            },
            required: ['krId', 'progress'],
          },
          description: 'Array of KR progress updates',
        },
        reason: {
          type: 'string',
          description: 'Brief reason for the update (e.g. "Shipped knowledge editor v1")',
        },
      },
      required: ['projectPath', 'updates'],
    },
  },
];

// =============================================================================
// Helpers
// =============================================================================

function getOkrPath(projectPath: string): string {
  return path.join(projectPath, '.sidstack', 'project-okrs.json');
}

async function readOkrs(projectPath: string): Promise<OKRData | null> {
  try {
    const content = await fs.readFile(getOkrPath(projectPath), 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function writeOkrs(projectPath: string, data: OKRData): Promise<void> {
  await fs.writeFile(getOkrPath(projectPath), JSON.stringify(data, null, 2), 'utf-8');
}

function computeProgress(krs: OKRKeyResult[]): number {
  if (krs.length === 0) return 0;
  return Math.round(krs.reduce((sum, kr) => sum + kr.progress, 0) / krs.length);
}

// =============================================================================
// Handlers
// =============================================================================

export async function handleOkrList(args: {
  projectPath: string;
  quarter?: string;
}): Promise<Record<string, unknown>> {
  const data = await readOkrs(args.projectPath);

  if (!data) {
    return {
      success: false,
      error: 'No OKRs found. Create .sidstack/project-okrs.json to define project goals.',
    };
  }

  const quarters = args.quarter
    ? data.quarters.filter((q) => q.id === args.quarter)
    : data.quarters;

  if (args.quarter && quarters.length === 0) {
    return {
      success: false,
      error: `Quarter "${args.quarter}" not found. Available: ${data.quarters.map((q) => q.id).join(', ')}`,
    };
  }

  const allKRs = quarters.flatMap((q) =>
    q.objectives.flatMap((obj) => obj.keyResults),
  );

  const quarterSummaries = quarters.map((q) => {
    const qKRs = q.objectives.flatMap((obj) => obj.keyResults);
    return {
      id: q.id,
      label: q.label,
      theme: q.theme,
      period: q.period,
      progress: computeProgress(qKRs),
      objectives: q.objectives.map((obj) => ({
        id: obj.id,
        title: obj.title,
        progress: computeProgress(obj.keyResults),
        keyResults: obj.keyResults.map((kr) => ({
          id: kr.id,
          title: kr.title,
          target: kr.target,
          progress: kr.progress,
        })),
      })),
    };
  });

  return {
    success: true,
    year: data.year,
    title: data.title,
    overallProgress: computeProgress(allKRs),
    totalKeyResults: allKRs.length,
    quarters: quarterSummaries,
  };
}

export async function handleOkrUpdate(args: {
  projectPath: string;
  updates: Array<{ krId: string; progress: number }>;
  reason?: string;
}): Promise<Record<string, unknown>> {
  const data = await readOkrs(args.projectPath);

  if (!data) {
    return {
      success: false,
      error: 'No OKRs found. Create .sidstack/project-okrs.json first.',
    };
  }

  // Build a lookup of all KRs for fast access
  const krMap = new Map<string, { kr: OKRKeyResult; objId: string; quarterId: string }>();
  for (const q of data.quarters) {
    for (const obj of q.objectives) {
      for (const kr of obj.keyResults) {
        krMap.set(kr.id, { kr, objId: obj.id, quarterId: q.id });
      }
    }
  }

  // Apply updates
  const applied: Array<{ krId: string; from: number; to: number; title: string }> = [];
  const notFound: string[] = [];

  for (const update of args.updates) {
    const entry = krMap.get(update.krId);
    if (!entry) {
      notFound.push(update.krId);
      continue;
    }

    const clampedProgress = Math.max(0, Math.min(100, Math.round(update.progress)));
    const oldProgress = entry.kr.progress;
    entry.kr.progress = clampedProgress;

    applied.push({
      krId: update.krId,
      from: oldProgress,
      to: clampedProgress,
      title: entry.kr.title,
    });
  }

  if (applied.length === 0) {
    return {
      success: false,
      error: `No valid KR IDs found. Not found: ${notFound.join(', ')}`,
      availableKRs: Array.from(krMap.keys()),
    };
  }

  // Write back
  await writeOkrs(args.projectPath, data);

  // Compute new overall progress
  const allKRs = data.quarters.flatMap((q) =>
    q.objectives.flatMap((obj) => obj.keyResults),
  );

  return {
    success: true,
    updated: applied,
    notFound: notFound.length > 0 ? notFound : undefined,
    reason: args.reason || undefined,
    overallProgress: computeProgress(allKRs),
  };
}
