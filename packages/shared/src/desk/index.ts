/**
 * Agent Desk v2 — Public API
 */

// Types
export type {
  DeskStatus,
  DeskSession,
  DeskPorts,
  DeskGitStatus,
  DeskInfo,
  DeskHealthIssue,
  DeskHealthReport,
  HealthIssueType,
  DeskCreateOptions,
  DeskRemoveOptions,
  DeskFileConflict,
  DeskConflictReport,
  DeskHookEvent,
  DeskHooksConfig,
} from './types.js';

export { PORT_BASES, PORT_STRIDE } from './types.js';

// Errors
export {
  DeskError,
  DeskNotFoundError,
  DeskAlreadyExistsError,
  DeskDirtyError,
  DeskGitError,
  BranchNotFoundError,
  BranchExistsError,
} from './errors.js';

// Manager
export { DeskManager } from './desk-manager.js';

// Context (optional, for explicit bootstrap)
export { bootstrapContext, cleanContext } from './desk-context.js';
