import * as fs from 'fs';
import * as path from 'path';

export interface VerificationCheck {
  name: string;
  passed: boolean;
  message: string;
}

export interface VerificationResult {
  checks: VerificationCheck[];
  allPassed: boolean;
}

function checkFileExists(filePath: string, name: string): VerificationCheck {
  const exists = fs.existsSync(filePath);
  return {
    name,
    passed: exists,
    message: exists ? name : `${name} — missing`,
  };
}

function checkJsonValid(filePath: string, name: string): VerificationCheck {
  if (!fs.existsSync(filePath)) {
    return { name, passed: false, message: `${name} — missing` };
  }
  try {
    JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return { name, passed: true, message: name };
  } catch {
    return { name, passed: false, message: `${name} — invalid JSON` };
  }
}

function checkMcpConfig(projectPath: string): VerificationCheck {
  const mcpPath = path.join(projectPath, '.mcp.json');
  if (!fs.existsSync(mcpPath)) {
    return { name: '.mcp.json', passed: false, message: '.mcp.json — missing' };
  }
  try {
    const content = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
    const hasSidstack = !!content?.mcpServers?.sidstack;
    return {
      name: '.mcp.json (MCP integration)',
      passed: hasSidstack,
      message: hasSidstack ? '.mcp.json (MCP integration)' : '.mcp.json — missing sidstack server',
    };
  } catch {
    return { name: '.mcp.json', passed: false, message: '.mcp.json — invalid JSON' };
  }
}

function checkClaudeSettings(projectPath: string): VerificationCheck {
  const settingsPath = path.join(projectPath, '.claude', 'settings.local.json');
  if (!fs.existsSync(settingsPath)) {
    return { name: '.claude/settings.local.json', passed: false, message: '.claude/settings.local.json — missing' };
  }
  try {
    const content = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    const enabled = content?.enableAllProjectMcpServers === true;
    return {
      name: '.claude/settings.local.json',
      passed: enabled,
      message: enabled ? '.claude/settings.local.json' : '.claude/settings.local.json — MCP not enabled',
    };
  } catch {
    return { name: '.claude/settings.local.json', passed: false, message: '.claude/settings.local.json — invalid JSON' };
  }
}

function checkGovernance(projectPath: string): VerificationCheck {
  const governancePath = path.join(projectPath, '.sidstack', 'governance.md');
  const hooksDir = path.join(projectPath, '.claude', 'hooks');
  const claudeMdPath = path.join(projectPath, 'CLAUDE.md');

  const hasGovernance = fs.existsSync(governancePath);
  const hasHooks = fs.existsSync(hooksDir);
  const hasClaudeMd = fs.existsSync(claudeMdPath) &&
    fs.readFileSync(claudeMdPath, 'utf-8').includes('SidStack Governance');

  const allGood = hasGovernance && hasHooks && hasClaudeMd;
  return {
    name: 'Governance system',
    passed: allGood,
    message: allGood ? 'Governance system' : 'Governance system — incomplete',
  };
}

function checkOpenSpec(projectPath: string): VerificationCheck {
  const agentsPath = path.join(projectPath, 'openspec', 'AGENTS.md');
  const projectMdPath = path.join(projectPath, 'openspec', 'project.md');
  const allGood = fs.existsSync(agentsPath) && fs.existsSync(projectMdPath);
  return {
    name: 'OpenSpec',
    passed: allGood,
    message: allGood ? 'OpenSpec' : 'OpenSpec — incomplete',
  };
}

function checkGitignore(projectPath: string): VerificationCheck {
  const gitignorePath = path.join(projectPath, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    return { name: '.gitignore', passed: false, message: '.gitignore — missing' };
  }
  const content = fs.readFileSync(gitignorePath, 'utf-8');
  const hasSidstack = content.includes('# SidStack');
  return {
    name: '.gitignore',
    passed: hasSidstack,
    message: hasSidstack ? '.gitignore' : '.gitignore — missing SidStack entries',
  };
}

export function verifyInit(
  projectPath: string,
  options: { governance: boolean; openspec: boolean }
): VerificationResult {
  const checks: VerificationCheck[] = [
    checkJsonValid(path.join(projectPath, '.sidstack', 'config.json'), '.sidstack/config.json'),
    checkMcpConfig(projectPath),
    checkClaudeSettings(projectPath),
  ];

  if (options.governance) {
    checks.push(checkGovernance(projectPath));
  }
  if (options.openspec) {
    checks.push(checkOpenSpec(projectPath));
  }

  checks.push(checkFileExists(path.join(projectPath, 'CLAUDE.md'), 'CLAUDE.md'));
  checks.push(checkGitignore(projectPath));

  return {
    checks,
    allPassed: checks.every((c) => c.passed),
  };
}
