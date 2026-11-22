import cookieParser from 'cookie-parser';
import express from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { getDb } from './db/connection.ts';
import { runMigrations } from './db/migrations.ts';
import { attachSession } from './middleware/auth.ts';
import { csrfProtection } from './middleware/csrf.ts';
import { AppError, errorHandler, sendSuccess } from './middleware/errorHandler.ts';
import { createAdminRouter } from './routes/adminRoutes.ts';
import { createAuthRouter } from './routes/authRoutes.ts';
import { createDraftRouter } from './routes/draftRoutes.ts';
import { createFormRouter } from './routes/formRoutes.ts';
import { createUploadRouter } from './routes/uploadRoutes.ts';
import { ensureUploadDir } from './services/uploadService.ts';

export interface CreateAppOptions {
  db?: DatabaseSync;
  disableRateLimit?: boolean;
}

export function createApp(options: CreateAppOptions = {}) {
  const db = options.db ?? getDb();
  runMigrations(db);
  ensureUploadDir();

  const app = express();
  app.set('trust proxy', 1);

  // Basic security headers (compatible with iframe preview)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());

  // Attach database + session context to every request
  app.use((req, _res, next) => {
    req.db = db;
    next();
  });

  app.use(attachSession);
  app.use('/api', csrfProtection);

  app.get('/api/health', (_req, res) => {
    sendSuccess(res, { ok: true, timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', createAuthRouter({ disableRateLimit: options.disableRateLimit }));
  app.use('/api/drafts', createDraftRouter());
  app.use('/api/forms', createFormRouter());
  app.use('/api/uploads', createUploadRouter());
  app.use('/api/admin', createAdminRouter());

  // Catch unknown /api routes with clean JSON 404
  app.use('/api', (_req, _res, next) => {
    next(new AppError(404, 'NOT_FOUND', 'API endpoint not found.'));
  });

  app.use(errorHandler);

  return { app, db };
}
