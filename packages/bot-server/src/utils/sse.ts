import { Response } from 'express';

/**
 * Initialize SSE connection on the response
 */
export function initSSE(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

/**
 * Send a named SSE event with JSON data
 */
export function sendSSE(res: Response, event: string, data: unknown): void {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * End the SSE stream with a done event
 */
export function endSSE(res: Response): void {
  if (res.writableEnded) return;
  sendSSE(res, 'done', {});
  res.end();
}
