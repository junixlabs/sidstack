/**
 * Agent Desk v2 — MCP Tool Handlers
 *
 * Thin wrappers around DeskManager from @sidstack/shared.
 * 7 tools: desk_create, desk_list, desk_status, desk_checkout, desk_health, desk_conflicts, desk_remove
 */

import {
  detectWorkspace,
  DeskManager,
  DeskError,
} from '@sidstack/shared';

// =============================================================================
// Tool Definitions
// =============================================================================

export const agentDeskTools = [
  {
    name: 'desk_create',
    description:
      'Create a new agent desk (persistent git worktree). Use --bootstrap to run setup commands.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to any directory within the workspace (auto-resolves workspace root)',
        },
        name: {
          type: 'string',
          description: 'Desk name (e.g., "desk-1", "desk-review"). Alphanumeric, dash, underscore only.',
        },
        baseBranch: {
          type: 'string',
          description: 'Base branch to create desk from (default: "main")',
        },
        bootstrap: {
          type: 'string',
          description: 'Bootstrap command to run after creation (e.g., "pnpm install")',
        },
      },
      required: ['projectPath', 'name'],
    },
  },
  {
    name: 'desk_list',
    description:
      'List all agent desks in the workspace with status, branch, and port assignments.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to any directory within the workspace (auto-resolves workspace root)',
        },
      },
      required: ['projectPath'],
    },
  },
  {
    name: 'desk_status',
    description:
      'Get detailed status of a specific desk including git status and port assignments.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to any directory within the workspace',
        },
        name: {
          type: 'string',
          description: 'Desk name (e.g., "desk-1")',
        },
      },
      required: ['projectPath', 'name'],
    },
  },
  {
    name: 'desk_checkout',
    description:
      'Switch branch on a desk. Use --branch to checkout existing branch, --create to create new branch.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to any directory within the workspace',
        },
        name: {
          type: 'string',
          description: 'Desk name',
        },
        branch: {
          type: 'string',
          description: 'Existing branch to checkout',
        },
        create: {
          type: 'string',
          description: 'New branch name to create',
        },
        from: {
          type: 'string',
          description: 'Base branch when creating new branch (default: current branch)',
        },
      },
      required: ['projectPath', 'name'],
    },
  },
  {
    name: 'desk_health',
    description:
      'Run health checks on all desks. Detects corrupted sessions, dirty state, stale locks, orphan worktrees, and missing .env files.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to any directory within the workspace',
        },
      },
      required: ['projectPath'],
    },
  },
  {
    name: 'desk_conflicts',
    description:
      'Detect cross-desk file conflicts. Reports files modified by 2+ desks simultaneously.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to any directory within the workspace',
        },
      },
      required: ['projectPath'],
    },
  },
  {
    name: 'desk_remove',
    description:
      'Remove a desk (git worktree). Use force to remove even with uncommitted changes.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to any directory within the workspace',
        },
        name: {
          type: 'string',
          description: 'Desk name to remove',
        },
        force: {
          type: 'boolean',
          description: 'Force removal even with uncommitted changes (default: false)',
        },
      },
      required: ['projectPath', 'name'],
    },
  },
];

// =============================================================================
// Helpers
// =============================================================================

function resolveManager(projectPath: string): DeskManager {
  const info = detectWorkspace(projectPath);
  if (!info) {
    throw new Error(`Not inside a SidStack workspace: ${projectPath}`);
  }
  return new DeskManager(info.workspaceRoot);
}

// =============================================================================
// Handlers
// =============================================================================

export async function handleDeskCreate(args: {
  projectPath: string;
  name: string;
  baseBranch?: string;
  bootstrap?: string;
}): Promise<Record<string, unknown>> {
  const mgr = resolveManager(args.projectPath);
  const info = await mgr.create(args.name, {
    baseBranch: args.baseBranch,
    bootstrap: args.bootstrap,
  });
  return { success: true, desk: info };
}

export async function handleDeskList(args: {
  projectPath: string;
}): Promise<Record<string, unknown>> {
  const mgr = resolveManager(args.projectPath);
  const desks = mgr.list();
  return {
    success: true,
    desks,
    summary: {
      total: desks.length,
      idle: desks.filter(d => d.status === 'idle').length,
      working: desks.filter(d => d.status === 'working').length,
    },
  };
}

export async function handleDeskStatus(args: {
  projectPath: string;
  name: string;
}): Promise<Record<string, unknown>> {
  const mgr = resolveManager(args.projectPath);
  const info = mgr.status(args.name);
  return { success: true, desk: info };
}

export async function handleDeskCheckout(args: {
  projectPath: string;
  name: string;
  branch?: string;
  create?: string;
  from?: string;
}): Promise<Record<string, unknown>> {
  const mgr = resolveManager(args.projectPath);

  if (!args.branch && !args.create) {
    throw new Error('Either "branch" (existing) or "create" (new) is required');
  }

  let info;
  if (args.create) {
    info = mgr.checkoutCreate(args.name, args.create, args.from);
  } else {
    info = mgr.checkout(args.name, args.branch!);
  }

  return { success: true, desk: info };
}

export async function handleDeskHealth(args: {
  projectPath: string;
}): Promise<Record<string, unknown>> {
  const mgr = resolveManager(args.projectPath);
  const report = await mgr.health();
  return { success: true, ...report };
}

export async function handleDeskConflicts(args: {
  projectPath: string;
}): Promise<Record<string, unknown>> {
  const mgr = resolveManager(args.projectPath);
  const report = mgr.conflicts();
  return { success: true, ...report };
}

export async function handleDeskRemove(args: {
  projectPath: string;
  name: string;
  force?: boolean;
}): Promise<Record<string, unknown>> {
  const mgr = resolveManager(args.projectPath);
  await mgr.remove(args.name, { force: args.force });
  return { success: true, removed: args.name };
}
