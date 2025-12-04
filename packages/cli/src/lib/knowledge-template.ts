/**
 * Knowledge Template Loader
 *
 * Utilities for loading and applying knowledge document templates.
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Types
// =============================================================================

export interface KnowledgeTemplate {
  name: string;
  type: string;
  description: string;
  filePath: string;
  variables: string[];
}

export interface TemplateInfo {
  name: string;
  type: string;
  description: string;
  variables: string[];
}

// Template metadata
const TEMPLATE_METADATA: Record<string, { description: string; requiredVariables: string[]; variables: string[] }> = {
  'business-logic': {
    description: 'Document business rules, state machines, and workflows',
    requiredVariables: ['title'],
    variables: ['title', 'module', 'date', 'source_file', 'function_name'],
  },
  'api-endpoint': {
    description: 'Document REST API endpoints with request/response schemas',
    requiredVariables: ['title'],
    variables: ['title', 'module', 'method', 'path', 'date', 'base_url', 'source_file', 'service_file', 'validation_file'],
  },
  'design-pattern': {
    description: 'Document design patterns implemented in the codebase',
    requiredVariables: ['title'],
    variables: ['title', 'module', 'pattern_name', 'date'],
  },
  'database-table': {
    description: 'Document database tables/collections with schemas and queries',
    requiredVariables: ['title'],
    variables: ['title', 'module', 'table_name', 'database_type', 'date'],
  },
  'module': {
    description: 'Document a module with its API, dependencies, and governance',
    requiredVariables: ['title'],
    variables: ['title', 'module_id', 'owner', 'date', 'source_path'],
  },
};

// =============================================================================
// Template Loader
// =============================================================================

export class KnowledgeTemplateLoader {
  private templatesDir: string;

  constructor() {
    const sidstackRoot = path.resolve(__dirname, '../../../../');
    this.templatesDir = path.join(sidstackRoot, 'packages/cli/templates/knowledge');
  }

  /**
   * List all available templates
   */
  listTemplates(): TemplateInfo[] {
    if (!fs.existsSync(this.templatesDir)) {
      return [];
    }

    const files = fs.readdirSync(this.templatesDir).filter(f => f.endsWith('.md.template'));
    const templates: TemplateInfo[] = [];

    for (const file of files) {
      const name = file.replace('.md.template', '');
      const metadata = TEMPLATE_METADATA[name];

      if (metadata) {
        templates.push({
          name,
          type: name,
          description: metadata.description,
          variables: metadata.variables,
        });
      }
    }

    return templates;
  }

  /**
   * Load a template by name
   */
  loadTemplate(name: string): KnowledgeTemplate | null {
    const templatePath = path.join(this.templatesDir, `${name}.md.template`);

    if (!fs.existsSync(templatePath)) {
      return null;
    }

    const metadata = TEMPLATE_METADATA[name];
    if (!metadata) {
      return null;
    }

    return {
      name,
      type: name,
      description: metadata.description,
      filePath: templatePath,
      variables: metadata.variables,
    };
  }

  /**
   * Get template names
   */
  getTemplateNames(): string[] {
    return Object.keys(TEMPLATE_METADATA);
  }

  /**
   * Check if template exists
   */
  templateExists(name: string): boolean {
    return fs.existsSync(path.join(this.templatesDir, `${name}.md.template`));
  }

  /**
   * Read template content
   */
  readTemplate(name: string): string | null {
    const templatePath = path.join(this.templatesDir, `${name}.md.template`);

    if (!fs.existsSync(templatePath)) {
      return null;
    }

    return fs.readFileSync(templatePath, 'utf-8');
  }

  /**
   * Apply variables to template content
   */
  applyTemplate(name: string, variables: Record<string, string>): string | null {
    const content = this.readTemplate(name);
    if (!content) {
      return null;
    }

    // Replace all {{variable}} placeholders
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    return result;
  }

  /**
   * Get missing variables for a template
   * @param requiredOnly - If true, only return missing required variables (for non-interactive mode)
   */
  getMissingVariables(name: string, providedVars: Record<string, string>, requiredOnly?: boolean): string[] {
    const metadata = TEMPLATE_METADATA[name];
    if (!metadata) {
      return [];
    }

    const varsToCheck = requiredOnly ? metadata.requiredVariables : metadata.variables;
    return varsToCheck.filter(v => !providedVars[v]);
  }
}

// =============================================================================
// Convenience functions
// =============================================================================

const loader = new KnowledgeTemplateLoader();

export function listKnowledgeTemplates(): TemplateInfo[] {
  return loader.listTemplates();
}

export function loadKnowledgeTemplate(name: string): KnowledgeTemplate | null {
  return loader.loadTemplate(name);
}

export function getKnowledgeTemplateNames(): string[] {
  return loader.getTemplateNames();
}

export function applyKnowledgeTemplate(name: string, variables: Record<string, string>): string | null {
  return loader.applyTemplate(name, variables);
}

export function getTemplateMissingVariables(name: string, providedVars: Record<string, string>, requiredOnly?: boolean): string[] {
  return loader.getMissingVariables(name, providedVars, requiredOnly);
}
