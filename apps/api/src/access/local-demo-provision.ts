import { createPostgresPool } from '../database.js';
import { loadEnvironment } from '../env.js';
import {
  createStructuredLogger,
  OBSERVABILITY_EVENT_CODES,
} from '../observability/logger.js';
import { provisionLocalDemoData } from './local-demo-provisioning.js';

async function main() {
  if (process.argv.length > 2) {
    throw new Error('COMMAND_LINE_VALUES_PROHIBITED');
  }

  const environment = loadEnvironment();
  const logger = createStructuredLogger({
    service: 'hakimi-api',
    level: environment.LOG_LEVEL,
  });
  const pool = createPostgresPool(environment.DATABASE_URL);

  try {
    const result = await provisionLocalDemoData(pool, environment);
    logger.info(OBSERVABILITY_EVENT_CODES.accessProvisioningCompleted, {
      affectedCount:
        1 +
        result.facilityIds.length +
        result.practitionerIds.length +
        result.patientIds.length +
        result.appointmentIds.length,
    });
    process.stdout.write(
      JSON.stringify(
        {
          status: 'ok',
          actorId: result.actorId,
          oidcIssuer: result.oidcIssuer,
          oidcSubject: result.oidcSubject,
          role: result.role,
          facilityCount: result.facilityIds.length,
          practitionerCount: result.practitionerIds.length,
          patientCount: result.patientIds.length,
          appointmentCount: result.appointmentIds.length,
        },
        null,
        2,
      ),
    );
    process.stdout.write('\n');
  } catch {
    logger.error(OBSERVABILITY_EVENT_CODES.accessProvisioningFailed, {
      affectedCount: 0,
    });
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {
      process.exitCode = 1;
    });
  }
}

void main();
