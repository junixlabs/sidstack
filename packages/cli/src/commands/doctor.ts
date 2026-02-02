import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { Command } from '@oclif/core';

import { checkPrerequisites } from '../lib/prerequisites.js';
import { verifyInit } from '../lib/init-verify.js';

export default class Doctor extends Command {
  static description = 'Run health checks and diagnostics';

  static examples = ['<%= config.bin %> doctor'];

  async run(): Promise<void> {
    this.log('Running SidStack diagnostics...');
    this.log('');

    // Check Docker
    try {
      const dockerVersion = execSync('docker --version', { encoding: 'utf-8' }).trim();
      this.log(`✓ Docker is installed (${dockerVersion.split(' ')[2]})`);
    } catch {
      this.log('✗ Docker is not installed');
    }

    // Check Docker Compose
    try {
      const composeVersion = execSync('docker compose version', { encoding: 'utf-8' }).trim();
      this.log(`✓ Docker Compose is installed (${composeVersion.split(' ')[3]})`);
    } catch {
      this.log('✗ Docker Compose is not installed');
    }

    // Check Node.js
    try {
      const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
      this.log(`✓ Node.js is installed (${nodeVersion})`);
    } catch {
      this.log('✗ Node.js is not installed');
    }

    // Check Go
    try {
      const goVersion = execSync('go version', { encoding: 'utf-8' }).trim();
      const version = goVersion.split(' ')[2];
      this.log(`✓ Go is installed (${version})`);
    } catch {
      this.log('✗ Go is not installed');
    }

    // Check pnpm
    try {
      const pnpmVersion = execSync('pnpm --version', { encoding: 'utf-8' }).trim();
      this.log(`✓ pnpm is installed (v${pnpmVersion})`);
    } catch {
      this.log('✗ pnpm is not installed');
    }

    // SidStack prerequisites
    this.log('');
    this.log('SidStack Prerequisites:');
    const prereqs = checkPrerequisites(process.cwd());
    for (const r of prereqs.results) {
      const icon = r.status === 'ok' ? '✓' : r.status === 'warn' ? '⚠' : '✗';
      this.log(`  ${icon} ${r.message}`);
    }

    // SidStack project health
    this.log('');
    const sidstackDir = path.join(process.cwd(), '.sidstack');
    if (fs.existsSync(sidstackDir)) {
      this.log('SidStack Project Health:');

      // Read config for version info
      const configPath = path.join(sidstackDir, 'config.json');
      let versionInfo = '';
      if (fs.existsSync(configPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          if (config.version) versionInfo = ` (v${config.version})`;
        } catch {
          // ignore
        }
      }

      const hasGovernance = fs.existsSync(path.join(sidstackDir, 'governance.md'));
      const hasOpenSpec = fs.existsSync(path.join(process.cwd(), 'openspec', 'AGENTS.md'));

      const verification = verifyInit(process.cwd(), {
        governance: hasGovernance,
        openspec: hasOpenSpec,
      });

      for (const check of verification.checks) {
        const icon = check.passed ? '✓' : '✗';
        const label = check.name === '.sidstack/config.json' && versionInfo
          ? `${check.message}${versionInfo}`
          : check.message;
        this.log(`  ${icon} ${label}`);
      }
    } else {
      this.log('SidStack Project Health:');
      this.log('  ⚠ Not initialized (run `sidstack init` first)');
    }

    this.log('');
  }
}
