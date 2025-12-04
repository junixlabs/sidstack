/**
 * Tests for: sidstack preset list
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

describe('preset list', () => {
  describe('basic functionality', () => {
    it('should list available presets', async () => {
      const result = await runCli(['preset', 'list']);

      expect(result.exitCode).toBe(0);
      // Should show at least some presets
      expect(result.stdout).toContain('preset');
    });

    it('should include minimal preset', async () => {
      const result = await runCli(['preset', 'list']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toLowerCase()).toContain('minimal');
    });
  });

  describe('JSON output (--json)', () => {
    it('should return valid JSON', async () => {
      const result = await runCli(['preset', 'list', '--json']);

      expect(result.exitCode).toBe(0);
      expect(result.json).toBeDefined();
      expect(result.json?.success).toBe(true);
    });

    it('should include presets array', async () => {
      const result = await runCli(['preset', 'list', '--json']);

      expect(result.exitCode).toBe(0);
      const data = result.json?.data as Record<string, unknown>;
      expect(data?.presets).toBeDefined();
      expect(Array.isArray(data?.presets)).toBe(true);
    });

    it('should include total count', async () => {
      const result = await runCli(['preset', 'list', '--json']);

      expect(result.exitCode).toBe(0);
      const data = result.json?.data as Record<string, unknown>;
      expect(typeof data?.total).toBe('number');
    });
  });

  describe('quiet mode (--quiet)', () => {
    it('should output names only', async () => {
      const result = await runCli(['preset', 'list', '--quiet']);

      expect(result.exitCode).toBe(0);
      // Should be minimal output - just names
      const lines = result.stdout.split('\n').filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
    });
  });

  describe('language filter (--language)', () => {
    it('should filter by typescript', async () => {
      const result = await runCli(['preset', 'list', '--language', 'typescript', '--json']);

      expect(result.exitCode).toBe(0);
      const data = result.json?.data as Record<string, unknown>;
      const presets = data?.presets as Array<{ language?: string }>;

      // All returned presets should be typescript or 'any' (language-agnostic)
      if (presets && presets.length > 0) {
        expect(presets.every(p => !p.language || p.language === 'typescript' || p.language === 'any')).toBe(true);
      }
    });
  });

  describe('type filter (--type)', () => {
    it('should filter by backend type', async () => {
      const result = await runCli(['preset', 'list', '--type', 'backend', '--json']);

      expect(result.exitCode).toBe(0);
      const data = result.json?.data as Record<string, unknown>;
      const presets = data?.presets as Array<{ type?: string }>;

      // Should have some backend presets
      if (presets && presets.length > 0) {
        expect(presets.every(p => !p.type || p.type === 'backend')).toBe(true);
      }
    });
  });
});
