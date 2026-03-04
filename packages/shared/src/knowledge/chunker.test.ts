/**
 * Chunker Unit Tests
 *
 * Pure function tests for chunkDocument().
 * No mocks needed — tests markdown-aware semantic chunking logic.
 */
import { describe, it, expect } from 'vitest';
import { chunkDocument, type KnowledgeChunk } from './chunker';
import { makeTestDoc, repeat } from './__test-utils';

// =============================================================================
// Tests
// =============================================================================

describe('chunkDocument', () => {
  // Test 1: Short doc → single chunk
  it('returns single chunk for short document (< 1500 chars)', () => {
    const doc = makeTestDoc({ content: 'This is a short document.' });
    const chunks = chunkDocument(doc);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].totalChunks).toBe(1);
    expect(chunks[0].docId).toBe('test-doc-1');
  });

  // Test 2: Multi-section doc
  it('splits at ## heading boundaries into separate chunks', () => {
    const content = [
      '## Section One',
      repeat('First section content paragraph.', 20),
      '## Section Two',
      repeat('Second section content paragraph.', 20),
      '## Section Three',
      repeat('Third section content paragraph.', 20),
    ].join('\n');

    const doc = makeTestDoc({ content });
    const chunks = chunkDocument(doc);

    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks[0].sectionHeading).toBe('Section One');
    expect(chunks[1].sectionHeading).toBe('Section Two');
    expect(chunks[2].sectionHeading).toBe('Section Three');
  });

  // Test 3: Code block preservation
  it('keeps fenced code block intact in one chunk', () => {
    const codeBlock = '```typescript\nfunction hello() {\n  console.log("hello");\n}\n```';
    const content = [
      '## Code Section',
      'Some intro text before the code block.',
      '',
      codeBlock,
      '',
      repeat('More text after code.', 30),
      '## Next Section',
      repeat('Next section text.', 20),
    ].join('\n');

    const doc = makeTestDoc({ content });
    const chunks = chunkDocument(doc);

    // Find the chunk containing the code
    const codeChunk = chunks.find(c => c.content.includes('function hello()'));
    expect(codeChunk).toBeDefined();
    expect(codeChunk!.content).toContain('```typescript');
    expect(codeChunk!.content).toContain('```');
    expect(codeChunk!.content).toContain('console.log("hello")');
  });

  // Test 4: Table preservation
  it('keeps table intact in one chunk', () => {
    const table = [
      '| Col1 | Col2 | Col3 |',
      '|------|------|------|',
      '| A    | B    | C    |',
      '| D    | E    | F    |',
    ].join('\n');

    const content = [
      '## Table Section',
      'Intro paragraph.',
      '',
      table,
      '',
      repeat('Text after table paragraph.', 30),
      '## Other Section',
      repeat('Other section content.', 20),
    ].join('\n');

    const doc = makeTestDoc({ content });
    const chunks = chunkDocument(doc);

    const tableChunk = chunks.find(c => c.content.includes('| Col1 |'));
    expect(tableChunk).toBeDefined();
    expect(tableChunk!.content).toContain('| A    | B    | C    |');
    expect(tableChunk!.content).toContain('| D    | E    | F    |');
  });

  // Test 5: List preservation
  it('keeps list items together in one chunk', () => {
    const list = [
      '- Item one with some description',
      '- Item two with some description',
      '- Item three with some description',
      '- Item four with some description',
    ].join('\n');

    const content = [
      '## List Section',
      'Intro paragraph.',
      '',
      list,
      '',
      repeat('Text after list paragraph.', 30),
      '## Other Section',
      repeat('Other section content.', 20),
    ].join('\n');

    const doc = makeTestDoc({ content });
    const chunks = chunkDocument(doc);

    const listChunk = chunks.find(c => c.content.includes('- Item one'));
    expect(listChunk).toBeDefined();
    expect(listChunk!.content).toContain('- Item two');
    expect(listChunk!.content).toContain('- Item four');
  });

  // Test 6: Long section → paragraph split
  it('splits long single section at paragraph boundaries', () => {
    // Create a section much longer than 1500 chars
    const longContent = [
      '## Long Section',
      ...Array(30).fill(null).map((_, i) =>
        `Paragraph ${i}: ${repeat('Some meaningful text content.', 3)}`
      ),
    ].join('\n\n');

    const doc = makeTestDoc({ content: longContent });
    const chunks = chunkDocument(doc);

    expect(chunks.length).toBeGreaterThan(1);
    // All chunks should reference the same heading
    chunks.forEach(c => {
      expect(c.sectionHeading).toBe('Long Section');
    });
  });

  // Test 7: Tiny fragment skip
  it('skips fragments shorter than 100 chars', () => {
    const content = [
      '## Big Section',
      repeat('Substantial content paragraph for testing purposes.', 20),
      '## Tiny',
      'Hi.',
      '## Another Big Section',
      repeat('More substantial content paragraph here.', 20),
    ].join('\n');

    const doc = makeTestDoc({ content });
    const chunks = chunkDocument(doc);

    // The tiny section ("Hi.") should be skipped
    const tinyChunk = chunks.find(c => c.sectionHeading === 'Tiny');
    expect(tinyChunk).toBeUndefined();
  });

  // Test 8: Empty content
  it('returns empty array for empty content', () => {
    const doc = makeTestDoc({ content: '' });
    const chunks = chunkDocument(doc);
    expect(chunks).toEqual([]);
  });

  // Test 9: Chunk metadata
  it('includes correct metadata on each chunk', () => {
    const doc = makeTestDoc({
      id: 'doc-meta',
      title: 'Meta Test',
      type: 'spec',
      status: 'draft',
      tags: ['api', 'v2'],
      module: 'core',
      content: 'Some content for metadata test.',
    });

    const chunks = chunkDocument(doc);
    expect(chunks).toHaveLength(1);

    const meta = chunks[0].metadata;
    expect(meta.sourceType).toBe('knowledge_chunk');
    expect(meta.docId).toBe('doc-meta');
    expect(meta.type).toBe('spec');
    expect(meta.title).toBe('Meta Test');
    expect(meta.tags).toEqual(['api', 'v2']);
    expect(meta.status).toBe('draft');
    expect(meta.module).toBe('core');
  });

  // Test 10: Context prefix
  it('prefixes chunk content with "Title: {title} | Section: {heading}"', () => {
    const doc = makeTestDoc({
      title: 'My Guide',
      content: 'Simple body text.',
    });

    const chunks = chunkDocument(doc);
    expect(chunks[0].content).toMatch(/^Title: My Guide \| Section: /);
  });

  // Test 11: ChunkId format
  it('generates chunkId in "{docId}#chunk-{index}" format', () => {
    const content = [
      '## Section A',
      repeat('Content for section A here.', 20),
      '## Section B',
      repeat('Content for section B here.', 20),
    ].join('\n');

    const doc = makeTestDoc({ id: 'doc-42', content });
    const chunks = chunkDocument(doc);

    chunks.forEach((c, i) => {
      expect(c.chunkId).toBe(`doc-42#chunk-${i}`);
    });
  });

  // Test 12: H3 heading split
  it('splits at ### sub-heading boundaries', () => {
    const content = [
      '### Sub One',
      repeat('Sub section one content text.', 20),
      '### Sub Two',
      repeat('Sub section two content text.', 20),
      '### Sub Three',
      repeat('Sub section three content text.', 20),
    ].join('\n');

    const doc = makeTestDoc({ content });
    const chunks = chunkDocument(doc);

    expect(chunks.length).toBeGreaterThanOrEqual(3);
    const headings = chunks.map(c => c.sectionHeading);
    expect(headings).toContain('Sub One');
    expect(headings).toContain('Sub Two');
    expect(headings).toContain('Sub Three');
  });
});
