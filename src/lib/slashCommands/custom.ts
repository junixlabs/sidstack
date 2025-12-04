/**
 * Custom Commands Loader
 *
 * Load user-defined slash commands from:
 * - Project: {workingDir}/.claude/commands/*.md
 * - User: ~/.claude/commands/*.md
 *
 * Project commands override user commands with same name.
 */

import { invoke } from "@tauri-apps/api/core";

import type { CommandContext, CommandResult, CustomCommand } from "./types";

import { registerCommand, unregisterCommand } from "./index";

/** Loaded custom commands */
const customCommands = new Map<string, CustomCommand>();

/**
 * Parse frontmatter from markdown file
 */
function parseFrontmatter(content: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const frontmatter: Record<string, string> = {};
  const lines = match[1].split("\n");

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body: match[2] };
}

/**
 * Create a SlashCommand from custom command file
 */
function createCustomCommand(
  name: string,
  content: string,
  sourcePath: string,
  source: "project" | "user"
): CustomCommand {
  const { frontmatter, body } = parseFrontmatter(content);

  const command: CustomCommand = {
    name,
    description: frontmatter.description || `Custom command from ${source}`,
    argHint: frontmatter["argument-hint"],
    category: "custom",
    sourcePath,
    source,
    content: body,
    allowedTools: frontmatter["allowed-tools"]?.split(",").map((s) => s.trim()),

    async execute(ctx: CommandContext, args: string): Promise<CommandResult> {
      // Replace $ARGUMENTS placeholder
      let prompt = body.replace(/\$ARGUMENTS/g, args);

      // Replace $1, $2, etc. with positional args
      const argParts = args.split(/\s+/).filter(Boolean);
      for (let i = 0; i < argParts.length; i++) {
        prompt = prompt.replace(new RegExp(`\\$${i + 1}`, "g"), argParts[i]);
      }

      // Send to Claude
      if (!ctx.sessionId) {
        ctx.addOutputBlock(
          "No active session. Start a conversation first.",
          "error"
        );
        return {
          success: false,
          message: "No active session",
        };
      }

      try {
        await ctx.sendInput(prompt);
        return {
          success: true,
          action: "send",
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to execute custom command: ${error}`,
        };
      }
    },
  };

  return command;
}

/**
 * Load custom commands from a directory
 */
async function loadCommandsFromDir(
  dir: string,
  source: "project" | "user"
): Promise<CustomCommand[]> {
  try {
    const files = await invoke<Array<{ name: string; content: string }>>(
      "list_custom_commands",
      { dir }
    );

    const commands: CustomCommand[] = [];

    for (const file of files) {
      // Extract command name from filename (without .md)
      const name = file.name.replace(/\.md$/, "").toLowerCase();

      // Skip if name is invalid
      if (!name || name.includes("/")) {
        console.warn(`[custom] Skipping invalid command name: ${file.name}`);
        continue;
      }

      const command = createCustomCommand(
        name,
        file.content,
        `${dir}/${file.name}`,
        source
      );
      commands.push(command);
    }

    return commands;
  } catch (error) {
    // Directory might not exist - that's okay
    console.debug(`[custom] No commands in ${dir}:`, error);
    return [];
  }
}

/**
 * Load all custom commands for a working directory
 */
export async function loadCustomCommands(workingDir: string): Promise<void> {
  // Unregister existing custom commands
  for (const [name] of customCommands) {
    unregisterCommand(name);
  }
  customCommands.clear();

  // Load user commands first (lower priority)
  const homeDir = await invoke<string>("get_home_dir");
  const userCommands = await loadCommandsFromDir(
    `${homeDir}/.claude/commands`,
    "user"
  );

  for (const cmd of userCommands) {
    customCommands.set(cmd.name, cmd);
  }

  // Load project commands (higher priority - will override user)
  const projectCommands = await loadCommandsFromDir(
    `${workingDir}/.claude/commands`,
    "project"
  );

  for (const cmd of projectCommands) {
    customCommands.set(cmd.name, cmd);
  }

  // Register all commands
  for (const [, cmd] of customCommands) {
    registerCommand(cmd);
  }

  console.log(
    `[custom] Loaded ${customCommands.size} custom commands (${userCommands.length} user, ${projectCommands.length} project)`
  );
}

/**
 * Get all loaded custom commands
 */
export function getCustomCommands(): CustomCommand[] {
  return Array.from(customCommands.values());
}

/**
 * Check if a command is custom
 */
export function isCustomCommand(name: string): boolean {
  return customCommands.has(name);
}
