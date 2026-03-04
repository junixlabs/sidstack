/**
 * Hybrid Search + RAG Context Building
 *
 * Fuses keyword search (API server) with vector search (SidMemo)
 * using Reciprocal Rank Fusion (RRF). Builds chunk-level RAG context
 * with optional Knowledge Graph enrichment.
 */

import type { SidMemoClient } from '../memory/client.js';
import type { SidStackApiClient } from '../api-client.js';
import type { SubgraphResponse } from '../memory/types.js';

// =============================================================================
// Types
// =============================================================================

export interface HybridSearchOptions {
  query: string;
  userId: string;
  limit?: number;             // default 20
  filters?: { type?: string[]; module?: string; status?: string };
  weights?: { keyword: number; vector: number };  // default 0.4 / 0.6
}

export interface HybridSearchResult {
  docId: string;
  title: string;
  type: string;
  module?: string;
  bestChunk: { content: string; sectionHeading: string; score: number };
  fusedScore: number;
  relatedEntities?: Array<{ name: string; type?: string; relation: string }>;
}

export interface RAGContextOptions {
  query: string;
  userId: string;
  maxTokens?: number;         // default 2000
  maxChunks?: number;         // default 15
  filters?: { type?: string[]; module?: string };
  includeGraph?: boolean;     // default true
}

export interface RAGContextResult {
  context: string;            // Assembled markdown for Claude
  chunks: Array<{
    docId: string;
    docTitle: string;
    sectionHeading: string;
    content: string;
    score: number;
  }>;
  graph?: SubgraphResponse;
  metadata: {
    totalChunks: number;
    estimatedTokens: number;
    truncated: boolean;
  };
}

interface SearchDeps {
  sidmemo: SidMemoClient;
  apiClient: SidStackApiClient;
}

// =============================================================================
// RRF Constants
// =============================================================================

const RRF_K = 60; // Standard RRF constant

// =============================================================================
// Hybrid Search
// =============================================================================

/**
 * Hybrid search: keyword (API server) + vector (SidMemo) fused via RRF.
 */
export async function hybridSearch(
  options: HybridSearchOptions,
  deps: SearchDeps,
): Promise<HybridSearchResult[]> {
  const limit = options.limit || 20;
  const weights = options.weights || { keyword: 0.4, vector: 0.6 };

  // Run keyword and vector searches in parallel
  const [keywordResults, vectorResults] = await Promise.all([
    keywordSearch(options, deps.apiClient),
    vectorSearch(options, deps.sidmemo, limit * 2),
  ]);

  // Build per-doc ranked lists
  const keywordRanks = new Map<string, { rank: number; doc: any }>();
  keywordResults.forEach((doc, idx) => {
    keywordRanks.set(doc.id, { rank: idx + 1, doc });
  });

  // Group vector results by docId, keep best chunk per doc
  const vectorByDoc = new Map<string, { rank: number; chunk: any; score: number }>();
  vectorResults.forEach((chunk, idx) => {
    const docId = chunk.metadata_?.docId as string || chunk.id;
    if (!vectorByDoc.has(docId)) {
      vectorByDoc.set(docId, {
        rank: idx + 1,
        chunk,
        score: chunk.score ?? 0,
      });
    }
  });

  // Collect all unique docIds
  const allDocIds = new Set([...keywordRanks.keys(), ...vectorByDoc.keys()]);

  // Compute RRF score for each doc
  const scored: Array<{
    docId: string;
    title: string;
    type: string;
    module?: string;
    bestChunk: { content: string; sectionHeading: string; score: number };
    fusedScore: number;
    relatedEntities?: Array<{ name: string; type?: string; relation: string }>;
  }> = [];

  for (const docId of allDocIds) {
    let rrfScore = 0;
    let title = '';
    let type = '';
    let module: string | undefined;
    let bestChunk = { content: '', sectionHeading: '', score: 0 };

    const kw = keywordRanks.get(docId);
    if (kw) {
      rrfScore += weights.keyword / (RRF_K + kw.rank);
      title = kw.doc.title || title;
      type = kw.doc.type || type;
      module = kw.doc.module || module;
    }

    const vec = vectorByDoc.get(docId);
    if (vec) {
      rrfScore += weights.vector / (RRF_K + vec.rank);
      const chunkMeta = vec.chunk.metadata_ || {};
      title = (chunkMeta.title as string) || title;
      type = (chunkMeta.type as string) || type;
      module = (chunkMeta.module as string) || module;
      bestChunk = {
        content: vec.chunk.content || '',
        sectionHeading: (chunkMeta.sectionHeading as string) || '',
        score: vec.score,
      };
    }

    scored.push({ docId, title, type, module, bestChunk, fusedScore: rrfScore });
  }

  // Sort by fusedScore descending, take top N
  scored.sort((a, b) => b.fusedScore - a.fusedScore);
  const topResults = scored.slice(0, limit);

  // Graph enrichment for top 5 results (optional, non-blocking)
  try {
    const entityNames = topResults.slice(0, 5)
      .map(r => r.title)
      .filter(Boolean);

    if (entityNames.length > 0) {
      const enriched = await enrichWithGraph(entityNames, deps.sidmemo);
      for (const result of topResults) {
        result.relatedEntities = enriched.get(result.title);
      }
    }
  } catch {
    // Non-blocking
  }

  return topResults as HybridSearchResult[];
}

// =============================================================================
// RAG Context Building
// =============================================================================

