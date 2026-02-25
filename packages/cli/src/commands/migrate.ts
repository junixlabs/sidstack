import { randomUUID } from 'crypto';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { Command, Flags } from '@oclif/core';

import {
  detectWorkspace,
  saveWorkspaceConfig,
  loadWorkspaceConfig,
  ensureSidstackLocal,
  updateWorktreeStatus,
  type WorkspaceConfig,
} from '@sidstack/shared';
import { successResponse, errorResponse, ExitCodes } from '../lib/output.js';
import { resolveTemplatesDir } from '../lib/resolve-paths.js';

export default class Migrate extends Command {
  static description = 'Migrate a legacy SidStack project to workspace structure with worktree support';

  static examples = [
    '<%= config.bin %> migrate',
    '<%= config.bin %> migrate --dry-run',
    '<%= config.bin %> migrate --no-backup',
    '<%= config.bin %> migrate --rollback',
  ];

  static flags = {
    'dry-run': Flags.boolean({
      char: 'd',
      description: 'Show what would be done without making changes',
      default: false,
    }),
    'no-backup': Flags.boolean({
      description: 'Skip creating backup before migration',
      default: false,
    }),
    rollback: Flags.boolean({
      char: 'r',
      description: 'Rollback a previous migration using backup',
      default: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Force migration even if already a workspace',
      default: false,
    }),
    json: Flags.boolean({
      char: 'j',
      description: 'Output in JSON format',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Migrate);
    const { json, force } = flags;
    const dryRun = flags['dry-run'];
    const noBackup = flags['no-backup'];

    const projectPath = process.cwd();

    // Handle rollback
    if (flags.rollback) {
      await this.rollback(projectPath, json);
      return;
    }

    // Check if already a workspace
    const workspace = detectWorkspace(projectPath);

    if (workspace?.isWorkspaceStructure && !force) {
      if (json) {
        this.log(JSON.stringify(errorResponse('migrate', [
          { code: 'ALREADY_WORKSPACE', message: 'Already a workspace structure. Use --force to re-migrate.' },
        ]), null, 2));
      } else {
        this.error('Already a workspace structure. Use --force to re-migrate.');
      }
      return;
    }

    // Check for .sidstack directory (legacy project)
    const sidstackDir = path.join(projectPath, '.sidstack');
    if (!fs.existsSync(sidstackDir)) {
      if (json) {
        this.log(JSON.stringify(errorResponse('migrate', [
          { code: 'NOT_SIDSTACK_PROJECT', message: 'Not a SidStack project. Run `sidstack init` first.' },
        ], ExitCodes.NOT_INITIALIZED), null, 2));
      } else {
        this.error('Not a SidStack project. Run `sidstack init` first.');
      }
      return;
    }

    // Check for git
    const gitDir = path.join(projectPath, '.git');
    if (!fs.existsSync(gitDir)) {
      if (json) {
        this.log(JSON.stringify(errorResponse('migrate', [
          { code: 'NOT_GIT_REPO', message: 'Not a git repository. Initialize git first.' },
        ]), null, 2));
      } else {
        this.error('Not a git repository. Initialize git first.');
      }
      return;
    }

    // Check for uncommitted changes
    try {
      const gitStatus = execSync('git status --porcelain', {
        cwd: projectPath,
        encoding: 'utf-8',
      }).trim();

      if (gitStatus && !force) {
        if (json) {
          this.log(JSON.stringify(errorResponse('migrate', [
            {
              code: 'UNCOMMITTED_CHANGES',
              message: 'Uncommitted changes detected. Commit or stash them first, or use --force.',
            },
          ]), null, 2));
        } else {
          this.error('Uncommitted changes detected. Commit or stash them first, or use --force.');
        }
        return;
      }
    } catch {
      // Ignore git errors
    }

    // Load existing config
    let existingConfig: WorkspaceConfig | null = null;
    try {
      existingConfig = loadWorkspaceConfig(projectPath);
    } catch {
      // No config or invalid
    }

    const projectName = existingConfig?.projectName || path.basename(projectPath);
    const projectId = existingConfig?.projectId || randomUUID();

    if (!json) {
      this.log('');
      this.log('SidStack Migration');
      this.log('==================');
      this.log('');
      this.log(`Project: ${projectName}`);
      this.log(`Path: ${projectPath}`);
      this.log(`Project ID: ${projectId}`);
      this.log('');
    }

    if (dryRun) {
      this.showDryRun(projectPath, projectName);
      return;
    }

    try {
      // Step 1: Create backup
      let backupPath: string | undefined;
      if (!noBackup) {
        if (!json) {
          this.log('1. Creating backup...');
        }
        backupPath = await this.createBackup(projectPath);
        if (!json) {
          this.log(`   Backup: ${backupPath}`);
        }
      } else {
        if (!json) {
          this.log('1. Skipping backup (--no-backup)');
        }
      }

      // Step 2: Get current branch
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: projectPath,
        encoding: 'utf-8',
      }).trim();

      if (!json) {
        this.log(`2. Current branch: ${currentBranch}`);
      }

      // Step 3: Create bare repo
      if (!json) {
        this.log('3. Creating bare repository...');
      }

      const bareDir = path.join(projectPath, '.bare');
      const tempBare = path.join(projectPath, '.bare-temp');

      // Clone to temp bare
      execSync(`git clone --bare "${projectPath}" "${tempBare}"`, { stdio: 'pipe' });

      // Step 4: Move files to temp
      if (!json) {
        this.log('4. Reorganizing files...');
      }

      const tempDir = path.join(projectPath, '.migrate-temp');
      fs.mkdirSync(tempDir, { recursive: true });

      // Move all files except .bare-temp and .migrate-temp
      const entries = fs.readdirSync(projectPath);
      for (const entry of entries) {
        if (entry === '.bare-temp' || entry === '.migrate-temp') continue;

        const srcPath = path.join(projectPath, entry);
        const destPath = path.join(tempDir, entry);

        fs.renameSync(srcPath, destPath);
      }

      // Rename temp bare to .bare
      fs.renameSync(tempBare, bareDir);

      // Step 5: Create main worktree
      if (!json) {
        this.log('5. Creating main worktree...');
      }

      const mainDir = path.join(projectPath, 'main');
      execSync(`git -C "${bareDir}" worktree add "${mainDir}" ${currentBranch}`, { stdio: 'pipe' });

      // Step 6: Restore files to main (except .git)
      if (!json) {
        this.log('6. Restoring project files...');
      }

      const tempEntries = fs.readdirSync(tempDir);
      for (const entry of tempEntries) {
        if (entry === '.git') continue;

        const srcPath = path.join(tempDir, entry);
        const destPath = path.join(mainDir, entry);

        // Remove if exists in main (from git checkout)
        if (fs.existsSync(destPath)) {
          fs.rmSync(destPath, { recursive: true, force: true });
        }

        fs.renameSync(srcPath, destPath);
      }

      // Cleanup temp
      fs.rmSync(tempDir, { recursive: true, force: true });

      // Step 7: Move .sidstack to workspace level
      if (!json) {
        this.log('7. Moving .sidstack to workspace level...');
      }

      const mainSidstack = path.join(mainDir, '.sidstack');
      const workspaceSidstack = path.join(projectPath, '.sidstack');

      if (fs.existsSync(mainSidstack)) {
        // Copy contents, preserving existing workspace .sidstack
        this.copyDirMerge(mainSidstack, workspaceSidstack);
        fs.rmSync(mainSidstack, { recursive: true, force: true });
      }

      // Step 8: Update config
      if (!json) {
        this.log('8. Updating configuration...');
      }

      const config: WorkspaceConfig = {
        projectId,
        projectName,
        projectPath: projectPath,
        version: existingConfig?.version || '1.0.0',
        createdAt: existingConfig?.createdAt || new Date().toISOString(),
        isWorkspace: true,
        worktrees: ['main'],
      };

      saveWorkspaceConfig(projectPath, config);

      // Step 9: Create CLAUDE.md at workspace level if not exists
      const claudeMd = path.join(projectPath, 'CLAUDE.md');
      const mainClaudeMd = path.join(mainDir, 'CLAUDE.md');

      if (fs.existsSync(mainClaudeMd) && !fs.existsSync(claudeMd)) {
        fs.renameSync(mainClaudeMd, claudeMd);
      } else if (fs.existsSync(mainClaudeMd)) {
        // Merge or keep workspace version
        fs.rmSync(mainClaudeMd);
      }

      // If no CLAUDE.md, create from template
      if (!fs.existsSync(claudeMd)) {
        const governanceDir = resolveTemplatesDir(__dirname, 'governance');
        const claudeTemplate = path.join(governanceDir, 'CLAUDE.md.template');
        if (fs.existsSync(claudeTemplate)) {
          let content = fs.readFileSync(claudeTemplate, 'utf-8');
          content = content.replace(/\{projectName\}/g, projectName);
          fs.writeFileSync(claudeMd, content);
        }
      }

      // Step 10: Create wt-1 worktree
      if (!json) {
        this.log('9. Creating wt-1 worktree...');
      }

      const wt1Dir = path.join(projectPath, 'wt-1');
      execSync(`git -C "${bareDir}" worktree add "${wt1Dir}" ${currentBranch}`, { stdio: 'pipe' });

      ensureSidstackLocal(wt1Dir);
      updateWorktreeStatus(wt1Dir, {
        status: 'idle',
        branch: currentBranch,
      });

      config.worktrees = ['main', 'wt-1'];
      saveWorkspaceConfig(projectPath, config);

      // Step 11: Create .gitignore at workspace level
      const gitignoreContent = `# SidStack workspace
.sidstack-local/
*.log
.DS_Store
.migrate-backup/
`;
      fs.writeFileSync(path.join(projectPath, '.gitignore'), gitignoreContent);

      // Step 12: Move .claude to main if exists at workspace level
      const workspaceClaude = path.join(projectPath, '.claude');
      const mainClaude = path.join(mainDir, '.claude');

      // Keep .claude in main (it's project-specific, not workspace-level)
      // But the hooks and settings should work from worktree

      if (json) {
        this.log(JSON.stringify(successResponse('migrate', {
          workspace: projectPath,
          projectId,
          projectName,
          branch: currentBranch,
          worktrees: ['main', 'wt-1'],
          backup: backupPath,
          rollbackCommand: backupPath ? `sidstack migrate --rollback` : undefined,
        }), null, 2));
      } else {
        this.log('');
        this.log('✓ Migration complete!');
        this.log('');
        this.log('Structure:');
        this.log(`  ${projectPath}/`);
        this.log('  ├── .sidstack/     # Shared governance & knowledge');
        this.log('  ├── CLAUDE.md      # Shared AI instructions');
        this.log('  ├── .bare/         # Git bare repository');
        this.log('  ├── main/          # Main branch (your code)');
        this.log('  └── wt-1/          # Working worktree');
        this.log('');
        if (backupPath) {
          this.log(`Backup: ${backupPath}`);
          this.log('To rollback: sidstack migrate --rollback');
          this.log('');
        }
        this.log('Next steps:');
        this.log(`  cd ${wt1Dir}`);
        this.log('  # Start working');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Try to cleanup
      this.tryCleanup(projectPath);

      if (json) {
        this.log(JSON.stringify(errorResponse('migrate', [
          { code: 'MIGRATION_FAILED', message: `Migration failed: ${message}` },
        ]), null, 2));
      } else {
        this.error(`Migration failed: ${message}\n\nUse --rollback to restore from backup if available.`);
      }
    }
  }

