/**
 * Test Room File Operations
 *
 * Handles file storage for test rooms:
 * - Folder structure creation
 * - Session markdown export
 * - Artifact storage
 */

import { join } from "@tauri-apps/api/path";
import {
  exists,
  mkdir,
  writeTextFile,
  readTextFile,
  readDir,
} from "@tauri-apps/plugin-fs";

import type {
  TestRoom,
  TestSessionExport,
} from "@/types/testRoom";
import { TEST_STATUS_ICONS } from "@/types/testRoom";

// =============================================================================
// Constants
// =============================================================================

const TEST_ROOMS_FOLDER = ".sidstack/test-rooms";

// =============================================================================
// Folder Management
// =============================================================================

/**
 * Ensure test rooms base folder exists
 */
export async function ensureTestRoomsFolder(projectPath: string): Promise<string> {
  const basePath = await join(projectPath, TEST_ROOMS_FOLDER);

  if (!(await exists(basePath))) {
    await mkdir(basePath, { recursive: true });
  }

  return basePath;
}

/**
 * Ensure folder for a specific module's test room exists
 */
export async function ensureModuleFolder(
  projectPath: string,
  moduleId: string
): Promise<string> {
  const basePath = await ensureTestRoomsFolder(projectPath);
  const modulePath = await join(basePath, moduleId);

  if (!(await exists(modulePath))) {
    await mkdir(modulePath, { recursive: true });
  }

  // Also create artifacts subfolder
  const artifactsPath = await join(modulePath, "artifacts");
  if (!(await exists(artifactsPath))) {
    await mkdir(artifactsPath, { recursive: true });
  }

  return modulePath;
}

// =============================================================================
// Session Export
// =============================================================================

/**
 * Generate markdown content from test session data
 */
