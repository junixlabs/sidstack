/**
 * Integration Tests - Tickets CRUD Flow
 *
 * Tests: create → list → get → update (review/approve) → convert to task
 */
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Isolated temp DB
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidstack-tickets-test-'));
fs.mkdirSync(path.join(tmpDir, '.sidstack'), { recursive: true });
process.env.HOME = tmpDir;

import { app, server } from '../src/index';

afterAll(() => {
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Tickets Integration', () => {
  const projectId = 'ticket-test';
  let ticketId: string;
  let ticket2Id: string;

  // --- Create ---

  it('creates a bug ticket', async () => {
    const res = await request(app).post('/api/tickets').send({
      projectId,
      title: 'Login button broken on Safari',
      description: 'Users on Safari cannot click the login button',
      type: 'bug',
      priority: 'high',
      source: 'manual',
      labels: ['safari', 'login', 'critical'],
    });

    expect(res.status).toBe(201);
    expect(res.body.ticket).toBeDefined();
    expect(res.body.ticket.status).toBe('new');
    expect(res.body.ticket.type).toBe('bug');
    ticketId = res.body.ticket.id;
  });

  it('creates a feature ticket with externalId', async () => {
    const res = await request(app).post('/api/tickets').send({
      projectId,
      title: 'Add dark mode toggle',
      description: 'Users want a dark mode option',
      type: 'feature',
      priority: 'medium',
      externalId: 'GH-456',
      source: 'github',
    });

    expect(res.status).toBe(201);
    expect(res.body.ticket.externalId).toBe('GH-456');
    ticket2Id = res.body.ticket.id;
  });

  it('rejects ticket with duplicate externalId', async () => {
    const res = await request(app).post('/api/tickets').send({
      projectId,
      title: 'Duplicate ticket',
      externalId: 'GH-456',
      source: 'github',
    });

    expect(res.status).toBe(409);
  });

  it('rejects ticket without required fields', async () => {
    const res = await request(app).post('/api/tickets').send({
      description: 'Missing title and projectId',
    });

    expect(res.status).toBe(400);
  });

  // --- List ---

  it('lists all tickets for project', async () => {
    const res = await request(app)
      .get('/api/tickets')
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.tickets).toBeInstanceOf(Array);
    expect(res.body.tickets.length).toBe(2);
  });

  // --- Get ---

  it('gets a ticket by ID', async () => {
    const res = await request(app).get(`/api/tickets/${ticketId}`);

    expect(res.status).toBe(200);
    expect(res.body.ticket.id).toBe(ticketId);
    expect(res.body.ticket.title).toContain('Safari');
  });

  it('returns 404 for nonexistent ticket', async () => {
    const res = await request(app).get('/api/tickets/nonexistent');

    expect(res.status).toBe(404);
  });

  // --- Update: Review → Approve flow ---

  it('moves ticket to reviewing', async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .send({ status: 'reviewing' });

    expect(res.status).toBe(200);
  });

  it('approves the ticket', async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
  });

  // --- Convert to Task ---

  it('converts approved ticket to task', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/convert-to-task`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.task).toBeDefined();
    expect(res.body.task.title).toContain('Login button broken');
  });

  it('rejects re-conversion of already converted ticket', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/convert-to-task`);

    expect(res.status).toBe(409);
  });

  // --- Full Flow: Ticket → Task → Complete → Ticket auto-completed ---

  it('completes task and auto-completes linked ticket', async () => {
    // The ticketId was converted to a task above. Get the task ID.
    const ticketRes = await request(app).get(`/api/tickets/${ticketId}`);
    expect(ticketRes.status).toBe(200);
    const taskId = ticketRes.body.ticket.taskId;
    expect(taskId).toBeDefined();

    // Move task to in_progress
    const progressRes = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .send({ status: 'in_progress', progress: 50 });
    expect(progressRes.status).toBe(200);

    // Complete the task (force since governance may block in test env)
    const completeRes = await request(app)
      .post(`/api/tasks/${taskId}/complete`)
      .send({ force: true, reason: 'E2E test completion' });
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.task.status).toBe('completed');
    expect(completeRes.body.linkedTicketCompleted).toBe(ticketId);

    // Verify ticket was auto-completed
    const verifyRes = await request(app).get(`/api/tickets/${ticketId}`);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.ticket.status).toBe('completed');
  });

  // --- Delete ---

  it('deletes a ticket', async () => {
    const res = await request(app).delete(`/api/tickets/${ticket2Id}`);

    expect(res.status).toBe(200);
  });

  it('confirms deleted ticket is gone', async () => {
    const res = await request(app).get(`/api/tickets/${ticket2Id}`);

    expect(res.status).toBe(404);
  });
});
