import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { apiClient, type ApiTask, type ApiTicket } from './api-client';
import { getProjectPath } from './config';
import type { TasksTreeProvider } from './providers/tasks-tree';
import type { KnowledgeTreeProvider } from './providers/knowledge-tree';
import type { TicketsTreeProvider } from './providers/tickets-tree';
import type { TrainingTreeProvider } from './providers/training-tree';
import type { StatusBarManager } from './status-bar';

interface Providers {
  tasks: TasksTreeProvider;
  knowledge: KnowledgeTreeProvider;
  tickets: TicketsTreeProvider;
  training: TrainingTreeProvider;
  statusBar: StatusBarManager;
}

// BUG-3 FIX: Extract ID from TreeItem or string argument
// VS Code passes TreeItem objects from context menus, not raw strings
function extractTaskId(arg: unknown): string | undefined {
  if (typeof arg === 'string') { return arg; }
  if (arg && typeof arg === 'object' && 'task' in arg) {
    return (arg as { task: ApiTask }).task.id;
  }
  return undefined;
}

function extractTicketId(arg: unknown): string | undefined {
  if (typeof arg === 'string') { return arg; }
  if (arg && typeof arg === 'object' && 'ticket' in arg) {
    return (arg as { ticket: ApiTicket }).ticket.id;
  }
  return undefined;
}

