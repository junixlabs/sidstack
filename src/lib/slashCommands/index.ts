/**
 * Slash Command Registry
 *
 * Minimal local command registry.
 * Only app-specific commands are registered here.
 * All other commands are forwarded directly to Claude CLI.
 */


// App-specific commands only
import { clearCommand } from "./builtin/clear";
import { stopCommand } from "./builtin/stop";
import type {
  SlashCommand,
  CommandCategory,
  CommandSuggestion,
} from "./types";

/**
 * Known Claude CLI commands for autocomplete suggestions
 * These are NOT registered locally - they're forwarded to Claude CLI when executed
 */
const CLAUDE_CLI_COMMANDS: Array<{ name: string; description: string; category: CommandCategory }> = [
  // Session commands
  { name: "resume", description: "Resume a previous conversation", category: "session" },
  { name: "compact", description: "Compact conversation to reduce context", category: "session" },
  { name: "model", description: "Switch AI model", category: "session" },
  { name: "exit", description: "Exit current session", category: "session" },
  // Context commands
  { name: "context", description: "Show current context usage", category: "context" },
  { name: "cost", description: "Show token usage and cost", category: "context" },
  // Navigation commands
  { name: "help", description: "Show help and available commands", category: "navigation" },
  { name: "doctor", description: "Run diagnostics and health checks", category: "navigation" },
  { name: "init", description: "Initialize Claude in current directory", category: "navigation" },
  { name: "settings", description: "Open settings panel", category: "navigation" },
  { name: "permissions", description: "View or update tool permissions", category: "navigation" },
  { name: "vim", description: "Toggle vim mode", category: "navigation" },
  { name: "config", description: "View or edit configuration", category: "navigation" },
  // Memory commands
  { name: "memory", description: "View or manage memory", category: "navigation" },
  { name: "forget", description: "Clear memory", category: "navigation" },
  // MCP commands
  { name: "mcp", description: "MCP server management", category: "navigation" },
  // Other useful commands
  { name: "bug", description: "Report a bug", category: "navigation" },
  { name: "feedback", description: "Send feedback", category: "navigation" },
  { name: "terminal-setup", description: "Configure terminal settings", category: "navigation" },
  { name: "login", description: "Login to Claude", category: "navigation" },
  { name: "logout", description: "Logout from Claude", category: "navigation" },
  { name: "status", description: "Show current status", category: "navigation" },
  { name: "review", description: "Review code changes", category: "navigation" },
  { name: "pr-comments", description: "Show PR comments", category: "navigation" },
  { name: "add-dir", description: "Add directory to context", category: "context" },
  { name: "hooks", description: "Manage hooks", category: "navigation" },
  { name: "listen", description: "Listen for voice input", category: "navigation" },
  { name: "diff", description: "Show diff of changes", category: "context" },
  { name: "undo", description: "Undo last change", category: "session" },
  { name: "allowed-tools", description: "Show allowed tools", category: "navigation" },
  { name: "approve", description: "Approve pending action", category: "session" },
  { name: "reject", description: "Reject pending action", category: "session" },
];

/** Command storage */
const commands = new Map<string, SlashCommand>();

/** Alias to command name mapping */
const aliases = new Map<string, string>();

/**
 * Register a command
 */
export function registerCommand(command: SlashCommand): void {
  commands.set(command.name, command);

  // Register aliases
  if (command.aliases) {
    for (const alias of command.aliases) {
      aliases.set(alias, command.name);
    }
  }
}

/**
 * Unregister a command
 */
export function unregisterCommand(name: string): void {
  const command = commands.get(name);
  if (command) {
    // Remove aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        aliases.delete(alias);
      }
    }
    commands.delete(name);
  }
}

/**
 * Find a command by name or alias
 */
export function findCommand(nameOrAlias: string): SlashCommand | undefined {
  // Direct name lookup
  const command = commands.get(nameOrAlias);
  if (command) return command;

  // Alias lookup
  const realName = aliases.get(nameOrAlias);
  if (realName) {
    return commands.get(realName);
  }

  return undefined;
}

/**
 * Get all registered commands
 */
export function getAllCommands(): SlashCommand[] {
  return Array.from(commands.values());
}

/**
 * Get commands grouped by category
 */
export function getCommandsByCategory(): Map<CommandCategory, SlashCommand[]> {
  const result = new Map<CommandCategory, SlashCommand[]>();

  for (const command of commands.values()) {
    const category = command.category;
    const list = result.get(category) || [];
    list.push(command);
    result.set(category, list);
  }

  return result;
}

/**
 * Search commands by prefix (for autocomplete)
 * Includes both local app commands and known Claude CLI commands
 */
export function searchCommands(query: string): CommandSuggestion[] {
  const lowerQuery = query.toLowerCase();
  const results: CommandSuggestion[] = [];
  const addedNames = new Set<string>();

  // First, add local app commands
  for (const command of commands.values()) {
    // Match command name
    if (command.name.startsWith(lowerQuery)) {
      results.push({
        label: `/${command.name}`,
        value: `/${command.name}`,
        description: command.description,
        category: command.category,
      });
      addedNames.add(command.name);
      continue;
    }

    // Match aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        if (alias.startsWith(lowerQuery)) {
          results.push({
            label: `/${alias}`,
            value: `/${command.name}`,
            description: `${command.description} (alias for /${command.name})`,
            category: command.category,
          });
          addedNames.add(alias);
          break;
        }
      }
    }
  }

  // Then, add Claude CLI commands (if not already added as local)
  for (const cmd of CLAUDE_CLI_COMMANDS) {
    if (cmd.name.startsWith(lowerQuery) && !addedNames.has(cmd.name)) {
      results.push({
        label: `/${cmd.name}`,
        value: `/${cmd.name}`,
        description: cmd.description,
        category: cmd.category,
      });
      addedNames.add(cmd.name);
    }
  }

  // Sort by name
  results.sort((a, b) => a.label.localeCompare(b.label));

  return results;
}

/**
 * Get similar commands for "did you mean" suggestions
 * Includes both local and Claude CLI commands
 */
export function getSimilarCommands(
  name: string,
  maxResults: number = 3
): string[] {
  const similar: Array<{ name: string; distance: number }> = [];
  const checked = new Set<string>();

  // Check local commands
  for (const command of commands.values()) {
    const distance = levenshteinDistance(name, command.name);
    if (distance <= 3) {
      similar.push({ name: command.name, distance });
      checked.add(command.name);
    }
  }

  // Check Claude CLI commands
  for (const cmd of CLAUDE_CLI_COMMANDS) {
    if (!checked.has(cmd.name)) {
      const distance = levenshteinDistance(name, cmd.name);
      if (distance <= 3) {
        similar.push({ name: cmd.name, distance });
      }
    }
  }

  return similar
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxResults)
    .map((s) => s.name);
}

/**
 * Simple Levenshtein distance for typo detection
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Initialize registry with app-specific commands only
 * All other commands are forwarded to Claude CLI
 */
export function initializeBuiltinCommands(): void {
  // Clear existing (for re-initialization)
  commands.clear();
  aliases.clear();

  // Only register app-specific commands that control the UI/process
  // /clear - clears the app's terminal blocks UI
  // /stop - terminates the Claude process
  // All other slash commands are forwarded directly to Claude CLI
  registerCommand(clearCommand);
  registerCommand(stopCommand);
}

// Auto-initialize on import
initializeBuiltinCommands();

// Re-export types
export type { SlashCommand, CommandContext, CommandResult } from "./types";
