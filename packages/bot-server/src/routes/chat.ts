/**
 * Chat routes: POST /api/chat, POST /api/chat/cancel
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { authMiddleware } from '../middleware/auth';
import { initSSE, sendSSE, endSSE } from '../utils/sse';
import { routeIntent, cancelIntent } from '../services/intent-router';

export const chatRouter: Router = Router();

chatRouter.use(authMiddleware);

/**
 * POST / — Send a message, receive SSE stream
 */
chatRouter.post('/', async (req: Request, res: Response) => {
  const { message, conversationId: convId, context, model } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'message is required' },
    });
    return;
  }

  const conversationId = convId || `conv_${randomUUID()}`;
  const messageId = `msg_${randomUUID()}`;
  const apiKey = req.geminiApiKey!;

  initSSE(res);

  // Handle client disconnect — use res.on('close') not req.on('close')
  // req 'close' fires when POST body is consumed, not when connection drops
  let aborted = false;
  res.on('close', () => {
    if (!res.writableFinished) {
      aborted = true;
      cancelIntent(conversationId);
    }
  });

  try {
    sendSSE(res, 'message_start', { conversationId, messageId, route: 'pending' });

    const result = await routeIntent(
      apiKey,
      conversationId,
      message,
      context || {},
      model,
      res,
    );

    if (!aborted) {
      sendSSE(res, 'message_end', {
        messageId,
        route: result.route,
        tokenCount: result.tokenCount,
        usage: result.usage,
      });
      endSSE(res);
    }
  } catch (err) {
    if (!aborted) {
      const message = err instanceof Error ? err.message : 'Internal error';
      const isRateLimit = message.includes('429') || message.toLowerCase().includes('rate');

      if (isRateLimit) {
        sendSSE(res, 'error', { code: 'RATE_LIMITED', message });
      } else {
        sendSSE(res, 'error', { code: 'INTERNAL_ERROR', message });
      }
      endSSE(res);
    }
  }
});

/**
 * POST /cancel — Cancel active stream for a conversation
 */
chatRouter.post('/cancel', (req: Request, res: Response) => {
  const { conversationId } = req.body;
  if (!conversationId) {
    res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'conversationId is required' },
    });
    return;
  }

  const cancelled = cancelIntent(conversationId);
  res.json({ ok: true, cancelled });
});
