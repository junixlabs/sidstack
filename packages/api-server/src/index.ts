import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import configRouter from './routes/config';
import { uploadRouter } from './routes/upload';
import { tasksRouter } from './routes/tasks';
import { projectsApiRouter } from './routes/projects-api';
import { progressRouter } from './routes/progress';
import { contextRouter } from './routes/context';

import { impactRouter } from './routes/impact';
import { ticketsRouter } from './routes/tickets';
import { knowledgeRouter } from './routes/knowledge';
import { trainingRouter } from './routes/training';
import { tunnelRouter } from './routes/tunnel';
import { referencesRouter } from './routes/references';
import { traceabilityRouter } from './routes/traceability';
import { eventsRouter } from './events';
import { getDB } from '@sidstack/shared';
const app: Application = express();
const server = createServer(app);
const PORT = process.env.API_PORT || 19432;

// =============================================================================
// CORS Configuration — supports extra origins via SIDSTACK_CORS_ORIGINS env
// =============================================================================
const ALLOWED_ORIGINS = [
  'http://localhost:1420',   // Tauri dev webview
  'http://localhost:5173',   // Vite dev server
  'http://localhost:19432',  // API server itself
  'tauri://localhost',       // Tauri production webview
  'https://tauri.localhost', // Tauri production webview (macOS)
];

// Add extra origins from env (comma-separated)
if (process.env.SIDSTACK_CORS_ORIGINS) {
  ALLOWED_ORIGINS.push(
    ...process.env.SIDSTACK_CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  );
}

// VS Code WebView origins use dynamic scheme: vscode-webview://
const ALLOWED_ORIGIN_PATTERNS = [
  /^vscode-webview:\/\//,
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin, curl, MCP server, VS Code extension host)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else if (ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
}));

// Security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json());

// =============================================================================
// Auth Middleware — optional Bearer token validation
// Skip if SIDSTACK_API_KEY is not set (backward compatible for local dev)
// =============================================================================
const API_KEY = process.env.SIDSTACK_API_KEY;

if (API_KEY) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Health check is always public
    if (req.path === '/health') {
      return next();
    }

    // SSE endpoint exempt — EventSource browser API cannot send custom headers
    if (req.path === '/api/events/stream') {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.slice(7);
    if (token !== API_KEY) {
      return res.status(403).json({ error: 'Invalid API key' });
    }

    next();
  });
  console.log('[API] Auth enabled — SIDSTACK_API_KEY is set');
}

// =============================================================================
// Rate Limiting — simple in-memory tracker (no external deps)
// =============================================================================

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_WRITES = 100; // POST/PUT/PATCH/DELETE per window
const RATE_LIMIT_MAX_READS = 600;  // GET per window

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function getRateLimitKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

app.use((req: Request, res: Response, next: NextFunction) => {
  // Skip rate limiting for health check and SSE
  if (req.path === '/health' || req.path === '/api/events/stream') {
    return next();
  }

  const isWrite = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS';
  const limit = isWrite ? RATE_LIMIT_MAX_WRITES : RATE_LIMIT_MAX_READS;
  const key = `${getRateLimitKey(req)}:${isWrite ? 'w' : 'r'}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitStore.set(key, entry);
  }

  entry.count++;

  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - entry.count)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter,
    });
  }

  next();
});

// Periodically clean up expired rate limit entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now >= entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

// Health check (before auth-protected routes so it's always accessible)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Core Routes (SQLite-based)
app.use('/api/tasks', tasksRouter);
app.use('/api/projects', projectsApiRouter);
app.use('/api/progress', progressRouter);
app.use('/api/context', contextRouter);

app.use('/api/impact', impactRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/knowledge', knowledgeRouter);
app.use('/api/training', trainingRouter);
app.use('/api/tunnel', tunnelRouter);
app.use('/api/references', referencesRouter);
app.use('/api/traceability', traceabilityRouter);
app.use('/api/events', eventsRouter);

// Desktop App Routes
app.use('/api/config', configRouter);
app.use('/api/upload', uploadRouter);

// Global error handler - must be after all routes
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(`[API Error] ${err.message}`, err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
server.listen(PORT, async () => {
  console.log(`API Server running on http://localhost:${PORT}`);
  const db = await getDB();
  console.log(`Database: ${db.getDbPath()}`);
});

export { app, server };
