import * as vscode from 'vscode';
import { apiClient, type ApiTask } from '../api-client';

// ─── Tree Items ──────────────────────────────────────────────────────────────

class TaskGroupItem extends vscode.TreeItem {
  constructor(
    public readonly status: string,
    public readonly count: number,
  ) {
    super(`${formatStatus(status)} (${count})`, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = `taskGroup-${status}`;
    this.iconPath = statusIcon(status);
  }
}

class TaskItem extends vscode.TreeItem {
  constructor(public readonly task: ApiTask) {
    super(task.title, vscode.TreeItemCollapsibleState.None);
    this.description = task.taskType ? `[${task.taskType}]` : undefined;
    this.tooltip = new vscode.MarkdownString(
      `**${task.title}**\n\n` +
      `Status: ${task.status} | Priority: ${task.priority}\n\n` +
      `Progress: ${task.progress}%\n\n` +
      (task.description ? task.description.slice(0, 200) : ''),
    );
    this.contextValue = `task-${task.status}`;
    this.iconPath = priorityIcon(task.priority);
    this.command = {
      command: 'sidstack.viewTask',
      title: 'View Task',
      arguments: [task.id],
    };
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export class TasksTreeProvider implements vscode.TreeDataProvider<TaskGroupItem | TaskItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private tasks: ApiTask[] = [];

  getActiveCount(): number {
    return this.tasks.filter((t) => t.status === 'in_progress').length;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TaskGroupItem | TaskItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TaskGroupItem | TaskItem): Promise<(TaskGroupItem | TaskItem)[]> {
    if (!element) {
      return this.getRootItems();
    }
    if (element instanceof TaskGroupItem) {
      return this.getTasksForStatus(element.status);
    }
    return [];
  }

  private async getRootItems(): Promise<TaskGroupItem[]> {
    try {
      this.tasks = await apiClient.listTasks();
    } catch {
      this.tasks = [];
    }

    const groups = new Map<string, ApiTask[]>();
    const statusOrder = ['in_progress', 'pending', 'blocked', 'completed', 'failed', 'cancelled'];

    for (const task of this.tasks) {
      const list = groups.get(task.status) || [];
      list.push(task);
      groups.set(task.status, list);
    }

    return statusOrder
      .filter((s) => groups.has(s))
      .map((s) => new TaskGroupItem(s, groups.get(s)!.length));
  }

  private getTasksForStatus(status: string): TaskItem[] {
    return this.tasks
      .filter((t) => t.status === status)
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
      })
      .map((t) => new TaskItem(t));
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusIcon(status: string): vscode.ThemeIcon {
  switch (status) {
    case 'in_progress': return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.yellow'));
    case 'pending': return new vscode.ThemeIcon('circle-outline');
    case 'blocked': return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
    case 'completed': return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
    case 'failed': return new vscode.ThemeIcon('close', new vscode.ThemeColor('charts.red'));
    case 'cancelled': return new vscode.ThemeIcon('dash');
    default: return new vscode.ThemeIcon('circle-outline');
  }
}

function priorityIcon(priority: string): vscode.ThemeIcon {
  switch (priority) {
    case 'high': return new vscode.ThemeIcon('arrow-up', new vscode.ThemeColor('charts.red'));
    case 'medium': return new vscode.ThemeIcon('dash', new vscode.ThemeColor('charts.yellow'));
    case 'low': return new vscode.ThemeIcon('arrow-down', new vscode.ThemeColor('charts.blue'));
    default: return new vscode.ThemeIcon('dash');
  }
}
