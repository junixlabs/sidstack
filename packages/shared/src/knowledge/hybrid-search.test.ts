/**
 * Hybrid Search + RAG Context Unit Tests
 *
 * Tests RRF fusion, graph enrichment, and RAG context building
 * by mocking both SidMemoClient and SidStackApiClient.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hybridSearch, buildRAGContext } from './hybrid-search';
import { makeMockSidMemoClient, makeMockApiClient } from './__test-utils';

function makeVectorResult(docId: string, score: number, content = 'chunk content') {
  return {
    id: `${docId}-chunk`,
    content,
    score,
    metadata_: {
      sourceType: 'knowledge_chunk',
      docId,
      title: `Title ${docId}`,
      type: 'guide',
      sectionHeading: 'Section A',
    },
  };
}

function makeKeywordResult(id: string, title?: string) {
  return {
    id,
    title: title || `Title ${id}`,
    type: 'guide',
    module: 'core',
  };
}

// =============================================================================
// hybridSearch() Tests
// =============================================================================

describe('hybridSearch()', () => {
  const RRF_K = 60;

  // Test 1: Keyword only (SidMemo empty)
  it('returns keyword results when SidMemo returns empty', async () => {
    const apiClient = makeMockApiClient({
      search: vi.fn().mockResolvedValue({
        results: [makeKeywordResult('d1'), makeKeywordResult('d2'), makeKeywordResult('d3')],
      }),
    });
    const sidmemo = makeMockSidMemoClient();

    const results = await hybridSearch(
      { query: 'test', userId: 'u1' },
      { sidmemo, apiClient },
    );

    expect(results).toHaveLength(3);
    // Score should be keyword-only: weight / (K + rank)
    expect(results[0].fusedScore).toBeCloseTo(0.4 / (RRF_K + 1), 6);
  });

  // Test 2: Vector only (API empty)
  it('returns vector results when API returns empty', async () => {
    const apiClient = makeMockApiClient();
    const sidmemo = makeMockSidMemoClient({
      search: vi.fn().mockResolvedValue([
        makeVectorResult('d1', 0.95),
        makeVectorResult('d2', 0.85),
        makeVectorResult('d3', 0.75),
      ]),
    });

    const results = await hybridSearch(
      { query: 'test', userId: 'u1' },
      { sidmemo, apiClient },
    );

    expect(results).toHaveLength(3);
    // Score should be vector-only: weight / (K + rank)
    expect(results[0].fusedScore).toBeCloseTo(0.6 / (RRF_K + 1), 6);
  });

  // Test 3: Both sources with overlap
  it('merges overlapping docs with highest fusedScore', async () => {
    const apiClient = makeMockApiClient({
      search: vi.fn().mockResolvedValue({
        results: [makeKeywordResult('shared'), makeKeywordResult('kw-only')],
      }),
    });
    const sidmemo = makeMockSidMemoClient({
      search: vi.fn().mockResolvedValue([
        makeVectorResult('shared', 0.9),
        makeVectorResult('vec-only', 0.8),
      ]),
    });

    const results = await hybridSearch(
      { query: 'test', userId: 'u1' },
      { sidmemo, apiClient },
    );

    // 'shared' appears in both → highest RRF score
    expect(results[0].docId).toBe('shared');
    // Fused = keyword/(K+1) + vector/(K+1)
    const expectedShared = 0.4 / (RRF_K + 1) + 0.6 / (RRF_K + 1);
    expect(results[0].fusedScore).toBeCloseTo(expectedShared, 6);
  });

  // Test 4: RRF score computation
  it('computes correct RRF scores with k=60', async () => {
    const apiClient = makeMockApiClient({
      search: vi.fn().mockResolvedValue({
        results: [makeKeywordResult('docA'), makeKeywordResult('dummy'), makeKeywordResult('docB')],
      }),
    });
    const sidmemo = makeMockSidMemoClient({
      search: vi.fn().mockResolvedValue([
        makeVectorResult('docB', 0.9),
        makeVectorResult('dummy2', 0.8),
        makeVectorResult('docA', 0.7),
      ]),
    });

    const results = await hybridSearch(
      { query: 'test', userId: 'u1' },
      { sidmemo, apiClient },
    );

    const docA = results.find(r => r.docId === 'docA')!;
    const docB = results.find(r => r.docId === 'docB')!;

    // docA: keyword rank 1, vector rank 3
    const expectedA = 0.4 / (RRF_K + 1) + 0.6 / (RRF_K + 3);
    expect(docA.fusedScore).toBeCloseTo(expectedA, 6);

    // docB: keyword rank 3, vector rank 1
    const expectedB = 0.4 / (RRF_K + 3) + 0.6 / (RRF_K + 1);
    expect(docB.fusedScore).toBeCloseTo(expectedB, 6);
  });

  // Test 5: Limit respected
  it('returns at most `limit` results', async () => {
    const kwResults = Array.from({ length: 10 }, (_, i) => makeKeywordResult(`kw-${i}`));
    const vecResults = Array.from({ length: 10 }, (_, i) => makeVectorResult(`vec-${i}`, 0.9 - i * 0.05));

    const apiClient = makeMockApiClient({
      search: vi.fn().mockResolvedValue({ results: kwResults }),
    });
    const sidmemo = makeMockSidMemoClient({
      search: vi.fn().mockResolvedValue(vecResults),
    });

    const results = await hybridSearch(
      { query: 'test', userId: 'u1', limit: 5 },
      { sidmemo, apiClient },
    );

    expect(results).toHaveLength(5);
  });

  // Test 6: Type filter passed to both backends
  it('passes type filter to both search backends', async () => {
    const apiClient = makeMockApiClient({
      search: vi.fn().mockResolvedValue({ results: [] }),
    });
    const sidmemo = makeMockSidMemoClient({
      search: vi.fn().mockResolvedValue([]),
    });

    await hybridSearch(
      { query: 'test', userId: 'u1', filters: { type: ['spec'] } },
      { sidmemo, apiClient },
    );

    // API search should receive type filter
    expect(apiClient.knowledge.search).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'spec' }),
    );

    // SidMemo search should receive type in filters
    const sidmemoCall = (sidmemo.search as any).mock.calls[0];
    expect(sidmemoCall[3]).toEqual(expect.objectContaining({ type: ['spec'] }));
  });

  // Test 7: Custom weights
  it('applies custom weights to RRF scores', async () => {
    const apiClient = makeMockApiClient({
      search: vi.fn().mockResolvedValue({
        results: [makeKeywordResult('d1')],
      }),
    });
    const sidmemo = makeMockSidMemoClient({
      search: vi.fn().mockResolvedValue([
        makeVectorResult('d1', 0.9),
      ]),
    });

    const results = await hybridSearch(
      { query: 'test', userId: 'u1', weights: { keyword: 0.7, vector: 0.3 } },
      { sidmemo, apiClient },
    );

    const expected = 0.7 / (RRF_K + 1) + 0.3 / (RRF_K + 1);
    expect(results[0].fusedScore).toBeCloseTo(expected, 6);
  });

  // Test 8: Graph enrichment populates relatedEntities
  it('populates relatedEntities from graph subgraph', async () => {
    const apiClient = makeMockApiClient({
      search: vi.fn().mockResolvedValue({
        results: [makeKeywordResult('d1', 'EntityA')],
      }),
    });
    const sidmemo = makeMockSidMemoClient({
      search: vi.fn().mockResolvedValue([]),
      getSubgraph: vi.fn().mockResolvedValue({
        entities: [
          { name: 'EntityA', type: 'concept', properties: {} },
          { name: 'EntityB', type: 'concept', properties: {} },
        ],
        relations: [
          { id: 'r1', source: 'EntityA', target: 'EntityB', type: 'RELATED_TO', properties: {} },
        ],
      }),
    });

    const results = await hybridSearch(
      { query: 'test', userId: 'u1' },
      { sidmemo, apiClient },
    );

    expect(results[0].relatedEntities).toBeDefined();
    expect(results[0].relatedEntities).toContainEqual(
      expect.objectContaining({ name: 'EntityB', relation: 'RELATED_TO' }),
    );
  });

  // Test 9: Graph failure graceful
  it('returns results without relatedEntities when graph fails', async () => {
    const apiClient = makeMockApiClient({
      search: vi.fn().mockResolvedValue({
        results: [makeKeywordResult('d1')],
      }),
    });
    const sidmemo = makeMockSidMemoClient({
      search: vi.fn().mockResolvedValue([]),
      getSubgraph: vi.fn().mockRejectedValue(new Error('graph unavailable')),
    });

    const results = await hybridSearch(
      { query: 'test', userId: 'u1' },
      { sidmemo, apiClient },
    );

    expect(results).toHaveLength(1);
    // relatedEntities should be undefined (graph failed gracefully)
    expect(results[0].relatedEntities).toBeUndefined();
  });
});

// =============================================================================
// buildRAGContext() Tests
// =============================================================================

describe('buildRAGContext()', () => {
  // Test 10: Basic context assembly
  it('assembles markdown with Relevant Knowledge header and chunk sections', async () => {
    const sidmemo = makeMockSidMemoClient({
      search: vi.fn().mockResolvedValue([
        makeVectorResult('d1', 0.9, 'Chunk one content'),
        makeVectorResult('d2', 0.8, 'Chunk two content'),
        makeVectorResult('d3', 0.7, 'Chunk three content'),
      ]),
    });
    const apiClient = makeMockApiClient();

    const result = await buildRAGContext(
      { query: 'test', userId: 'u1' },
      { sidmemo, apiClient },
    );

    expect(result.context).toContain('## Relevant Knowledge');
    expect(result.context).toContain('### From: Title d1');
    expect(result.context).toContain('### From: Title d2');
    expect(result.context).toContain('### From: Title d3');
    expect(result.chunks).toHaveLength(3);
  });

  // Test 11: Deduplication by docId
  it('deduplicates chunks by docId (keeps first per doc)', async () => {
    const sidmemo = makeMockSidMemoClient({
      search: vi.fn().mockResolvedValue([
        makeVectorResult('d1', 0.9, 'First chunk of d1'),
        { ...makeVectorResult('d1', 0.85, 'Second chunk of d1'), id: 'd1-chunk-2' },
        makeVectorResult('d2', 0.8, 'Chunk of d2'),
      ]),
    });
    const apiClient = makeMockApiClient();

    const result = await buildRAGContext(
      { query: 'test', userId: 'u1' },
      { sidmemo, apiClient },
    );

    // Only 2 unique docs
    expect(result.chunks).toHaveLength(2);
    expect(result.chunks[0].docId).toBe('d1');
    expect(result.chunks[1].docId).toBe('d2');
  });

  // Test 12: Token truncation
  it('truncates when chunks exceed maxTokens', async () => {
    // Each chunk ~200 chars → ~50 tokens. Plus formatting overhead.
    const longContent = 'A'.repeat(800);
    const chunks = Array.from({ length: 10 }, (_, i) =>
      makeVectorResult(`d${i}`, 0.9 - i * 0.05, longContent),
    );

    const sidmemo = makeMockSidMemoClient({
      search: vi.fn().mockResolvedValue(chunks),
    });
    const apiClient = makeMockApiClient();

    const result = await buildRAGContext(
      { query: 'test', userId: 'u1', maxTokens: 500 },
      { sidmemo, apiClient },
    );

    expect(result.metadata.truncated).toBe(true);
    // chunks array has all deduped results; truncation only affects context string
    // Verify context doesn't contain all 10 chunk sections
    const sectionCount = (result.context.match(/### From:/g) || []).length;
    expect(sectionCount).toBeLessThan(10);
  });

  // Test 13: Graph section included
  it('includes Related Concepts section when includeGraph is true', async () => {
    const sidmemo = makeMockSidMemoClient({
      search: vi.fn().mockResolvedValue([makeVectorResult('d1', 0.9)]),
      getSubgraph: vi.fn().mockResolvedValue({
        entities: [
          { name: 'A', type: 'concept', properties: {} },
          { name: 'B', type: 'concept', properties: {} },
        ],
        relations: [
          { id: 'r1', source: 'A', target: 'B', type: 'DEPENDS_ON', properties: {} },
        ],
      }),
    });
    const apiClient = makeMockApiClient();

    const result = await buildRAGContext(
      { query: 'test', userId: 'u1', includeGraph: true },
      { sidmemo, apiClient },
    );

    expect(result.context).toContain('## Related Concepts');
    expect(result.context).toContain('A --DEPENDS_ON--> B');
    expect(result.graph).toBeDefined();
  });

  // Test 14: Graph excluded
  it('excludes graph section when includeGraph is false', async () => {
    const sidmemo = makeMockSidMemoClient({
      search: vi.fn().mockResolvedValue([makeVectorResult('d1', 0.9)]),
    });
    const apiClient = makeMockApiClient();

    const result = await buildRAGContext(
      { query: 'test', userId: 'u1', includeGraph: false },
      { sidmemo, apiClient },
    );

    expect(result.context).not.toContain('## Related Concepts');
    expect(result.graph).toBeUndefined();
    expect(sidmemo.getSubgraph).not.toHaveBeenCalled();
  });

  // Test 15: Graph failure graceful
  it('returns context without graph when getSubgraph throws', async () => {
    const sidmemo = makeMockSidMemoClient({
      search: vi.fn().mockResolvedValue([makeVectorResult('d1', 0.9)]),
      getSubgraph: vi.fn().mockRejectedValue(new Error('graph down')),
    });
    const apiClient = makeMockApiClient();

    const result = await buildRAGContext(
      { query: 'test', userId: 'u1', includeGraph: true },
      { sidmemo, apiClient },
    );

    expect(result.context).toContain('## Relevant Knowledge');
    expect(result.context).not.toContain('## Related Concepts');
    expect(result.graph).toBeUndefined();
  });

  // Test 16: Score in output
  it('includes score in markdown output', async () => {
    const sidmemo = makeMockSidMemoClient({
      search: vi.fn().mockResolvedValue([makeVectorResult('d1', 0.92)]),
    });
    const apiClient = makeMockApiClient();

    const result = await buildRAGContext(
      { query: 'test', userId: 'u1' },
      { sidmemo, apiClient },
    );

    expect(result.context).toContain('[score: 0.92]');
    expect(result.chunks[0].score).toBe(0.92);
  });

  // Test 17: Empty results
  it('returns empty context for no search results', async () => {
    const sidmemo = makeMockSidMemoClient();
    const apiClient = makeMockApiClient();

    const result = await buildRAGContext(
      { query: 'test', userId: 'u1' },
      { sidmemo, apiClient },
    );

    expect(result.context).toBe('## Relevant Knowledge\n\n');
    expect(result.chunks).toEqual([]);
    expect(result.metadata.totalChunks).toBe(0);
  });
});
