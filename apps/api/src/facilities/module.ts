import type { Pool } from 'pg';
import { createHealthcareFacilityRepository } from './repository.js';
import { createFacilitiesRouter } from './router.js';
import { createHealthcareFacilityService } from './service.js';

export function createHealthcareFacilitiesModule(db: Pick<Pool, 'query'>) {
  const repository = createHealthcareFacilityRepository(db);
  const service = createHealthcareFacilityService(repository);
  const router = createFacilitiesRouter(service);

  return {
    repository,
    service,
    router,
  };
}
