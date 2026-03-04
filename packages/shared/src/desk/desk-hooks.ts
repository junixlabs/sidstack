/**
 * Agent Desk v2 — Lifecycle Hooks
 *
 * Reads hook config from .sidstack/desk-config.json and executes
 * shell commands on desk lifecycle events. Hook failures are non-fatal.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { DeskHooksConfig, DeskHookEvent } from './types.js';

/**
 * Load hooks config from .sidstack/desk-config.json.
 */
export function loadHooks(workspaceRoot: string): DeskHooksConfig {
  const configPath = path.join(workspaceRoot, '.sidstack', 'desk-config.json');
  if (!fs.existsSync(configPath)) return {};

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return raw.hooks || {};
  } catch {
    return {};
  }
}

/**
 * Run a lifecycle hook. Non-fatal: catches errors silently.
 */
export function runHook(
  workspaceRoot: string,
  event: DeskHookEvent,
  env?: Record<string, string>
): void {
  const hooks = loadHooks(workspaceRoot);
  const cmd = hooks[event];
  if (!cmd) return;

  try {
    execSync(cmd, {
      cwd: workspaceRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30_000,
      env: { ...process.env, ...env },
    });
  } catch {
    // Hook failure is non-fatal
  }
}
