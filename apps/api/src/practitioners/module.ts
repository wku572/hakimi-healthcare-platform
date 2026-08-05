import type { Pool } from 'pg';
import { createPractitionerRepository } from './repository.js';
import { createPractitionersRouter } from './router.js';
import { createPractitionerService } from './service.js';

export function createPractitionersModule(db: Pick<Pool, 'query' | 'connect'>) {
  const repository = createPractitionerRepository(db);
  const service = createPractitionerService(repository);
  const router = createPractitionersRouter(service);

  return {
    repository,
    service,
    router,
  };
}
