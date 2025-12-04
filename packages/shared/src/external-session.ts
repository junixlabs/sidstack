/**
 * External Claude Session Launcher
 *
 * Utility to detect and launch Claude Code sessions in external terminals
 * (iTerm, Terminal.app, Warp, Alacritty, Kitty, Ghostty).
 *
 * Key finding: Claude Code uses raw terminal mode, so Enter creates newline.
 * Solution: Pass prompt as CLI argument instead of typing into session.
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';

// ============================================================================
// Types
// ============================================================================

export type TerminalApp =
  | 'iTerm'
  | 'Terminal'
  | 'Warp'
  | 'Alacritty'
  | 'kitty'
  | 'ghostty'
  | 'Hyper';

export type LaunchMode =
  | 'normal'
  | 'skip-permissions'
  | 'continue'
  | 'resume'
  | 'print'
  | 'verbose';

export type WindowMode = 'always-new' | 'per-project-tabs' | 'per-project-splits';

export interface SessionContext {
  taskId?: string;
  moduleId?: string;
  filePath?: string;
  prompt?: string;
}

export interface LaunchOptions {
  projectDir: string;
  context?: SessionContext;
  terminal?: TerminalApp;
  mode?: LaunchMode;
  additionalFlags?: string[];
  /** Claude session ID to resume (used with mode='resume') */
  resumeSessionId?: string;
  /** Window mode: 'always-new' creates new window, 'per-project-tabs' reuses project window */
  windowMode?: WindowMode;
}

export interface LaunchResult {
  success: boolean;
  terminal: TerminalApp;
  command: string;
  pid?: number;
  terminalWindowId?: string;
  error?: string;
  /** Claude's internal session ID (UUID) if detected */
  claudeSessionId?: string;
}

// Terminal priority for auto-detection
const TERMINAL_PRIORITY: TerminalApp[] = [
  'iTerm',
  'Warp',
  'ghostty',
  'kitty',
  'Alacritty',
  'Hyper',
  'Terminal',
];

// ============================================================================
// Terminal Detection
// ============================================================================

/**
 * Normalize terminal name from TERM_PROGRAM env var
 */
function normalizeTerminalName(termProgram: string): TerminalApp | null {
  const normalized = termProgram.toLowerCase();

  if (normalized.includes('iterm')) return 'iTerm';
  if (normalized.includes('warp')) return 'Warp';
  if (normalized.includes('ghostty')) return 'ghostty';
  if (normalized.includes('kitty')) return 'kitty';
  if (normalized.includes('alacritty')) return 'Alacritty';
  if (normalized.includes('hyper')) return 'Hyper';
  if (normalized === 'apple_terminal' || normalized === 'terminal') return 'Terminal';

  return null;
}

/**
 * Check if a terminal app is installed
 */
function isTerminalInstalled(terminal: TerminalApp): boolean {
  const appPaths = [
    `/Applications/${terminal}.app`,
    `/Applications/${terminal === 'iTerm' ? 'iTerm' : terminal}.app`,
    `${process.env.HOME}/Applications/${terminal}.app`,
  ];

  // Special cases
  if (terminal === 'iTerm') {
    appPaths.push('/Applications/iTerm.app');
  }
  if (terminal === 'Terminal') {
    appPaths.push('/System/Applications/Utilities/Terminal.app');
  }

  return appPaths.some((p) => fs.existsSync(p));
}

/**
 * Get list of running terminal processes
 */