/**
 * Build chunk-level RAG context with graph enrichment.
 */
export async function buildRAGContext(
  options: RAGContextOptions,
  deps: SearchDeps,
): Promise<RAGContextResult> {
  const maxTokens = options.maxTokens || 2000;
  const maxChunks = options.maxChunks || 15;
  const includeGraph = options.includeGraph !== false;

  // Semantic search for relevant chunks
  const searchResults = await deps.sidmemo.search(
    options.query,
    options.userId,
    maxChunks * 2,
    options.filters ? buildSidMemoFilters(options.filters) : { sourceType: 'knowledge_chunk' },
  );

  // Deduplicate by docId (keep top chunk per doc)
  const seenDocs = new Set<string>();
  const chunks: RAGContextResult['chunks'] = [];

  for (const result of searchResults) {
    const meta = result.metadata_ || {};
    const docId = (meta.docId as string) || result.id;

    if (seenDocs.has(docId)) continue;
    seenDocs.add(docId);

    chunks.push({
      docId,
      docTitle: (meta.title as string) || docId,
      sectionHeading: (meta.sectionHeading as string) || '',
      content: result.content,
      score: result.score ?? 0,
    });

    if (chunks.length >= maxChunks) break;
  }

  // Graph context (optional)
  let graph: SubgraphResponse | undefined;
  if (includeGraph && chunks.length > 0) {
    try {
      const entityNames = chunks.slice(0, 5).map(c => c.docTitle).filter(Boolean);
      if (entityNames.length > 0) {
        graph = await deps.sidmemo.getSubgraph(entityNames, 1);
      }
    } catch {
      // Non-blocking
    }
  }

  // Assemble markdown context
  let context = '## Relevant Knowledge\n\n';
  let estimatedTokens = 10; // header
  let truncated = false;

  for (const chunk of chunks) {
    const chunkText = formatChunkForContext(chunk);
    const chunkTokens = estimateTokens(chunkText);

    if (estimatedTokens + chunkTokens > maxTokens) {
      truncated = true;
      break;
    }

    context += chunkText;
    estimatedTokens += chunkTokens;
  }

  // Append graph context
  if (graph && graph.relations.length > 0) {
    const graphSection = formatGraphContext(graph);
    const graphTokens = estimateTokens(graphSection);

    if (estimatedTokens + graphTokens <= maxTokens) {
      context += graphSection;
      estimatedTokens += graphTokens;
    }
  }

  return {
    context,
    chunks,
    graph,
    metadata: {
      totalChunks: chunks.length,
      estimatedTokens,
      truncated,
    },
  };
}

// =============================================================================
// Internal helpers
// =============================================================================

async function keywordSearch(options: HybridSearchOptions, apiClient: SidStackApiClient): Promise<any[]> {
  try {
    const response = await apiClient.knowledge.search({
      q: options.query,
      limit: String(options.limit || 20),
      ...(options.filters?.type ? { type: options.filters.type.join(',') } : {}),
      ...(options.filters?.module ? { module: options.filters.module } : {}),
    } as any);
    return response.results || [];
  } catch {
    return [];
  }
}

async function vectorSearch(
  options: HybridSearchOptions,
  sidmemo: SidMemoClient,
  limit: number,
): Promise<any[]> {
  try {
    const filters: Record<string, unknown> = { sourceType: 'knowledge_chunk' };
    if (options.filters?.type?.length) filters.type = options.filters.type;
    if (options.filters?.module) filters.module = options.filters.module;

    return await sidmemo.search(options.query, options.userId, limit, filters);
  } catch {
    return [];
  }
}

async function enrichWithGraph(
  entityNames: string[],
  sidmemo: SidMemoClient,
): Promise<Map<string, Array<{ name: string; type?: string; relation: string }>>> {
  const result = new Map<string, Array<{ name: string; type?: string; relation: string }>>();

  try {
    const subgraph = await sidmemo.getSubgraph(entityNames, 1);
    for (const rel of subgraph.relations) {
      // Add related entities for source
      if (!result.has(rel.source)) result.set(rel.source, []);
      result.get(rel.source)!.push({
        name: rel.target,
        type: subgraph.entities.find(e => e.name === rel.target)?.type,
        relation: rel.type,
      });
    }
  } catch {
    // Non-blocking
  }

  return result;
}

function buildSidMemoFilters(filters: { type?: string[]; module?: string }): Record<string, unknown> {
  const result: Record<string, unknown> = { sourceType: 'knowledge_chunk' };
  if (filters.type?.length) result.type = filters.type;
  if (filters.module) result.module = filters.module;
  return result;
}

function formatChunkForContext(chunk: RAGContextResult['chunks'][0]): string {
  const scorePart = chunk.score > 0 ? ` [score: ${chunk.score.toFixed(2)}]` : '';
  let text = `### From: ${chunk.docTitle}${scorePart}\n`;
  if (chunk.sectionHeading) {
    text += `**Section:** ${chunk.sectionHeading}\n`;
  }
  text += `${chunk.content}\n\n---\n\n`;
  return text;
}

function formatGraphContext(graph: SubgraphResponse): string {
  if (graph.relations.length === 0) return '';

  let text = '\n## Related Concepts (from Knowledge Graph)\n\n';
  for (const rel of graph.relations.slice(0, 15)) {
    text += `- ${rel.source} --${rel.type}--> ${rel.target}\n`;
  }
  text += '\n';
  return text;
}

/** Rough token estimation: ~4 chars per token */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
