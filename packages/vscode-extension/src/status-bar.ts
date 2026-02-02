import * as vscode from 'vscode';
import { apiClient } from './api-client';
import { getConfig } from './config';
import type { ServerManager } from './server-manager';

export class StatusBarManager implements vscode.Disposable {
  private connectionItem: vscode.StatusBarItem;
  private taskItem: vscode.StatusBarItem;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  // BUG-5 FIX: Store subscription for proper disposal
  private connectionSub: vscode.Disposable;
  private _isConnected: boolean;

  constructor(serverManager: ServerManager) {
    this._isConnected = serverManager.isConnected;

    // Connection status (right-aligned)
    this.connectionItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.connectionItem.command = 'sidstack.refreshAll';
    this.connectionItem.show();

    // Active task (left-aligned)
    this.taskItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.taskItem.command = 'sidstack.refreshAll';
    this.taskItem.show();

    // Listen for connection changes
    this.connectionSub = serverManager.onConnectionChanged((connected) => {
      this._isConnected = connected;
      this.updateConnectionStatus(connected);
    });

    this.updateConnectionStatus(serverManager.isConnected);
    this.startAutoRefresh();
  }

  updateConnectionStatus(connected: boolean): void {
    if (connected) {
      this.connectionItem.text = '$(check) SidStack';
      // UX-5: MarkdownString tooltip
      const tip = new vscode.MarkdownString('', true);
      tip.appendMarkdown('$(check) **SidStack API** -- Connected\n\nClick to refresh all views');
      this.connectionItem.tooltip = tip;
      this.connectionItem.backgroundColor = undefined;
    } else {
      this.connectionItem.text = '$(warning) SidStack';
      const tip = new vscode.MarkdownString('', true);
      tip.appendMarkdown('$(warning) **SidStack API** -- Disconnected\n\nClick to retry connection');
      this.connectionItem.tooltip = tip;
      this.connectionItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
  }

  async updateActiveTask(): Promise<void> {
    // Don't poll when disconnected
    if (!this._isConnected) {
      this.taskItem.text = '$(tasklist) ---';
      this.taskItem.tooltip = 'SidStack API not connected';
      return;
    }

    try {
      const tasks = await apiClient.listTasks('in_progress');
      if (tasks.length > 0) {
        const task = tasks[0];
        const progress = task.progress > 0 ? ` ${task.progress}%` : '';
        const title = task.title.length > 40 ? task.title.slice(0, 37) + '...' : task.title;
        this.taskItem.text = `$(tasklist) ${title}${progress}`;
        // UX-5: MarkdownString tooltip
        const tip = new vscode.MarkdownString('', true);
        tip.appendMarkdown(`**Active Task:** ${task.title}\n\n`);
        tip.appendMarkdown(`| | |\n|---|---|\n`);
        tip.appendMarkdown(`| Progress | ${task.progress}% |\n`);
        tip.appendMarkdown(`| Priority | ${task.priority} |\n`);
        tip.appendMarkdown(`| Type | ${task.taskType || '-'} |\n`);
        this.taskItem.tooltip = tip;
      } else {
        this.taskItem.text = '$(tasklist) No active task';
        this.taskItem.tooltip = 'No task in progress';
      }
    } catch {
      this.taskItem.text = '$(tasklist) ---';
      this.taskItem.tooltip = 'Unable to fetch tasks';
    }
  }

  private startAutoRefresh(): void {
    const intervalSec = getConfig().refreshInterval;
    this.refreshInterval = setInterval(() => {
      this.updateActiveTask();
    }, intervalSec * 1000);

    // Initial fetch
    this.updateActiveTask();
  }

  dispose(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.connectionSub.dispose();
    this.connectionItem.dispose();
    this.taskItem.dispose();
  }
}
