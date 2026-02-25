/**
 * Claude Code Launcher
 *
 * Fetches knowledge context from the API server and launches
 * Claude Code CLI with that context pre-loaded as the initial prompt.
 */

import { invoke } from "@tauri-apps/api/core";
import { getApiBaseUrl } from "@/lib/api-config";

// ---------------------------------------------------------------------------
// Types (mirrored from Tauri SpawnOptions)
// ---------------------------------------------------------------------------

interface SpawnOptions {
  role: string;
  working_dir: string;
  prompt?: string;
  session_id?: string;
  max_turns?: number;
}

interface ClaudeProcessInfo {
  id: string;
  pid: number;
  role: string;
  working_dir: string;
  status: string;
  created_at: number;
}

interface KnowledgeContextResponse {
  prompt: string;
  documents: Array<{ id: string; title: string; type: string }>;
  totalDocuments: number;
  includedDocuments: number;
  totalCharacters: number;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchKnowledgeContext(
  projectId: string,
  taskId?: string,
): Promise<string> {
  const baseUrl = getApiBaseUrl();
  const params = new URLSearchParams({ projectId, format: "summary" });
  if (taskId) params.set("taskId", taskId);

  const res = await fetch(`${baseUrl}/api/knowledge/context?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch knowledge context: ${res.status}`);
  }

  const data: KnowledgeContextResponse = await res.json();
  return data.prompt || "";
}

async function fetchTaskContext(taskId: string): Promise<string> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/tasks/${taskId}`);
  if (!res.ok) return "";

  const { task } = await res.json();
  if (!task) return "";

  const parts: string[] = [];
  parts.push(`# Task: ${task.title}`);
  parts.push(`Status: ${task.status} | Priority: ${task.priority}`);
  if (task.description) parts.push(`\n${task.description}`);
  if (task.solutionPlan) parts.push(`\n## Solution Plan\n${task.solutionPlan}`);

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Launcher
// ---------------------------------------------------------------------------

export interface LaunchOptions {
  workingDir: string;
  projectId: string;
  taskId?: string;
  userPrompt?: string;
  maxTurns?: number;
}

/**
 * Launch Claude Code with knowledge context from the API.
 *
 * 1. Fetches knowledge context + optional task context
 * 2. Builds a composite prompt with context
 * 3. Calls `claude_spawn` Tauri command
 */
export async function launchClaudeWithContext(
  options: LaunchOptions,
): Promise<ClaudeProcessInfo> {
  const { workingDir, projectId, taskId, userPrompt, maxTurns } = options;

  // Fetch context in parallel
  const [knowledgeCtx, taskCtx] = await Promise.all([
    fetchKnowledgeContext(projectId, taskId).catch(() => ""),
    taskId ? fetchTaskContext(taskId).catch(() => "") : Promise.resolve(""),
  ]);

  // Build composite prompt
  const parts: string[] = [];

  if (knowledgeCtx) {
    parts.push(knowledgeCtx);
  }

  if (taskCtx) {
    parts.push(taskCtx);
  }

  if (userPrompt) {
    parts.push(`\n---\n\n${userPrompt}`);
  } else if (taskId) {
    parts.push(`\n---\n\nPlease work on the task described above.`);
  }

  const prompt = parts.join("\n\n") || "Hello, I have context loaded. What would you like me to work on?";

  const spawnOptions: SpawnOptions = {
    role: "dev",
    working_dir: workingDir,
    prompt,
    max_turns: maxTurns,
  };

  return invoke<ClaudeProcessInfo>("claude_spawn", { options: spawnOptions });
}
