/**
 * Command Parser
 *
 * Detects input type and parses accordingly:
 * - `/command [args]` -> Slash command
 * - `@path` -> File mention (within text)
 * - `!bash cmd` -> Direct bash execution
 * - Plain text -> Send to Claude
 */

export type InputType = "command" | "bash" | "prompt";

export interface ParsedInput {
  type: InputType;
  raw: string;
}

export interface ParsedCommand extends ParsedInput {
  type: "command";
  name: string;
  args: string;
}

export interface ParsedBash extends ParsedInput {
  type: "bash";
  command: string;
}

export interface ParsedPrompt extends ParsedInput {
  type: "prompt";
  text: string;
  mentions: FileMention[];
}

export interface FileMention {
  raw: string; // "@src/App.tsx"
  path: string; // "src/App.tsx"
  start: number; // Position in original text
  end: number;
}

/**
 * Parse user input and determine its type
 */
export function parseInput(
  input: string
): ParsedCommand | ParsedBash | ParsedPrompt {
  const trimmed = input.trim();

  // Empty input is a prompt
  if (!trimmed) {
    return {
      type: "prompt",
      raw: input,
      text: "",
      mentions: [],
    };
  }

  // Slash command: starts with /
  if (trimmed.startsWith("/")) {
    return parseSlashCommand(trimmed);
  }

  // Bash direct: starts with !
  if (trimmed.startsWith("!")) {
    return parseBashCommand(trimmed);
  }

  // Regular prompt with potential file mentions
  return parsePrompt(input);
}

/**
 * Parse slash command: /command [args]
 */
function parseSlashCommand(input: string): ParsedCommand {
  // Remove leading /
  const content = input.slice(1);

  // Split into command name and arguments
  const spaceIndex = content.indexOf(" ");
  const name = spaceIndex === -1 ? content : content.slice(0, spaceIndex);
  const args = spaceIndex === -1 ? "" : content.slice(spaceIndex + 1).trim();

  return {
    type: "command",
    raw: input,
    name: name.toLowerCase(),
    args,
  };
}

/**
 * Parse bash command: !command
 */
function parseBashCommand(input: string): ParsedBash {
  // Remove leading ! and trim
  const command = input.slice(1).trim();

  return {
    type: "bash",
    raw: input,
    command,
  };
}

/**
 * Parse prompt with file mentions
 */
function parsePrompt(input: string): ParsedPrompt {
  const mentions = extractFileMentions(input);

  return {
    type: "prompt",
    raw: input,
    text: input,
    mentions,
  };
}

/**
 * Extract @file mentions from text
 * Matches: @path/to/file.ext or @path/to/dir/
 */
export function extractFileMentions(text: string): FileMention[] {
  const mentions: FileMention[] = [];

  // Regex to match @path patterns
  // Matches @ followed by path characters until whitespace or end
  const regex = /@([\w./-]+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    mentions.push({
      raw: match[0],
      path: match[1],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return mentions;
}

/**
 * Check if input starts with command trigger
 */
export function isCommandTrigger(input: string): boolean {
  return input.startsWith("/");
}

/**
 * Check if input starts with bash trigger
 */
export function isBashTrigger(input: string): boolean {
  return input.startsWith("!");
}

/**
 * Get current @ mention being typed (for autocomplete)
 * Returns the partial path after @ or null if not in a mention
 */
export function getCurrentMention(
  text: string,
  cursorPosition: number
): { query: string; start: number } | null {
  // Look backwards from cursor for @
  let start = cursorPosition - 1;
  while (start >= 0 && text[start] !== "@" && text[start] !== " ") {
    start--;
  }

  if (start < 0 || text[start] !== "@") {
    return null;
  }

  const query = text.slice(start + 1, cursorPosition);

  // Don't trigger on just @ with space after or at end
  if (cursorPosition > start + 1 || text.length === start + 1) {
    return { query, start };
  }

  return { query: "", start };
}

/**
 * Get current slash command being typed (for autocomplete)
 * Returns the partial command name or null if not typing a command
 */
export function getCurrentCommand(
  text: string,
  cursorPosition: number
): { query: string; start: number } | null {
  // Must start with /
  if (!text.startsWith("/")) {
    return null;
  }

  // Get text from / to cursor
  const query = text.slice(1, cursorPosition);

  // If there's a space, command name is complete
  if (query.includes(" ")) {
    return null;
  }

  return { query: query.toLowerCase(), start: 0 };
}
