import { randomUUID } from 'crypto';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { Args, Command, Flags } from '@oclif/core';

import {
  saveWorkspaceConfig,
  ensureSidstackLocal,
  updateWorktreeStatus,
  type WorkspaceConfig,
} from '@sidstack/shared';
import { successResponse, errorResponse, ExitCodes } from '../lib/output.js';
import { resolveTemplatesDir } from '../lib/resolve-paths.js';

export default class New extends Command {
  static description = 'Create a new managed workspace with git bare repo structure';

  static examples = [
    '<%= config.bin %> new my-project',
    '<%= config.bin %> new my-app --repo git@github.com:user/repo.git',
    '<%= config.bin %> new my-project --local /path/to/project',
    '<%= config.bin %> new my-project --json',
  ];

  static flags = {
    repo: Flags.string({
      char: 'r',
      description: 'Git repository URL to clone',
    }),
    local: Flags.string({
      char: 'l',
      description: 'Path to local repository to convert',
    }),
    branch: Flags.string({
      char: 'b',
      description: 'Default branch name (default: main)',
      default: 'main',
    }),
    'workspace-dir': Flags.string({
      description: 'Custom workspace directory (default: ~/.sidstack/workspaces/)',
    }),
    json: Flags.boolean({
      char: 'j',
      description: 'Output in JSON format',
      default: false,
    }),
    'skip-worktree': Flags.boolean({
      description: 'Skip creating initial wt-1 worktree',
      default: false,
    }),
  };

