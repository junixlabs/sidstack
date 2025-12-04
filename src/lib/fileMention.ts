/**
 * File Mention Utilities
 *
 * Handles @file mention resolution and autocomplete.
 */

import { invoke } from "@tauri-apps/api/core";

export interface FileSuggestion {
  label: string;
  value: string;
  path: string;
  isDirectory: boolean;
}

export interface ResolvedMention {
  raw: string;
  path: string;
  absolutePath: string;
  exists: boolean;
  content?: string;
}

/**
 * Search files for autocomplete
 */
export async function searchFiles(
  query: string,
  workingDir: string,
  maxResults: number = 10
): Promise<FileSuggestion[]> {
  try {
    // Use Tauri to search files
    const results = await invoke<Array<{ path: string; is_dir: boolean }>>(
      "slash_search_files",
      {
        query,
        working_dir: workingDir,
        max_results: maxResults,
      }
    );

    return results.map((r) => ({
      label: r.is_dir ? `${r.path}/` : r.path,
      value: `@${r.path}`,
      path: r.path,
      isDirectory: r.is_dir,
    }));
  } catch (error) {
    console.error("[fileMention] Search failed:", error);
    // Fallback: return empty
    return [];
  }
}

/**
 * Resolve a file mention to absolute path
 */
export async function resolveMention(
  mention: string,
  workingDir: string
): Promise<ResolvedMention> {
  // Remove @ prefix if present
  const path = mention.startsWith("@") ? mention.slice(1) : mention;

  try {
    const result = await invoke<{
      absolute_path: string;
      exists: boolean;
      content?: string;
    }>("resolve_file_mention", {
      path,
      working_dir: workingDir,
    });

    return {
      raw: mention,
      path,
      absolutePath: result.absolute_path,
      exists: result.exists,
      content: result.content,
    };
  } catch (error) {
    console.error("[fileMention] Resolve failed:", error);
    return {
      raw: mention,
      path,
      absolutePath: `${workingDir}/${path}`,
      exists: false,
    };
  }
}

/**
 * Load file content
 */
export async function loadFileContent(
  absolutePath: string
): Promise<string | null> {
  try {
    const content = await invoke<string>("read_file_content", {
      path: absolutePath,
    });
    return content;
  } catch (error) {
    console.error("[fileMention] Load content failed:", error);
    return null;
  }
}

/**
 * Process input to resolve all file mentions and inject content
 */
export async function processFileMentions(
  input: string,
  workingDir: string
): Promise<{ processedInput: string; fileContexts: string[] }> {
  // Extract mentions
  const mentionRegex = /@([\w./-]+)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(input)) !== null) {
    mentions.push(match[1]);
  }

  if (mentions.length === 0) {
    return { processedInput: input, fileContexts: [] };
  }

  // Resolve and load each mention
  const fileContexts: string[] = [];

  for (const mentionPath of mentions) {
    const resolved = await resolveMention(mentionPath, workingDir);

    if (resolved.exists && resolved.content) {
      fileContexts.push(
        `--- File: ${resolved.path} ---\n${resolved.content}\n--- End File ---`
      );
    }
  }

  return { processedInput: input, fileContexts };
}
