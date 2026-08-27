import type { Pool } from 'pg';
import { createHealthcareFacilityRepository } from './repository.js';
import { createFacilitiesRouter } from './router.js';
import { createHealthcareFacilityService } from './service.js';
import {
  denyRouteAuthorizer,
  type RouteAuthorizer,
} from '../access/service.js';

export function createHealthcareFacilitiesModule(
  db: Pick<Pool, 'query'>,
  authorizer: RouteAuthorizer = denyRouteAuthorizer,
) {
  const repository = createHealthcareFacilityRepository(db);
  const service = createHealthcareFacilityService(repository);
  const router = createFacilitiesRouter(service, authorizer);

  return {
    repository,
    service,
    router,
  };
}
