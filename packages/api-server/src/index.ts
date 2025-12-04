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
import { sessionsRouter } from './routes/sessions';
import { ticketsRouter } from './routes/tickets';
import { knowledgeRouter } from './routes/knowledge';
import { trainingRouter } from './routes/training';
import { tunnelRouter } from './routes/tunnel';
import { referencesRouter } from './routes/references';
import { capabilitiesRouter } from './routes/capabilities';
import { getDB } from '@sidstack/shared';
const app: Application = express();
const server = createServer(app);
const PORT = process.env.API_PORT || 19432;

// Middleware - CORS restricted to localhost origins (desktop app only)
const ALLOWED_ORIGINS = [
  'http://localhost:1420',   // Tauri dev webview
  'http://localhost:5173',   // Vite dev server
  'http://localhost:19432',  // API server itself
  'tauri://localhost',       // Tauri production webview
  'https://tauri.localhost', // Tauri production webview (macOS)
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin, curl, MCP server)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
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

// Core Routes (SQLite-based)
app.use('/api/tasks', tasksRouter);
app.use('/api/projects', projectsApiRouter);
app.use('/api/progress', progressRouter);
app.use('/api/context', contextRouter);

app.use('/api/impact', impactRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/knowledge', knowledgeRouter);
app.use('/api/training', trainingRouter);
app.use('/api/tunnel', tunnelRouter);
app.use('/api/references', referencesRouter);
app.use('/api/capabilities', capabilitiesRouter);

// Desktop App Routes
app.use('/api/config', configRouter);
app.use('/api/upload', uploadRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
