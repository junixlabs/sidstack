/**
 * Tests for: sidstack preset show
 */

import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, '../../../bin/run.js');

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  json?: Record<string, unknown>;
}

async function runCli(args: string[], cwd?: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    const proc = spawn('node', [CLI_PATH, ...args], {
      cwd: cwd || process.cwd(),
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

describe('preset show', () => {
  describe('basic functionality', () => {
    it('should show preset details', async () => {
      const result = await runCli(['preset', 'show', 'minimal']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('minimal');
    });

    it('should show preset description', async () => {
      const result = await runCli(['preset', 'show', 'minimal']);

      expect(result.exitCode).toBe(0);
      // Should have some description
      expect(result.stdout.length).toBeGreaterThan(50);
    });
  });

  describe('JSON output (--json)', () => {
    it('should return valid JSON', async () => {
      const result = await runCli(['preset', 'show', 'minimal', '--json']);

      expect(result.exitCode).toBe(0);
      expect(result.json).toBeDefined();
      expect(result.json?.success).toBe(true);
    });

    it('should include preset details', async () => {
      const result = await runCli(['preset', 'show', 'minimal', '--json']);

      expect(result.exitCode).toBe(0);
      const data = result.json?.data as Record<string, unknown>;

      expect(data?.name).toBe('minimal');
      expect(data?.displayName).toBeDefined();
    });
  });

  describe('section filter (--section)', () => {
    it('should show only agents section', async () => {
      const result = await runCli(['preset', 'show', 'minimal', '--section', 'agents']);

      expect(result.exitCode).toBe(0);
    });

    it('should show only skills section', async () => {
      const result = await runCli(['preset', 'show', 'minimal', '--section', 'skills']);

      expect(result.exitCode).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should error for nonexistent preset', async () => {
      const result = await runCli(['preset', 'show', 'nonexistent-preset']);

      expect(result.exitCode).not.toBe(0);
    });

    it('should return error JSON for nonexistent preset', async () => {
      const result = await runCli(['preset', 'show', 'nonexistent-preset', '--json']);

      expect(result.exitCode).not.toBe(0);
      expect(result.json?.success).toBe(false);
    });
  });
});
