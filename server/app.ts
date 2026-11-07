import express, { type Express, type Router } from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { configureSecurityHeaders, noCacheForApi } from './http/security.js';
import { requestLogger } from './http/logger.js';
import { errorHandler, notFoundHandler } from './http/errors.js';
import { type AppConfig, loadConfig } from './config.js';
import { getPool } from './db/client.js';
import { authRouter } from './modules/auth/routes.js';
import { requireAuth } from './modules/auth/middleware.js';
import { contractsRouter } from './modules/contracts/routes.js';
import { payrollRouter } from './modules/payroll/routes.js';
import { reportsRouter } from './modules/reports/routes.js';
import { settingsRouter } from './modules/settings/routes.js';
import { integrationsRouter } from './modules/integrations/routes.js';

export interface AppFactoryOptions {
  config?: AppConfig;
  isTest?: boolean;
  apiRouter?: Router;
  readyCheck?: () => Promise<{ ready: boolean; details?: Record<string, unknown> }>;
}

export function createApp(options: AppFactoryOptions = {}): Express {
  const appConfig = options.config || loadConfig();
  const app = express();

  // Trust proxy configuration
  app.set('trust proxy', appConfig.TRUSTED_PROXY);

  // Security and observation middlewares
  app.use(configureSecurityHeaders());
  app.use(requestLogger);
  app.use(noCacheForApi);

  // Request body parsing with strict 1MB limit
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Session configuration with connect-pg-simple
  const PgSession = connectPgSimple(session);
  const sessionStore = new PgSession({
    pool: getPool(appConfig.DATABASE_URL),
    tableName: 'sessions',
    createTableIfMissing: false,
  });

  app.use(
    session({
      store: sessionStore,
      secret: appConfig.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      name: 'connect.sid',
      cookie: {
        secure: appConfig.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000,
      },
    })
  );

  // Health checks
  app.get('/health/live', (req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health/ready', async (req, res) => {
    if (options.readyCheck) {
      try {
        const { ready, details } = await options.readyCheck();
        if (ready) {
          return res.status(200).json({ status: 'ready', ...details });
        }
        return res.status(503).json({ status: 'not_ready', ...details });
      } catch (err: unknown) {
        return res.status(503).json({
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Default readiness check in early development phase
    res.status(200).json({
      status: 'ready',
      env: appConfig.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  });

  // Mount modules
  app.use('/api/auth', authRouter);
  app.use('/api/contracts', requireAuth, contractsRouter);
  app.use('/api/payroll', payrollRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/dashboard/reports', reportsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/sim', integrationsRouter);

  // Mount API router if provided
  if (options.apiRouter) {
    app.use('/api', options.apiRouter);
  }

  // Not found handler for /api routes
  app.use('/api', notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
}
