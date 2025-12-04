/**
 * Spec Graph - Parse and traverse OpenSpec specifications
 *
 * Provides utilities for:
 * - Parsing spec files with YAML frontmatter
 * - Building a graph of spec relationships
 * - Querying related specs
 * - Building context for orchestrator
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

export interface SpecFrontmatter {
  id: string;
  type: 'capability' | 'requirement' | 'constraint';
  status: 'draft' | 'in-progress' | 'stable' | 'deprecated';
  depends_on?: string[];
  relates_to?: string[];
  implements?: string[];
}

export interface Spec {
  id: string;
  path: string;
  frontmatter: SpecFrontmatter;
  content: string;
  title: string;
  summary: string;
}

export interface SpecGraph {
  specs: Map<string, Spec>;
  edges: Map<string, Set<string>>; // id -> set of related ids
  reverseEdges: Map<string, Set<string>>; // id -> set of specs that reference this
}

export interface SpecContext {
  primarySpecs: Spec[];
  relatedSpecs: Spec[];
  totalTokenEstimate: number;
}

// ============================================================================
// Parsing
// ============================================================================

/**
 * Parse YAML frontmatter from markdown content
 */
export function parseFrontmatter(content: string): { frontmatter: Partial<SpecFrontmatter>; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const yamlContent = match[1];
  const body = match[2];

  // Simple YAML parser for our specific format
  const frontmatter: Partial<SpecFrontmatter> = {};
  const lines = yamlContent.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Handle arrays: [item1, item2]
    if (value.startsWith('[') && value.endsWith(']')) {
      const arrayContent = value.slice(1, -1);
      const items = arrayContent.split(',').map(s => s.trim()).filter(Boolean);
      (frontmatter as Record<string, unknown>)[key] = items;
    } else {
      (frontmatter as Record<string, unknown>)[key] = value;
    }
  }

  return { frontmatter, body };
}

/**
 * Extract title from markdown content (first # heading)
 */
export function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Untitled';
}

/**
 * Extract summary from markdown content (first paragraph after title)
 */
export function extractSummary(content: string): string {
  // Find content after ## Summary or first paragraph
  const summaryMatch = content.match(/##\s+Summary\n+([^\n#]+)/);
  if (summaryMatch) {
    return summaryMatch[1].trim();
  }

  // Fall back to first paragraph
  const paragraphMatch = content.match(/^#[^\n]+\n+([^\n#]+)/m);
  return paragraphMatch ? paragraphMatch[1].trim().slice(0, 200) : '';
}

/**
 * Parse a single spec file
 */
export async function parseSpecFile(filePath: string): Promise<Spec | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);

    if (!frontmatter.id) {
      // Generate id from filename
      frontmatter.id = path.basename(filePath, '.md');
    }

    return {
      id: frontmatter.id,
      path: filePath,
      frontmatter: {
        id: frontmatter.id,
        type: frontmatter.type || 'capability',
        status: frontmatter.status || 'draft',
        depends_on: frontmatter.depends_on || [],
        relates_to: frontmatter.relates_to || [],
        implements: frontmatter.implements || [],
      },
      content: body,
      title: extractTitle(body),
      summary: extractSummary(body),
    };
  } catch (error) {
    console.error(`Failed to parse spec file ${filePath}:`, error);
    return null;
  }
}

// ============================================================================
// Graph Building
// ============================================================================

/**
 * Find all spec files in a directory recursively
 */
export async function findSpecFiles(specsDir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist or not accessible
    }
  }

  await walk(specsDir);
  return files;
}

/**
 * Build a spec graph from a specs directory
 */
export async function buildSpecGraph(specsDir: string): Promise<SpecGraph> {
  const graph: SpecGraph = {
    specs: new Map(),
    edges: new Map(),
    reverseEdges: new Map(),
  };

  // Find and parse all spec files
  const files = await findSpecFiles(specsDir);

  for (const file of files) {
    const spec = await parseSpecFile(file);
    if (spec) {
      graph.specs.set(spec.id, spec);
    }
  }

  // Build edges from relationships
  for (const spec of graph.specs.values()) {
    const edges = new Set<string>();

    // Add all relationship types
    for (const depId of spec.frontmatter.depends_on || []) {
      edges.add(depId);
      addReverseEdge(graph.reverseEdges, depId, spec.id);
    }

    for (const relId of spec.frontmatter.relates_to || []) {
      edges.add(relId);
      addReverseEdge(graph.reverseEdges, relId, spec.id);
    }

    for (const implId of spec.frontmatter.implements || []) {
      edges.add(implId);
      addReverseEdge(graph.reverseEdges, implId, spec.id);
    }

    graph.edges.set(spec.id, edges);
  }

  return graph;
}

function addReverseEdge(reverseEdges: Map<string, Set<string>>, from: string, to: string) {
  if (!reverseEdges.has(from)) {
    reverseEdges.set(from, new Set());
  }
  reverseEdges.get(from)!.add(to);
}

// ============================================================================
// Querying
// ============================================================================

/**
 * Get all specs that a given spec depends on (transitively)
 */
export function getDependencies(graph: SpecGraph, specId: string, maxDepth = 3): Set<string> {
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: specId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;

    if (visited.has(id) || depth > maxDepth) continue;
    visited.add(id);

    const spec = graph.specs.get(id);
    if (!spec) continue;

    for (const depId of spec.frontmatter.depends_on || []) {
      if (!visited.has(depId)) {
        queue.push({ id: depId, depth: depth + 1 });
      }
    }
  }

  visited.delete(specId); // Don't include the original spec
  return visited;
}