export function registerCommands(
  context: vscode.ExtensionContext,
  providers: Providers,
): void {
  const { tasks, knowledge, tickets, training, statusBar } = providers;

  // ─── Refresh ─────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('sidstack.refreshAll', () => {
      tasks.refresh();
      knowledge.refresh();
      tickets.refresh();
      training.refresh();
      statusBar.updateActiveTask();
    }),
    vscode.commands.registerCommand('sidstack.refreshTasks', () => tasks.refresh()),
    vscode.commands.registerCommand('sidstack.refreshKnowledge', () => knowledge.refresh()),
    vscode.commands.registerCommand('sidstack.refreshTickets', () => tickets.refresh()),
    vscode.commands.registerCommand('sidstack.refreshTraining', () => training.refresh()),
  );

  // ─── Task Commands ───────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('sidstack.createTask', async () => {
      const title = await vscode.window.showInputBox({
        prompt: 'Task title (e.g., [feature] Add user authentication)',
        placeHolder: '[type] description...',
      });
      if (!title) { return; }

      const description = await vscode.window.showInputBox({
        prompt: 'Task description (press Escape to skip)',
        placeHolder: 'Describe what needs to be done...',
      });
      // undefined = Escape pressed on description, but we allow empty description

      const priority = await vscode.window.showQuickPick(['medium', 'high', 'low'], {
        placeHolder: 'Priority',
      });

      try {
        const task = await apiClient.createTask({
          title,
          description: description || '',
          priority: priority || 'medium',
        });
        vscode.window.showInformationMessage(`Task created: ${task.id}`);
        tasks.refresh();
        statusBar.updateActiveTask();
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to create task: ${error}`);
      }
    }),

    // BUG-3 FIX: Handle TreeItem arg from context menu
    // BUG-2 FIX: Wrap entire body in try/catch
    vscode.commands.registerCommand('sidstack.completeTask', async (arg?: unknown) => {
      try {
        let taskId = extractTaskId(arg);

        if (!taskId) {
          const allTasks = await apiClient.listTasks();
          const activeTasks = allTasks.filter((t) => t.status === 'in_progress' || t.status === 'pending');
          if (activeTasks.length === 0) {
            vscode.window.showInformationMessage('No active tasks to complete.');
            return;
          }
          const pick = await vscode.window.showQuickPick(
            activeTasks.map((t) => ({ label: t.title, description: `${t.status} | ${t.priority}`, id: t.id })),
            { placeHolder: 'Select task to complete' },
          );
          if (!pick) { return; }
          taskId = pick.id;
        }

        await apiClient.completeTask(taskId);
        vscode.window.showInformationMessage('Task completed.');
        tasks.refresh();
        statusBar.updateActiveTask();
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to complete task: ${error}`);
      }
    }),

    vscode.commands.registerCommand('sidstack.viewTask', async (arg: unknown) => {
      const taskId = extractTaskId(arg) || (typeof arg === 'string' ? arg : undefined);
      if (!taskId) { return; }
      try {
        const task = await apiClient.getTask(taskId);
        const doc = await vscode.workspace.openTextDocument({
          content: formatTaskDetail(task),
          language: 'markdown',
        });
        await vscode.window.showTextDocument(doc, { preview: true });
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to load task: ${error}`);
      }
    }),
  );

  // ─── Knowledge Commands ──────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('sidstack.searchKnowledge', async () => {
      const query = await vscode.window.showInputBox({
        prompt: 'Search knowledge base',
        placeHolder: 'Enter search query...',
      });
      if (!query) { return; }

      try {
        const results = await apiClient.searchKnowledge(query);
        if (results.length === 0) {
          vscode.window.showInformationMessage('No results found.');
          return;
        }

        const pick = await vscode.window.showQuickPick(
          results.map((d) => ({ label: d.title || d.id, description: d.type, id: d.id })),
          { placeHolder: `${results.length} results` },
        );
        if (pick) {
          vscode.commands.executeCommand('sidstack.viewKnowledgeDoc', pick.id);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Search failed: ${error}`);
      }
    }),

    vscode.commands.registerCommand('sidstack.viewKnowledgeDoc', async (docId: string) => {
      try {
        const { document: docMeta, content } = await apiClient.getKnowledgeDoc(docId);
        const text = content || docMeta.summary || 'No content available.';
        const doc = await vscode.workspace.openTextDocument({
          content: `# ${docMeta.title || docId}\n\nType: ${docMeta.type} | Status: ${docMeta.status}\n\n---\n\n${text}`,
          language: 'markdown',
        });
        await vscode.window.showTextDocument(doc, { preview: true });
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to load document: ${error}`);
      }
    }),
  );

  // ─── Ticket Commands ─────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('sidstack.createTicket', async () => {
      const title = await vscode.window.showInputBox({
        prompt: 'Ticket title',
        placeHolder: 'Describe the issue or request...',
      });
      if (!title) { return; }

      const type = await vscode.window.showQuickPick(
        ['bug', 'feature', 'improvement', 'task'],
        { placeHolder: 'Ticket type' },
      );

      const priority = await vscode.window.showQuickPick(
        ['medium', 'high', 'low', 'critical'],
        { placeHolder: 'Priority' },
      );

      try {
        const ticket = await apiClient.createTicket({
          title,
          type: type || 'task',
          priority: priority || 'medium',
        });
        vscode.window.showInformationMessage(`Ticket created: ${ticket.id}`);
        tickets.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to create ticket: ${error}`);
      }
    }),

    // BUG-3 FIX: Handle TreeItem arg from context menu
    // BUG-2 FIX: Wrap entire body in try/catch
    vscode.commands.registerCommand('sidstack.convertTicketToTask', async (arg?: unknown) => {
      try {
        let ticketId = extractTicketId(arg);

        if (!ticketId) {
          const allTickets = await apiClient.listTickets();
          const convertible = allTickets.filter((t) => ['new', 'reviewing', 'approved'].includes(t.status));
          if (convertible.length === 0) {
            vscode.window.showInformationMessage('No tickets available to convert.');
            return;
          }
          const pick = await vscode.window.showQuickPick(
            convertible.map((t) => ({ label: t.title, description: `${t.type} | ${t.priority}`, id: t.id })),
            { placeHolder: 'Select ticket to convert to task' },
          );
          if (!pick) { return; }
          ticketId = pick.id;
        }

        const task = await apiClient.convertTicketToTask(ticketId);
        vscode.window.showInformationMessage(`Ticket converted to task: ${task.id}`);
        tickets.refresh();
        tasks.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to convert ticket: ${error}`);
      }
    }),

    vscode.commands.registerCommand('sidstack.viewTicket', async (arg: unknown) => {
      const ticketId = extractTicketId(arg) || (typeof arg === 'string' ? arg : undefined);
      if (!ticketId) { return; }
      try {
        const ticket = await apiClient.getTicket(ticketId);
        const doc = await vscode.workspace.openTextDocument({
          content: formatTicketDetail(ticket),
          language: 'markdown',
        });
        await vscode.window.showTextDocument(doc, { preview: true });
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to load ticket: ${error}`);
      }
    }),
  );

  // ─── Impact Commands ─────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('sidstack.runImpactAnalysis', async () => {
      const description = await vscode.window.showInputBox({
        prompt: 'Describe the change to analyze',
        placeHolder: 'e.g., Refactor authentication module...',
      });
      if (!description) { return; }

      const changeType = await vscode.window.showQuickPick(
        ['feature', 'refactor', 'bugfix', 'migration', 'deletion'],
        { placeHolder: 'Change type' },
      );

      // BUG-1 FIX: Await withProgress and move error handler inside
      try {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: 'Running impact analysis...' },
          async () => {
            const analysis = await apiClient.runImpactAnalysis(description, changeType);
            vscode.window.showInformationMessage(
              `Impact analysis complete: ${analysis.riskLevel || 'unknown'} risk, gate: ${analysis.gateStatus || 'pending'}`,
            );
          },
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Impact analysis failed: ${error}`);
      }
    }),

    vscode.commands.registerCommand('sidstack.checkGate', async () => {
      try {
        const analyses = await apiClient.listImpactAnalyses();
        if (analyses.length === 0) {
          vscode.window.showInformationMessage('No impact analyses found.');
          return;
        }

        const pick = await vscode.window.showQuickPick(
          analyses.map((a) => ({
            label: (a.description || '').slice(0, 60),
            description: `${a.riskLevel || '?'} risk | ${a.gateStatus || '?'}`,
            id: a.id,
          })),
          { placeHolder: 'Select analysis to check gate' },
        );
        if (!pick) { return; }

        const result = await apiClient.checkGate(pick.id);
        const msg = `Gate: ${result.gateStatus}` +
          (result.blockers.length > 0 ? ` | ${result.blockers.length} blockers` : '') +
          (result.warnings.length > 0 ? ` | ${result.warnings.length} warnings` : '');
        vscode.window.showInformationMessage(msg);
      } catch (error) {
        vscode.window.showErrorMessage(`Gate check failed: ${error}`);
      }
    }),
  );

  // ─── MCP Setup ───────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('sidstack.setupMcp', async () => {
      const projectPath = getProjectPath();
      if (!projectPath) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
      }

      const vscodePath = path.join(projectPath, '.vscode');
      const mcpPath = path.join(vscodePath, 'mcp.json');

      const mcpConfig = {
        servers: {
          sidstack: {
            command: 'npx',
            args: ['@sidstack/mcp-server'],
          },
        },
      };

      try {
        if (!fs.existsSync(vscodePath)) {
          fs.mkdirSync(vscodePath, { recursive: true });
        }

        // Merge with existing mcp.json if it exists
        if (fs.existsSync(mcpPath)) {
          let existing: Record<string, unknown>;
          try {
            existing = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
          } catch {
            existing = {};
          }
          if (!existing.servers || typeof existing.servers !== 'object') {
            existing.servers = {};
          }
          (existing.servers as Record<string, unknown>).sidstack = mcpConfig.servers.sidstack;
          fs.writeFileSync(mcpPath, JSON.stringify(existing, null, 2) + '\n');
        } else {
          fs.writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2) + '\n');
        }

        vscode.window.showInformationMessage(
          'MCP server configured. All 22 SidStack tools are now available in Copilot agent mode.',
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to setup MCP: ${error}`);
      }
    }),
  );

  // ─── WebView Panel Commands (Phase 3 stubs - hidden from palette) ──────

  const webviewCommands = [
    'sidstack.openDashboard',
    'sidstack.openTaskManager',
    'sidstack.openKnowledgeBrowser',
    'sidstack.openTicketQueue',
    'sidstack.openTrainingRoom',
    'sidstack.openImpactViewer',
  ];

  for (const cmd of webviewCommands) {
    context.subscriptions.push(
      vscode.commands.registerCommand(cmd, () => {
        vscode.window.showInformationMessage(
          'WebView panels are coming in a future release. Use the sidebar tree views for now.',
        );
      }),
    );
  }
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatTaskDetail(task: ApiTask): string {
  return [
    `# ${task.title}`,
    '',
    `| Field | Value |`,
    `|-------|-------|`,
    `| ID | ${task.id} |`,
    `| Status | ${task.status} |`,
    `| Priority | ${task.priority} |`,
    `| Progress | ${task.progress}% |`,
    task.taskType ? `| Type | ${task.taskType} |` : '',
    task.moduleId ? `| Module | ${task.moduleId} |` : '',
    task.assignedAgent ? `| Assigned | ${task.assignedAgent} |` : '',
    `| Created | ${new Date(task.createdAt).toLocaleString()} |`,
    '',
    '## Description',
    '',
    task.description || '_No description_',
  ].filter(Boolean).join('\n');
}

function formatTicketDetail(ticket: ApiTicket): string {
  return [
    `# ${ticket.title}`,
    '',
    `| Field | Value |`,
    `|-------|-------|`,
    `| ID | ${ticket.id} |`,
    `| Status | ${ticket.status} |`,
    `| Type | ${ticket.type} |`,
    `| Priority | ${ticket.priority} |`,
    `| Source | ${ticket.source} |`,
    ticket.reporter ? `| Reporter | ${ticket.reporter} |` : '',
    ticket.labels.length > 0 ? `| Labels | ${ticket.labels.join(', ')} |` : '',
    `| Created | ${new Date(ticket.createdAt).toLocaleString()} |`,
    '',
    '## Description',
    '',
    ticket.description || '_No description_',
  ].filter(Boolean).join('\n');
}
