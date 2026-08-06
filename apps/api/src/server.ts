import { createApp } from './app.js';
import {
  closePostgresPool,
  createDatabaseReadinessCheck,
  createPostgresPool,
} from './database.js';
import { loadEnvironment } from './env.js';
import { createAppointmentsModule } from './appointments/module.js';
import { createHealthcareFacilitiesModule } from './facilities/module.js';
import { createPatientsModule } from './patients/module.js';
import { createPractitionersModule } from './practitioners/module.js';

const env = loadEnvironment();
const pool = createPostgresPool(env.DATABASE_URL);
pool.on('error', () => {
  console.error('PostgreSQL connection error detected.');
});
const readinessCheck = createDatabaseReadinessCheck(pool);
const facilitiesModule = createHealthcareFacilitiesModule(pool);
const practitionersModule = createPractitionersModule(pool);
const patientsModule = createPatientsModule(pool);
const appointmentsModule = createAppointmentsModule(pool);
const app = createApp({
  readinessCheck,
  facilitiesRouter: facilitiesModule.router,
  practitionersRouter: practitionersModule.router,
  patientsRouter: patientsModule.router,
  appointmentsRouter: appointmentsModule.router,
});

const server = app.listen(env.PORT, () => {
  console.log(`Hakimi API listening on http://localhost:${env.PORT}`);
});

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  server.close(async (error) => {
    if (error) {
      console.error(
        `Error while closing API server after ${signal}:`,
        error.message,
      );
    }

    try {
      await closePostgresPool(pool);
    } catch {
      console.error(`Failed to close PostgreSQL pool after ${signal}.`);
      process.exitCode = 1;
      return;
    }

    process.exit(process.exitCode ?? 0);
  });
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});
