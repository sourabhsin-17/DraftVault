import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createApp } from './server/app.ts';
import { getEnvConfig } from './server/config/env.ts';
import { errorHandler } from './server/middleware/errorHandler.ts';
import { cleanupOrphanedFiles } from './server/services/uploadService.ts';
import { pruneExpiredAuthRecords } from './server/services/authService.ts';

async function startServer() {
  const config = getEnvConfig();
  const { app, db } = createApp();

  // Prune abandoned uploads and expired authentication records on startup.
  cleanupOrphanedFiles(db);
  pruneExpiredAuthRecords(db);

  // Repeat cleanup periodically; unref() prevents the timer keeping Node alive.
  const cleanupTimer = setInterval(() => {
    try {
      cleanupOrphanedFiles(db);
      pruneExpiredAuthRecords(db);
    } catch (error) {
      console.error('Scheduled cleanup failed:', error);
    }
  }, 60 * 60 * 1000);
  cleanupTimer.unref();

  if (config.nodeEnv !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.use(async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        const template = fs.readFileSync(indexPath, 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    // Express 4-compatible SPA fallback. API routes are registered before this.
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(distDir, 'index.html'), (error) => {
        if (error) next(error);
      });
    });
  }

  app.use(errorHandler);

  const httpServer = app.listen(config.port, '0.0.0.0', () => {
    console.log(`Autosave Form Management System listening on http://0.0.0.0:${config.port}`);
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received; shutting down gracefully.`);
    clearInterval(cleanupTimer);
    httpServer.close(() => {
      try { db.close(); } catch (error) { console.error('Database close failed:', error); }
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
