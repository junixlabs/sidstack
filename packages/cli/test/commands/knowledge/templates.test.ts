/**
 * Tests for: sidstack knowledge templates
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

describe('knowledge templates', () => {
  describe('list templates', () => {
    it('should list available templates', async () => {
      const result = await runCli(['knowledge', 'templates']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('template');
    });

    it('should include business-logic template', async () => {
      const result = await runCli(['knowledge', 'templates']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('business-logic');
    });

    it('should include api-endpoint template', async () => {
      const result = await runCli(['knowledge', 'templates']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('api-endpoint');
    });

    it('should include database-table template', async () => {
      const result = await runCli(['knowledge', 'templates']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('database-table');
    });

    it('should include module template', async () => {
      const result = await runCli(['knowledge', 'templates']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('module');
    });
  });

  describe('JSON output (--json)', () => {
    it('should return valid JSON', async () => {
      const result = await runCli(['knowledge', 'templates', '--json']);

      expect(result.exitCode).toBe(0);
      expect(result.json).toBeDefined();
      expect(result.json?.success).toBe(true);
    });

    it('should include templates array', async () => {
      const result = await runCli(['knowledge', 'templates', '--json']);

      expect(result.exitCode).toBe(0);
      const data = result.json?.data as Record<string, unknown>;

      expect(data?.templates).toBeDefined();
      expect(Array.isArray(data?.templates)).toBe(true);
    });

    it('should include total count', async () => {
      const result = await runCli(['knowledge', 'templates', '--json']);

      expect(result.exitCode).toBe(0);
      const data = result.json?.data as Record<string, unknown>;

      expect(typeof data?.total).toBe('number');
      expect(data?.total).toBeGreaterThan(0);
    });

    it('should include template metadata', async () => {
      const result = await runCli(['knowledge', 'templates', '--json']);

      expect(result.exitCode).toBe(0);
      const data = result.json?.data as Record<string, unknown>;
      const templates = data?.templates as Array<Record<string, unknown>>;

      expect(templates[0]).toHaveProperty('name');
      expect(templates[0]).toHaveProperty('description');
      expect(templates[0]).toHaveProperty('variables');
    });
  });

  describe('quiet mode (--quiet)', () => {
    it('should output names only', async () => {
      const result = await runCli(['knowledge', 'templates', '--quiet']);

      expect(result.exitCode).toBe(0);
      // Should be minimal output
      const lines = result.stdout.split('\n').filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
    });
  });

  describe('show specific template (--show)', () => {
    it('should show template details', async () => {
      const result = await runCli(['knowledge', 'templates', '--show', 'business-logic']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('business-logic');
      expect(result.stdout).toContain('Variables');
    });

    it('should show template variables', async () => {
      const result = await runCli(['knowledge', 'templates', '--show', 'api-endpoint']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('{{');
    });

    it('should error for nonexistent template', async () => {
      const result = await runCli(['knowledge', 'templates', '--show', 'nonexistent']);

      expect(result.exitCode).not.toBe(0);
    });
  });
});
