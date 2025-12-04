/**
 * Block Types for Claude Terminal UI
 *
 * Defines the structured block types for rendering Claude Code output
 * in a Warp-style block-based interface.
 */

// =============================================================================
// Block Type Enum
// =============================================================================

export type BlockType =
  | "input"      // User prompt/input
  | "thinking"   // Claude's extended thinking
  | "tool"       // Tool use (Read, Write, Bash, etc.)
  | "output"     // Claude's response text
  | "error"      // Error messages
  | "system";    // System messages (init, session info)

// =============================================================================
// Block Status
// =============================================================================

export type BlockStatus =
  | "pending"    // Not yet processed
  | "streaming"  // Currently receiving data
  | "completed"  // Finished successfully
  | "error";     // Failed

// =============================================================================
// Content Types for Each Block
// =============================================================================

export interface InputContent {
  prompt: string;
  editedPrompt?: string;  // If user modified for retry
}

export interface ThinkingContent {
  thinking: string;
  isPartial?: boolean;    // Still streaming
}

export interface ToolContent {
  toolName: string;
  toolInput: unknown;
  toolOutput?: string;
  isError?: boolean;
  executionTimeMs?: number;
  toolUseId?: string;
}

export interface OutputContent {
  text: string;
  model?: string;
  // Metadata from result event
  costUsd?: number;
  durationMs?: number;
  durationApiMs?: number;
  numTurns?: number;
  // Code blocks extracted for syntax highlighting
  codeBlocks?: CodeBlock[];
}

export interface ErrorContent {
  message: string;
  code?: string;
  details?: string;
}

export interface SystemContent {
  subtype: string;        // "init", "session", etc.
  sessionId?: string;
  tools?: string[];
  mcpServers?: string[];
}

// =============================================================================
// Code Block (for syntax highlighting)
// =============================================================================

export interface CodeBlock {
  id: string;
  language: string;
  code: string;
  filename?: string;
  startLine?: number;
  isCollapsed?: boolean;
}

// =============================================================================
// Block Content Union Type
// =============================================================================

export type BlockContent =
  | { type: "input"; data: InputContent }
  | { type: "thinking"; data: ThinkingContent }
  | { type: "tool"; data: ToolContent }
  | { type: "output"; data: OutputContent }
  | { type: "error"; data: ErrorContent }
  | { type: "system"; data: SystemContent };

// =============================================================================
// Main Block Interface
// =============================================================================

export interface Block {
  id: string;
  type: BlockType;
  content: BlockContent;
  timestamp: Date;
  status: BlockStatus;
  isCollapsed: boolean;

  // Agent context (for multi-agent)
  role?: string;
  agentId?: string;

  // Relationships
  parentBlockId?: string;      // For tool results linked to tool use
  replyToBlockId?: string;     // For follow-up responses

  // Metadata
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Block Actions
// =============================================================================

export interface BlockAction {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  action: (block: Block) => void | Promise<void>;
}

// Common actions
export const BLOCK_ACTIONS = {
  COPY: "copy",
  RETRY: "retry",
  EDIT: "edit",
  COLLAPSE: "collapse",
  EXPAND: "expand",
  SHARE: "share",
  DELETE: "delete",
} as const;

// =============================================================================
// Block Creation Helpers
// =============================================================================

let blockIdCounter = 0;

export function generateBlockId(): string {
  return `block-${Date.now()}-${++blockIdCounter}`;
}

export function createInputBlock(prompt: string, role?: string): Block {
  return {
    id: generateBlockId(),
    type: "input",
    content: { type: "input", data: { prompt } },
    timestamp: new Date(),
    status: "completed",
    isCollapsed: false,
    role,
  };
}

export function createThinkingBlock(thinking: string, role?: string): Block {
  return {
    id: generateBlockId(),
    type: "thinking",
    content: { type: "thinking", data: { thinking } },
    timestamp: new Date(),
    status: "streaming",
    isCollapsed: true,
    role,
  };
}

export function createToolBlock(
  toolName: string,
  toolInput: unknown,
  toolUseId?: string,
  role?: string
): Block {
  return {
    id: generateBlockId(),
    type: "tool",
    content: {
      type: "tool",
      data: { toolName, toolInput, toolUseId },
    },
    timestamp: new Date(),
    status: "streaming",
    isCollapsed: false,
    role,
  };
}

export function createOutputBlock(text: string, model?: string, role?: string): Block {
  return {
    id: generateBlockId(),
    type: "output",
    content: { type: "output", data: { text, model } },
    timestamp: new Date(),
    status: "completed",
    isCollapsed: false,
    role,
  };
}

export function createErrorBlock(message: string, code?: string, role?: string): Block {
  return {
    id: generateBlockId(),
    type: "error",
    content: { type: "error", data: { message, code } },
    timestamp: new Date(),
    status: "error",
    isCollapsed: false,
    role,
  };
}

export function createSystemBlock(
  subtype: string,
  sessionId?: string,
  tools?: string[],
  role?: string
): Block {
  return {
    id: generateBlockId(),
    type: "system",
    content: { type: "system", data: { subtype, sessionId, tools } },
    timestamp: new Date(),
    status: "completed",
    isCollapsed: true,
    role,
  };
}

// =============================================================================
// Block Utilities
// =============================================================================

export function getBlockTitle(block: Block): string {
  switch (block.type) {
    case "input":
      return "Input";
    case "thinking":
      return "Thinking";
    case "tool": {
      const toolData = block.content.data as ToolContent;
      return `Tool: ${toolData.toolName}`;
    }
    case "output":
      return "Claude";
    case "error":
      return "Error";
    case "system": {
      const sysData = block.content.data as SystemContent;
      return `System: ${sysData.subtype}`;
    }
    default:
      return "Unknown";
  }
}

export function shouldAutoCollapse(block: Block): boolean {
  // Thinking blocks and system blocks are collapsed by default
  return block.type === "thinking" || block.type === "system";
}

export function getBlockDuration(block: Block): number | undefined {
  if (block.type === "output") {
    const data = block.content.data as OutputContent;
    return data.durationMs;
  }
  if (block.type === "tool") {
    const data = block.content.data as ToolContent;
    return data.executionTimeMs;
  }
  return undefined;
}

export function getBlockCost(block: Block): number | undefined {
  if (block.type === "output") {
    const data = block.content.data as OutputContent;
    return data.costUsd;
  }
  return undefined;
}

// =============================================================================
// Block List Operations
// =============================================================================

export function findBlockById(blocks: Block[], id: string): Block | undefined {
  return blocks.find((b) => b.id === id);
}

export function findLastBlockByType(blocks: Block[], type: BlockType): Block | undefined {
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i].type === type) {
      return blocks[i];
    }
  }
  return undefined;
}

export function updateBlockInList(
  blocks: Block[],
  id: string,
  updates: Partial<Block>
): Block[] {
  return blocks.map((b) => (b.id === id ? { ...b, ...updates } : b));
}

export function filterBlocksByRole(blocks: Block[], role: string): Block[] {
  return blocks.filter((b) => b.role === role);
}

export function filterBlocksByType(blocks: Block[], type: BlockType): Block[] {
  return blocks.filter((b) => b.type === type);
}
