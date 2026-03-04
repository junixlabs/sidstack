/**
 * SidMemoClient Unit Tests
 *
 * Tests HTTP client logic by mocking global.fetch.
 * No real API calls — validates request construction, response parsing, error handling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SidMemoClient } from './client';

// =============================================================================
// Mock Setup
// =============================================================================

const originalFetch = global.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  fetchMock = vi.fn();
  global.fetch = fetchMock as any;
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

// =============================================================================
// Tests
// =============================================================================

describe('SidMemoClient', () => {
  // =========================================================================
  // isAvailable()
  // =========================================================================

  describe('isAvailable()', () => {
    // Test 1: Healthy server
    it('returns true when server responds with 200', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ status: 'ok' }, 200));
      const client = new SidMemoClient({ baseUrl: 'http://localhost:9999', apiKey: 'test' });

      const result = await client.isAvailable();
      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    // Test 2: Server down
    it('returns false when server is unreachable', async () => {
      fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const client = new SidMemoClient({ baseUrl: 'http://localhost:9999', apiKey: 'test' });

      const result = await client.isAvailable();
      expect(result).toBe(false);
    });

    // Test 3: Cache behavior
    it('caches true permanently (no second fetch)', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ status: 'ok' }));
      const client = new SidMemoClient({ baseUrl: 'http://localhost:9999', apiKey: 'test' });

      await client.isAvailable();
      const secondResult = await client.isAvailable();

      expect(secondResult).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1); // Only 1 call, cached
    });
  });

  // =========================================================================
  // add()
  // =========================================================================

  describe('add()', () => {
    // Test 4: Success
    it('sends POST and returns SidMemoMemory on 201', async () => {
      const memory = { id: 'mem-1', content: 'test', created_at: '2026-01-01', updated_at: '2026-01-01' };
      fetchMock.mockResolvedValueOnce(mockResponse(memory, 201));
      const client = new SidMemoClient({ baseUrl: 'http://localhost:9999', apiKey: 'test' });

      const result = await client.add('test content', 'user-1', { key: 'val' });

      expect(result).toEqual(memory);
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('/memories');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body);
      expect(body.messages[0].content).toBe('test content');
      expect(body.user_id).toBe('user-1');
      expect(body.metadata).toEqual({ key: 'val' });
    });

    // Test 5: API error
    it('throws on non-ok response', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ error: 'Internal' }, 500));
      const client = new SidMemoClient({ baseUrl: 'http://localhost:9999', apiKey: 'test' });

      await expect(client.add('test', 'user-1')).rejects.toThrow('SidMemo add failed: 500');
    });
  });

  // =========================================================================
  // search()
  // =========================================================================

  describe('search()', () => {
    // Test 6: Array response
    it('parses direct array response', async () => {
      const results = [{ id: '1', content: 'a', score: 0.9 }];
      fetchMock.mockResolvedValueOnce(mockResponse(results));
      const client = new SidMemoClient({ baseUrl: 'http://localhost:9999', apiKey: 'test' });

      const out = await client.search('query', 'user-1');
      expect(out).toEqual(results);
    });

    // Test 7: Wrapped response
    it('unwraps { results: [...] } response', async () => {
      const inner = [{ id: '1', content: 'b', score: 0.8 }];
      fetchMock.mockResolvedValueOnce(mockResponse({ results: inner }));
      const client = new SidMemoClient({ baseUrl: 'http://localhost:9999', apiKey: 'test' });

      const out = await client.search('query', 'user-1');
      expect(out).toEqual(inner);
    });

    // Test 8: Filters
    it('sends filters in request body', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse([]));
      const client = new SidMemoClient({ baseUrl: 'http://localhost:9999', apiKey: 'test' });

      await client.search('query', 'user-1', 10, { sourceType: 'knowledge_chunk' });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.filters).toEqual({ sourceType: 'knowledge_chunk' });
    });
  });

  // =========================================================================
  // list()
  // =========================================================================

  describe('list()', () => {
    // Test 9: Pagination query params
    it('sends page and pageSize as query params', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ items: [], total: 0, page: 2, page_size: 10 }));
      const client = new SidMemoClient({ baseUrl: 'http://localhost:9999', apiKey: 'test' });

      await client.list('user-1', 2, 10);

      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('page=2');
      expect(url).toContain('page_size=10');
      expect(url).toContain('user_id=user-1');
    });

    // Test 10: Normalize array response
    it('wraps plain array response into SidMemoListResponse', async () => {
      const items = [{ id: '1', content: 'test', created_at: '2026-01-01', updated_at: '2026-01-01' }];
      fetchMock.mockResolvedValueOnce(mockResponse(items));
      const client = new SidMemoClient({ baseUrl: 'http://localhost:9999', apiKey: 'test' });

      const result = await client.list('user-1');
      expect(result.items).toEqual(items);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });
  });

  // =========================================================================
  // delete()
  // =========================================================================

  describe('delete()', () => {
    // Test 11: Success
    it('sends DELETE request and resolves on 200', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({}, 200));
      const client = new SidMemoClient({ baseUrl: 'http://localhost:9999', apiKey: 'test' });

      await expect(client.delete('mem-1')).resolves.toBeUndefined();
      expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
    });

    // Test 12: Not found
    it('throws on 404', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ error: 'not found' }, 404));
      const client = new SidMemoClient({ baseUrl: 'http://localhost:9999', apiKey: 'test' });

      await expect(client.delete('nonexistent')).rejects.toThrow('SidMemo delete failed: 404');
    });
  });

  // =========================================================================
  // bulkDelete()
  // =========================================================================

  describe('bulkDelete()', () => {
    // Test 13: By IDs
    it('sends POST with ids array and returns deleted count', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ deleted: 3 }));
      const client = new SidMemoClient({ baseUrl: 'http://localhost:9999', apiKey: 'test' });

      const result = await client.bulkDelete(['a', 'b', 'c']);
      expect(result).toEqual({ deleted: 3 });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.ids).toEqual(['a', 'b', 'c']);
    });
  });

  // =========================================================================
  // update()
  // =========================================================================

  describe('update()', () => {
    // Test 14: PATCH
    it('sends PATCH with content and returns updated memory', async () => {
      const updated = { id: 'mem-1', content: 'new content', created_at: '2026-01-01', updated_at: '2026-01-02' };
      fetchMock.mockResolvedValueOnce(mockResponse(updated));
      const client = new SidMemoClient({ baseUrl: 'http://localhost:9999', apiKey: 'test' });

      const result = await client.update('mem-1', 'new content');
      expect(result).toEqual(updated);
      expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
    });
  });

  // =========================================================================
  // Knowledge Graph
  // =========================================================================

  describe('getEntity()', () => {
    // Test 15: Graph entity
    it('fetches entity by name', async () => {
      const entity = { name: 'SidStack', type: 'project', properties: {}, relations: [] };
      fetchMock.mockResolvedValueOnce(mockResponse(entity));
      const client = new SidMemoClient({ baseUrl: 'http://localhost:9999', apiKey: 'test' });

      const result = await client.getEntity('SidStack');
      expect(result).toEqual(entity);

      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('/graph/entities/SidStack');
    });
  });

  describe('getSubgraph()', () => {
    // Test 16: Subgraph
    it('fetches subgraph with entities and hops params', async () => {
      const subgraph = { entities: [], relations: [] };
      fetchMock.mockResolvedValueOnce(mockResponse(subgraph));
      const client = new SidMemoClient({ baseUrl: 'http://localhost:9999', apiKey: 'test' });

      const result = await client.getSubgraph(['A', 'B'], 1);
      expect(result).toEqual(subgraph);

      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('entities=A%2CB');
      expect(url).toContain('hops=1');
    });
  });

  // =========================================================================
  // URL & Auth Construction
  // =========================================================================

  describe('URL construction', () => {
    // Test 17: API URL construction
    it('builds correct prefix from baseUrl + projectSlug', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse([]));
      const client = new SidMemoClient({
        baseUrl: 'https://custom.api.com',
        projectSlug: 'my-project',
        apiKey: 'test',
      });

      await client.search('query', 'user-1');

      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toBe('https://custom.api.com/api/v1/projects/my-project/memories/search');
    });
  });

  describe('Auth header', () => {
    // Test 18: X-API-Key header
    it('includes X-API-Key header when apiKey is provided', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse([]));
      const client = new SidMemoClient({ baseUrl: 'http://localhost:9999', apiKey: 'my-secret-key' });

      await client.search('query', 'user-1');

      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers['X-API-Key']).toBe('my-secret-key');
    });
  });

  describe('Env var fallback', () => {
    // Test 19: Environment variables
    it('uses SIDMEMO_* env vars when no config provided', async () => {
      const origUrl = process.env.SIDMEMO_API_URL;
      const origKey = process.env.SIDMEMO_API_KEY;
      const origSlug = process.env.SIDMEMO_PROJECT_SLUG;

      process.env.SIDMEMO_API_URL = 'https://env.example.com';
      process.env.SIDMEMO_API_KEY = 'env-key';
      process.env.SIDMEMO_PROJECT_SLUG = 'env-project';

      try {
        fetchMock.mockResolvedValueOnce(mockResponse([]));
        const client = new SidMemoClient();

        await client.search('query', 'user-1');

        const url = fetchMock.mock.calls[0][0] as string;
        expect(url).toBe('https://env.example.com/api/v1/projects/env-project/memories/search');

        const headers = fetchMock.mock.calls[0][1].headers;
        expect(headers['X-API-Key']).toBe('env-key');
      } finally {
        // Restore
        if (origUrl !== undefined) process.env.SIDMEMO_API_URL = origUrl;
        else delete process.env.SIDMEMO_API_URL;
        if (origKey !== undefined) process.env.SIDMEMO_API_KEY = origKey;
        else delete process.env.SIDMEMO_API_KEY;
        if (origSlug !== undefined) process.env.SIDMEMO_PROJECT_SLUG = origSlug;
        else delete process.env.SIDMEMO_PROJECT_SLUG;
      }
    });
  });
});
