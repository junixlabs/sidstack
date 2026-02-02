import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ServerManager } from './server-manager';
import { StatusBarManager } from './status-bar';
import { TasksTreeProvider } from './providers/tasks-tree';
import { KnowledgeTreeProvider } from './providers/knowledge-tree';
import { TicketsTreeProvider } from './providers/tickets-tree';
import { TrainingTreeProvider } from './providers/training-tree';
import { registerCommands } from './commands';
import { getConfig } from './config';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspacePath) { return; }

  // Verify .sidstack directory exists
  const sidstackDir = path.join(workspacePath, '.sidstack');
  if (!fs.existsSync(sidstackDir)) {
    context.subscriptions.push(
      vscode.commands.registerCommand('sidstack.setupMcp', () => {
        vscode.window.showWarningMessage(
          'No .sidstack directory found. Run `npx @sidstack/cli init` first.',
        );
      }),
    );
    return;
  }

  // ─── Server Manager ────────────────────────────────────────────────────

  const serverManager = new ServerManager();
  context.subscriptions.push(serverManager);

  // UX-2: Set context key for when clauses (viewsWelcome, commandPalette)
  const setConnectionContext = (connected: boolean) => {
    vscode.commands.executeCommand('setContext', 'sidstack.connected', connected);
  };

  serverManager.onConnectionChanged(setConnectionContext);

  const connected = await serverManager.ensureRunning();
  setConnectionContext(connected);

  if (!connected) {
    vscode.window.showWarningMessage(
      'SidStack API server is not running. Some features may be unavailable.',
      'Start Server',
    ).then((choice) => {
      if (choice === 'Start Server') {
        serverManager.ensureRunning();
      }
    });
  }

  serverManager.startHealthMonitor();

  // ─── Tree Providers (UX-3: createTreeView for badges + collapseAll) ────

  const tasksProvider = new TasksTreeProvider();
  const knowledgeProvider = new KnowledgeTreeProvider();
  const ticketsProvider = new TicketsTreeProvider();
  const trainingProvider = new TrainingTreeProvider();

  const tasksView = vscode.window.createTreeView('sidstack.tasks', {
    treeDataProvider: tasksProvider,
    showCollapseAll: true,
  });

  const knowledgeView = vscode.window.createTreeView('sidstack.knowledge', {
    treeDataProvider: knowledgeProvider,
    showCollapseAll: true,
  });

  const ticketsView = vscode.window.createTreeView('sidstack.tickets', {
    treeDataProvider: ticketsProvider,
    showCollapseAll: true,
  });

  const trainingView = vscode.window.createTreeView('sidstack.training', {
    treeDataProvider: trainingProvider,
    showCollapseAll: true,
  });

  context.subscriptions.push(tasksView, knowledgeView, ticketsView, trainingView);

  // ─── Status Bar ────────────────────────────────────────────────────────

  const statusBarManager = new StatusBarManager(serverManager);
  context.subscriptions.push(statusBarManager);

  // ─── Commands ──────────────────────────────────────────────────────────

  registerCommands(context, {
    tasks: tasksProvider,
    knowledge: knowledgeProvider,
    tickets: ticketsProvider,
    training: trainingProvider,
    statusBar: statusBarManager,
  });

  // ─── Auto-Refresh + Badge Updates ──────────────────────────────────────

  const refreshInterval = getConfig().refreshInterval * 1000;
  const autoRefresh = setInterval(() => {
    if (serverManager.isConnected) {
      tasksProvider.refresh();
      knowledgeProvider.refresh();
      ticketsProvider.refresh();
      trainingProvider.refresh();

      // UX-3: Update badge counts
      updateBadges();
    }
  }, refreshInterval);

  context.subscriptions.push({
    dispose: () => clearInterval(autoRefresh),
  });

  // Badge update helper
  const updateBadges = () => {
    const activeCount = tasksProvider.getActiveCount();
    tasksView.badge = activeCount > 0
      ? { value: activeCount, tooltip: `${activeCount} task${activeCount > 1 ? 's' : ''} in progress` }
      : undefined;

    const newTicketCount = ticketsProvider.getNewCount();
    ticketsView.badge = newTicketCount > 0
      ? { value: newTicketCount, tooltip: `${newTicketCount} new ticket${newTicketCount > 1 ? 's' : ''}` }
      : undefined;
  };

  // Initial badge update after first data load
  setTimeout(updateBadges, 3000);

  // UX-4: No activation notification (follows VS Code guidelines)
}

export function deactivate(): void {
  // All cleanup handled by context.subscriptions
}
