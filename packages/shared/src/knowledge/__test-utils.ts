/**
 * Shared test utilities for knowledge + memory tests.
 *
 * Provides reusable factories for KnowledgeDocument fixtures
 * and SidMemoClient / SidStackApiClient mocks.
 */
import { vi } from 'vitest';
import type { KnowledgeDocument } from './types';
import type { SidMemoClient } from '../memory/client';
import type { SidStackApiClient } from '../api-client';

// =============================================================================
// Document Fixtures
// =============================================================================

/** Create a KnowledgeDocument with sensible defaults. Override any field. */
export function makeTestDoc(overrides: Partial<KnowledgeDocument> = {}): KnowledgeDocument {
  return {
    id: 'test-doc-1',
    slug: 'test-doc',
    title: 'Test Document',
    type: 'guide',
    status: 'active',
    content: 'Short content for testing.',
    tags: ['test'],
    source: 'sidstack',
    sourcePath: 'test.md',
    absolutePath: '/test.md',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/** Create a long document with multiple sections (useful for chunking tests). */
export function makeLongDoc(id: string): KnowledgeDocument {
  const sections = Array(5).fill(null).map((_, i) =>
    `## Section ${i}\n\n${Array(10).fill(`Paragraph content for section ${i}.`).join('\n\n')}`
  ).join('\n\n');
  return makeTestDoc({ id, content: sections });
}

/** Repeat text N times separated by double newlines. */
export function repeat(text: string, times: number): string {
  return Array(times).fill(text).join('\n\n');
}

// =============================================================================
// Mock Factories
// =============================================================================

/** Create a mock SidMemoClient with all methods stubbed via vi.fn(). */
export function makeMockSidMemoClient(overrides: Partial<Record<string, any>> = {}) {
  return {
    add: vi.fn().mockResolvedValue({ id: 'mem-1', content: '', created_at: '', updated_at: '' }),
    search: vi.fn().mockResolvedValue([]),
    bulkDelete: vi.fn().mockResolvedValue({ deleted: 0 }),
    delete: vi.fn().mockResolvedValue(undefined),
    getSubgraph: vi.fn().mockResolvedValue({ entities: [], relations: [] }),
    getEntity: vi.fn().mockResolvedValue({ name: '', properties: {}, relations: [] }),
    ...overrides,
  } as unknown as SidMemoClient;
}

/** Create a mock SidStackApiClient with knowledge.search stubbed. */
export function makeMockApiClient(overrides: Partial<Record<string, any>> = {}) {
  return {
    knowledge: {
      search: vi.fn().mockResolvedValue({ results: [] }),
      ...overrides,
    },
  } as unknown as SidStackApiClient;
}
