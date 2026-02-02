import { execSync } from 'child_process';

export interface PrerequisiteResult {
  name: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
  suggestion?: string;
}

export interface PrerequisitesReport {
  results: PrerequisiteResult[];
  canProceed: boolean;
  claudeAvailable: boolean;
}

function checkGitRepo(projectPath: string): PrerequisiteResult {
  try {
    execSync('git rev-parse --is-inside-work-tree', {
      cwd: projectPath,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return { name: 'Git repository', status: 'ok', message: 'Git repository detected' };
  } catch {
    return {
      name: 'Git repository',
      status: 'warn',
      message: 'Not a git repository',
      suggestion: 'Run `git init` first for .gitignore and hooks support',
    };
  }
}

function checkNode(): PrerequisiteResult {
  try {
    const version = execSync('node --version', { stdio: 'pipe', encoding: 'utf-8' }).trim();
    const major = parseInt(version.replace('v', '').split('.')[0], 10);
    if (major >= 18) {
      return { name: 'Node.js', status: 'ok', message: `Node.js ${version}` };
    }
    return {
      name: 'Node.js',
      status: 'error',
      message: `Node.js ${version} (requires >= 18)`,
      suggestion: 'Upgrade Node.js to version 18 or later',
    };
  } catch {
    return {
      name: 'Node.js',
      status: 'error',
      message: 'Node.js not found',
      suggestion: 'Install Node.js 18+ from https://nodejs.org',
    };
  }
}

function checkClaudeCli(): PrerequisiteResult {
  try {
    execSync('claude --version', { stdio: 'pipe', encoding: 'utf-8' });
    return { name: 'Claude CLI', status: 'ok', message: 'Claude CLI installed' };
  } catch {
    return {
      name: 'Claude CLI',
      status: 'warn',
      message: 'Claude CLI not found',
      suggestion: 'Install with: npm i -g @anthropic-ai/claude-code',
    };
  }
}

function checkNpx(): PrerequisiteResult {
  try {
    execSync('npx --version', { stdio: 'pipe', encoding: 'utf-8' });
    return { name: 'npx', status: 'ok', message: 'npx available' };
  } catch {
    return {
      name: 'npx',
      status: 'warn',
      message: 'npx not found',
      suggestion: 'npx is required for .mcp.json to work. Install Node.js 18+ which includes npx.',
    };
  }
}

export function checkPrerequisites(projectPath: string): PrerequisitesReport {
  const results = [
    checkGitRepo(projectPath),
    checkNode(),
    checkClaudeCli(),
    checkNpx(),
  ];

  return {
    results,
    canProceed: results.every((r) => r.status !== 'error'),
    claudeAvailable: results.find((r) => r.name === 'Claude CLI')?.status === 'ok',
  };
}
