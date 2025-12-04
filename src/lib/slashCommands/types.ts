/**
 * Slash Commands Type Definitions
 */

/**
 * Command categories for help grouping
 */
export type CommandCategory = "session" | "context" | "navigation" | "custom";

/**
 * Slash command definition
 */
export interface SlashCommand {
  /** Command name (without /) */
  name: string;
  /** Optional aliases */
  aliases?: string[];
  /** Short description for help listing */
  description: string;
  /** Argument hint for autocomplete (e.g., "[topic]") */
  argHint?: string;
  /** Category for grouping in help */
  category: CommandCategory;
  /** Execute the command */
  execute: (ctx: CommandContext, args: string) => Promise<CommandResult>;
}

/**
 * Context passed to command execution
 */
export interface CommandContext {
  /** Terminal ID */
  terminalId: string;
  /** Claude session ID (null if no active session) */
  sessionId: string | null;
  /** Working directory path */
  workingDir: string;
  /** Agent role (frontend, backend, orchestrator, etc.) */
  role: string;
  /** Whether Claude is currently running */
  isRunning: boolean;

  // Terminal actions
  /** Clear all conversation blocks */
  clearBlocks: () => void;
  /** Send input to Claude */
  sendInput: (input: string) => Promise<void>;
  /** Terminate current Claude session */
  terminateSession: () => Promise<void>;
  /** Add output block to conversation */
  addOutputBlock: (content: string, type?: "info" | "error" | "success") => void;

  // UI controls
  /** Show toast notification */
  showNotification: (msg: string, type: "info" | "error" | "success") => void;
  /** Open a panel (settings, etc.) */
  openPanel: (panel: string) => void;

  // Command registry access (for /help)
  /** Get all registered commands */
  getAllCommands: () => SlashCommand[];
}

/**
 * Result of command execution
 */
export interface CommandResult {
  /** Whether command succeeded */
  success: boolean;
  /** Optional message to display */
  message?: string;
  /** Action to perform after command */
  action?: CommandAction;
  /** Additional data */
  data?: unknown;
}

/**
 * Actions that can be triggered by command results
 */
export type CommandAction =
  | "clear" // Clear conversation blocks
  | "stop" // Stop Claude process
  | "output" // Display output in terminal
  | "navigate" // Navigate to panel/view
  | "send"; // Send prompt to Claude

/**
 * Suggestion for autocomplete
 */
export interface CommandSuggestion {
  /** Display text */
  label: string;
  /** Value to insert */
  value: string;
  /** Description */
  description?: string;
  /** Icon or category indicator */
  category?: CommandCategory;
}

/**
 * Custom command from .claude/commands/*.md
 */
export interface CustomCommand extends SlashCommand {
  /** Source file path */
  sourcePath: string;
  /** Whether from project or user dir */
  source: "project" | "user";
  /** Raw markdown content */
  content: string;
  /** Allowed tools (from frontmatter) */
  allowedTools?: string[];
}
