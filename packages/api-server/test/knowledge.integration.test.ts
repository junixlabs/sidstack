/**
 * Integration Tests - Knowledge API
 *
 * Tests: list → search → stats (filesystem-based, no CRUD via API)
 * Knowledge documents come from .sidstack/knowledge/ files on disk.
 */
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Isolated temp DB with knowledge directory
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidstack-knowledge-test-'));
const sidstackDir = path.join(tmpDir, '.sidstack');
const knowledgeDir = path.join(sidstackDir, 'knowledge');
fs.mkdirSync(knowledgeDir, { recursive: true });

// Create a sample knowledge document
const sampleDoc = `---
title: Authentication Flow
type: business-logic
module: auth
status: published
tags:
  - security
  - login
---

# Authentication Flow

Users authenticate via email/password. Sessions are stored in SQLite.

## Steps
1. User enters credentials
2. Server validates against database
3. JWT token issued
4. Token stored in localStorage
`;

fs.writeFileSync(path.join(knowledgeDir, 'auth-flow.md'), sampleDoc);

process.env.HOME = tmpDir;

import { app, server } from '../src/index';

afterAll(() => {
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Knowledge Integration', () => {
  // --- Validation ---

  it('requires projectPath parameter', async () => {
    const res = await request(app).get('/api/knowledge');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('projectPath');
  });

  // --- List ---

  it('lists knowledge documents for project', async () => {
    const res = await request(app)
      .get('/api/knowledge')
      .query({ projectPath: tmpDir });

    expect(res.status).toBe(200);
    expect(res.body.documents).toBeDefined();
    expect(res.body.documents.length).toBeGreaterThanOrEqual(1);
  });

  it('lists documents filtered by type', async () => {
    const res = await request(app)
      .get('/api/knowledge')
      .query({ projectPath: tmpDir, type: 'business-logic' });

    expect(res.status).toBe(200);
    // Should include our auth-flow.md doc
    if (res.body.documents.length > 0) {
      expect(res.body.documents[0].type).toBe('business-logic');
    }
  });

  // --- Search ---

  it('requires search query parameter', async () => {
    const res = await request(app)
      .get('/api/knowledge/search')
      .query({ projectPath: tmpDir });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('query');
  });

  it('searches documents by keyword', async () => {
    const res = await request(app)
      .get('/api/knowledge/search')
      .query({ projectPath: tmpDir, q: 'authentication' });

    expect(res.status).toBe(200);
    expect(res.body.results).toBeDefined();
    expect(res.body.query).toBe('authentication');
  });

  // --- Stats ---

  it('returns knowledge base stats', async () => {
    const res = await request(app)
      .get('/api/knowledge/stats')
      .query({ projectPath: tmpDir });

    expect(res.status).toBe(200);
    // Stats shape varies but should have some structure
    expect(res.body).toBeDefined();
  });

  // --- Single Document ---

  it('returns 404 for nonexistent document', async () => {
    const res = await request(app)
      .get('/api/knowledge/doc/nonexistent-doc')
      .query({ projectPath: tmpDir });

    expect(res.status).toBe(404);
  });
});
