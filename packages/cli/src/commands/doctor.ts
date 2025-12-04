import { execSync } from 'child_process';

import { Command } from '@oclif/core';

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

    this.log('');
    this.log('Service health checks:');
    this.log('  (Not yet implemented - services need to be running)');
    this.log('');
  }
}
