/**
 * useSlashCommands Hook
 *
 * Provides slash command execution for agent terminal.
 * Handles command parsing, execution, and result handling.
 */

import { useCallback, useMemo } from "react";

import {
  parseInput,
  type ParsedCommand,
  type ParsedBash,
  type ParsedPrompt,
} from "@/lib/commandParser";
import {
  findCommand,
  getAllCommands,
  getSimilarCommands,
  searchCommands,
} from "@/lib/slashCommands";
import type { CommandContext, CommandResult, SlashCommand } from "@/lib/slashCommands/types";

export interface UseSlashCommandsOptions {
  terminalId: string;
  sessionId: string | null;
  workingDir: string;
  role: string;
  isRunning: boolean;
  // Terminal actions
  clearBlocks: () => void;
  sendInput: (input: string) => Promise<void>;
  terminateSession: () => Promise<void>;
  addOutputBlock: (content: string, type?: "info" | "error" | "success") => void;
  // UI controls
  showNotification: (msg: string, type: "info" | "error" | "success") => void;
  openPanel: (panel: string) => void;
}

export interface UseSlashCommandsResult {
  /** Parse and handle input (command, bash, or prompt) */
  handleInput: (input: string) => Promise<{
    handled: boolean;
    result?: CommandResult;
    parsed: ParsedCommand | ParsedBash | ParsedPrompt;
  }>;
  /** Execute a specific command by name */
  executeCommand: (name: string, args?: string) => Promise<CommandResult>;
  /** Get command suggestions for autocomplete */
  getCommandSuggestions: (query: string) => ReturnType<typeof searchCommands>;
  /** Get all available commands */
  getAllCommands: () => SlashCommand[];
  /** Find a command by name or alias */
  findCommand: (name: string) => SlashCommand | undefined;
}

export function useSlashCommands(
  options: UseSlashCommandsOptions
): UseSlashCommandsResult {
  const {
    terminalId,
    sessionId,
    workingDir,
    role,
    isRunning,
    clearBlocks,
    sendInput,
    terminateSession,
    addOutputBlock,
    showNotification,
    openPanel,
  } = options;

  // Build command context
  const context: CommandContext = useMemo(
    () => ({
      terminalId,
      sessionId,
      workingDir,
      role,
      isRunning,
      clearBlocks,
      sendInput,
      terminateSession,
      addOutputBlock,
      showNotification,
      openPanel,
      getAllCommands,
    }),
    [
      terminalId,
      sessionId,
      workingDir,
      role,
      isRunning,
      clearBlocks,
      sendInput,
      terminateSession,
      addOutputBlock,
      showNotification,
      openPanel,
    ]
  );

  // Execute a command by name
  const executeCommand = useCallback(
    async (name: string, args: string = ""): Promise<CommandResult> => {
      const command = findCommand(name);

      if (!command) {
        // Command not found in local registry - forward to Claude CLI
        // This ensures we support all Claude Code commands including future updates
        const fullCommand = args ? `/${name} ${args}` : `/${name}`;

        console.log(`[SlashCommands] Forwarding unknown command to Claude: ${fullCommand}`);

        try {
          // Forward the command to Claude CLI process
          await sendInput(fullCommand);

          return {
            success: true,
            message: `Forwarded to Claude: ${fullCommand}`,
          };
        } catch (error) {
          // If forwarding fails, show suggestions
          const similar = getSimilarCommands(name);
          const suggestion =
            similar.length > 0
              ? `\n\nDid you mean: ${similar.map((s) => "/" + s).join(", ")}?`
              : "\n\nThis command will be forwarded to Claude CLI.";

          addOutputBlock(
            `Command "/${name}" not found locally. Failed to forward to Claude.\n${error}${suggestion}`,
            "error"
          );

          return {
            success: false,
            message: `Failed to forward command: ${name}`,
          };
        }
      }

      try {
        const result = await command.execute(context, args);

        // Handle result message
        if (result.message && !result.success) {
          showNotification(result.message, "error");
        }

        return result;
      } catch (error) {
        const message = `Command error: ${error}`;
        addOutputBlock(message, "error");

        return {
          success: false,
          message,
        };
      }
    },
    [context, addOutputBlock, showNotification, sendInput]
  );

  // Handle input (parse and execute if command)
  const handleInput = useCallback(
    async (input: string) => {
      const parsed = parseInput(input);

      // Handle slash command
      if (parsed.type === "command") {
        const result = await executeCommand(parsed.name, parsed.args);
        return {
          handled: true,
          result,
          parsed,
        };
      }

      // Bash and prompt are not handled here - return to caller
      return {
        handled: false,
        parsed,
      };
    },
    [executeCommand]
  );

  // Get suggestions for autocomplete
  const getCommandSuggestions = useCallback((query: string) => {
    return searchCommands(query);
  }, []);

  return {
    handleInput,
    executeCommand,
    getCommandSuggestions,
    getAllCommands,
    findCommand,
  };
}
