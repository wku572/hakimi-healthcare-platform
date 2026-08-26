import { describe, expect, it, vi } from 'vitest';
import {
  createApiShutdownHandler,
  createApiStartupFailureHandler,
  logApiStarted,
} from '../src/observability/api-lifecycle.js';
import type { ObservabilityLogger } from '../src/observability/logger.js';

function createLoggerMock(): ObservabilityLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('API lifecycle observability', () => {
  it('logs listener startup failure once, closes the pool, and always exits 1', async () => {
    const logger = createLoggerMock();
    const closeDatabasePool = vi
      .fn()
      .mockRejectedValue(new Error('postgresql://user:secret@database/hakimi'));
    const finish = vi.fn();
    const handleStartupFailure = createApiStartupFailureHandler({
      logger,
      closeDatabasePool,
      finish,
    });

    await Promise.all([handleStartupFailure(), handleStartupFailure()]);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('API_STARTUP_FAILED');
    expect(closeDatabasePool).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledWith(1);
    expect(JSON.stringify(vi.mocked(logger).error.mock.calls)).not.toContain(
      'secret',
    );
  });

  it('logs startup and a successful graceful shutdown', async () => {
    const logger = createLoggerMock();
    const closeHttpServer = vi.fn().mockResolvedValue(undefined);
    const closeDatabasePool = vi.fn().mockResolvedValue(undefined);
    const finish = vi.fn();
    const shutdown = createApiShutdownHandler({
      logger,
      closeHttpServer,
      closeDatabasePool,
      finish,
    });

    logApiStarted(logger, 3001);
    await shutdown('SIGTERM');
    await shutdown('SIGTERM');

    expect(logger.info).toHaveBeenNthCalledWith(1, 'API_STARTED', {
      port: 3001,
    });
    expect(logger.info).toHaveBeenNthCalledWith(2, 'API_SHUTDOWN_STARTED', {
      signal: 'SIGTERM',
    });
    expect(logger.info).toHaveBeenNthCalledWith(3, 'API_SHUTDOWN_COMPLETED', {
      signal: 'SIGTERM',
    });
    expect(closeHttpServer).toHaveBeenCalledTimes(1);
    expect(closeDatabasePool).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledWith(0);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs opaque shutdown stages without exposing raw failures', async () => {
    const logger = createLoggerMock();
    const closeHttpServer = vi
      .fn()
      .mockRejectedValue(new Error('patient@example.org server failure'));
    const closeDatabasePool = vi
      .fn()
      .mockRejectedValue(new Error('postgresql://user:secret@database/hakimi'));
    const finish = vi.fn();
    const shutdown = createApiShutdownHandler({
      logger,
      closeHttpServer,
      closeDatabasePool,
      finish,
    });

    await shutdown('SIGINT');

    expect(logger.error).toHaveBeenCalledWith('API_SHUTDOWN_FAILED', {
      signal: 'SIGINT',
      failureStage: 'http_server',
    });
    expect(logger.error).toHaveBeenCalledWith('API_SHUTDOWN_FAILED', {
      signal: 'SIGINT',
      failureStage: 'database_pool',
    });
    expect(JSON.stringify(vi.mocked(logger).error.mock.calls)).not.toContain(
      'patient@example.org',
    );
    expect(JSON.stringify(vi.mocked(logger).error.mock.calls)).not.toContain(
      'secret',
    );
    expect(finish).toHaveBeenCalledWith(1);
  });
});
