/**
 * Session Continuity MCP Tool Handlers
 *
 * Persist and restore session state across conversations.
 * State stored as JSON file in .claude/session-state.json
 *
 * Tools:
 * - session_save: Save current session state (decisions, blockers, files, context)
 * - session_restore: Restore saved session state
 */

import * as fs from 'fs';
import * as path from 'path';
import { detectWorkspace } from '@sidstack/shared';

// =============================================================================
// Tool Definitions
// =============================================================================

export const sessionStateTools = [
  {
    name: 'session_save',
    description:
      'Save current session state for continuity across conversations. Persists decisions made, blockers encountered, files modified, and custom notes. State is automatically restored on next session startup.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Project path (REQUIRED)',
        },
        taskId: {
          type: 'string',
          description: 'Active task ID',
        },
        decisions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Key decisions made during this session',
        },
        blockers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Blockers or open questions for next session',
        },
        filesModified: {
          type: 'array',
          items: { type: 'string' },
          description: 'Key files modified (not committed yet)',
        },
        context: {
          type: 'string',
          description: 'Free-form context notes for next session',
        },
        progress: {
          type: 'object',
          description: 'Progress summary: what was done, what remains',
          properties: {
            completed: {
              type: 'array',
              items: { type: 'string' },
              description: 'Steps completed',
            },
            remaining: {
              type: 'array',
              items: { type: 'string' },
              description: 'Steps remaining',
            },
          },
        },
      },
      required: ['projectPath'],
    },
  },
  {
    name: 'session_restore',
    description:
      'Restore saved session state from a previous conversation. Returns all saved decisions, blockers, files, and context. Use at session start to resume previous work.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Project path (REQUIRED)',
        },
      },
      required: ['projectPath'],
    },
  },
];

// =============================================================================
// Helpers
// =============================================================================

function resolveSessionFilePath(projectPath: string): string {
  const workspace = detectWorkspace(projectPath);
  const root = workspace ? workspace.workspaceRoot : projectPath;
  return path.join(root, '.claude', 'session-state.json');
}

interface SessionState {
  savedAt: string;
  taskId?: string;
  decisions?: string[];
  blockers?: string[];
  filesModified?: string[];
  context?: string;
  progress?: {
    completed?: string[];
    remaining?: string[];
  };
}

// =============================================================================
// Handlers
// =============================================================================

export async function handleSessionSave(args: {
  projectPath: string;
  taskId?: string;
  decisions?: string[];
  blockers?: string[];
  filesModified?: string[];
  context?: string;
  progress?: { completed?: string[]; remaining?: string[] };
}): Promise<Record<string, unknown>> {
  const filePath = resolveSessionFilePath(args.projectPath);

  const state: SessionState = {
    savedAt: new Date().toISOString(),
    taskId: args.taskId,
    decisions: args.decisions,
    blockers: args.blockers,
    filesModified: args.filesModified,
    context: args.context,
    progress: args.progress,
  };

  // Remove undefined fields
  const cleanState = JSON.parse(JSON.stringify(state));

  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(cleanState, null, 2), 'utf-8');

    return {
      success: true,
      savedTo: filePath,
      state: cleanState,
      hint: 'Session state saved. It will be auto-restored on next startup/resume.',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save session state',
    };
  }
}

export async function handleSessionRestore(args: {
  projectPath: string;
}): Promise<Record<string, unknown>> {
  const filePath = resolveSessionFilePath(args.projectPath);

  if (!fs.existsSync(filePath)) {
    return {
      success: true,
      hasState: false,
      message: 'No saved session state found. Starting fresh.',
    };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const state = JSON.parse(content) as SessionState;

    // Build human-readable summary
    const summaryParts: string[] = [];
    summaryParts.push(`Session saved at: ${state.savedAt}`);

    if (state.taskId) {
      summaryParts.push(`Active task: ${state.taskId}`);
    }
    if (state.decisions?.length) {
      summaryParts.push(`Decisions (${state.decisions.length}):`);
      state.decisions.forEach(d => summaryParts.push(`  - ${d}`));
    }
    if (state.blockers?.length) {
      summaryParts.push(`Blockers (${state.blockers.length}):`);
      state.blockers.forEach(b => summaryParts.push(`  - ${b}`));
    }
    if (state.filesModified?.length) {
      summaryParts.push(`Files modified: ${state.filesModified.join(', ')}`);
    }
    if (state.context) {
      summaryParts.push(`Context: ${state.context}`);
    }
    if (state.progress) {
      if (state.progress.completed?.length) {
        summaryParts.push(`Completed: ${state.progress.completed.join('; ')}`);
      }
      if (state.progress.remaining?.length) {
        summaryParts.push(`Remaining: ${state.progress.remaining.join('; ')}`);
      }
    }

    return {
      success: true,
      hasState: true,
      state,
      summary: summaryParts.join('\n'),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to restore session state',
    };
  }
}
