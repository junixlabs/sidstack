/**
 * Block parser for terminal output
 * Parses raw terminal output into structured blocks for the block-based view
 */

export type BlockType =
  | "user"
  | "assistant"
  | "tool"
  | "groupchat"
  | "error"
  | "system";

export type BlockStatus = "pending" | "streaming" | "complete" | "error";

export interface TerminalBlock {
  id: string;
  type: BlockType;
  role?: string; // Agent role for groupchat blocks
  content: string;
  timestamp: number;
  collapsed?: boolean;
  status?: BlockStatus;
  toolName?: string; // For tool blocks
}

// Patterns for detecting block types
const PATTERNS = {
  // [GroupChat @orchestrator]: message
  groupchat: /^\[GroupChat @([\w-]+)\]:\s*/,
  // Claude's response markers
  claudeStart: /^(Claude|Assistant):/i,
  // Tool execution markers
  toolStart: /^\[(Tool|Read|Write|Edit|Bash|Glob|Grep|Task|WebFetch|WebSearch):\s*([^\]]*)\]/i,
  toolEnd: /^(───|─{3,}|Result:|Output:)/,
  // Error markers
  error: /^(Error|ERROR|Failed|FAILED|Exception|EXCEPTION):/i,
  // System messages
  system: /^(System|INFO|WARN|DEBUG):/i,
  // User prompt marker (from Claude Code)
  userPrompt: /^(>|❯|\$)\s+/,
  // Thinking indicator
  thinking: /^(⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏)\s*(Thinking|Processing|Loading)/i,
};

/**
 * Generate unique block ID
 */
function generateBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Detect the type of content and extract metadata
 */
function detectBlockType(
  line: string
): { type: BlockType; role?: string; toolName?: string } | null {
  // Check for groupchat
  const groupchatMatch = line.match(PATTERNS.groupchat);
  if (groupchatMatch) {
    return { type: "groupchat", role: groupchatMatch[1] };
  }

  // Check for tool
  const toolMatch = line.match(PATTERNS.toolStart);
  if (toolMatch) {
    return { type: "tool", toolName: toolMatch[1] };
  }

  // Check for error
  if (PATTERNS.error.test(line)) {
    return { type: "error" };
  }

  // Check for system
  if (PATTERNS.system.test(line)) {
    return { type: "system" };
  }

  // Check for Claude response
  if (PATTERNS.claudeStart.test(line)) {
    return { type: "assistant" };
  }

  // Check for user prompt
  if (PATTERNS.userPrompt.test(line)) {
    return { type: "user" };
  }

  return null;
}

/**
 * Parse raw terminal output into blocks
 * This is an incremental parser that can handle streaming output
 */
export function parseTerminalOutput(rawOutput: string): TerminalBlock[] {
  const lines = rawOutput.split("\n");
  const blocks: TerminalBlock[] = [];
  let currentBlock: TerminalBlock | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      // Empty line - add to current block or skip
      if (currentBlock) {
        currentBlock.content += "\n";
      }
      continue;
    }

    const detected = detectBlockType(trimmedLine);

    if (detected) {
      // New block detected - finalize current and start new
      if (currentBlock) {
        currentBlock.content = currentBlock.content.trim();
        currentBlock.status = "complete";
        blocks.push(currentBlock);
      }

      currentBlock = {
        id: generateBlockId(),
        type: detected.type,
        role: detected.role,
        toolName: detected.toolName,
        content: line,
        timestamp: Date.now(),
        status: "streaming",
      };
    } else if (currentBlock) {
      // Continue current block
      currentBlock.content += "\n" + line;
    } else {
      // No current block and no detection - create a system block
      currentBlock = {
        id: generateBlockId(),
        type: "system",
        content: line,
        timestamp: Date.now(),
        status: "streaming",
      };
    }
  }

  // Finalize last block
  if (currentBlock) {
    currentBlock.content = currentBlock.content.trim();
    currentBlock.status = "complete";
    blocks.push(currentBlock);
  }

  return blocks;
}

/**
 * Merge new blocks into existing blocks
 * Used for incremental updates
 */
export function mergeBlocks(
  existing: TerminalBlock[],
  newBlocks: TerminalBlock[]
): TerminalBlock[] {
  if (existing.length === 0) return newBlocks;
  if (newBlocks.length === 0) return existing;

  // If last existing block is streaming, merge with first new block
  const lastExisting = existing[existing.length - 1];
  if (lastExisting.status === "streaming" && newBlocks.length > 0) {
    const firstNew = newBlocks[0];
    if (lastExisting.type === firstNew.type) {
      lastExisting.content += "\n" + firstNew.content;
      lastExisting.status = firstNew.status;
      return [...existing.slice(0, -1), lastExisting, ...newBlocks.slice(1)];
    }
  }

  return [...existing, ...newBlocks];
}

/**
 * Check if a block should be collapsed by default
 */
export function shouldCollapseBlock(block: TerminalBlock): boolean {
  const lineCount = block.content.split("\n").length;
  // Collapse tool outputs > 100 lines
  if (block.type === "tool" && lineCount > 100) {
    return true;
  }
  // Collapse system messages > 50 lines
  if (block.type === "system" && lineCount > 50) {
    return true;
  }
  return false;
}

/**
 * Format timestamp for display
 */
export function formatBlockTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Get display title for a block
 */
export function getBlockTitle(block: TerminalBlock): string {
  switch (block.type) {
    case "groupchat":
      return `GroupChat @${block.role || "unknown"}`;
    case "assistant":
      return "Claude";
    case "tool":
      return `Tool: ${block.toolName || "Unknown"}`;
    case "user":
      return "User";
    case "error":
      return "Error";
    case "system":
      return "System";
    default:
      return "Output";
  }
}
