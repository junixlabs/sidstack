import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { Command, Flags } from '@oclif/core';

import {
  detectWorkspace,
  ensureSidstackLocal,
  getDeskPath,
  getDesksPath,
} from '@sidstack/shared';
import { successResponse, errorResponse, ExitCodes } from '../../lib/output.js';

export default class DeskInit extends Command {
  static description = 'Initialize a desk pool for the workspace';

  static examples = [
    '<%= config.bin %> desk init --pool 3',
    '<%= config.bin %> desk init --pool 4 --workers 3 --reviewers 1',
    '<%= config.bin %> desk init --pool 2 --bootstrap "npm install"',
    '<%= config.bin %> desk init --pool 3 --json',
  ];

  static flags = {
    pool: Flags.integer({
      char: 'p',
      description: 'Number of desks to create (1-10)',
      required: true,
      min: 1,
      max: 10,
    }),
    workers: Flags.integer({
      char: 'w',
      description: 'Number of worker desks (default: pool - 1)',
    }),
    reviewers: Flags.integer({
      char: 'r',
      description: 'Number of reviewer desks (default: 1)',
    }),
    bootstrap: Flags.string({
      description: 'Bootstrap command to run in each desk (e.g., "pnpm install")',
    }),
    'run-bootstrap': Flags.boolean({
      description: 'Run bootstrap command after creating desks',
      default: false,
    }),
    json: Flags.boolean({
      char: 'j',
      description: 'Output in JSON format',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DeskInit);
    const { pool, bootstrap, json } = flags;
    const runBootstrap = flags['run-bootstrap'];

    // Detect workspace
    const workspace = detectWorkspace(process.cwd());

    if (!workspace) {
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:init', [
          { code: 'NOT_WORKSPACE', message: 'Not inside a SidStack workspace. Run `sidstack init` first.' },
        ], ExitCodes.NOT_INITIALIZED), null, 2));
      } else {
        this.error('Not inside a SidStack workspace. Run `sidstack init` first.');
      }
      return;
    }

    const workspaceRoot = workspace.workspaceRoot;

    // Check if pool already exists
    const poolPath = path.join(workspaceRoot, '.sidstack', 'desk-pool.json');
    if (fs.existsSync(poolPath)) {
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:init', [
          { code: 'POOL_EXISTS', message: 'Desk pool already initialized. Use `sidstack desk list` to see desks.' },
        ]), null, 2));
      } else {
        this.error('Desk pool already initialized. Use `sidstack desk list` to see desks.');
      }
      return;
    }

    // Calculate worker/reviewer split
    const reviewerCount = flags.reviewers ?? 1;
    const workerCount = flags.workers ?? (pool - reviewerCount);

    if (workerCount + reviewerCount !== pool) {
      const msg = `Worker (${workerCount}) + reviewer (${reviewerCount}) must equal pool size (${pool})`;
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:init', [
          { code: 'INVALID_SPLIT', message: msg },
        ]), null, 2));
      } else {
        this.error(msg);
      }
      return;
    }

    if (workerCount < 0 || reviewerCount < 0) {
      const msg = 'Worker and reviewer counts must be non-negative';
      if (json) {
        this.log(JSON.stringify(errorResponse('desk:init', [
          { code: 'INVALID_COUNT', message: msg },
        ]), null, 2));
      } else {
        this.error(msg);
      }
      return;
    }

    // Build desk list
    const desks: Array<{ name: string; role: 'worker' | 'reviewer'; affinity: string[] }> = [];

    for (let i = 1; i <= workerCount; i++) {
      desks.push({ name: `desk-${i}`, role: 'worker', affinity: [] });
    }
    for (let i = 1; i <= reviewerCount; i++) {
      const name = reviewerCount === 1 ? 'desk-review' : `desk-review-${i}`;
      desks.push({ name, role: 'reviewer', affinity: [] });
    }

    if (!json) {
      this.log('');
      this.log(`Initializing desk pool (${pool} desks)...`);
      this.log('');
    }

    // Ensure desks/ directory exists
    const desksDir = getDesksPath(workspaceRoot);
    if (!fs.existsSync(desksDir)) {
      fs.mkdirSync(desksDir, { recursive: true });
    }

    // Add desks/ to .gitignore if not already there
    const gitignorePath = path.join(workspaceRoot, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
      if (!gitignore.includes('desks/')) {
        fs.appendFileSync(gitignorePath, '\n# Agent Desk worktrees\ndesks/\n');
      }
    } else {
      fs.writeFileSync(gitignorePath, '# Agent Desk worktrees\ndesks/\n', 'utf-8');
    }

    // Create worktrees
    const created: string[] = [];
    const errors: string[] = [];

    for (const desk of desks) {
      const deskPath = getDeskPath(workspaceRoot, desk.name);

      if (fs.existsSync(deskPath)) {
        errors.push(`${desk.name}: directory already exists`);
        if (!json) this.log(`  ! ${desk.name}: already exists, skipping`);
        continue;
      }

      try {
        const tempBranch = `agent/${desk.name}`;
        execSync(
          `git worktree add -b "${tempBranch}" "${deskPath}" main`,
          { cwd: workspaceRoot, encoding: 'utf-8', stdio: 'pipe' },
        );

        // Create .sidstack-local with session.json
        const localDir = ensureSidstackLocal(deskPath);
        const agentName = desk.role === 'reviewer'
          ? (reviewerCount === 1 ? 'Reviewer' : `Reviewer ${desk.name.replace('desk-review-', '')}`)
          : `Worker ${desk.name.replace('desk-', '')}`;

        fs.writeFileSync(
          path.join(localDir, 'session.json'),
          JSON.stringify({
            name: desk.name,
            status: 'idle',
            branch: 'main',
            agentRole: desk.role,
            agentName,
            lastActivity: new Date().toISOString(),
            ports: { dev: 0, api: 0, preview: 0 },
          }, null, 2),
          'utf-8',
        );

        created.push(desk.name);
        if (!json) {
          const icon = desk.role === 'reviewer' ? '◉' : '●';
          this.log(`  ${icon} ${desk.name} (${desk.role}) created`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${desk.name}: ${msg}`);
        if (!json) this.log(`  ! ${desk.name}: FAILED - ${msg}`);
      }
    }

    // Run bootstrap if requested
    if (runBootstrap && bootstrap && created.length > 0) {
      if (!json) {
        this.log('');
        this.log(`Running bootstrap: ${bootstrap}`);
      }
      for (const deskName of created) {
        const deskBootstrapPath = getDeskPath(workspaceRoot, deskName);
        try {
          if (!json) this.log(`  ${deskName}...`);
          execSync(bootstrap, { cwd: deskBootstrapPath, stdio: json ? 'pipe' : 'inherit' });
        } catch {
          if (!json) this.log(`  ! ${deskName}: bootstrap failed (non-fatal)`);
        }
      }
    }

    // Write pool config
    const poolConfig = {
      version: 1,
      poolSize: pool,
      desks,
      branchPattern: '{type}/{taskSlug}',
      resetStrategy: 'hard-reset-to-main',
      bootstrap: {
        command: bootstrap || 'pnpm install',
        runOnCreate: true,
        runOnReset: false,
      },
    };

    fs.writeFileSync(poolPath, JSON.stringify(poolConfig, null, 2), 'utf-8');

    if (json) {
      this.log(JSON.stringify(successResponse('desk:init', {
        workspace: workspaceRoot,
        poolSize: pool,
        workers: workerCount,
        reviewers: reviewerCount,
        created,
        errors: errors.length > 0 ? errors : undefined,
        poolConfig,
      }), null, 2));
    } else {
      this.log('');
      if (errors.length > 0) {
        this.log(`Pool initialized with ${created.length}/${pool} desks (${errors.length} errors)`);
      } else {
        this.log(`Pool initialized: ${created.length} desks`);
      }
      this.log(`Config: ${poolPath}`);
      this.log('');
      this.log('Start coding:');
      for (const deskName of created) {
        this.log(`  cd ${getDeskPath(workspaceRoot, deskName)} && claude`);
      }
      this.log('');
    }
  }
}
