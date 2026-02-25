import 'dotenv/config';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { chatRouter } from './routes/chat';
import { deleteConversation } from './services/conversation';

const app: Application = express();
const PORT = process.env.PORT || 3222;
const DEFAULT_MODEL = 'gemini-2.5-flash';

// CORS
const ALLOWED_ORIGINS = [
  'http://localhost:1420',
  'http://localhost:5173',
  'http://localhost:3222',
  'tauri://localhost',
  'https://tauri.localhost',
];

app.use(cors({
  origin: (origin, callback) => {
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

// Routes
app.use('/api/chat', chatRouter);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: '0.1.0',
    geminiModel: DEFAULT_MODEL,
  });
});

// Models
app.get('/models', (_req: Request, res: Response) => {
  res.json({
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', default: true },
    ],
  });
});

// Delete conversation
app.delete('/api/conversations/:id', (req: Request, res: Response) => {
  deleteConversation(req.params.id);
  res.json({ ok: true });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(`[BotServer Error] ${err.message}`, err.stack);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' },
  });
});

app.listen(PORT, () => {
  console.log(`Bot Server running on http://localhost:${PORT}`);
  console.log(`Gemini model: ${DEFAULT_MODEL}`);
});

export { app };
