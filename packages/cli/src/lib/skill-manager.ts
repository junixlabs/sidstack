import * as fs from 'fs/promises';
import * as path from 'path';

export interface Skill {
  id: string;
  name: string;
  type: 'core' | 'generated';
  content: string;
  appliesTo: string[];
}

export class SkillManager {
  private skillsDir: string;
  private coreSkillsDir: string;
  private generatedSkillsDir: string;

  constructor() {
    this.skillsDir = path.join(__dirname, '../../skills');
    this.coreSkillsDir = path.join(this.skillsDir, 'core');
    this.generatedSkillsDir = path.join(this.skillsDir, 'generated');
  }

  /**
   * Load all skills applicable to a specific agent role
   */
  async loadSkillsForRole(role: string): Promise<Skill[]> {
    const skills: Skill[] = [];

    // Load core skills
    const coreSkills = await this.loadSkillsFromDir(this.coreSkillsDir, 'core');
    skills.push(...coreSkills.filter(s => this.skillAppliesToRole(s, role)));

    // Load generated skills
    const generatedSkills = await this.loadSkillsFromDir(this.generatedSkillsDir, 'generated');
    skills.push(...generatedSkills.filter(s => this.skillAppliesToRole(s, role)));

    return skills;
  }

  /**
   * Load skills from a directory
   */
  private async loadSkillsFromDir(dir: string, type: 'core' | 'generated'): Promise<Skill[]> {
    const skills: Skill[] = [];

    try {
      const files = await fs.readdir(dir);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const filePath = path.join(dir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const skill = this.parseSkillFile(file, content, type);

        if (skill) {
          skills.push(skill);
        }
      }
    } catch (error: any) {
      // Directory may not exist yet
      if (error.code !== 'ENOENT') {
        console.warn(`[SkillManager] Error loading skills from ${dir}:`, error.message);
      }
    }

    return skills;
  }

  /**
   * Parse skill metadata from markdown file
   */
  private parseSkillFile(filename: string, content: string, type: 'core' | 'generated'): Skill | null {
    const id = filename.replace('.md', '');

    // Extract metadata from frontmatter-like format
    const nameMatch = content.match(/# Skill: (.+)/);
    const appliesToMatch = content.match(/\*\*Applies To:\*\* (.+)/);

    const name = nameMatch ? nameMatch[1] : id;
    const appliesTo = appliesToMatch
      ? appliesToMatch[1].split(/[,()]/).map(s => s.trim().toLowerCase()).filter(Boolean)
      : ['all'];

    return {
      id,
      name,
      type,
      content,
      appliesTo,
    };
  }

  /**
   * Check if a skill applies to a specific role
   */
  private skillAppliesToRole(skill: Skill, role: string): boolean {
    const normalizedRole = role.toLowerCase();

    // All agents if 'all' is specified
    if (skill.appliesTo.includes('all')) return true;
    if (skill.appliesTo.includes('all agents')) return true;

    // Check specific role matches
    return skill.appliesTo.some(applies => {
      const normalized = applies.toLowerCase();
      return normalized.includes(normalizedRole) ||
             normalized.includes(this.getRoleAlias(normalizedRole));
    });
  }

  /**
   * Get role aliases for matching
   */
  private getRoleAlias(role: string): string {
    const aliases: Record<string, string> = {
      'dev': 'developer',
      'ba': 'business analyst',
      'qa': 'quality assurance',
      'da': 'data architect',
      'bm': 'branch manager',
      'devops': 'devops',
    };
    return aliases[role] || role;
  }

  /**
   * Format skills for injection into agent prompt
   */
  formatSkillsForPrompt(skills: Skill[]): string {
    if (skills.length === 0) return '';

    let formatted = '\n\n---\n\n## LOADED SKILLS\n\n';
    formatted += 'The following skills have been loaded for this session. Apply these patterns:\n\n';

    for (const skill of skills) {
      formatted += `### ${skill.name}\n`;
      formatted += `**Source:** ${skill.type}\n\n`;

      // Extract just the workflow/examples section
      const ruleSection = this.extractSection(skill.content, 'Rule', 'Workflow');
      const workflowSection = this.extractSection(skill.content, 'Workflow', 'Example');

      if (ruleSection) {
        formatted += ruleSection + '\n\n';
      }
      if (workflowSection) {
        formatted += workflowSection + '\n\n';
      }
    }

    return formatted;
  }

  /**
   * Extract a section from markdown content
   */
  private extractSection(content: string, startHeader: string, endHeader?: string): string | null {
    const startPattern = new RegExp(`## ${startHeader}\\s*\\n`, 'i');
    const startMatch = content.match(startPattern);

    if (!startMatch || startMatch.index === undefined) return null;

    const startIndex = startMatch.index + startMatch[0].length;

    if (endHeader) {
      const endPattern = new RegExp(`## ${endHeader}`, 'i');
      const endMatch = content.slice(startIndex).match(endPattern);

      if (endMatch && endMatch.index !== undefined) {
        return content.slice(startIndex, startIndex + endMatch.index).trim();
      }
    }

    // Return rest of content if no end header
    return content.slice(startIndex).trim();
  }

  /**
   * Create a new generated skill
   */
  async createGeneratedSkill(
    id: string,
    name: string,
    content: string,
    appliesTo: string[]
  ): Promise<void> {
    await fs.mkdir(this.generatedSkillsDir, { recursive: true });

    const skillContent = `# Skill: ${name}

**ID:** ${id}
**Created:** ${new Date().toISOString().split('T')[0]}
**Type:** generated
**Applies To:** ${appliesTo.join(', ')}

${content}
`;

    const filePath = path.join(this.generatedSkillsDir, `${id}.md`);
    await fs.writeFile(filePath, skillContent, 'utf-8');

    console.log(`[SkillManager] Created generated skill: ${id}`);
  }

  /**
   * List all available skills
   */
  async listAllSkills(): Promise<Skill[]> {
    const coreSkills = await this.loadSkillsFromDir(this.coreSkillsDir, 'core');
    const generatedSkills = await this.loadSkillsFromDir(this.generatedSkillsDir, 'generated');
    return [...coreSkills, ...generatedSkills];
  }
}
