import * as vscode from 'vscode';

export interface SidStackConfig {
  apiPort: number;
  autoStartServer: boolean;
  refreshInterval: number;
  projectId: string;
}

export function getConfig(): SidStackConfig {
  const config = vscode.workspace.getConfiguration('sidstack');
  return {
    apiPort: config.get<number>('apiPort', 19432),
    autoStartServer: config.get<boolean>('autoStartServer', true),
    refreshInterval: config.get<number>('refreshInterval', 30),
    projectId: config.get<string>('projectId', 'sidstack'),
  };
}

export function getApiBaseUrl(): string {
  const { apiPort } = getConfig();
  return `http://localhost:${apiPort}`;
}

export function getProjectPath(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  return folders?.[0]?.uri.fsPath;
}
