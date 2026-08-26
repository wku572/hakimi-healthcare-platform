import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { createDatabaseReadinessCheck } from '../src/database.js';
import type { ObservabilityLogger } from '../src/observability/logger.js';

function createLoggerMock(): ObservabilityLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('database readiness observability', () => {
  it('logs an opaque connectivity success without changing readiness', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] });
    const pool = { query } as unknown as Pool;
    const logger = createLoggerMock();
    const checkReadiness = createDatabaseReadinessCheck(pool, 1_000, logger);

    await expect(checkReadiness()).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith({
      text: 'SELECT 1',
      query_timeout: 1_000,
    });
    expect(logger.info).toHaveBeenCalledWith('POSTGRES_CONNECTIVITY_SUCCEEDED');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs an opaque connectivity failure without exposing database details', async () => {
    const query = vi
      .fn()
      .mockRejectedValue(
        new Error('postgresql://user:secret@database/hakimi SELECT 1'),
      );
    const pool = { query } as unknown as Pool;
    const logger = createLoggerMock();
    const checkReadiness = createDatabaseReadinessCheck(pool, 1_000, logger);

    await expect(checkReadiness()).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith('POSTGRES_CONNECTIVITY_FAILED');
    expect(logger.info).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(logger).error.mock.calls)).not.toContain(
      'secret',
    );
    expect(JSON.stringify(vi.mocked(logger).error.mock.calls)).not.toContain(
      'SELECT 1',
    );
  });
});