  private showDryRun(projectPath: string, projectName: string): void {
    this.log('[DRY RUN] Would perform the following steps:');
    this.log('');
    this.log('1. Create backup at .migrate-backup/');
    this.log('2. Create .bare/ (git bare repository)');
    this.log('3. Create main/ worktree with current code');
    this.log('4. Move .sidstack/ to workspace level');
    this.log('5. Create/move CLAUDE.md to workspace level');
    this.log('6. Create wt-1/ worktree');
    this.log('7. Update config.json with isWorkspace: true');
    this.log('');
    this.log('Result structure:');
    this.log(`  ${projectPath}/`);
    this.log('  ├── .sidstack/     # Shared');
    this.log('  ├── CLAUDE.md      # Shared');
    this.log('  ├── .bare/         # Git bare repo');
    this.log('  ├── main/          # Main branch');
    this.log('  └── wt-1/          # Working worktree');
    this.log('');
    this.log('Run without --dry-run to perform migration.');
  }

  private async createBackup(projectPath: string): Promise<string> {
    const backupDir = path.join(projectPath, '.migrate-backup');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-${timestamp}`);

    fs.mkdirSync(backupPath, { recursive: true });

    // Backup key directories and files
    const toBackup = ['.sidstack', '.git', 'CLAUDE.md', '.claude'];

    for (const item of toBackup) {
      const srcPath = path.join(projectPath, item);
      const destPath = path.join(backupPath, item);

      if (fs.existsSync(srcPath)) {
        if (fs.statSync(srcPath).isDirectory()) {
          this.copyDir(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }

    // Save metadata
    const metadata = {
      timestamp: new Date().toISOString(),
      projectPath,
      items: toBackup.filter(item => fs.existsSync(path.join(projectPath, item))),
    };
    fs.writeFileSync(path.join(backupPath, 'metadata.json'), JSON.stringify(metadata, null, 2));

    return backupPath;
  }

  private async rollback(projectPath: string, json: boolean): Promise<void> {
    const backupDir = path.join(projectPath, '.migrate-backup');

    if (!fs.existsSync(backupDir)) {
      if (json) {
        this.log(JSON.stringify(errorResponse('migrate', [
          { code: 'NO_BACKUP', message: 'No backup found. Cannot rollback.' },
        ]), null, 2));
      } else {
        this.error('No backup found. Cannot rollback.');
      }
      return;
    }

    // Find latest backup
    const backups = fs.readdirSync(backupDir)
      .filter(d => d.startsWith('backup-'))
      .sort()
      .reverse();

    if (backups.length === 0) {
      if (json) {
        this.log(JSON.stringify(errorResponse('migrate', [
          { code: 'NO_BACKUP', message: 'No backup found. Cannot rollback.' },
        ]), null, 2));
      } else {
        this.error('No backup found. Cannot rollback.');
      }
      return;
    }

    const latestBackup = path.join(backupDir, backups[0]);

    if (!json) {
      this.log('');
      this.log('Rolling back migration...');
      this.log(`Using backup: ${latestBackup}`);
      this.log('');
    }

    try {
      // Remove workspace structure
      const toRemove = ['.bare', 'main', 'wt-1', 'wt-2', 'wt-3'];
      for (const item of toRemove) {
        const itemPath = path.join(projectPath, item);
        if (fs.existsSync(itemPath)) {
          fs.rmSync(itemPath, { recursive: true, force: true });
        }
      }

      // Restore from backup
      const metadata = JSON.parse(fs.readFileSync(path.join(latestBackup, 'metadata.json'), 'utf-8'));

      for (const item of metadata.items) {
        const srcPath = path.join(latestBackup, item);
        const destPath = path.join(projectPath, item);

        if (fs.existsSync(srcPath)) {
          // Remove existing
          if (fs.existsSync(destPath)) {
            fs.rmSync(destPath, { recursive: true, force: true });
          }

          if (fs.statSync(srcPath).isDirectory()) {
            this.copyDir(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      }

      // Update config to remove workspace flag
      try {
        const config = loadWorkspaceConfig(projectPath);
        delete config.isWorkspace;
        delete config.worktrees;
        saveWorkspaceConfig(projectPath, config);
      } catch {
        // Ignore config errors
      }

      if (json) {
        this.log(JSON.stringify(successResponse('migrate', {
          rollback: true,
          backup: latestBackup,
          restored: metadata.items,
        }), null, 2));
      } else {
        this.log('✓ Rollback complete!');
        this.log('');
        this.log('Restored:');
        for (const item of metadata.items) {
          this.log(`  - ${item}`);
        }
        this.log('');
        this.log('Your project has been restored to its pre-migration state.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (json) {
        this.log(JSON.stringify(errorResponse('migrate', [
          { code: 'ROLLBACK_FAILED', message: `Rollback failed: ${message}` },
        ]), null, 2));
      } else {
        this.error(`Rollback failed: ${message}`);
      }
    }
  }

  private tryCleanup(projectPath: string): void {
    // Try to cleanup partial migration
    const toClean = ['.bare-temp', '.migrate-temp'];
    for (const item of toClean) {
      const itemPath = path.join(projectPath, item);
      if (fs.existsSync(itemPath)) {
        try {
          fs.rmSync(itemPath, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  private copyDir(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  private copyDirMerge(src: string, dest: string): void {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirMerge(srcPath, destPath);
      } else {
        // Only copy if not exists in dest
        if (!fs.existsSync(destPath)) {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }
  }
}
