/**
 * Knowledge Indexer Unit Tests
 *
 * Tests orchestration logic by mocking SidMemoClient methods.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KnowledgeIndexer } from './indexer';
import { makeTestDoc, makeLongDoc, makeMockSidMemoClient } from './__test-utils';

// =============================================================================
// Tests
// =============================================================================

describe('KnowledgeIndexer', () => {
  let client: ReturnType<typeof makeMockSidMemoClient>;
  let indexer: KnowledgeIndexer;

  beforeEach(() => {
    client = makeMockSidMemoClient();
    indexer = new KnowledgeIndexer(client);
  });

  // Test 1: indexDocument — chunks created
  it('indexDocument() calls client.add for each chunk', async () => {
    const doc = makeLongDoc('doc-1');
    const result = await indexer.indexDocument(doc, 'user-1');

    expect(result.docId).toBe('doc-1');
    expect(result.chunksCreated).toBeGreaterThan(1);
    expect(client.add).toHaveBeenCalledTimes(result.chunksCreated);
  });

  // Test 2: indexDocument — short doc
  it('indexDocument() calls client.add once for short doc', async () => {
    const doc = makeTestDoc({ content: 'Short.' });
    const result = await indexer.indexDocument(doc, 'user-1');

    expect(result.chunksCreated).toBe(1);
    expect(client.add).toHaveBeenCalledTimes(1);
  });

  // Test 3: reindexDocument — remove + re-add
  it('reindexDocument() removes old chunks before indexing new ones', async () => {
    const existing = [{ id: 'old-1', content: '', score: 0.9 }];
    (client.search as any).mockResolvedValue(existing);

    const doc = makeTestDoc({ content: 'Updated content.' });
    await indexer.reindexDocument(doc, 'user-1');

    // removeDocument should search and bulkDelete
    expect(client.search).toHaveBeenCalled();
    expect(client.bulkDelete).toHaveBeenCalledWith(['old-1']);
    // Then indexDocument should add
    expect(client.add).toHaveBeenCalled();
  });

  // Test 4: removeDocument — chunks found
  it('removeDocument() bulk-deletes found chunks', async () => {
    const chunks = [
      { id: 'c-1', content: '', score: 0.9 },
      { id: 'c-2', content: '', score: 0.8 },
    ];
    (client.search as any).mockResolvedValue(chunks);

    await indexer.removeDocument('doc-1', 'user-1');

    expect(client.bulkDelete).toHaveBeenCalledWith(['c-1', 'c-2']);
  });

  // Test 5: removeDocument — no chunks
  it('removeDocument() does not call bulkDelete when no chunks found', async () => {
    (client.search as any).mockResolvedValue([]);

    await indexer.removeDocument('doc-1', 'user-1');

    expect(client.bulkDelete).not.toHaveBeenCalled();
  });

  // Test 6: removeDocument — search fails (graceful)
  it('removeDocument() does not throw when search fails', async () => {
    (client.search as any).mockRejectedValue(new Error('network error'));

    await expect(indexer.removeDocument('doc-1', 'user-1')).resolves.toBeUndefined();
    expect(client.bulkDelete).not.toHaveBeenCalled();
  });

  // Test 7: indexAll — batch success
  it('indexAll() returns correct counts for all-success batch', async () => {
    const docs = [makeTestDoc({ id: 'd1' }), makeTestDoc({ id: 'd2' }), makeTestDoc({ id: 'd3' })];
    const result = await indexer.indexAll(docs, 'user-1');

    expect(result).toEqual({ total: 3, indexed: 3, failed: 0, errors: [] });
  });

  // Test 8: indexAll — partial failure
  it('indexAll() counts failures and collects errors', async () => {
    let callCount = 0;
    (client.add as any).mockImplementation(() => {
      callCount++;
      if (callCount === 2) throw new Error('chunk add failed');
      return Promise.resolve({ id: `mem-${callCount}`, content: '', created_at: '', updated_at: '' });
    });

    const docs = [makeTestDoc({ id: 'd1' }), makeTestDoc({ id: 'd2' }), makeTestDoc({ id: 'd3' })];
    const result = await indexer.indexAll(docs, 'user-1');

    expect(result.total).toBe(3);
    expect(result.indexed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].docId).toBe('d2');
    expect(result.errors[0].error).toContain('chunk add failed');
  });

  // Test 9: indexAll — progress callback
  it('indexAll() calls progress callback for each doc', async () => {
    const docs = [makeTestDoc({ id: 'd1' }), makeTestDoc({ id: 'd2' }), makeTestDoc({ id: 'd3' })];
    const progress = vi.fn();

    await indexer.indexAll(docs, 'user-1', progress);

    expect(progress).toHaveBeenCalledTimes(3);
    expect(progress).toHaveBeenCalledWith(1, 3, 'd1');
    expect(progress).toHaveBeenCalledWith(2, 3, 'd2');
    expect(progress).toHaveBeenCalledWith(3, 3, 'd3');
  });

  // Test 10: indexDocument — timing
  it('indexDocument() returns positive durationMs', async () => {
    const doc = makeTestDoc({ content: 'Test timing.' });
    const result = await indexer.indexDocument(doc, 'user-1');

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
