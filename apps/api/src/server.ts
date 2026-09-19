import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ZodError } from 'zod';
import { initSchema, getDb } from './db';
import { seedAgents } from './db/seed';
import { apiRouter } from './routes';

dotenv.config();

export const app = express();
const port = process.env.PORT || 4000;

// Standard middleware - CORS configuration supporting Vercel production & preview deployments
const corsOriginEnv = process.env.CORS_ORIGIN;
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (curl, server-to-server, healthchecks)
      if (!origin) return callback(null, true);

      // Explicit custom origins from environment
      if (corsOriginEnv) {
        const allowed = corsOriginEnv.split(',').map((o) => o.trim());
        if (allowed.includes('*') || allowed.includes(origin)) {
          return callback(null, true);
        }
      }

      // Allow all Vercel domains (production & branch previews) and local dev
      if (
        origin.endsWith('.vercel.app') ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('https://localhost:')
      ) {
        return callback(null, true);
      }

      // Permissive fallback to avoid cross-origin demo failure
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
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

// Admin reset endpoint: resets database to pristine demo state (3 agents, 0 actions, 0 docket, 0 audit)
app.post('/admin/reset', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    db.transaction(() => {
      db.prepare('DELETE FROM audit_trail_entries').run();
      db.prepare('DELETE FROM docket_entries').run();
      db.prepare('DELETE FROM action_requests').run();
      db.prepare('DELETE FROM agent_capabilities').run();
      db.prepare('DELETE FROM agents').run();
      seedAgents(db);
    })();
    const agents = (db.prepare('SELECT count(*) as count FROM agents').get() as { count: number })?.count ?? 0;
    const actions = (db.prepare('SELECT count(*) as count FROM action_requests').get() as { count: number })?.count ?? 0;
    return res.json({
      ok: true,
      message: 'Database reset to clean demo state',
      counts: { agents, action_requests: actions, docket_entries: 0, audit_trail_entries: 0 }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
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
