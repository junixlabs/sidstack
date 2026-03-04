/**
 * Memory Hygiene Tests
 *
 * Unit tests for TTL expiry helpers, conflict detection (addSmart),
 * and the SidMemoClient update/addSmart methods.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeExpiresAt, isMemoryExpired, MEMORY_TTL_MS } from './types';
import type { Mem0Memory, SidMemoMemory, SidMemoSearchResult } from './types';

// ============================================================
// TTL Helpers
// ============================================================

describe('computeExpiresAt', () => {
  it('returns undefined for sourceTypes with no TTL (lesson, knowledge_doc, manual)', () => {
    expect(computeExpiresAt('lesson')).toBeUndefined();
    expect(computeExpiresAt('knowledge_doc')).toBeUndefined();
    expect(computeExpiresAt('manual')).toBeUndefined();
  });

  it('returns a future ISO date for task_completion (90 days)', () => {
    const result = computeExpiresAt('task_completion');
    expect(result).toBeDefined();
    const expiry = new Date(result!).getTime();
    const expected = Date.now() + 90 * 24 * 60 * 60 * 1000;
    // Allow 5 second tolerance
    expect(Math.abs(expiry - expected)).toBeLessThan(5000);
  });

  it('returns a future ISO date for incident (180 days)', () => {
    const result = computeExpiresAt('incident');
    expect(result).toBeDefined();
    const expiry = new Date(result!).getTime();
    const expected = Date.now() + 180 * 24 * 60 * 60 * 1000;
    expect(Math.abs(expiry - expected)).toBeLessThan(5000);
  });

  it('returns undefined for unknown sourceType', () => {
    expect(computeExpiresAt('unknown_type')).toBeUndefined();
  });

  it('returns undefined when sourceType is undefined', () => {
    expect(computeExpiresAt(undefined)).toBeUndefined();
  });
});

describe('isMemoryExpired', () => {
  it('returns false when no expiresAt in metadata', () => {
    const mem: Mem0Memory = { id: '1', memory: 'test' };
    expect(isMemoryExpired(mem)).toBe(false);
  });

  it('returns false when metadata is undefined', () => {
    const mem: Mem0Memory = { id: '1', memory: 'test', metadata: undefined };
    expect(isMemoryExpired(mem)).toBe(false);
  });

  it('returns false when expiresAt is in the future', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const mem: Mem0Memory = {
      id: '1',
      memory: 'test',
      metadata: { expiresAt: future },
    };
    expect(isMemoryExpired(mem)).toBe(false);
  });

  it('returns true when expiresAt is in the past', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const mem: Mem0Memory = {
      id: '1',
      memory: 'test',
      metadata: { expiresAt: past },
    };
    expect(isMemoryExpired(mem)).toBe(true);
  });

  it('works with SidMemoMemory (metadata_ field)', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const mem: SidMemoMemory = {
      id: '1',
      content: 'test',
      metadata_: { expiresAt: past },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(isMemoryExpired(mem)).toBe(true);
  });
});

describe('MEMORY_TTL_MS', () => {
  it('has correct TTL for task_completion (90 days)', () => {
    expect(MEMORY_TTL_MS.task_completion).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it('has correct TTL for incident (180 days)', () => {
    expect(MEMORY_TTL_MS.incident).toBe(180 * 24 * 60 * 60 * 1000);
  });

  it('has null TTL for persistent types', () => {
    expect(MEMORY_TTL_MS.lesson).toBeNull();
    expect(MEMORY_TTL_MS.knowledge_doc).toBeNull();
    expect(MEMORY_TTL_MS.manual).toBeNull();
  });
});

// ============================================================
// SidMemoClient.addSmart (mock-based)
// ============================================================

const makeMockMemory = (overrides: Partial<SidMemoMemory> = {}): SidMemoMemory => ({
  id: 'new-1',
  content: 'test content',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

const makeMockSearchResult = (overrides: Partial<SidMemoSearchResult> = {}): SidMemoSearchResult => ({
  id: 'result-1',
  content: 'test content',
  ...overrides,
});

describe('SidMemoClient.addSmart', () => {
  let client: InstanceType<typeof import('./client').SidMemoClient>;

  beforeEach(async () => {
    const { SidMemoClient } = await import('./client.js');
    client = new SidMemoClient({ baseUrl: 'http://localhost:9999', apiKey: 'test' });

    // Mark as available
    (client as any).available = true;
  });

  it('adds without conflict search when no sourceType in metadata', async () => {
    const addSpy = vi.spyOn(client, 'add').mockResolvedValue(makeMockMemory());
    const searchSpy = vi.spyOn(client, 'search').mockResolvedValue([]);

    const result = await client.addSmart('some content', 'proj-1');

    expect(searchSpy).not.toHaveBeenCalled();
    expect(addSpy).toHaveBeenCalledWith('some content', 'proj-1', {});
    expect(result.replaced).toEqual([]);
  });

  it('searches and replaces conflicting memory with same sourceType', async () => {
    const conflicting = makeMockSearchResult({
      id: 'old-1',
      content: 'old content',
      score: 0.92,
      metadata_: { sourceType: 'task_completion' },
    });

    vi.spyOn(client, 'search').mockResolvedValue([conflicting]);
    const deleteSpy = vi.spyOn(client, 'delete').mockResolvedValue(undefined);
    vi.spyOn(client, 'add').mockResolvedValue(makeMockMemory());

    const result = await client.addSmart('updated content', 'proj-1', {
      sourceType: 'task_completion',
    });

    expect(deleteSpy).toHaveBeenCalledWith('old-1');
    expect(result.replaced).toEqual(['old-1']);
  });

  it('does NOT replace memory below threshold', async () => {
    const similar = makeMockSearchResult({
      id: 'similar-1',
      content: 'similar but different',
      score: 0.70,
      metadata_: { sourceType: 'task_completion' },
    });

    vi.spyOn(client, 'search').mockResolvedValue([similar]);
    const deleteSpy = vi.spyOn(client, 'delete').mockResolvedValue(undefined);
    vi.spyOn(client, 'add').mockResolvedValue(makeMockMemory());

    const result = await client.addSmart('new content', 'proj-1', {
      sourceType: 'task_completion',
    });

    expect(deleteSpy).not.toHaveBeenCalled();
    expect(result.replaced).toEqual([]);
  });

  it('does NOT replace memory with different sourceType', async () => {
    const different = makeMockSearchResult({
      id: 'diff-1',
      content: 'same topic',
      score: 0.95,
      metadata_: { sourceType: 'lesson' },
    });

    vi.spyOn(client, 'search').mockResolvedValue([different]);
    const deleteSpy = vi.spyOn(client, 'delete').mockResolvedValue(undefined);
    vi.spyOn(client, 'add').mockResolvedValue(makeMockMemory());

    const result = await client.addSmart('new content', 'proj-1', {
      sourceType: 'task_completion',
    });

    expect(deleteSpy).not.toHaveBeenCalled();
    expect(result.replaced).toEqual([]);
  });

  it('stamps expiresAt for task_completion', async () => {
    vi.spyOn(client, 'search').mockResolvedValue([]);
    const addSpy = vi.spyOn(client, 'add').mockResolvedValue(makeMockMemory());

    await client.addSmart('task done', 'proj-1', {
      sourceType: 'task_completion',
    });

    const calledMetadata = addSpy.mock.calls[0][2] as Record<string, unknown>;
    expect(calledMetadata.expiresAt).toBeDefined();
    const expiry = new Date(calledMetadata.expiresAt as string).getTime();
    const expected = Date.now() + MEMORY_TTL_MS.task_completion!;
    expect(Math.abs(expiry - expected)).toBeLessThan(5000);
  });

  it('does NOT stamp expiresAt for manual/lesson/knowledge_doc', async () => {
    vi.spyOn(client, 'search').mockResolvedValue([]);
    const addSpy = vi.spyOn(client, 'add').mockResolvedValue(makeMockMemory());

    await client.addSmart('user note', 'proj-1', { sourceType: 'manual' });

    const calledMetadata = addSpy.mock.calls[0][2] as Record<string, unknown>;
    expect(calledMetadata.expiresAt).toBeUndefined();
  });

  it('respects custom conflictThreshold', async () => {
    const borderline = makeMockSearchResult({
      id: 'border-1',
      content: 'borderline similar',
      score: 0.80,
      metadata_: { sourceType: 'task_completion' },
    });

    vi.spyOn(client, 'search').mockResolvedValue([borderline]);
    const deleteSpy = vi.spyOn(client, 'delete').mockResolvedValue(undefined);
    vi.spyOn(client, 'add').mockResolvedValue(makeMockMemory());

    // Default threshold 0.85 → no replace
    const r1 = await client.addSmart('new', 'proj-1', { sourceType: 'task_completion' });
    expect(r1.replaced).toEqual([]);

    // Custom threshold 0.75 → should replace
    const r2 = await client.addSmart('new', 'proj-1', { sourceType: 'task_completion' }, { conflictThreshold: 0.75 });
    expect(deleteSpy).toHaveBeenCalledWith('border-1');
    expect(r2.replaced).toEqual(['border-1']);
  });

  it('continues adding even if search fails', async () => {
    vi.spyOn(client, 'search').mockRejectedValue(new Error('network error'));
    const addSpy = vi.spyOn(client, 'add').mockResolvedValue(makeMockMemory({ id: 'new-1' }));

    const result = await client.addSmart('content', 'proj-1', {
      sourceType: 'task_completion',
    });

    expect(addSpy).toHaveBeenCalled();
    expect(result.replaced).toEqual([]);
    expect(result.result.id).toBe('new-1');
  });
});
