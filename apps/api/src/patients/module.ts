import type { Pool } from 'pg';
import { createPatientRepository } from './repository.js';
import { createPatientsRouter } from './router.js';
import { createPatientService } from './service.js';

export function createPatientsModule(db: Pick<Pool, 'query' | 'connect'>) {
  const repository = createPatientRepository(db);
  const service = createPatientService(repository);
  const router = createPatientsRouter(service);

  return {
    repository,
    service,
    router,
  };
}
