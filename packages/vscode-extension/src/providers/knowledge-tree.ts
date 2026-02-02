import * as vscode from 'vscode';
import { apiClient, type ApiKnowledgeDoc } from '../api-client';

// ─── Tree Items ──────────────────────────────────────────────────────────────

class KnowledgeGroupItem extends vscode.TreeItem {
  constructor(
    public readonly groupKey: string,
    public readonly groupLabel: string,
    public readonly count: number,
  ) {
    super(`${groupLabel} (${count})`, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'knowledgeGroup';
    this.iconPath = new vscode.ThemeIcon('folder');
  }
}

class KnowledgeDocItem extends vscode.TreeItem {
  constructor(public readonly doc: ApiKnowledgeDoc) {
    super(doc.title || doc.id, vscode.TreeItemCollapsibleState.None);
    this.description = doc.type;
    this.tooltip = new vscode.MarkdownString(
      `**${doc.title || doc.id}**\n\n` +
      `Type: ${doc.type} | Status: ${doc.status}\n\n` +
      (doc.summary || ''),
    );
    this.contextValue = 'knowledgeDoc';
    this.iconPath = docTypeIcon(doc.type);
    this.command = {
      command: 'sidstack.viewKnowledgeDoc',
      title: 'View Document',
      arguments: [doc.id],
    };
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export class KnowledgeTreeProvider implements vscode.TreeDataProvider<KnowledgeGroupItem | KnowledgeDocItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private docs: ApiKnowledgeDoc[] = [];

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: KnowledgeGroupItem | KnowledgeDocItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: KnowledgeGroupItem | KnowledgeDocItem): Promise<(KnowledgeGroupItem | KnowledgeDocItem)[]> {
    if (!element) {
      return this.getRootItems();
    }
    if (element instanceof KnowledgeGroupItem) {
      return this.getDocsForGroup(element.groupKey);
    }
    return [];
  }

  private async getRootItems(): Promise<KnowledgeGroupItem[]> {
    try {
      this.docs = await apiClient.listKnowledge();
    } catch {
      this.docs = [];
    }

    // Group by module, then by type for docs without module
    const groups = new Map<string, ApiKnowledgeDoc[]>();

    for (const doc of this.docs) {
      const key = doc.module || `_type:${doc.type}`;
      const list = groups.get(key) || [];
      list.push(doc);
      groups.set(key, list);
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, docs]) => {
        const label = key.startsWith('_type:') ? formatType(key.slice(6)) : key;
        return new KnowledgeGroupItem(key, label, docs.length);
      });
  }

  private getDocsForGroup(groupKey: string): KnowledgeDocItem[] {
    return this.docs
      .filter((doc) => {
        if (groupKey.startsWith('_type:')) {
          return !doc.module && doc.type === groupKey.slice(6);
        }
        return doc.module === groupKey;
      })
      .sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id))
      .map((doc) => new KnowledgeDocItem(doc));
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatType(type: string): string {
  return type.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function docTypeIcon(type: string): vscode.ThemeIcon {
  switch (type) {
    case 'business-logic': return new vscode.ThemeIcon('briefcase');
    case 'api-endpoint': return new vscode.ThemeIcon('plug');
    case 'design-pattern': return new vscode.ThemeIcon('symbol-structure');
    case 'database-table': return new vscode.ThemeIcon('database');
    case 'module': return new vscode.ThemeIcon('package');
    case 'governance': return new vscode.ThemeIcon('shield');
    case 'spec': return new vscode.ThemeIcon('file-text');
    case 'decision': return new vscode.ThemeIcon('git-compare');
    case 'guide': return new vscode.ThemeIcon('book');
    case 'skill': return new vscode.ThemeIcon('tools');
    case 'principle': return new vscode.ThemeIcon('law');
    case 'rule': return new vscode.ThemeIcon('warning');
    case 'index': return new vscode.ThemeIcon('list-tree');
    default: return new vscode.ThemeIcon('file');
  }
}
