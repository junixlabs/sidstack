/**
 * Tests for: sidstack governance show
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  createTestWorkspace,
  cleanupTestWorkspace,
  createEmptyWorkspace,
} from '../../setup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, '../../../bin/run.js');

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  json?: Record<string, unknown>;
}

async function runCli(args: string[], cwd: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    const proc = spawn('node', [CLI_PATH, ...args], {
      cwd,
      env: { ...process.env, FORCE_COLOR: '0' },
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const result: CommandResult = {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? 1,
      };

      if (args.includes('--json') || args.includes('-j')) {
        try {
          result.json = JSON.parse(stdout.trim());
        } catch {
          // Not valid JSON
        }
      }

      resolve(result);
    });

    proc.on('error', (err) => {
      resolve({
        stdout,
        stderr: err.message,
        exitCode: 1,
      });
    });
  });
}

describe('governance show', () => {
  let workspacePath: string;

  beforeEach(async () => {
    workspacePath = await createTestWorkspace();
  });

  afterEach(async () => {
    if (workspacePath) {
      await cleanupTestWorkspace(workspacePath);
    }
  });

  describe('basic functionality', () => {
    it('should show governance overview', async () => {
      const result = await runCli(['governance', 'show'], workspacePath);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Governance');
    });

    it('should show principles', async () => {
      const result = await runCli(['governance', 'show'], workspacePath);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('PRINCIPLES');
    });

    it('should show skills', async () => {
      const result = await runCli(['governance', 'show'], workspacePath);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('SKILLS');
    });
  });

  describe('JSON output (--json)', () => {
    it('should return valid JSON', async () => {
      const result = await runCli(['governance', 'show', '--json'], workspacePath);

      expect(result.json).toBeDefined();
      expect(result.json?.success).toBe(true);
    });

    it('should include all sections in JSON', async () => {
      const result = await runCli(['governance', 'show', '--json'], workspacePath);

      const data = result.json?.data as Record<string, unknown>;
      expect(data?.initialized).toBe(true);
      expect(data?.principles).toBeDefined();
      expect(data?.skills).toBeDefined();
      expect(data?.agents).toBeDefined();
      expect(data?.modules).toBeDefined();
    });

    it('should include principles details', async () => {
      const result = await runCli(['governance', 'show', '--json'], workspacePath);

      const data = result.json?.data as Record<string, unknown>;
      const principles = data?.principles as Record<string, unknown>;

      expect(principles?.total).toBeGreaterThanOrEqual(0);
      expect(principles?.list).toBeDefined();
      expect(Array.isArray(principles?.list)).toBe(true);
    });

    it('should include skills details', async () => {
      const result = await runCli(['governance', 'show', '--json'], workspacePath);

      const data = result.json?.data as Record<string, unknown>;
      const skills = data?.skills as Record<string, unknown>;

      expect(skills?.total).toBeGreaterThanOrEqual(0);
      expect(skills?.byCategory).toBeDefined();
    });
  });

  describe('section filter (--section)', () => {
    it('should show only principles section', async () => {
      const result = await runCli(['governance', 'show', '--section', 'principles'], workspacePath);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('PRINCIPLES');
      expect(result.stdout).not.toContain('AGENTS');
    });

    it('should show only skills section', async () => {
      const result = await runCli(['governance', 'show', '--section', 'skills'], workspacePath);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('SKILLS');
      expect(result.stdout).not.toContain('PRINCIPLES');
    });

    it('should show only modules section', async () => {
      const result = await runCli(['governance', 'show', '--section', 'modules'], workspacePath);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('MODULE');
      expect(result.stdout).not.toContain('PRINCIPLES');
    });
  });

  describe('quiet mode (--quiet)', () => {
    it('should output counts only', async () => {
      const result = await runCli(['governance', 'show', '--quiet'], workspacePath);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Principles:');
      expect(result.stdout).toContain('Skills:');
      expect(result.stdout).toContain('Agents:');
      expect(result.stdout).toContain('Modules:');
    });
  });

  describe('uninitialized workspace', () => {
    it('should handle workspace without governance', async () => {
      const emptyPath = await createEmptyWorkspace();

      try {
        const result = await runCli(['governance', 'show', '--json'], emptyPath);

        // Should return error for uninitialized governance
        expect(result.exitCode).toBe(4); // NOT_INITIALIZED
        expect(result.json?.success).toBe(false);
      } finally {
        await cleanupTestWorkspace(emptyPath);
      }
    });
  });
});
