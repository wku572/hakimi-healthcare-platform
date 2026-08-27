import { createApp } from './app.js';
import {
  closePostgresPool,
  createDatabaseReadinessCheck,
  createPostgresPool,
} from './database.js';
import { loadAccessEnvironment } from './env.js';
import { createAppointmentsModule } from './appointments/module.js';
import { createHealthcareFacilitiesModule } from './facilities/module.js';
import { createPatientsModule } from './patients/module.js';
import { createPractitionersModule } from './practitioners/module.js';
import {
  createStructuredLogger,
  OBSERVABILITY_EVENT_CODES,
} from './observability/logger.js';
import {
  createApiShutdownHandler,
  createApiStartupFailureHandler,
  logApiStarted,
} from './observability/api-lifecycle.js';
import { createAccessModule } from './access/module.js';

function main() {
  const env = loadAccessEnvironment();
  const logger = createStructuredLogger({
    service: 'hakimi-api',
    level: env.LOG_LEVEL,
  });
  const pool = createPostgresPool(env.DATABASE_URL);
  pool.on('error', () => {
    logger.error(OBSERVABILITY_EVENT_CODES.databasePoolError);
  });
  const readinessCheck = createDatabaseReadinessCheck(pool, undefined, logger);
  const accessModule = createAccessModule(pool, env, logger);
  const facilitiesModule = createHealthcareFacilitiesModule(
    pool,
    accessModule.routeAuthorizer,
  );
  const practitionersModule = createPractitionersModule(
    pool,
    accessModule.routeAuthorizer,
  );
  const patientsModule = createPatientsModule(
    pool,
    accessModule.routeAuthorizer,
  );
  const appointmentsModule = createAppointmentsModule(
    pool,
    accessModule.routeAuthorizer,
  );
  const app = createApp({
    readinessCheck,
    facilitiesRouter: facilitiesModule.router,
    practitionersRouter: practitionersModule.router,
    patientsRouter: patientsModule.router,
    appointmentsRouter: appointmentsModule.router,
    logger,
    accessAuthenticationMiddleware: accessModule.authenticationMiddleware,
  });

  const server = app.listen(env.PORT, () => {
    logApiStarted(logger, env.PORT);
  });
  const handleStartupFailure = createApiStartupFailureHandler({
    logger,
    closeDatabasePool: () => closePostgresPool(pool),
    finish(exitCode) {
      process.exit(exitCode);
    },
  });
  server.once('error', () => {
    void handleStartupFailure();
  });

  const shutdown = createApiShutdownHandler({
    logger,
    closeHttpServer: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(new Error('HTTP server close failed'));
            return;
          }

          resolve();
        });
      }),
    closeDatabasePool: () => closePostgresPool(pool),
    finish(exitCode) {
      process.exit(exitCode || process.exitCode || 0);
    },
  });

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

try {
  main();
} catch (error) {
  void error;
  const logger = createStructuredLogger({
    service: 'hakimi-api',
    level: 'error',
  });
  logger.error(OBSERVABILITY_EVENT_CODES.apiStartupFailed);
  process.exitCode = 1;
}
