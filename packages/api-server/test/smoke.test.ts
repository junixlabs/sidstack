/**
 * API Server Smoke Tests
 *
 * Verifies that all route groups are mounted and respond correctly.
 * Uses the real Express app but with an isolated temp database.
 */

import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Set up temp directory BEFORE importing app (which triggers getDB on first request)
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidstack-test-'));
const sidstackDir = path.join(tmpDir, '.sidstack');
fs.mkdirSync(sidstackDir, { recursive: true });

// Point the DB to our temp directory (API_PORT=0 is set in vitest.config.ts)
process.env.HOME = tmpDir;

// Import app after env setup
import { app, server } from '../src/index';

afterAll(() => {
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================================
// Health Check
// ============================================================================

describe('Health Check', () => {
  it('GET /health should return 200 with status ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

// ============================================================================
// Route Mounting - Verify all route groups are accessible (not 404)
// ============================================================================

describe('Route Mounting', () => {
  it('GET /api/tasks should return tasks array', async () => {
    const res = await request(app).get('/api/tasks');

    expect(res.status).toBe(200);
    expect(res.body.tasks).toBeDefined();
    expect(Array.isArray(res.body.tasks)).toBe(true);
  });

  it('GET /api/projects should return projects array', async () => {
    const res = await request(app).get('/api/projects');

    expect(res.status).toBe(200);
    expect(res.body.projects).toBeDefined();
  });

  it('GET /api/progress/sessions should respond', async () => {
    const res = await request(app).get('/api/progress/sessions').query({ workspacePath: tmpDir });

    expect(res.status).toBe(200);
  });

  it('GET /api/context/task/:taskId should handle missing task', async () => {
    const res = await request(app).get('/api/context/task/nonexistent');

    // 404 or 200 with empty context - either is valid
    expect([200, 404]).toContain(res.status);
  });

  it('GET /api/sessions should return sessions', async () => {
    const res = await request(app).get('/api/sessions');

    expect(res.status).toBe(200);
  });

  it('GET /api/tickets should return tickets', async () => {
    const res = await request(app).get('/api/tickets');

    expect(res.status).toBe(200);
    expect(res.body.tickets).toBeDefined();
  });

  it('GET /api/knowledge should handle missing projectPath', async () => {
    const res = await request(app).get('/api/knowledge');

    // 400 for missing param or 200 with empty results
    expect([200, 400]).toContain(res.status);
  });

  it('GET /api/training/sessions should return sessions', async () => {
    const res = await request(app).get('/api/training/sessions');

    expect(res.status).toBe(200);
  });

  it('GET /api/tunnel/status should return tunnel status', async () => {
    const res = await request(app).get('/api/tunnel/status');

    expect(res.status).toBe(200);
    expect(res.body.success).toBeDefined();
  });

  it('GET /api/config/agents should respond (not 404)', async () => {
    const res = await request(app).get('/api/config/agents');

    // Route is mounted (not 404). May 500 without project context.
    expect(res.status).not.toBe(404);
  });
});

// ============================================================================
// CRUD Operations - Basic create/read/delete flow
// ============================================================================

describe('Tasks CRUD', () => {
  let taskId: string;

  it('POST /api/tasks should create a task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({
        title: 'Smoke check task',
        description: 'Created by smoke test',
        projectId: 'smoke-test',
        priority: 'low',
        taskType: 'spike',
      });

    expect(res.status).toBe(201);
    expect(res.body.task).toBeDefined();
    expect(res.body.task.id).toBeDefined();
    taskId = res.body.task.id;
  });

  it('GET /api/tasks/:id should return the task', async () => {
    expect(taskId).toBeDefined();
    const res = await request(app).get(`/api/tasks/${taskId}`);

    expect(res.status).toBe(200);
    expect(res.body.task.id).toBe(taskId);
  });

  it('PATCH /api/tasks/:id should update the task', async () => {
    expect(taskId).toBeDefined();
    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('in_progress');
  });

  it('GET /api/tasks/:id should return 404 for nonexistent task', async () => {
    const res = await request(app).get('/api/tasks/nonexistent-id');

    expect(res.status).toBe(404);
  });
});

describe('Tickets CRUD', () => {
  let ticketId: string;

  it('POST /api/tickets should create a ticket', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .send({
        projectId: 'smoke-test',
        title: 'Smoke test ticket',
        description: 'Created by smoke test',
        type: 'bug',
        priority: 'low',
      });

    expect(res.status).toBe(201);
    expect(res.body.ticket).toBeDefined();
    ticketId = res.body.ticket.id;
  });

  it('GET /api/tickets/:id should return the ticket', async () => {
    expect(ticketId).toBeDefined();
    const res = await request(app).get(`/api/tickets/${ticketId}`);

    expect(res.status).toBe(200);
    expect(res.body.ticket.id).toBe(ticketId);
  });

  it('PATCH /api/tickets/:id should update the ticket', async () => {
    expect(ticketId).toBeDefined();
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .send({ status: 'reviewing' });

    expect(res.status).toBe(200);
  });

  it('DELETE /api/tickets/:id should delete the ticket', async () => {
    expect(ticketId).toBeDefined();
    const res = await request(app).delete(`/api/tickets/${ticketId}`);

    expect(res.status).toBe(200);
  });

  it('POST /api/tickets should reject missing required fields', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .send({ description: 'No title or projectId' });

    expect(res.status).toBe(400);
  });
});

// ============================================================================
// Training Room
// ============================================================================

describe('Training Room', () => {
  let sessionId: string;

  it('POST /api/training/sessions/:moduleId should create a session', async () => {
    const res = await request(app)
      .post('/api/training/sessions/test-module')
      .send({ projectPath: tmpDir });

    expect(res.status).toBe(200);
    expect(res.body.session).toBeDefined();
    sessionId = res.body.session.id;
  });

  it('POST /api/training/incidents should create an incident', async () => {
    expect(sessionId).toBeDefined();
    const res = await request(app)
      .post('/api/training/incidents')
      .send({
        sessionId,
        title: 'Test incident',
        description: 'Smoke test incident',
        type: 'mistake',
        severity: 'low',
      });

    expect(res.status).toBe(201);
    expect(res.body.incident).toBeDefined();
  });

  it('GET /api/training/incidents should list incidents', async () => {
    const res = await request(app).get('/api/training/incidents');

    expect(res.status).toBe(200);
    expect(res.body.incidents).toBeDefined();
  });
});

// ============================================================================
// Error Handling
// ============================================================================

describe('Error Handling', () => {
  it('should return 404 for unregistered routes', async () => {
    const res = await request(app).get('/api/nonexistent');

    expect(res.status).toBe(404);
  });

  it('POST /api/tasks with no title should return 400', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ description: 'No title provided' });

    expect(res.status).toBe(400);
  });
});
