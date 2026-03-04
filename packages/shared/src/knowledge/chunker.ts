/**
 * Knowledge Document Chunker
 *
 * Markdown-aware semantic chunking for knowledge documents.
 * Splits at heading boundaries, preserves code blocks/tables/lists,
 * and enriches each chunk with metadata for filtered search.
 */

import type { KnowledgeDocument } from './types.js';

// =============================================================================
// Types
// =============================================================================

export interface KnowledgeChunk {
  chunkId: string;           // "{docId}#chunk-{index}"
  docId: string;
  sectionHeading: string;    // nearest H2/H3
  content: string;           // chunk text with context prefix
  chunkIndex: number;
  totalChunks: number;
  metadata: {
    sourceType: 'knowledge_chunk';
    docId: string;
    module?: string;
    type: string;
    title: string;
    tags: string[];
    status: string;
    sectionHeading: string;
  };
}

// =============================================================================
// Constants
// =============================================================================

const MAX_CHUNK_CHARS = 1500;
const MIN_CHUNK_CHARS = 100;
const HEADING_RE = /^#{2,3}\s+(.+)$/;

// =============================================================================
// Core
// =============================================================================

/**
 * Chunk a knowledge document into semantically meaningful pieces.
 *
 * Rules:
 * - Split at ## / ### heading boundaries
 * - Within sections, split by paragraph if > MAX_CHUNK_CHARS
 * - Never split mid-code-block, mid-table, mid-list
 * - Prefix each chunk with "Title: {title} | Section: {heading}\n\n"
 * - Minimum MIN_CHUNK_CHARS (skip tiny fragments)
 * - Short docs (<MAX_CHUNK_CHARS): single chunk, no splitting
 */
export function chunkDocument(doc: KnowledgeDocument): KnowledgeChunk[] {
  const body = doc.content.trim();
  if (!body) return [];

  // Short doc: single chunk
  if (body.length < MAX_CHUNK_CHARS) {
    return [buildChunk(doc, body, doc.title, 0, 1)];
  }

  // Split into sections by ## / ### headings
  const sections = splitBySections(body);

  // Build raw chunks from sections
  const rawChunks: Array<{ heading: string; content: string }> = [];

  for (const section of sections) {
    if (section.content.length <= MAX_CHUNK_CHARS) {
      rawChunks.push(section);
    } else {
      // Split large sections by paragraph boundaries
      const subChunks = splitByParagraphs(section.content, section.heading);
      rawChunks.push(...subChunks);
    }
  }

  // Filter out tiny fragments
  const filtered = rawChunks.filter(c => c.content.trim().length >= MIN_CHUNK_CHARS);
  if (filtered.length === 0) {
    // Fallback: single chunk
    return [buildChunk(doc, body, doc.title, 0, 1)];
  }

  const total = filtered.length;
  return filtered.map((c, i) => buildChunk(doc, c.content, c.heading, i, total));
}

// =============================================================================
// Helpers
// =============================================================================

function buildChunk(
  doc: KnowledgeDocument,
  content: string,
  heading: string,
  index: number,
  total: number,
): KnowledgeChunk {
  const prefix = `Title: ${doc.title} | Section: ${heading}\n\n`;
  return {
    chunkId: `${doc.id}#chunk-${index}`,
    docId: doc.id,
    sectionHeading: heading,
    content: prefix + content.trim(),
    chunkIndex: index,
    totalChunks: total,
    metadata: {
      sourceType: 'knowledge_chunk',
      docId: doc.id,
      module: doc.module,
      type: doc.type,
      title: doc.title,
      tags: doc.tags || [],
      status: doc.status,
      sectionHeading: heading,
    },
  };
}

interface Section {
  heading: string;
  content: string;
}

/**
 * Split markdown content into sections at ## / ### heading boundaries.
 * Content before the first heading becomes a section with the doc's implicit heading.
 */
function splitBySections(content: string): Section[] {
  const lines = content.split('\n');
  const sections: Section[] = [];
  let currentHeading = 'Introduction';
  let currentLines: string[] = [];

  for (const line of lines) {
    const match = line.match(HEADING_RE);
    if (match) {
      // Flush previous section
      if (currentLines.length > 0) {
        sections.push({ heading: currentHeading, content: currentLines.join('\n') });
      }
      currentHeading = match[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // Flush last section
  if (currentLines.length > 0) {
    sections.push({ heading: currentHeading, content: currentLines.join('\n') });
  }

  return sections;
}

/**
 * Split a section into paragraph-sized chunks, respecting code blocks and tables.
 * Never breaks inside a fenced code block, table, or list.
 */
function splitByParagraphs(content: string, heading: string): Section[] {
  const blocks = identifyBlocks(content);
  const chunks: Section[] = [];
  let currentContent = '';

  for (const block of blocks) {
    if (currentContent.length + block.length > MAX_CHUNK_CHARS && currentContent.length >= MIN_CHUNK_CHARS) {
      chunks.push({ heading, content: currentContent });
      currentContent = '';
    }
    if (currentContent) currentContent += '\n\n';
    currentContent += block;
  }

  if (currentContent.trim()) {
    chunks.push({ heading, content: currentContent });
  }

  return chunks;
}

/**
 * Identify atomic blocks that should not be split:
 * - Fenced code blocks (``` ... ```)
 * - Tables (lines starting with |)
 * - Consecutive list items (lines starting with - or *)
 * - Regular paragraphs (separated by blank lines)
 */
function identifyBlocks(content: string): string[] {
  const lines = content.split('\n');
  const blocks: string[] = [];
  let current: string[] = [];
  let inCodeBlock = false;
  let inTable = false;
  let inList = false;

  const flush = () => {
    if (current.length > 0) {
      blocks.push(current.join('\n'));
      current = [];
    }
  };

  for (const line of lines) {
    // Code block fence
    if (line.trimStart().startsWith('```')) {
      if (!inCodeBlock) {
        // Start code block — flush prior content
        flush();
        inCodeBlock = true;
        current.push(line);
      } else {
        // End code block
        current.push(line);
        inCodeBlock = false;
        flush();
      }
      continue;
    }

    if (inCodeBlock) {
      current.push(line);
      continue;
    }

    // Table row
    const isTableRow = line.trimStart().startsWith('|');
    if (isTableRow) {
      if (!inTable) {
        flush();
        inTable = true;
      }
      current.push(line);
      continue;
    } else if (inTable) {
      inTable = false;
      flush();
    }

    // List item
    const isListItem = /^\s*[-*+]\s/.test(line) || /^\s*\d+\.\s/.test(line);
    if (isListItem) {
      if (!inList) {
        flush();
        inList = true;
      }
      current.push(line);
      continue;
    } else if (inList && line.trim() !== '') {
      // Continuation of list context (indented content)
      if (/^\s{2,}/.test(line)) {
        current.push(line);
        continue;
      }
      inList = false;
      flush();
    } else if (inList && line.trim() === '') {
      // End of list
      inList = false;
      flush();
    }

    // Blank line = paragraph separator
    if (line.trim() === '') {
      if (current.length > 0 && !inList) {
        flush();
      }
      continue;
    }

    current.push(line);
  }

  flush();
  return blocks;
}
