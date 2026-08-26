import { Pool } from 'pg';
import {
  noopObservabilityLogger,
  OBSERVABILITY_EVENT_CODES,
  type ObservabilityLogger,
} from './observability/logger.js';

const HEALTH_QUERY_TIMEOUT_MS = 2_500;

export function createPostgresPool(databaseUrl: string) {
  return new Pool({
    connectionString: databaseUrl,
    allowExitOnIdle: true,
    connectionTimeoutMillis: HEALTH_QUERY_TIMEOUT_MS,
    idleTimeoutMillis: 10_000,
    max: 2,
    options: `-c statement_timeout=${HEALTH_QUERY_TIMEOUT_MS}`,
  });
}

export function createDatabaseReadinessCheck(
  pool: Pool,
  timeoutMs = HEALTH_QUERY_TIMEOUT_MS,
  logger: ObservabilityLogger = noopObservabilityLogger,
) {
  return async function checkDatabaseReadiness(): Promise<boolean> {
    try {
      const query = pool.query.bind(pool) as (config: {
        text: string;
        query_timeout: number;
      }) => Promise<unknown>;

      await query({
        text: 'SELECT 1',
        query_timeout: timeoutMs,
      });
      logger.info(OBSERVABILITY_EVENT_CODES.postgresConnectivitySucceeded);
      return true;
    } catch {
      logger.error(OBSERVABILITY_EVENT_CODES.postgresConnectivityFailed);
      return false;
    }
  };
}

export async function closePostgresPool(pool: Pool) {
  await pool.end();
}
