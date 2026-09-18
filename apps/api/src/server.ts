import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ZodError } from 'zod';
import { initSchema } from './db';
import { apiRouter } from './routes';

dotenv.config();

export const app = express();
const port = process.env.PORT || 4000;

// Standard middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  const start = Date.now();
  next();
  // Simple non-blocking log
  console.log(`[API] ${req.method} ${req.url} - ${Date.now() - start}ms`);
});

// Additive health check (independent, outside frozen Step 5 contract)
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount Step 5 API routes
app.use(apiRouter);

// Centralized error handling
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Validation failed',
      details: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  console.error('[Server Error]', err);
  return res.status(500).json({
    error: 'Internal Server Error',
    message: err instanceof Error ? err.message : 'Unknown error',
  });
});

import http from 'http';

// Start server and apply database schema idempotently
export function startServer(overridePort?: number): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    try {
      initSchema();
    } catch (err) {
      console.error('[Verdict DB] Fatal error initializing schema:', err);
      reject(err);
      return;
    }

    const p = overridePort || port;
    const serverInstance = app.listen(p, () => {
      console.log(`[Verdict API] Server listening on port ${p}`);
      resolve(serverInstance);
    });
    serverInstance.on('error', (err) => {
      reject(err);
    });
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('[Verdict API] Failed to start server:', err);
    process.exit(1);
  });
}
