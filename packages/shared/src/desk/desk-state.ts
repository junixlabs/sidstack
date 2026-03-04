/**
 * Agent Desk v2 — Session State Management
 *
 * Reads/writes .sidstack-local/session.json.
 * Tolerant of old format (extra fields ignored, missing fields get defaults).
 */

import * as fs from 'fs';
import * as path from 'path';
import { ensureSidstackLocal } from '../workspace-detector.js';
import type { DeskSession, DeskPorts } from './types.js';

const SESSION_FILE = 'session.json';
const SIDSTACK_LOCAL = '.sidstack-local';

const DEFAULT_PORTS: DeskPorts = { api: 0, mcp: 0, web: 0, dev: 0 };

function sessionPath(deskPath: string): string {
  return path.join(deskPath, SIDSTACK_LOCAL, SESSION_FILE);
}

/**
 * Read session from desk. Returns null if missing or corrupt.
 */
export function readSession(deskPath: string): DeskSession | null {
  const filePath = sessionPath(deskPath);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    // Tolerant parse — fill defaults for missing fields
    return {
      name: raw.name || path.basename(deskPath),
      status: raw.status === 'working' ? 'working' : 'idle',
      branch: raw.branch || 'main',
      ports: raw.ports || DEFAULT_PORTS,
      lastActivity: raw.lastActivity || new Date().toISOString(),
      tags: raw.tags,
      bootstrapStatus: raw.bootstrapStatus,
      bootstrapError: raw.bootstrapError,
    };
  } catch {
    return null;
  }
}

/**
 * Write session atomically (tmp + rename).
 */
export function writeSession(deskPath: string, session: DeskSession): void {
  const localDir = ensureSidstackLocal(deskPath);
  const filePath = path.join(localDir, SESSION_FILE);
  const tmpPath = filePath + '.tmp';

  fs.writeFileSync(tmpPath, JSON.stringify(session, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Merge updates into existing session, touch lastActivity.
 */
export function updateSession(
  deskPath: string,
  updates: Partial<DeskSession>
): void {
  const existing = readSession(deskPath);
  const merged: DeskSession = {
    name: updates.name ?? existing?.name ?? path.basename(deskPath),
    status: updates.status ?? existing?.status ?? 'idle',
    branch: updates.branch ?? existing?.branch ?? 'main',
    ports: updates.ports ?? existing?.ports ?? DEFAULT_PORTS,
    lastActivity: new Date().toISOString(),
    tags: updates.tags !== undefined ? updates.tags : existing?.tags,
    bootstrapStatus: updates.bootstrapStatus !== undefined ? updates.bootstrapStatus : existing?.bootstrapStatus,
    bootstrapError: updates.bootstrapError !== undefined ? updates.bootstrapError : existing?.bootstrapError,
  };
  writeSession(deskPath, merged);
}
