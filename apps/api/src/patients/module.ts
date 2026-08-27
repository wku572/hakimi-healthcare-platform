import type { Pool } from 'pg';
import { createPatientRepository } from './repository.js';
import { createPatientsRouter } from './router.js';
import { createPatientService } from './service.js';
import {
  denyRouteAuthorizer,
  type RouteAuthorizer,
} from '../access/service.js';

export function createPatientsModule(
  db: Pick<Pool, 'query' | 'connect'>,
  authorizer: RouteAuthorizer = denyRouteAuthorizer,
) {
  const repository = createPatientRepository(db);
  const service = createPatientService(repository);
  const router = createPatientsRouter(service, authorizer);

  return {
    repository,
    service,
    router,
  };
}