function getRunningTerminals(): TerminalApp[] {
  try {
    const output = execSync('pgrep -l "iTerm\\|Terminal\\|Warp\\|Alacritty\\|kitty\\|ghostty\\|Hyper"', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const running: TerminalApp[] = [];
    for (const terminal of TERMINAL_PRIORITY) {
      if (output.toLowerCase().includes(terminal.toLowerCase())) {
        running.push(terminal);
      }
    }
    return running;
  } catch {
    return [];
  }
}

/**
 * Detect the best terminal to use
 */
export function detectTerminal(): TerminalApp {
  // Priority 1: TERM_PROGRAM env var (current terminal)
  const termProgram = process.env.TERM_PROGRAM;
  if (termProgram) {
    const normalized = normalizeTerminalName(termProgram);
    if (normalized && isTerminalInstalled(normalized)) {
      return normalized;
    }
  }

  // Priority 2: Check running terminals
  const running = getRunningTerminals();
  if (running.length > 0) {
    return running[0];
  }

  // Priority 3: Check installed terminals in priority order
  for (const terminal of TERMINAL_PRIORITY) {
    if (isTerminalInstalled(terminal)) {
      return terminal;
    }
  }

  // Fallback: macOS default
  return 'Terminal';
}

// ============================================================================
// Command Building
// ============================================================================

/**
 * Build the claude command with flags and prompt
 */
/**
 * Find the actual path to the claude executable
 */
function findClaudePath(): string {
  const homeDir = process.env.HOME || '';

  // Common paths where claude might be installed
  const possiblePaths = [
    '/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/cli.js',
    '/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js',
    `${homeDir}/.npm-global/lib/node_modules/@anthropic-ai/claude-code/cli.js`,
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
    `${homeDir}/.npm-global/bin/claude`,
    `${homeDir}/.local/bin/claude`,
  ];

  for (const claudePath of possiblePaths) {
    try {
      execSync(`"${claudePath}" --version`, { stdio: 'pipe', timeout: 3000 });
      return claudePath;
    } catch {
      // Try next path
    }
  }

  // Fallback to 'claude' and hope it's in PATH
  return 'claude';
}

export function buildClaudeCommand(options: LaunchOptions): string {
  const claudePath = findClaudePath();
  const parts: string[] = [claudePath];

  // Add mode flags
  switch (options.mode) {
    case 'skip-permissions':
      parts.push('--dangerously-skip-permissions');
      break;
    case 'continue':
      parts.push('--continue');
      break;
    case 'resume':
      // Resume session
      if (options.resumeSessionId) {
        // Resume specific session by ID
        parts.push('--resume', options.resumeSessionId);
      } else {
        // Show session picker (--resume without ID)
        parts.push('--resume');
      }
      break;
    case 'print':
      parts.push('--print');
      break;
    case 'verbose':
      parts.push('--verbose');
      break;
  }

  // Add additional flags
  if (options.additionalFlags) {
    parts.push(...options.additionalFlags);
  }

  // Add prompt as argument (if provided)
  if (options.context?.prompt) {
    // Escape single quotes in prompt
    const escapedPrompt = options.context.prompt.replace(/'/g, "'\\''");
    parts.push(`'${escapedPrompt}'`);
  }

  return parts.join(' ');
}

/**
 * Write prompt to a temp file and return the path
 * This avoids all shell escaping issues with special characters
 */
function writePromptToTempFile(prompt: string): string {
  const tempDir = process.env.TMPDIR || '/tmp';
  const filename = `sidstack_prompt_${Date.now()}.txt`;
  const filepath = `${tempDir}${filename}`;

  fs.writeFileSync(filepath, prompt, 'utf-8');

  return filepath;
}

/**
 * Build the full terminal command (cd + claude)
 * Uses temp file for prompts to avoid shell escaping issues
 */
function buildFullCommand(options: LaunchOptions): string {
  // Escape single quotes in project dir
  const escapedDir = options.projectDir.replace(/'/g, "'\\''");
  const claudePath = findClaudePath();

  // Build mode flags
  const modeFlags: string[] = [];
  switch (options.mode) {
    case 'skip-permissions':
      modeFlags.push('--dangerously-skip-permissions');
      break;
    case 'continue':
      modeFlags.push('--continue');
      break;
    case 'resume':
      if (options.resumeSessionId) {
        modeFlags.push('--resume', options.resumeSessionId);
      } else {
        modeFlags.push('--resume');
      }
      break;
    case 'print':
      modeFlags.push('--print');
      break;
    case 'verbose':
      modeFlags.push('--verbose');
      break;
  }

  if (options.additionalFlags) {
    modeFlags.push(...options.additionalFlags);
  }

  const flagsStr = modeFlags.length > 0 ? modeFlags.join(' ') + ' ' : '';

  // If there's a prompt, write to temp file and pipe to claude
  if (options.context?.prompt) {
    const promptFile = writePromptToTempFile(options.context.prompt);
    // Cat temp file and pipe to claude, then remove the temp file
    return `cd '${escapedDir}' && cat '${promptFile}' | ${claudePath} ${flagsStr}- && rm -f '${promptFile}'`;
  }

  return `cd '${escapedDir}' && ${claudePath} ${flagsStr}`;
}

// ============================================================================
// Terminal Launchers
// ============================================================================

// In-memory store for project -> window ID mapping (for per-project-tabs/splits mode)
const projectWindowMap = new Map<string, string>();

// Track split count per project for alternating horizontal/vertical splits
const projectSplitCount = new Map<string, number>();

/**
 * Check if an iTerm window with given ID still exists
 */
function checkITermWindowExists(windowId: string): boolean {
  try {
    // Parse windowId as integer for AppleScript comparison
    const winId = parseInt(windowId, 10);
    if (isNaN(winId)) return false;

    const script = `
      tell application "iTerm"
        set windowIds to id of every window
        set targetId to ${winId}
        if windowIds contains targetId then
          return "true"
        else
          return "false"
        end if
      end tell
    `;
    const result = execSync(`osascript -e '${script}'`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return result.trim() === 'true';
  } catch (e) {
    console.warn('Failed to check iTerm window:', e);
    return false;
  }
}

/**
 * Launch session in iTerm2
 */
async function launchITerm(
  fullCommand: string,
  options?: { windowMode?: WindowMode; projectDir?: string }
): Promise<{ success: boolean; windowId?: string; error?: string }> {
  const windowMode = options?.windowMode || 'always-new';
  const projectDir = options?.projectDir || '';

  // For per-project-tabs mode, try to reuse existing window with new tab
  if (windowMode === 'per-project-tabs' && projectDir) {
    const existingWindowId = projectWindowMap.get(projectDir);

    if (existingWindowId && checkITermWindowExists(existingWindowId)) {
      // Create new tab in existing window
      const tabScript = `
        tell application "iTerm"
          activate
          set targetWindow to (first window whose id is ${existingWindowId})
          tell targetWindow
            set newTab to (create tab with default profile)
            tell current session of newTab
              write text "${fullCommand.replace(/"/g, '\\"')}"
            end tell
          end tell
          return id of targetWindow
        end tell
      `;

      try {
        const result = execSync(`osascript -e '${tabScript.replace(/'/g, "'\\''")}'`, {
          encoding: 'utf-8',
          timeout: 10000,
        });
        return { success: true, windowId: result.trim() };
      } catch (error: any) {
        // If tab creation fails, fall through to create new window
        console.warn('Failed to create tab, creating new window:', error.message);
      }
    }
  }

  // For per-project-splits mode, try to split existing session
  if (windowMode === 'per-project-splits' && projectDir) {
    const existingWindowId = projectWindowMap.get(projectDir);

    if (existingWindowId && checkITermWindowExists(existingWindowId)) {
      // Alternate between horizontal and vertical splits
      const splitCount = projectSplitCount.get(projectDir) || 0;
      const splitDirection = splitCount % 2 === 0 ? 'vertically' : 'horizontally';

      // Split the current session
      const splitScript = `
        tell application "iTerm"
          activate
          set targetWindow to (first window whose id is ${existingWindowId})
          tell current session of current tab of targetWindow
            set newSession to (split ${splitDirection} with default profile)
            tell newSession
              write text "${fullCommand.replace(/"/g, '\\"')}"
            end tell
          end tell
          return id of targetWindow
        end tell
      `;

      try {
        const result = execSync(`osascript -e '${splitScript.replace(/'/g, "'\\''")}'`, {
          encoding: 'utf-8',
          timeout: 10000,
        });
        // Increment split count
        projectSplitCount.set(projectDir, splitCount + 1);
        return { success: true, windowId: result.trim() };
      } catch (error: any) {
        // If split fails, fall through to create new window
        console.warn('Failed to split session, creating new window:', error.message);
      }
    }
  }

  // Create new window (default behavior)
  const script = `
    tell application "iTerm"
      activate
      set newWindow to (create window with default profile)
      tell current session of newWindow
        write text "${fullCommand.replace(/"/g, '\\"')}"
      end tell
      return id of newWindow
    end tell
  `;

  try {
    const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    const windowId = result.trim();

    // Store window ID for project (for per-project-tabs/splits mode)
    if ((windowMode === 'per-project-tabs' || windowMode === 'per-project-splits') && projectDir) {
      projectWindowMap.set(projectDir, windowId);
      // Reset split count for new window
      if (windowMode === 'per-project-splits') {
        projectSplitCount.set(projectDir, 0);
      }
    }

    return { success: true, windowId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// In-memory store for project -> Terminal.app window ID mapping
const projectTerminalWindowMap = new Map<string, string>();

/**
 * Check if a Terminal.app window with given ID still exists
 */
function checkTerminalAppWindowExists(windowId: string): boolean {
  try {
    const script = `
      tell application "Terminal"
        set windowIds to id of every window
        return windowIds contains ${windowId}
      end tell
    `;
    const result = execSync(`osascript -e '${script}'`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return result.trim() === 'true';
  } catch {
    return false;
  }
}

/**
 * Launch session in Terminal.app
 */
async function launchTerminalApp(
  fullCommand: string,
  options?: { windowMode?: WindowMode; projectDir?: string }
): Promise<{ success: boolean; windowId?: string; error?: string }> {
  const windowMode = options?.windowMode || 'always-new';
  const projectDir = options?.projectDir || '';

  // For per-project-tabs/splits mode, try to reuse existing window
  // Note: Terminal.app doesn't support splits, so both modes use tabs
  if ((windowMode === 'per-project-tabs' || windowMode === 'per-project-splits') && projectDir) {
    const existingWindowId = projectTerminalWindowMap.get(projectDir);

    if (existingWindowId && checkTerminalAppWindowExists(existingWindowId)) {
      // Create new tab in existing window
      const tabScript = `
        tell application "Terminal"
          activate
          set targetWindow to (first window whose id is ${existingWindowId})
          tell targetWindow
            set newTab to do script "${fullCommand.replace(/"/g, '\\"')}"
          end tell
          return id of targetWindow
        end tell
      `;

      try {
        const result = execSync(`osascript -e '${tabScript.replace(/'/g, "'\\''")}'`, {
          encoding: 'utf-8',
          timeout: 10000,
        });
        return { success: true, windowId: result.trim() };
      } catch (error: any) {
        // If tab creation fails, fall through to create new window
        console.warn('Failed to create tab, creating new window:', error.message);
      }
    }
  }

  // Create new window (default behavior)
  const script = `
    tell application "Terminal"
      activate
      do script "${fullCommand.replace(/"/g, '\\"')}"
      return id of front window
    end tell
  `;

  try {
    const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    const windowId = result.trim();

    // Store window ID for project (for per-project-tabs/splits mode)
    // Note: Terminal.app doesn't support splits, so per-project-splits falls back to tabs
    if ((windowMode === 'per-project-tabs' || windowMode === 'per-project-splits') && projectDir) {
      projectTerminalWindowMap.set(projectDir, windowId);
    }

    return { success: true, windowId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Launch session in Warp
 */
async function launchWarp(fullCommand: string): Promise<{ success: boolean; error?: string }> {
  // Warp doesn't have great AppleScript support, use open command
  try {
    execSync(`open -a Warp`, { timeout: 5000 });

    // Wait for Warp to open, then use AppleScript to type
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const script = `
      tell application "Warp"
        activate
      end tell
      tell application "System Events"
        keystroke "t" using command down
        delay 0.5
        keystroke "${fullCommand.replace(/"/g, '\\"')}"
        key code 36
      end tell
    `;

    execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Launch session in non-AppleScript terminals (Alacritty, Kitty, Ghostty, Hyper)
 */
async function launchGenericTerminal(
  terminal: TerminalApp,
  fullCommand: string
): Promise<{ success: boolean; pid?: number; error?: string }> {
  try {
    // Use 'open' command with bash -c
    const wrappedCommand = `/bin/bash -c "${fullCommand.replace(/"/g, '\\"')}; exec bash"`;

    const child = spawn('open', ['-a', terminal, '--args', '-e', wrappedCommand], {
      detached: true,
      stdio: 'ignore',
    });

    child.unref();

    return { success: true, pid: child.pid };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// Main Launch Function
// ============================================================================

/**
 * Launch a Claude Code session in an external terminal
 */
export async function launchClaudeSession(options: LaunchOptions): Promise<LaunchResult> {
  // Validate project directory
  if (!fs.existsSync(options.projectDir)) {
    return {
      success: false,
      terminal: options.terminal || 'Terminal',
      command: '',
      error: `Project directory not found: ${options.projectDir}`,
    };
  }

  // Detect or use specified terminal
  const terminal = options.terminal || detectTerminal();

  // Build the full command
  const fullCommand = buildFullCommand(options);

  // Record time before launch for session detection
  const beforeLaunchTime = Date.now();

  // Launch based on terminal type
  let result: { success: boolean; windowId?: string; pid?: number; error?: string };

  // Options for window mode
  const launchOpts = {
    windowMode: options.windowMode,
    projectDir: options.projectDir,
  };

  switch (terminal) {
    case 'iTerm':
      result = await launchITerm(fullCommand, launchOpts);
      break;
    case 'Terminal':
      result = await launchTerminalApp(fullCommand, launchOpts);
      break;
    case 'Warp':
      result = await launchWarp(fullCommand);
      break;
    default:
      result = await launchGenericTerminal(terminal, fullCommand);
  }

  // Try to detect the new Claude session ID (non-blocking)
  let claudeSessionId: string | undefined;
  if (result.success) {
    // Wait a bit for Claude to create the session file, but don't block too long
    claudeSessionId = (await detectNewClaudeSession(options.projectDir, beforeLaunchTime, 3000, 300)) || undefined;
  }

  return {
    success: result.success,
    terminal,
    command: fullCommand,
    pid: result.pid,
    terminalWindowId: result.windowId,
    claudeSessionId,
    error: result.error,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if Claude CLI is installed
 * Checks multiple common locations since PATH may vary between shells
 */
export function isClaudeInstalled(): boolean {
  const homeDir = process.env.HOME || '';

  // Common paths where claude might be installed
  const possiblePaths = [
    'claude', // In PATH
    `${homeDir}/.npm-global/bin/claude`,
    '/usr/local/bin/claude',
    `${homeDir}/.local/bin/claude`,
    `${homeDir}/node_modules/.bin/claude`,
    '/opt/homebrew/bin/claude',
    // npm global install locations (symlink may not exist)
    '/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/cli.js',
    '/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js',
    `${homeDir}/.npm-global/lib/node_modules/@anthropic-ai/claude-code/cli.js`,
  ];

  for (const claudePath of possiblePaths) {
    try {
      execSync(`"${claudePath}" --version`, { stdio: 'pipe', timeout: 5000 });
      return true;
    } catch {
      // Try next path
    }
  }

  // Also try which command as fallback
  try {
    execSync('which claude', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get installation instructions for Claude CLI
 */
export function getClaudeInstallInstructions(): string {
  return 'Claude CLI not installed. Run: npm install -g @anthropic-ai/claude-code';
}

// ============================================================================
// Claude Session Detection
// ============================================================================

/**
 * Get the Claude projects directory path for a workspace
 */
export function getClaudeProjectDir(workspacePath: string): string {
  const homeDir = process.env.HOME || '';
  // Claude converts path to directory name by replacing / with -
  const projectName = workspacePath.replace(/\//g, '-');
  return `${homeDir}/.claude/projects/${projectName}`;
}

/**
 * Get list of Claude sessions for a project, sorted by modification time (newest first)
 */
export function getClaudeSessions(workspacePath: string): Array<{ id: string; modifiedAt: number }> {
  const projectDir = getClaudeProjectDir(workspacePath);

  try {
    if (!fs.existsSync(projectDir)) {
      return [];
    }

    const files = fs.readdirSync(projectDir);
    const sessions = files
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => {
        const filePath = `${projectDir}/${f}`;
        const stats = fs.statSync(filePath);
        return {
          id: f.replace('.jsonl', ''),
          modifiedAt: stats.mtimeMs,
        };
      })
      .sort((a, b) => b.modifiedAt - a.modifiedAt); // Newest first

    return sessions;
  } catch {
    return [];
  }
}

/**
 * Get the most recent Claude session for a project
 */
export function getLatestClaudeSession(workspacePath: string): string | null {
  const sessions = getClaudeSessions(workspacePath);
  return sessions.length > 0 ? sessions[0].id : null;
}

/**
 * Detect new Claude session after launch
 * Polls for new session files and returns the ID if found
 */
export async function detectNewClaudeSession(
  workspacePath: string,
  beforeLaunchTime: number,
  maxWaitMs = 5000,
  pollIntervalMs = 500
): Promise<string | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const sessions = getClaudeSessions(workspacePath);

    // Find a session created after our launch
    const newSession = sessions.find((s) => s.modifiedAt > beforeLaunchTime);
    if (newSession) {
      return newSession.id;
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return null;
}

// ============================================================================
// Session Status Checking
// ============================================================================

export interface SessionStatusCheck {
  isAlive: boolean;
  method: 'pid' | 'window' | 'unknown';
  details?: string;
}

/**
 * Check if a process is still running by PID
 */
export function isProcessRunning(pid: number): boolean {
  try {
    // kill -0 doesn't actually send a signal, just checks if process exists
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if an iTerm window is still open
 */
export function isITermWindowOpen(windowId: string): boolean {
  try {
    const script = `
      tell application "iTerm"
        set windowIds to id of every window
        return windowIds contains ${windowId}
      end tell
    `;
    const result = execSync(`osascript -e '${script}'`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return result.trim() === 'true';
  } catch {
    return false;
  }
}

/**
 * Check if a Terminal.app window is still open
 */
export function isTerminalAppWindowOpen(windowId: string): boolean {
  try {
    const script = `
      tell application "Terminal"
        set windowIds to id of every window
        return windowIds contains ${windowId}
      end tell
    `;
    const result = execSync(`osascript -e '${script}'`, {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return result.trim() === 'true';
  } catch {
    return false;
  }
}

/**
 * Check if a session is still alive
 */
export function checkSessionStatus(
  terminal: TerminalApp,
  pid?: number,
  windowId?: string
): SessionStatusCheck {
  // Method 1: Check by PID (most reliable if available)
  if (pid) {
    const isAlive = isProcessRunning(pid);
    return {
      isAlive,
      method: 'pid',
      details: isAlive ? `Process ${pid} is running` : `Process ${pid} not found`,
    };
  }

  // Method 2: Check by window ID (for AppleScript-supported terminals)
  if (windowId) {
    let isAlive = false;

    switch (terminal) {
      case 'iTerm':
        isAlive = isITermWindowOpen(windowId);
        break;
      case 'Terminal':
        isAlive = isTerminalAppWindowOpen(windowId);
        break;
      default:
        // For other terminals, we can't check window status
        return {
          isAlive: true, // Assume alive if we can't check
          method: 'unknown',
          details: `Cannot check window status for ${terminal}`,
        };
    }

    return {
      isAlive,
      method: 'window',
      details: isAlive ? `Window ${windowId} is open` : `Window ${windowId} not found`,
    };
  }

  // No PID or window ID available
  return {
    isAlive: true, // Assume alive if we can't check
    method: 'unknown',
    details: 'No PID or window ID available for status check',
  };
}