/**
 * Get all specs related to a given spec (bidirectional, 1 hop)
 */
export function getRelated(graph: SpecGraph, specId: string): Set<string> {
  const related = new Set<string>();

  // Forward edges
  const edges = graph.edges.get(specId);
  if (edges) {
    for (const id of edges) {
      related.add(id);
    }
  }

  // Reverse edges (specs that reference this one)
  const reverseEdges = graph.reverseEdges.get(specId);
  if (reverseEdges) {
    for (const id of reverseEdges) {
      related.add(id);
    }
  }

  return related;
}

/**
 * Find specs matching keywords in title, summary, or content
 */
export function searchSpecs(graph: SpecGraph, keywords: string[]): Spec[] {
  const results: Array<{ spec: Spec; score: number }> = [];
  const lowerKeywords = keywords.map(k => k.toLowerCase());

  for (const spec of graph.specs.values()) {
    let score = 0;
    const titleLower = spec.title.toLowerCase();
    const summaryLower = spec.summary.toLowerCase();
    const contentLower = spec.content.toLowerCase();

    for (const keyword of lowerKeywords) {
      if (titleLower.includes(keyword)) {
        score += 10; // Title match is most important
      }
      if (summaryLower.includes(keyword)) {
        score += 5;
      }
      if (contentLower.includes(keyword)) {
        score += 1;
      }
    }

    if (score > 0) {
      results.push({ spec, score });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.map(r => r.spec);
}

// ============================================================================
// Context Building
// ============================================================================

/**
 * Estimate token count for text (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Build context from specs for orchestrator
 */
export function buildSpecContext(
  graph: SpecGraph,
  primarySpecIds: string[],
  options: {
    maxTokens?: number;
    includeRelated?: boolean;
  } = {}
): SpecContext {
  const {
    maxTokens = 50000,
    includeRelated = true,
  } = options;

  const primarySpecs: Spec[] = [];
  const relatedSpecs: Spec[] = [];
  const seen = new Set<string>();
  let totalTokens = 0;

  // Add primary specs first
  for (const id of primarySpecIds) {
    const spec = graph.specs.get(id);
    if (spec && !seen.has(id)) {
      const tokens = estimateTokens(spec.content);
      if (totalTokens + tokens <= maxTokens) {
        primarySpecs.push(spec);
        seen.add(id);
        totalTokens += tokens;
      }
    }
  }

  // Add related specs if space allows
  if (includeRelated) {
    for (const primarySpec of primarySpecs) {
      const related = getRelated(graph, primarySpec.id);

      for (const relId of related) {
        if (seen.has(relId)) continue;

        const spec = graph.specs.get(relId);
        if (!spec) continue;

        const tokens = estimateTokens(spec.content);
        if (totalTokens + tokens <= maxTokens) {
          relatedSpecs.push(spec);
          seen.add(relId);
          totalTokens += tokens;
        }
      }
    }
  }

  return {
    primarySpecs,
    relatedSpecs,
    totalTokenEstimate: totalTokens,
  };
}

/**
 * Format spec context as markdown for Claude
 */
export function formatContextAsMarkdown(context: SpecContext): string {
  const sections: string[] = [];

  sections.push('# Project Specifications Context\n');
  sections.push(`_Token estimate: ~${context.totalTokenEstimate}_\n`);

  if (context.primarySpecs.length > 0) {
    sections.push('## Primary Specs\n');
    for (const spec of context.primarySpecs) {
      sections.push(`### ${spec.title} (${spec.id})\n`);
      sections.push(`**Status:** ${spec.frontmatter.status}\n`);
      if (spec.summary) {
        sections.push(`**Summary:** ${spec.summary}\n`);
      }
      sections.push('');
      sections.push(spec.content);
      sections.push('\n---\n');
    }
  }

  if (context.relatedSpecs.length > 0) {
    sections.push('## Related Specs\n');
    for (const spec of context.relatedSpecs) {
      sections.push(`### ${spec.title} (${spec.id})\n`);
      sections.push(`**Status:** ${spec.frontmatter.status}\n`);
      if (spec.summary) {
        sections.push(`**Summary:** ${spec.summary}\n`);
      }
      sections.push('');
      // For related specs, only include summary to save tokens
      sections.push(`_Full content available in: ${spec.path}_\n`);
      sections.push('\n---\n');
    }
  }

  return sections.join('\n');
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Load spec graph for a project
 */
export async function loadProjectSpecs(projectPath: string): Promise<SpecGraph> {
  const specsDir = path.join(projectPath, 'openspec', 'specs');
  return buildSpecGraph(specsDir);
}

/**
 * Get context for a user request by matching keywords
 */
export async function getContextForRequest(
  projectPath: string,
  request: string,
  maxTokens = 50000
): Promise<string> {
  const graph = await loadProjectSpecs(projectPath);

  // Extract keywords from request
  const keywords = request
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 3)
    .slice(0, 10);

  // Find matching specs
  const matchingSpecs = searchSpecs(graph, keywords);
  const primaryIds = matchingSpecs.slice(0, 5).map(s => s.id);

  // Build context
  const context = buildSpecContext(graph, primaryIds, { maxTokens });

  return formatContextAsMarkdown(context);
}
