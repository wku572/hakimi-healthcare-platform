import type { Pool } from 'pg';
import { createAppointmentsRouter } from './router.js';
import { createAppointmentRepository } from './repository.js';
import { createAppointmentService } from './service.js';

export function createAppointmentsModule(db: Pick<Pool, 'query' | 'connect'>) {
  const repository = createAppointmentRepository(db);
  const service = createAppointmentService(repository);
  const router = createAppointmentsRouter(service);

  return {
    repository,
    service,
    router,
  };
}
