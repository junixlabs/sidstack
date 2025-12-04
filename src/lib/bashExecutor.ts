/**
 * Bash Executor
 *
 * Execute bash commands directly (for !command syntax).
 */

import { invoke } from "@tauri-apps/api/core";

export interface BashResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  success: boolean;
}

/**
 * Execute a bash command in the specified directory
 */
export async function executeBash(
  command: string,
  workingDir: string,
  onOutput?: (chunk: string, isError: boolean) => void
): Promise<BashResult> {
  try {
    // Use Tauri to execute the command
    const result = await invoke<{
      exit_code: number;
      stdout: string;
      stderr: string;
    }>("execute_bash_command", {
      command,
      working_dir: workingDir,
    });

    // Call output callback if provided
    if (onOutput) {
      if (result.stdout) {
        onOutput(result.stdout, false);
      }
      if (result.stderr) {
        onOutput(result.stderr, true);
      }
    }

    return {
      exitCode: result.exit_code,
      stdout: result.stdout,
      stderr: result.stderr,
      success: result.exit_code === 0,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (onOutput) {
      onOutput(`Error: ${errorMessage}`, true);
    }

    return {
      exitCode: 1,
      stdout: "",
      stderr: errorMessage,
      success: false,
    };
  }
}

/**
 * Format bash result for display
 */
export function formatBashResult(result: BashResult, command: string): string {
  const lines: string[] = [`$ ${command}`];

  if (result.stdout) {
    lines.push(result.stdout);
  }

  if (result.stderr) {
    lines.push(`stderr: ${result.stderr}`);
  }

  if (!result.success) {
    lines.push(`\nExit code: ${result.exitCode}`);
  }

  return lines.join("\n");
}