export function generateSessionMarkdown(data: TestSessionExport): string {
  const { room, items, messages, artifacts, sessionStart, sessionEnd } = data;

  // Calculate stats
  const passedCount = items.filter((i) => i.status === "passed").length;
  const failedCount = items.filter((i) => i.status === "failed").length;
  const skippedCount = items.filter((i) => i.status === "skipped").length;

  // Format date
  const formatDate = (timestamp: string | number) => {
    const date = new Date(typeof timestamp === "string" ? parseInt(timestamp) : timestamp);
    return date.toISOString();
  };

  const formatTime = (timestamp: string | number) => {
    const date = new Date(typeof timestamp === "string" ? parseInt(timestamp) : timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  // Build markdown
  let md = `---
room_id: ${room.id}
module_id: ${room.moduleId}
${room.specId ? `spec_id: ${room.specId}` : ""}
session_start: ${formatDate(sessionStart)}
session_end: ${formatDate(sessionEnd)}
status: ${room.status}
---

# Test Session: ${room.name}

## Test Items
`;

  // Add test items checklist
  for (const item of items) {
    const icon = TEST_STATUS_ICONS[item.status];
    const statusLabel =
      item.status === "passed"
        ? "Passed"
        : item.status === "failed"
        ? "Failed"
        : item.status === "skipped"
        ? "Skipped"
        : item.status === "in_progress"
        ? "In Progress"
        : "Pending";
    const checkbox = item.status === "passed" ? "[x]" : "[ ]";
    md += `- ${checkbox} ${item.title} - ${icon} ${statusLabel}`;
    if (item.resultNotes) {
      md += ` (${item.resultNotes})`;
    }
    md += "\n";
  }

  md += `
## Conversation Log
`;

  // Add messages
  for (const msg of messages) {
    const time = formatTime(msg.createdAt);
    const sender = msg.sender === "agent" ? "Agent" : msg.sender === "human" ? "Human" : "System";

    md += `
### ${time} - ${sender}
${msg.content}
`;

    // Add metadata info
    if (msg.metadata) {
      const metadata = typeof msg.metadata === "string" ? JSON.parse(msg.metadata) : msg.metadata;

      if (msg.messageType === "request" && metadata.requestType) {
        md += `
**Request: ${metadata.requestType === "credentials" ? "Credentials" : metadata.requestType === "action" ? "Action" : "Confirmation"}**
`;
        if (metadata.command) {
          md += `- Command: \`${metadata.command}\`\n`;
        }
      }

      if (msg.messageType === "result" && metadata.status) {
        md += `
**Result: ${metadata.testItemId || "Test"}**
- Status: ${TEST_STATUS_ICONS[metadata.status as keyof typeof TEST_STATUS_ICONS]} ${metadata.status}
`;
      }
    }
  }

  // Add summary
  md += `
## Summary
- Total: ${items.length} tests
- Passed: ${passedCount}
- Failed: ${failedCount}
- Skipped: ${skippedCount}
`;

  // Add artifacts
  if (artifacts.length > 0) {
    md += `
## Artifacts
`;
    for (const artifact of artifacts) {
      const relativePath = artifact.path
        ? `./artifacts/${artifact.path.split("/").pop()}`
        : artifact.name;
      md += `- [${artifact.name}](${relativePath})\n`;
    }
  }

  return md;
}

/**
 * Export test session to markdown file
 */
export async function exportSession(
  projectPath: string,
  data: TestSessionExport
): Promise<string> {
  const modulePath = await ensureModuleFolder(projectPath, data.room.moduleId);

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `session-${timestamp}.md`;
  const filePath = await join(modulePath, filename);

  // Generate and write markdown
  const markdown = generateSessionMarkdown(data);
  await writeTextFile(filePath, markdown);

  return filePath;
}

// =============================================================================
// Artifact Storage
// =============================================================================

/**
 * Save artifact content to file
 */
export async function saveArtifact(
  projectPath: string,
  moduleId: string,
  name: string,
  content: string,
  type: "json" | "log" | "text" = "text"
): Promise<string> {
  const modulePath = await ensureModuleFolder(projectPath, moduleId);
  const artifactsPath = await join(modulePath, "artifacts");

  // Generate unique filename
  const timestamp = Date.now();
  const extension = type === "json" ? ".json" : type === "log" ? ".log" : ".txt";
  const safeName = name.replace(/[^a-zA-Z0-9-_]/g, "-");
  const filename = `${safeName}-${timestamp}${extension}`;
  const filePath = await join(artifactsPath, filename);

  await writeTextFile(filePath, content);

  return filePath;
}

/**
 * Save screenshot or binary artifact (base64 encoded)
 */
export async function saveScreenshot(
  projectPath: string,
  moduleId: string,
  name: string,
  base64Content: string
): Promise<string> {
  const modulePath = await ensureModuleFolder(projectPath, moduleId);
  const artifactsPath = await join(modulePath, "artifacts");

  const timestamp = Date.now();
  const safeName = name.replace(/[^a-zA-Z0-9-_]/g, "-");
  const filename = `${safeName}-${timestamp}.png`;
  const filePath = await join(artifactsPath, filename);

  // For binary files, we'd need to use writeBinaryFile
  // For now, save as base64 text
  await writeTextFile(filePath + ".b64", base64Content);

  return filePath;
}

// =============================================================================
// Session History
// =============================================================================

/**
 * List all sessions for a module
 */
export async function listSessions(
  projectPath: string,
  moduleId: string
): Promise<string[]> {
  try {
    const modulePath = await join(projectPath, TEST_ROOMS_FOLDER, moduleId);

    if (!(await exists(modulePath))) {
      return [];
    }

    const entries = await readDir(modulePath);
    return entries
      .filter((entry) => entry.name?.startsWith("session-") && entry.name?.endsWith(".md"))
      .map((entry) => entry.name!)
      .sort()
      .reverse(); // Most recent first
  } catch {
    return [];
  }
}

/**
 * Read a session markdown file
 */
export async function readSession(
  projectPath: string,
  moduleId: string,
  filename: string
): Promise<string | null> {
  try {
    const filePath = await join(projectPath, TEST_ROOMS_FOLDER, moduleId, filename);

    if (!(await exists(filePath))) {
      return null;
    }

    return await readTextFile(filePath);
  } catch {
    return null;
  }
}

// =============================================================================
// Index File Management
// =============================================================================

/**
 * Create or update the room index file
 */
export async function updateRoomIndex(
  projectPath: string,
  room: TestRoom
): Promise<void> {
  const modulePath = await ensureModuleFolder(projectPath, room.moduleId);
  const indexPath = await join(modulePath, "_index.md");

  const content = `# Test Room: ${room.name}

## Overview
- **Module:** ${room.moduleId}
- **Spec:** ${room.specId || "Not linked"}
- **Status:** ${room.status}
- **Created:** ${new Date(room.createdAt).toISOString()}
- **Updated:** ${new Date(room.updatedAt).toISOString()}

## Description
${room.description || "No description provided."}

## Sessions
See session files in this folder for test history.
`;

  await writeTextFile(indexPath, content);
}
