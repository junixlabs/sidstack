/**
 * Claude Session Manager Types
 *
 * Types and interfaces for tracking Claude Code sessions,
 * linking them to tasks/modules, and managing session lifecycle.
 */

import type { TerminalApp, LaunchMode, WindowMode } from './external-session';

// Re-export for convenience
export type { TerminalApp, LaunchMode, WindowMode };

// ============================================================================
// Session Types
// ============================================================================

export type SessionStatus = 'launching' | 'active' | 'completed' | 'error' | 'terminated';
export type SessionType = 'embedded' | 'external' | 'cli';
export type SessionEventType =
  | 'launched'
  | 'prompt_sent'
  | 'active'
  | 'error'
  | 'resumed'
  | 'completed'
  | 'terminated';

/**
 * Claude Code session record
 */
export interface ClaudeSession {
  id: string;
  workspacePath: string;

  // Linking
  taskId?: string;
  moduleId?: string;
  specId?: string;
  ticketId?: string;
  workSessionId?: string;

  // Launch info
  terminal: TerminalApp;
  launchMode: LaunchMode;
  initialPrompt?: string;

  // Process info
  pid?: number;
  terminalWindowId?: string;
  /** Claude's internal session ID (UUID from ~/.claude/projects/) */
  claudeSessionId?: string;

  // Status
  status: SessionStatus;
  startedAt: number;
  endedAt?: number;

  // Metadata
  claudeModel?: string;
  exitCode?: number;
  errorMessage?: string;

  // Resume
  canResume: boolean;
  resumeCount: number;
  lastResumeAt?: number;
  resumeContext?: string; // JSON: ResumeContext

  createdAt: number;
  updatedAt: number;
}

/**
 * Context preserved for resuming a session
 */
export interface ResumeContext {
  filesTouched: string[];
  lastActions: string[];
  taskProgress?: number;
  notes?: string;
  originalPrompt?: string;
}

/**
 * Session lifecycle event
 */
export interface SessionEvent {
  id: string;
  claudeSessionId: string;
  eventType: SessionEventType;
  timestamp: number;
  details?: string; // JSON
}

// ============================================================================
// Query Types
// ============================================================================

/**
 * Filters for querying sessions
 */
export interface SessionFilters {
  workspacePath?: string;
  taskId?: string;
  moduleId?: string;
  specId?: string;
  ticketId?: string;
  status?: SessionStatus | SessionStatus[];
  terminal?: TerminalApp;
  startedAfter?: number;
  startedBefore?: number;
  limit?: number;
  offset?: number;
}

/**
 * Session statistics
 */
export interface SessionStats {
  total: number;
  active: number;
  completed: number;
  error: number;
  terminated: number;
  totalDuration: number; // ms
  avgDuration: number; // ms
  byTerminal: Record<string, number>;
  byModule: Record<string, number>;
  byStatus: Record<SessionStatus, number>;
}

// ============================================================================
// Launch Types
// ============================================================================

/**
 * Options for launching and tracking a session
 */
export interface LaunchAndTrackOptions {
  projectDir: string;
  taskId?: string;
  moduleId?: string;
  specId?: string;
  ticketId?: string;
  prompt?: string;
  terminal?: TerminalApp;
  mode?: LaunchMode;
  trackSession?: boolean; // Default: true
  additionalFlags?: string[];
  /** Window mode: 'always-new' creates new window, 'per-project-tabs' reuses project window */
  windowMode?: WindowMode;
}

/**
 * Result of launching and tracking a session
 */
export interface LaunchAndTrackResult {
  success: boolean;
  sessionId?: string;
  workSessionId?: string;
  terminal: TerminalApp;
  command: string;
  pid?: number;
  terminalWindowId?: string;
  error?: string;
}

// ============================================================================
// Enhanced Work Session Types
// ============================================================================

/**
 * Enhanced work session with Claude session linking
 */
export interface EnhancedWorkSession {
  id: string;
  workspacePath: string;
  claudeSessionId?: string;
  sessionType: SessionType;
  moduleId?: string;
  taskIds?: string[]; // JSON array in DB
  startTime: number;
  endTime?: number;
  status: 'active' | 'completed' | 'interrupted';
  summary?: string;
  createdAt: number;
}

// ============================================================================
// Input Types
// ============================================================================

/**
 * Input for creating a new Claude session
 */
export interface CreateClaudeSessionInput {
  workspacePath: string;
  taskId?: string;
  moduleId?: string;
  specId?: string;
  ticketId?: string;
  terminal: TerminalApp;
  launchMode?: LaunchMode;
  initialPrompt?: string;
  pid?: number;
  terminalWindowId?: string;
  /** Claude's internal session ID (UUID from ~/.claude/projects/) */
  claudeSessionId?: string;
}

/**
 * Input for updating a Claude session
 */
export interface UpdateClaudeSessionInput {
  status?: SessionStatus;
  endedAt?: number;
  pid?: number;
  terminalWindowId?: string;
  claudeModel?: string;
  exitCode?: number;
  errorMessage?: string;
  canResume?: boolean;
  resumeContext?: ResumeContext;
  workSessionId?: string;
  // Linking updates
  taskId?: string;
  moduleId?: string;
  specId?: string;
  ticketId?: string;
}

/**
 * Input for logging a session event
 */
export interface LogSessionEventInput {
  claudeSessionId: string;
  eventType: SessionEventType;
  details?: Record<string, unknown>;
}
