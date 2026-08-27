import type { Pool } from 'pg';
import { createPractitionerRepository } from './repository.js';
import { createPractitionersRouter } from './router.js';
import { createPractitionerService } from './service.js';
import {
  denyRouteAuthorizer,
  type RouteAuthorizer,
} from '../access/service.js';

export function createPractitionersModule(
  db: Pick<Pool, 'query' | 'connect'>,
  authorizer: RouteAuthorizer = denyRouteAuthorizer,
) {
  const repository = createPractitionerRepository(db);
  const service = createPractitionerService(repository);
  const router = createPractitionersRouter(service, authorizer);

  return {
    repository,
    service,
    router,
  };
}
