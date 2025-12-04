/**
 * /stop command - Stop running Claude process
 */

import type { SlashCommand, CommandContext, CommandResult } from "../types";

export const stopCommand: SlashCommand = {
  name: "stop",
  aliases: ["cancel", "abort"],
  description: "Stop the current Claude process",
  category: "session",

  async execute(ctx: CommandContext, _args: string): Promise<CommandResult> {
    if (!ctx.isRunning) {
      ctx.addOutputBlock("No process running", "info");
      return {
        success: true,
        message: "No process running",
      };
    }

    try {
      await ctx.terminateSession();
      return {
        success: true,
        message: "Process stopped",
        action: "stop",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to stop process: ${error}`,
      };
    }
  },
};