  static args = {
    name: Args.string({
      description: 'Workspace name',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(New);
    const { name } = args;
    const { repo, local, branch, json } = flags;
    const skipWorktree = flags['skip-worktree'];

    // Determine workspace root
    const workspacesDir = flags['workspace-dir'] ||
      path.join(process.env.HOME || process.env.USERPROFILE || '', '.sidstack', 'workspaces');
    const workspaceRoot = path.join(workspacesDir, name);

    // Check if workspace already exists
    if (fs.existsSync(workspaceRoot)) {
      if (json) {
        this.log(JSON.stringify(errorResponse('new', [
          { code: 'WORKSPACE_EXISTS', message: `Workspace '${name}' already exists at ${workspaceRoot}` },
        ]), null, 2));
      } else {
        this.error(`Workspace '${name}' already exists at ${workspaceRoot}`);
      }
      return;
    }

    try {
      if (!json) {
        this.log('');
        this.log('Creating SidStack Workspace');
        this.log('===========================');
        this.log('');
      }

      // Create workspace directory structure
      fs.mkdirSync(workspaceRoot, { recursive: true });

      const bareDir = path.join(workspaceRoot, '.bare');
      const mainDir = path.join(workspaceRoot, 'main');
      const sidstackDir = path.join(workspaceRoot, '.sidstack');

      // Step 1: Set up git bare repo
      if (!json) {
        this.log('1. Setting up git repository...');
      }

      if (repo) {
        // Clone from remote
        execSync(`git clone --bare "${repo}" "${bareDir}"`, { stdio: json ? 'pipe' : 'inherit' });
      } else if (local) {
        // Convert local repo to bare
        const localPath = path.resolve(local);
        if (!fs.existsSync(path.join(localPath, '.git'))) {
          throw new Error(`${localPath} is not a git repository`);
        }
        // Clone the local repo as bare
        execSync(`git clone --bare "${localPath}" "${bareDir}"`, { stdio: json ? 'pipe' : 'inherit' });
      } else {
        // Create empty bare repo
        fs.mkdirSync(bareDir, { recursive: true });
        execSync(`git init --bare "${bareDir}"`, { stdio: json ? 'pipe' : 'inherit' });

        // Set default branch
        execSync(`git -C "${bareDir}" symbolic-ref HEAD refs/heads/${branch}`, { stdio: 'pipe' });
      }

      // Step 2: Create main worktree
      if (!json) {
        this.log('2. Creating main worktree...');
      }

      execSync(`git -C "${bareDir}" worktree add "${mainDir}" ${branch} 2>/dev/null || git -C "${bareDir}" worktree add "${mainDir}" --orphan ${branch}`, {
        stdio: json ? 'pipe' : 'inherit',
        shell: '/bin/bash',
      });

      // If it's a new repo, create initial commit
      if (!repo && !local) {
        fs.writeFileSync(path.join(mainDir, 'README.md'), `# ${name}\n\nCreated with SidStack.\n`);
        execSync(`git -C "${mainDir}" add . && git -C "${mainDir}" commit -m "Initial commit"`, {
          stdio: 'pipe',
          shell: '/bin/bash',
        });
      }

      // Step 3: Initialize .sidstack
      if (!json) {
        this.log('3. Initializing SidStack...');
      }

      // Create .sidstack directory
      fs.mkdirSync(sidstackDir, { recursive: true });

      // Create config
      const config: WorkspaceConfig = {
        projectId: randomUUID(),
        projectName: name,
        projectPath: workspaceRoot,
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        isWorkspace: true,
        worktrees: ['main'],
      };

      saveWorkspaceConfig(workspaceRoot, config);

      // Copy governance templates
      const governanceDir = resolveTemplatesDir(__dirname, 'governance');

      if (fs.existsSync(governanceDir)) {
        // Copy .sidstack content
        this.copyDir(path.join(governanceDir, '.sidstack'), sidstackDir);

        // Copy CLAUDE.md template
        const claudeTemplate = path.join(governanceDir, 'CLAUDE.md.template');
        if (fs.existsSync(claudeTemplate)) {
          let content = fs.readFileSync(claudeTemplate, 'utf-8');
          content = content.replace(/\{projectName\}/g, name);
          fs.writeFileSync(path.join(workspaceRoot, 'CLAUDE.md'), content);
        }
      }

      // Step 4: Create initial worktree (wt-1) if not skipped
      let wt1Path: string | undefined;
      if (!skipWorktree) {
        if (!json) {
          this.log('4. Creating initial worktree (wt-1)...');
        }

        wt1Path = path.join(workspaceRoot, 'wt-1');
        execSync(`git -C "${bareDir}" worktree add "${wt1Path}" ${branch}`, {
          stdio: json ? 'pipe' : 'inherit',
        });

        // Create .sidstack-local marker
        ensureSidstackLocal(wt1Path);
        updateWorktreeStatus(wt1Path, {
          status: 'idle',
          branch,
        });

        // Update config with worktrees
        config.worktrees = ['main', 'wt-1'];
        saveWorkspaceConfig(workspaceRoot, config);
      }

      // Step 5: Create .gitignore at workspace level
      const gitignoreContent = `# SidStack workspace
.sidstack-local/
*.log
.DS_Store
`;
      fs.writeFileSync(path.join(workspaceRoot, '.gitignore'), gitignoreContent);

      if (json) {
        this.log(JSON.stringify(successResponse('new', {
          name,
          workspaceRoot,
          projectId: config.projectId,
          bareRepo: bareDir,
          mainWorktree: mainDir,
          initialWorktree: wt1Path,
          branch,
        }), null, 2));
      } else {
        this.log('');
        this.log('✓ Workspace created successfully!');
        this.log('');
        this.log(`  Workspace: ${workspaceRoot}`);
        this.log(`  Project ID: ${config.projectId}`);
        this.log(`  Main branch: ${branch}`);
        this.log('');
        this.log('Structure:');
        this.log(`  ${workspaceRoot}/`);
        this.log('  ├── .sidstack/     # Shared governance & knowledge');
        this.log('  ├── CLAUDE.md      # Shared AI instructions');
        this.log('  ├── .bare/         # Git bare repository');
        this.log('  ├── main/          # Main branch worktree');
        if (wt1Path) {
          this.log('  └── wt-1/          # Working worktree (ready to use)');
        }
        this.log('');
        this.log('Next steps:');
        if (wt1Path) {
          this.log(`  cd ${wt1Path}`);
          this.log('  # Start working on your code');
        } else {
          this.log(`  cd ${workspaceRoot}`);
          this.log('  sidstack worktree add wt-1');
        }
      }
    } catch (error) {
      // Cleanup on failure
      if (fs.existsSync(workspaceRoot)) {
        fs.rmSync(workspaceRoot, { recursive: true, force: true });
      }

      const message = error instanceof Error ? error.message : String(error);
      if (json) {
        this.log(JSON.stringify(errorResponse('new', [
          { code: 'CREATE_ERROR', message: `Failed to create workspace: ${message}` },
        ]), null, 2));
      } else {
        this.error(`Failed to create workspace: ${message}`);
      }
    }
  }

  private copyDir(src: string, dest: string): void {
    if (!fs.existsSync(src)) return;

    fs.mkdirSync(dest, { recursive: true });

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDir(srcPath, destPath);
      } else {
        // Skip config.json as we create our own
        if (entry.name === 'config.json') continue;
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
