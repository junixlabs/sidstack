/**
 * Agent Desk v2 — Type Definitions
 *
 * Persistent dev machine model: desk created once, reused forever.
 * Status computed from git state (non-main branch or dirty = working).
 */

// ============================================================================
// Status & Session
// ============================================================================

/** Computed from git: on non-main branch or dirty working tree = 'working' */
export type DeskStatus = 'idle' | 'working';

/** Persisted in .sidstack-local/session.json */
export interface DeskSession {
  name: string;
  status: DeskStatus;
  branch: string;
  ports: DeskPorts;
  lastActivity: string;
  tags?: string[];
  bootstrapStatus?: 'pending' | 'running' | 'done' | 'failed';
  bootstrapError?: string;
}

// ============================================================================
// Ports
// ============================================================================

export interface DeskPorts {
  api: number;
  mcp: number;
  web: number;
  dev: number;
}

/** Base ports for each service */
export const PORT_BASES: Record<keyof DeskPorts, number> = {
  api: 3100,
  mcp: 3200,
  web: 3300,
  dev: 5100,
};

/** Port stride between desk indices */
export const PORT_STRIDE = 100;

// ============================================================================
// Git Status
// ============================================================================

export interface DeskGitStatus {
  branch: string;
  clean: boolean;
  staged: number;
  modified: number;
  untracked: number;
}

// ============================================================================
// Desk Info (composite)
// ============================================================================

export interface DeskInfo {
  name: string;
  path: string;
  status: DeskStatus;
  branch: string;
  ports: DeskPorts;
  lastActivity: string;
  git: DeskGitStatus;
  tags?: string[];
  bootstrapStatus?: 'pending' | 'running' | 'done' | 'failed';
  bootstrapError?: string;
}

// ============================================================================
// Health
// ============================================================================

export type HealthIssueType =
  | 'corrupted_session'
  | 'dirty_state'
  | 'stale_lock'
  | 'orphan_worktree'
  | 'missing_env'
  | 'file_overlap'
  | 'port_conflict';

export interface DeskHealthIssue {
  desk: string;
  type: HealthIssueType;
  message: string;
}

export interface DeskHealthReport {
  healthy: boolean;
  desks: number;
  issues: DeskHealthIssue[];
}

// ============================================================================
// Create Options
// ============================================================================

export interface DeskCreateOptions {
  baseBranch?: string;
  bootstrap?: string;
}

export interface DeskRemoveOptions {
  force?: boolean;
}

// ============================================================================
// Conflict Detection
// ============================================================================

export interface DeskFileConflict {
  file: string;        // relative file path
  desks: string[];     // desk names modifying this file
}

export interface DeskConflictReport {
  hasConflicts: boolean;
  conflicts: DeskFileConflict[];
}

// ============================================================================
// Lifecycle Hooks
// ============================================================================

export type DeskHookEvent = 'post-create' | 'pre-checkout' | 'post-checkout' | 'pre-remove';
export interface DeskHooksConfig {
  [event: string]: string | undefined;
}
