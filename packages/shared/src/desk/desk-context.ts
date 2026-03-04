/**
 * Agent Desk v2 — Optional CLAUDE.md Bootstrap
 *
 * Only called explicitly (e.g., from CLI --context flag), not on every operation.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface BootstrapContextOptions {
  deskName: string;
  branch?: string;
}

/**
 * Bootstrap context files: CLAUDE.md + .claude symlink.
 */
export function bootstrapContext(
  deskPath: string,
  workspaceRoot: string,
  opts?: BootstrapContextOptions
): void {
  // Copy workspace CLAUDE.md if exists
  const srcClaudeMd = path.join(workspaceRoot, 'CLAUDE.md');
  const dstClaudeMd = path.join(deskPath, 'CLAUDE.md');

  if (fs.existsSync(srcClaudeMd) && !fs.existsSync(dstClaudeMd)) {
    const content = fs.readFileSync(srcClaudeMd, 'utf-8');
    const header = opts
      ? `# Agent Desk: ${opts.deskName}\n\n---\n\n`
      : '';
    fs.writeFileSync(dstClaudeMd, header + content, 'utf-8');
  }

  // Symlink .claude/ for skills
  const srcClaudeDir = path.join(workspaceRoot, '.claude');
  const dstClaudeDir = path.join(deskPath, '.claude');

  try {
    if (fs.existsSync(srcClaudeDir) && !fs.existsSync(dstClaudeDir)) {
      fs.symlinkSync(srcClaudeDir, dstClaudeDir);
    }
  } catch {
    // Ignore symlink errors (permissions, etc.)
  }
}

/**
 * Remove context files from desk.
 */
export function cleanContext(deskPath: string): void {
  // Remove CLAUDE.md
  const claudeMdPath = path.join(deskPath, 'CLAUDE.md');
  if (fs.existsSync(claudeMdPath)) {
    fs.unlinkSync(claudeMdPath);
  }

  // Remove .claude symlink (only if it's a symlink)
  const claudeDir = path.join(deskPath, '.claude');
  try {
    const stat = fs.lstatSync(claudeDir);
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(claudeDir);
    }
  } catch {
    // Doesn't exist or not a symlink
  }
}
