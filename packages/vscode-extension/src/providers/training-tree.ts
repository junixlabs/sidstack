import * as vscode from 'vscode';
import { apiClient, type ApiLesson, type ApiRule, type ApiSkill } from '../api-client';

// ─── Tree Items ──────────────────────────────────────────────────────────────

class TrainingSectionItem extends vscode.TreeItem {
  constructor(
    public readonly section: 'lessons' | 'rules' | 'skills',
    public readonly count: number,
  ) {
    const labels: Record<string, string> = {
      lessons: 'Lessons',
      rules: 'Rules',
      skills: 'Skills',
    };
    super(`${labels[section]} (${count})`, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = `trainingSection-${section}`;
    this.iconPath = sectionIcon(section);
  }
}

class LessonItem extends vscode.TreeItem {
  constructor(public readonly lesson: ApiLesson) {
    super(lesson.title, vscode.TreeItemCollapsibleState.None);
    this.description = lesson.moduleId;
    this.tooltip = new vscode.MarkdownString(
      `**${lesson.title}**\n\n` +
      `**Problem:** ${lesson.problem}\n\n` +
      `**Root Cause:** ${lesson.rootCause}\n\n` +
      `**Solution:** ${lesson.solution}`,
    );
    this.contextValue = 'lesson';
    this.iconPath = new vscode.ThemeIcon('mortar-board');
  }
}

class RuleItem extends vscode.TreeItem {
  constructor(public readonly rule: ApiRule) {
    super(rule.title, vscode.TreeItemCollapsibleState.None);
    this.description = `${rule.level} | ${rule.enforcement}`;
    this.tooltip = new vscode.MarkdownString(
      `**${rule.title}**\n\n` +
      `Level: ${rule.level} | Enforcement: ${rule.enforcement}\n\n` +
      rule.description,
    );
    this.contextValue = 'rule';
    this.iconPath = ruleLevelIcon(rule.level);
  }
}

class SkillItem extends vscode.TreeItem {
  constructor(public readonly skill: ApiSkill) {
    super(skill.name, vscode.TreeItemCollapsibleState.None);
    this.description = `${skill.type} | ${skill.moduleId}`;
    this.tooltip = new vscode.MarkdownString(
      `**${skill.name}**\n\n` +
      `Type: ${skill.type}\n\n` +
      skill.description,
    );
    this.contextValue = 'skill';
    this.iconPath = new vscode.ThemeIcon('tools');
  }
}

type TrainingTreeItem = TrainingSectionItem | LessonItem | RuleItem | SkillItem;

// ─── Provider ────────────────────────────────────────────────────────────────

export class TrainingTreeProvider implements vscode.TreeDataProvider<TrainingTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private lessons: ApiLesson[] = [];
  private rules: ApiRule[] = [];
  private skills: ApiSkill[] = [];

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TrainingTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TrainingTreeItem): Promise<TrainingTreeItem[]> {
    if (!element) {
      return this.getRootItems();
    }
    if (element instanceof TrainingSectionItem) {
      return this.getItemsForSection(element.section);
    }
    return [];
  }

  private async getRootItems(): Promise<TrainingSectionItem[]> {
    try {
      [this.lessons, this.rules, this.skills] = await Promise.all([
        apiClient.listLessons().catch(() => []),
        apiClient.listRules().catch(() => []),
        apiClient.listSkills().catch(() => []),
      ]);
    } catch {
      this.lessons = [];
      this.rules = [];
      this.skills = [];
    }

    const sections: TrainingSectionItem[] = [];
    if (this.lessons.length > 0) { sections.push(new TrainingSectionItem('lessons', this.lessons.length)); }
    if (this.rules.length > 0) { sections.push(new TrainingSectionItem('rules', this.rules.length)); }
    if (this.skills.length > 0) { sections.push(new TrainingSectionItem('skills', this.skills.length)); }

    if (sections.length === 0) {
      // Show empty sections so the view isn't blank
      sections.push(new TrainingSectionItem('lessons', 0));
      sections.push(new TrainingSectionItem('rules', 0));
      sections.push(new TrainingSectionItem('skills', 0));
    }

    return sections;
  }

  private getItemsForSection(section: 'lessons' | 'rules' | 'skills'): TrainingTreeItem[] {
    switch (section) {
      case 'lessons':
        return this.lessons.map((l) => new LessonItem(l));
      case 'rules':
        return this.rules.map((r) => new RuleItem(r));
      case 'skills':
        return this.skills.map((s) => new SkillItem(s));
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sectionIcon(section: string): vscode.ThemeIcon {
  switch (section) {
    case 'lessons': return new vscode.ThemeIcon('mortar-board');
    case 'rules': return new vscode.ThemeIcon('shield');
    case 'skills': return new vscode.ThemeIcon('tools');
    default: return new vscode.ThemeIcon('folder');
  }
}

function ruleLevelIcon(level: string): vscode.ThemeIcon {
  switch (level) {
    case 'critical': return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
    case 'warning': return new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
    case 'info': return new vscode.ThemeIcon('info', new vscode.ThemeColor('charts.blue'));
    default: return new vscode.ThemeIcon('shield');
  }
}
