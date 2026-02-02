import * as vscode from 'vscode';
import { apiClient, type ApiTicket } from '../api-client';

// ─── Tree Items ──────────────────────────────────────────────────────────────

class TicketGroupItem extends vscode.TreeItem {
  constructor(
    public readonly status: string,
    public readonly count: number,
  ) {
    super(`${formatStatus(status)} (${count})`, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = `ticketGroup-${status}`;
    this.iconPath = statusIcon(status);
  }
}

class TicketItem extends vscode.TreeItem {
  constructor(public readonly ticket: ApiTicket) {
    super(ticket.title, vscode.TreeItemCollapsibleState.None);
    this.description = `${ticket.type} | ${ticket.priority}`;
    this.tooltip = new vscode.MarkdownString(
      `**${ticket.title}**\n\n` +
      `Type: ${ticket.type} | Priority: ${ticket.priority} | Source: ${ticket.source}\n\n` +
      (ticket.description || '').slice(0, 200),
    );
    this.contextValue = `ticket-${ticket.status}`;
    this.iconPath = typeIcon(ticket.type);
    this.command = {
      command: 'sidstack.viewTicket',
      title: 'View Ticket',
      arguments: [ticket.id],
    };
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export class TicketsTreeProvider implements vscode.TreeDataProvider<TicketGroupItem | TicketItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private tickets: ApiTicket[] = [];

  getNewCount(): number {
    return this.tickets.filter((t) => t.status === 'new').length;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TicketGroupItem | TicketItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TicketGroupItem | TicketItem): Promise<(TicketGroupItem | TicketItem)[]> {
    if (!element) {
      return this.getRootItems();
    }
    if (element instanceof TicketGroupItem) {
      return this.getTicketsForStatus(element.status);
    }
    return [];
  }

  private async getRootItems(): Promise<TicketGroupItem[]> {
    try {
      this.tickets = await apiClient.listTickets();
    } catch {
      this.tickets = [];
    }

    const groups = new Map<string, ApiTicket[]>();
    const statusOrder = ['new', 'reviewing', 'approved', 'in_progress', 'completed', 'rejected'];

    for (const ticket of this.tickets) {
      const list = groups.get(ticket.status) || [];
      list.push(ticket);
      groups.set(ticket.status, list);
    }

    return statusOrder
      .filter((s) => groups.has(s))
      .map((s) => new TicketGroupItem(s, groups.get(s)!.length));
  }

  private getTicketsForStatus(status: string): TicketItem[] {
    return this.tickets
      .filter((t) => t.status === status)
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
      })
      .map((t) => new TicketItem(t));
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusIcon(status: string): vscode.ThemeIcon {
  switch (status) {
    case 'new': return new vscode.ThemeIcon('mail', new vscode.ThemeColor('charts.blue'));
    case 'reviewing': return new vscode.ThemeIcon('eye', new vscode.ThemeColor('charts.yellow'));
    case 'approved': return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
    case 'in_progress': return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.yellow'));
    case 'completed': return new vscode.ThemeIcon('check-all', new vscode.ThemeColor('charts.green'));
    case 'rejected': return new vscode.ThemeIcon('close', new vscode.ThemeColor('charts.red'));
    default: return new vscode.ThemeIcon('circle-outline');
  }
}

function typeIcon(type: string): vscode.ThemeIcon {
  switch (type) {
    case 'bug': return new vscode.ThemeIcon('bug', new vscode.ThemeColor('charts.red'));
    case 'feature': return new vscode.ThemeIcon('lightbulb', new vscode.ThemeColor('charts.green'));
    case 'improvement': return new vscode.ThemeIcon('arrow-up', new vscode.ThemeColor('charts.blue'));
    case 'epic': return new vscode.ThemeIcon('rocket', new vscode.ThemeColor('charts.purple'));
    case 'task': return new vscode.ThemeIcon('tasklist');
    default: return new vscode.ThemeIcon('circle-outline');
  }
}
