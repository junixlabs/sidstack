/**
 * Integration Tests - Tasks CRUD Flow
 *
 * Tests: create → list → get → update → list with filters → delete
 */
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Isolated temp DB
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidstack-tasks-test-'));
fs.mkdirSync(path.join(tmpDir, '.sidstack'), { recursive: true });
process.env.HOME = tmpDir;

import { app, server } from '../src/index';

afterAll(() => {
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Tasks Integration', () => {
  const projectId = 'integration-test';
  let task1Id: string;
  let task2Id: string;

  // --- Create ---

  it('creates a feature task', async () => {
    const res = await request(app).post('/api/tasks').send({
      title: '[feature] Add user authentication',
      description: 'Implement login/logout flow',
      projectId,
      priority: 'high',
      taskType: 'feature',
      acceptanceCriteria: [{ description: 'Login form renders correctly' }],
    });

    expect(res.status).toBe(201);
    expect(res.body.task).toBeDefined();
    expect(res.body.task.title).toBe('[feature] Add user authentication');
    expect(res.body.task.priority).toBe('high');
    expect(res.body.task.status).toBe('pending');
    task1Id = res.body.task.id;
  });

  it('creates a bugfix task', async () => {
    const res = await request(app).post('/api/tasks').send({
      title: '[bugfix] Fix timeout on slow connections',
      description: 'Users report timeouts when connection is slow',
      projectId,
      priority: 'medium',
      taskType: 'bugfix',
      acceptanceCriteria: [{ description: 'Connection timeout resolved' }],
    });

    expect(res.status).toBe(201);
    task2Id = res.body.task.id;
  });

  it('rejects feature task without acceptance criteria', async () => {
    const res = await request(app).post('/api/tasks').send({
      title: '[feature] Missing criteria',
      description: 'No acceptance criteria',
      projectId,
      taskType: 'feature',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('acceptance criteria');
  });

  it('rejects task without title', async () => {
    const res = await request(app).post('/api/tasks').send({
      description: 'Missing required title',
      projectId,
    });

    expect(res.status).toBe(400);
  });

  // --- List ---

  it('lists all tasks for project', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.tasks).toBeInstanceOf(Array);
    expect(res.body.tasks.length).toBeGreaterThanOrEqual(2);
  });

  it('lists tasks filtered by status', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .query({ projectId, status: 'pending' });

    expect(res.status).toBe(200);
    expect(res.body.tasks.every((t: { status: string }) => t.status === 'pending')).toBe(true);
  });

  // --- Get ---

  it('gets a task by ID', async () => {
    const res = await request(app).get(`/api/tasks/${task1Id}`);

    expect(res.status).toBe(200);
    expect(res.body.task.id).toBe(task1Id);
    expect(res.body.task.title).toContain('authentication');
  });

  it('returns 404 for nonexistent task', async () => {
    const res = await request(app).get('/api/tasks/nonexistent-id');

    expect(res.status).toBe(404);
  });

  // --- Update ---

  it('updates task status to in_progress', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${task1Id}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('in_progress');
  });

  it('updates task progress', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${task1Id}`)
      .send({ progress: 50 });

    expect(res.status).toBe(200);
    expect(res.body.task.progress).toBe(50);
  });

  it('updates task to completed', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${task1Id}`)
      .send({ status: 'completed', progress: 100 });

    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('completed');
  });

  // --- List with filters after updates ---

  it('filters out completed tasks when querying pending', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .query({ projectId, status: 'pending' });

    expect(res.status).toBe(200);
    const ids = res.body.tasks.map((t: { id: string }) => t.id);
    expect(ids).not.toContain(task1Id);
    expect(ids).toContain(task2Id);
  });

  // Note: Tasks API does not have a DELETE endpoint (tasks are managed via status updates)
});
