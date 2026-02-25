import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      geminiApiKey?: string;
    }
  }
}

/**
 * Extract GEMINI_API_KEY from env. Reject if missing.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'GEMINI_API_KEY not configured' } });
    return;
  }
  req.geminiApiKey = apiKey;
  next();
}
