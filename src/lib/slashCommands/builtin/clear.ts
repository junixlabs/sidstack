/**
 * /clear command - Clear conversation blocks
 */

import type { SlashCommand, CommandContext, CommandResult } from "../types";

export const clearCommand: SlashCommand = {
  name: "clear",
  aliases: ["cls"],
  description: "Clear conversation history (keeps session active)",
  category: "session",

  async execute(ctx: CommandContext, _args: string): Promise<CommandResult> {
    ctx.clearBlocks();

    return {
      success: true,
      message: "Conversation cleared",
      action: "clear",
    };
  },
};
