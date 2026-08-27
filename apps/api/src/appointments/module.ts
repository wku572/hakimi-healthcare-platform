import type { Pool } from 'pg';
import { createAppointmentsRouter } from './router.js';
import { createAppointmentRepository } from './repository.js';
import { createAppointmentService } from './service.js';
import { createReminderRepository } from '../reminders/repository.js';
import {
  denyRouteAuthorizer,
  type RouteAuthorizer,
} from '../access/service.js';

export function createAppointmentsModule(
  db: Pick<Pool, 'query' | 'connect'>,
  authorizer: RouteAuthorizer = denyRouteAuthorizer,
) {
  const repository = createAppointmentRepository(db);
  const reminderRepository = createReminderRepository(db);
  const service = createAppointmentService(repository, reminderRepository);
  const router = createAppointmentsRouter(service, authorizer);

  return {
    repository,
    reminderRepository,
    service,
    router,
  };
}
