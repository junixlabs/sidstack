/**
 * Knowledge Browser Types
 *
 * Types for project knowledge documentation system.
 * Used by both frontend (React) and templates.
 */

export type KnowledgeDocumentType =
  | "index"
  | "business-logic"
  | "api-endpoint"
  | "design-pattern"
  | "database-table"
  | "module";

export type KnowledgeStatus = "draft" | "implemented" | "deprecated";

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type PatternCategory =
  | "creational"
  | "structural"
  | "behavioral"
  | "architectural";

/**
 * Code reference - links to source code
 */
export interface CodeReference {
  file: string;
  line?: number;
  description?: string;
}

/**
 * Base frontmatter for all knowledge documents
 */
export interface KnowledgeFrontmatter {
  id: string;
  type: KnowledgeDocumentType;
  title?: string;
  module?: string;
  status?: KnowledgeStatus;
  created?: string;
  updated?: string;
  related?: string[];
  tags?: string[];
}

/**
 * API endpoint specific frontmatter
 */
export interface ApiEndpointFrontmatter extends KnowledgeFrontmatter {
  type: "api-endpoint";
  method: ApiMethod;
  path: string;
  version?: string;
}

/**
 * Design pattern specific frontmatter
 */
export interface PatternFrontmatter extends KnowledgeFrontmatter {
  type: "design-pattern";
  category: PatternCategory;
}

/**
 * Parsed knowledge document
 */
export interface KnowledgeDocument {
  /** Relative path from knowledge root */
  path: string;
  /** Absolute file path */
  absolutePath: string;
  /** Parsed frontmatter */
  frontmatter: KnowledgeFrontmatter;
  /** Markdown content (without frontmatter) */
  content: string;
  /** Extracted code references */
  codeRefs: CodeReference[];
  /** Last modified time */
  modifiedAt?: number;
}

/**
 * File tree node for navigation
 */
export interface KnowledgeTreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: KnowledgeTreeNode[];
  document?: KnowledgeDocument;
}

/**
 * Knowledge browser state
 */
export interface KnowledgeBrowserState {
  /** Base path to knowledge folder */
  basePath: string;
  /** All loaded documents */
  documents: Map<string, KnowledgeDocument>;
  /** File tree structure */
  tree: KnowledgeTreeNode[];
  /** Currently selected document path */
  selectedPath: string | null;
  /** Search query */
  searchQuery: string;
  /** Active filters */
  filters: {
    type?: KnowledgeDocumentType;
    status?: KnowledgeStatus;
    module?: string;
    tags?: string[];
  };
  /** Is loading */
  isLoading: boolean;
  /** Error message */
  error: string | null;
}

/**
 * Parse frontmatter from markdown content
 */
export function parseFrontmatter(content: string): {
  frontmatter: KnowledgeFrontmatter | null;
  body: string;
} {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: null, body: content };
  }

  const [, yaml, body] = match;

  try {
    // Simple YAML parsing (handles basic key: value, arrays)
    const frontmatter: Record<string, unknown> = {};
    const lines = yaml.split("\n");

    for (const line of lines) {
      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) continue;

      const key = line.slice(0, colonIndex).trim();
      let value: unknown = line.slice(colonIndex + 1).trim();

      // Handle arrays [item1, item2]
      if (typeof value === "string" && value.startsWith("[")) {
        const arrayMatch = value.match(/^\[(.*)\]$/);
        if (arrayMatch) {
          value = arrayMatch[1]
            .split(",")
            .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
            .filter(Boolean);
        }
      }

      frontmatter[key] = value;
    }

    return {
      frontmatter: frontmatter as unknown as KnowledgeFrontmatter,
      body: body.trim(),
    };
  } catch {
    return { frontmatter: null, body: content };
  }
}

/**
 * Extract code references from markdown content
 * Matches patterns like `src/file.ts:45` or `file.ts:10 - description`
 */
export function extractCodeRefs(content: string): CodeReference[] {
  const refs: CodeReference[] = [];
  // Match code references in backticks: `src/file.ts:45` or `src/file.ts:45 - description`
  const codeRefRegex = /`([^`]+\.[a-z]+):(\d+)(?:\s*-\s*([^`]+))?`/gi;

  let match;
  while ((match = codeRefRegex.exec(content)) !== null) {
    refs.push({
      file: match[1],
      line: parseInt(match[2], 10),
      description: match[3]?.trim(),
    });
  }

  return refs;
}

/**
 * Get icon for document type
 */
export function getDocumentTypeIcon(
  type: KnowledgeDocumentType
): string {
  const icons: Record<KnowledgeDocumentType, string> = {
    index: "folder",
    "business-logic": "workflow",
    "api-endpoint": "globe",
    "design-pattern": "puzzle",
    "database-table": "database",
    module: "package",
  };
  return icons[type] || "file";
}

/**
 * Get color for document status
 */
export function getStatusColor(status: KnowledgeStatus): string {
  const colors: Record<KnowledgeStatus, string> = {
    draft: "yellow",
    implemented: "green",
    deprecated: "red",
  };
  return colors[status] || "gray";
}
