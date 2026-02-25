/**
 * Client for SidStack API task/ticket endpoints on :19432.
 */

const SIDSTACK_API_URL = process.env.SIDSTACK_API_URL || 'http://localhost:19432';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  taskType?: string;
  description?: string;
}

interface Ticket {
  id: string;
  title: string;
  status: string;
  priority: string;
  type?: string;
  description?: string;
}

export async function listTasks(
  projectId: string,
  filter?: string,
): Promise<{ tasks: Task[]; total: number }> {
  const params = new URLSearchParams({ projectId });
  if (filter) params.set('search', filter);

  const res = await fetch(`${SIDSTACK_API_URL}/api/tasks?${params}`);
  if (!res.ok) throw new Error(`listTasks failed: ${res.status}`);
  return res.json() as Promise<{ tasks: Task[]; total: number }>;
}

export async function listTickets(
  projectId: string,
  filter?: string,
): Promise<{ tickets: Ticket[]; total: number }> {
  const params = new URLSearchParams({ projectId });
  if (filter) params.set('search', filter);

  const res = await fetch(`${SIDSTACK_API_URL}/api/tickets?${params}`);
  if (!res.ok) throw new Error(`listTickets failed: ${res.status}`);
  return res.json() as Promise<{ tickets: Ticket[]; total: number }>;
}

export async function createTask(
  projectId: string,
  title: string,
  description?: string,
): Promise<Task> {
  const res = await fetch(`${SIDSTACK_API_URL}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, title, description }),
  });
  if (!res.ok) throw new Error(`createTask failed: ${res.status}`);
  return res.json() as Promise<Task>;
}
