import path from 'path';
import express from 'express';
import { createApp } from './server/app.js';
import { loadConfig } from './server/config.js';
import { getPool, closePool } from './server/db/client.js';

async function bootstrap() {
  const config = loadConfig();
  const isProd = config.NODE_ENV === 'production';
  const PORT = config.PORT || 3000;
  const HOST = '0.0.0.0';

  console.log(`[BOOTSTRAP] Initializing DPS Contract System in ${config.NODE_ENV} mode...`);

  // Verify PostgreSQL connection pool
  try {
    const pool = getPool(config.DATABASE_URL);
    const client = await pool.connect();
    const result = await client.query('SELECT current_database(), now() as current_time');
    client.release();
    console.log(`[DB] Connected to PostgreSQL: ${result.rows[0].current_database} at ${result.rows[0].current_time}`);
  } catch (dbErr: any) {
    console.error(`[DB ERROR] Failed to connect to PostgreSQL: ${dbErr.message}`);
    console.error(`[DB ERROR] Ensure PostgreSQL is running on port 5433 / 5432 and DATABASE_URL is configured.`);
    process.exit(1);
  }

  // Create Express application with full middleware stack
  const app = createApp({ config });

  // Serve Frontend: Vite Middleware in Development, Static Dist in Production
  if (isProd) {
    const distPath = path.resolve('dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      // Do not intercept API requests
      if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
        return next();
      }
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('[VITE] Vite development middleware attached successfully');
    } catch (viteErr: any) {
      console.warn(`[VITE WARNING] Could not attach Vite middleware: ${viteErr.message}`);
      const distPath = path.resolve('dist');
      app.use(express.static(distPath));
    }
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`========================================================`);
    console.log(`  DPS CONTRACT MANAGEMENT SYSTEM - READY`);
    console.log(`  Mode: ${config.NODE_ENV}`);
    console.log(`  Address: http://${HOST}:${PORT}`);
    console.log(`========================================================`);
  });

  // Graceful shutdown handling
  const gracefulShutdown = (signal: string) => {
    console.log(`\n[SHUTDOWN] Received ${signal}. Closing HTTP server gracefully...`);
    server.close(async () => {
      console.log('[SHUTDOWN] HTTP server closed.');
      try {
        await closePool();
        console.log('[SHUTDOWN] Database pool closed.');
      } catch (poolErr) {
        console.error('[SHUTDOWN ERROR] Error closing DB pool:', poolErr);
      }
      process.exit(0);
    });

    // Force terminate after 10s if stuck
    setTimeout(() => {
      console.error('[SHUTDOWN TIMEOUT] Forcefully shutting down process.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('[FATAL BOOTSTRAP ERROR]', err);
  process.exit(1);
});
