import {
  OBSERVABILITY_EVENT_CODES,
  type ObservabilityLogger,
} from './logger.js';

type ShutdownSignal = 'SIGINT' | 'SIGTERM';

type ApiShutdownDependencies = {
  logger: ObservabilityLogger;
  closeHttpServer: () => Promise<void>;
  closeDatabasePool: () => Promise<void>;
  finish: (exitCode: number) => void;
};

type ApiStartupFailureDependencies = {
  logger: ObservabilityLogger;
  closeDatabasePool: () => Promise<void>;
  finish: (exitCode: number) => void;
};

export function logApiStarted(logger: ObservabilityLogger, port: number): void {
  logger.info(OBSERVABILITY_EVENT_CODES.apiStarted, { port });
}

export function createApiStartupFailureHandler({
  logger,
  closeDatabasePool,
  finish,
}: ApiStartupFailureDependencies) {
  let handlingFailure: Promise<void> | undefined;

  return function handleStartupFailure(): Promise<void> {
    handlingFailure ??= (async () => {
      logger.error(OBSERVABILITY_EVENT_CODES.apiStartupFailed);

      try {
        await closeDatabasePool();
      } catch {
        // The startup event is intentionally the only emitted diagnostic.
      } finally {
        finish(1);
      }
    })();

    return handlingFailure;
  };
}

export function createApiShutdownHandler({
  logger,
  closeHttpServer,
  closeDatabasePool,
  finish,
}: ApiShutdownDependencies) {
  let shuttingDown = false;

  return async function shutdown(signal: ShutdownSignal): Promise<void> {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info(OBSERVABILITY_EVENT_CODES.apiShutdownStarted, { signal });
    let failed = false;

    try {
      await closeHttpServer();
    } catch {
      failed = true;
      logger.error(OBSERVABILITY_EVENT_CODES.apiShutdownFailed, {
        signal,
        failureStage: 'http_server',
      });
    }

    try {
      await closeDatabasePool();
    } catch {
      failed = true;
      logger.error(OBSERVABILITY_EVENT_CODES.apiShutdownFailed, {
        signal,
        failureStage: 'database_pool',
      });
    }

    if (!failed) {
      logger.info(OBSERVABILITY_EVENT_CODES.apiShutdownCompleted, { signal });
    }

    finish(failed ? 1 : 0);
  };
}
