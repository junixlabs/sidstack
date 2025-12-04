/**
 * Integration Tests - Sessions CRUD Flow
 *
 * Tests: create (record only) → list → get → update status → delete
 * Note: Uses POST / (record only), not POST /launch (which opens a terminal).
 */
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Isolated temp DB
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidstack-sessions-test-'));
fs.mkdirSync(path.join(tmpDir, '.sidstack'), { recursive: true });
process.env.HOME = tmpDir;

import { app, server } from '../src/index';

afterAll(() => {
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Sessions Integration', () => {
  let sessionId: string;

  // --- Create (record only, no terminal launch) ---

  it('creates a session record', async () => {
    const res = await request(app).post('/api/sessions').send({
      workspacePath: tmpDir,
      terminal: 'iterm',
      launchMode: 'normal',
      initialPrompt: 'Fix the auth bug',
      pid: 12345,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.session).toBeDefined();
    expect(res.body.session.id).toBeDefined();
    expect(res.body.session.terminal).toBe('iterm');
    sessionId = res.body.session.id;
  });

  it('rejects session without required fields', async () => {
    const res = await request(app).post('/api/sessions').send({
      initialPrompt: 'Missing workspacePath and terminal',
    });

    expect(res.status).toBe(400);
  });

  // --- List ---

  it('lists sessions', async () => {
    const res = await request(app).get('/api/sessions');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.sessions).toBeInstanceOf(Array);
    expect(res.body.sessions.length).toBeGreaterThanOrEqual(1);
  });

  it('lists sessions filtered by workspace', async () => {
    const res = await request(app)
      .get('/api/sessions')
      .query({ workspacePath: tmpDir });

    expect(res.status).toBe(200);
    expect(res.body.sessions.length).toBeGreaterThanOrEqual(1);
  });

  // --- Get ---

  it('gets session by ID', async () => {
    const res = await request(app).get(`/api/sessions/${sessionId}`);

    expect(res.status).toBe(200);
    expect(res.body.session.id).toBe(sessionId);
  });

  it('returns 404 for nonexistent session', async () => {
    const res = await request(app).get('/api/sessions/nonexistent');

    expect(res.status).toBe(404);
  });

  // --- Update Status ---

  it('updates session status to completed', async () => {
    const res = await request(app)
      .put(`/api/sessions/${sessionId}`)
      .send({ status: 'completed', endedAt: Date.now() });

    expect(res.status).toBe(200);
    expect(res.body.session.status).toBe('completed');
  });

  // --- Active query after completion ---

  it('active sessions query does not include completed session', async () => {
    const res = await request(app)
      .get('/api/sessions/query/active')
      .query({ workspacePath: tmpDir });

    expect(res.status).toBe(200);
    const ids = res.body.sessions.map((s: { id: string }) => s.id);
    expect(ids).not.toContain(sessionId);
  });

  // --- Delete ---

  it('deletes a session', async () => {
    const res = await request(app).delete(`/api/sessions/${sessionId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('confirms deleted session is gone', async () => {
    const res = await request(app).get(`/api/sessions/${sessionId}`);

    expect(res.status).toBe(404);
  });
});
